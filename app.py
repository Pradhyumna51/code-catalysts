import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import tempfile
import subprocess
import glob
import time
import re
import imageio_ffmpeg
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Hackathon ingestion target: allow longer recordings while still protecting the dev server.
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
AUDIO_EXTENSIONS = {"mp3", "wav", "webm", "m4a", "ogg", "flac", "aac", "mp4"}
VIDEO_EXTENSIONS = {"mp4", "mov", "mkv", "avi", "webm", "mpeg", "mpg"}
ALLOWED_EXTENSIONS = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MEETING_PROMPT = """You are an AI delivery analyst that converts meeting transcripts into trustworthy project documents.

Return ONLY valid JSON in this format:

{
  "summary": "clear 2-3 line executive summary",
  "speakers": [
    {
      "speaker": "Speaker 1",
      "role": "inferred role or Unknown",
      "evidence": "short reason for the role inference"
    }
  ],
  "diarized_transcript": [
    {
      "speaker": "Speaker 1",
      "start": "00:00",
      "end": "00:12",
      "text": "what they said"
    }
  ],
  "requirements": [
    {
      "statement": "specific extracted statement",
      "classification": "Firm Requirement | Decision | Action Item | Open Question | Optional Idea",
      "confidence": "High | Medium | Low",
      "owner": "person responsible or Unassigned",
      "deadline": "clear deadline or null",
      "evidence": "short transcript quote or paraphrase"
    }
  ],
  "tasks": [
    {
      "task": "specific actionable task",
      "assignee": "person responsible (or 'Unassigned')",
      "priority": "High | Medium | Low"
    }
  ],
  "deadlines": [
    "clear deadline if mentioned"
  ],
  "scope_of_work": {
    "project_title": "short project name",
    "objective": "business objective",
    "in_scope": ["confirmed deliverable or capability"],
    "out_of_scope": ["explicitly excluded item"],
    "deliverables": ["concrete SOW deliverable"],
    "milestones": [
      {
        "name": "milestone name",
        "deadline": "date or TBD",
        "owner": "owner or Unassigned"
      }
    ],
    "assumptions": ["assumption"],
    "risks": ["risk"],
    "acceptance_criteria": ["measurable completion criterion"],
    "next_steps": ["specific next step"]
  },
  "presentation_deck": {
    "title": "deck title",
    "slides": [
      {
        "title": "slide title",
        "bullets": ["4-6 specific bullets with concrete details"],
        "speaker_notes": "detailed presenter notes with context, rationale, and recommended talk track"
      }
    ]
  },
  "notes": [
    "optional unclear or suggested items"
  ]
}

Rules:
- Do NOT add any text outside JSON
- Tasks and requirements must be specific, actionable, and traceable to the transcript
- Assign names if mentioned, else use "Unassigned"
- Speaker labels can be inferred if names are not present, but do not invent real names
- Use transcript timestamps when available; otherwise use null for start/end
- Be conservative when classifying requirements
- Firm Requirement = committed language such as "must", "need", "required", "live by", "deadline", "contract", "approved", or an explicit stakeholder decision
- Optional Idea = speculative language such as "maybe", "someday", "could also", "nice to have", "explore later", or unclear ownership/timing
- If a statement sounds important but lacks commitment, classify it as Open Question or Optional Idea, not Firm Requirement
- Include evidence for every requirement so users can trust the generated SOW
- Priority rules:
  - High = urgent, immediate, deadlines soon
  - Medium = normal tasks
  - Low = optional or future ideas
- Extract deadlines only if clearly mentioned
- Add unclear or optional ideas in "notes"
- The SOW should only include Firm Requirements, Decisions, and high-confidence Action Items as committed scope
- The deck should be a detailed client-ready presentation generated from the SOW and transcript
- For recordings longer than 10 minutes, generate at least 6 slides; for recordings longer than 20 minutes, generate at least 8 slides when enough content exists
- Recommended deck structure: title/context, current state, business objectives, confirmed requirements, proposed scope, deliverables, milestones/timeline, risks/assumptions, decisions needed, next steps
- Each slide should contain 4-6 concrete bullets, not generic filler
- Speaker notes should be 2-4 sentences and explain what the presenter should emphasize

Transcript:
"""


def get_groq_client(timeout=900.0):
    """Initialize Groq client. Pass a higher timeout for multi-chunk large files."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or "your-groq-api-key" in api_key:
        raise ValueError("Missing GROQ_API_KEY in .env file")
    return Groq(api_key=api_key, timeout=timeout)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def normalize_timestamp(seconds):
    if seconds is None:
        return None
    minutes, secs = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def chunk_text(text, max_chars=35000, overlap=1000):
    """Chunk long transcripts with overlap so extraction keeps continuity."""
    if len(text) <= max_chars:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = max(0, end - overlap)
    return chunks


def build_timed_transcript(transcription):
    segments = getattr(transcription, "segments", None) or []
    if not segments:
        return getattr(transcription, "text", "")

    lines = []
    for segment in segments:
        start = normalize_timestamp(segment.get("start") if isinstance(segment, dict) else getattr(segment, "start", None))
        end = normalize_timestamp(segment.get("end") if isinstance(segment, dict) else getattr(segment, "end", None))
        text = segment.get("text") if isinstance(segment, dict) else getattr(segment, "text", "")
        lines.append(f"[{start or '??'} - {end or '??'}] {text.strip()}")
    return "\n".join(lines)


def call_whisper_with_retry(client, file_tuple, model="whisper-large-v3", max_retries=3):
    """Call Whisper API with intelligent rate limit backoff parsing."""
    for attempt in range(max_retries):
        try:
            return client.audio.transcriptions.create(
                file=file_tuple,
                model=model,
                response_format="verbose_json",
            )
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate limit" in err_str.lower():
                # Extract wait time from error message, e.g., "try again in 2m25s"
                match = re.search(r'try again in (?:(\d+)m)?(?:(\d+)(?:\.\d+)?s)', err_str)
                sleep_time = 60  # Default fallback sleep time
                if match:
                    mins = int(match.group(1)) if match.group(1) else 0
                    secs = int(match.group(2)) if match.group(2) else 0
                    sleep_time = (mins * 60) + secs + 5  # +5s safety buffer
                
                print(f"[transcribe] Rate limit 429 hit. Pausing for {sleep_time} seconds...", flush=True)
                time.sleep(sleep_time)
            else:
                if attempt == max_retries - 1:
                    raise e
                print(f"[transcribe] Whisper API Error: {err_str}. Retrying...", flush=True)
                time.sleep(10)
    raise Exception("Max retries exceeded for Whisper API")


def transcribe_media(file_path):
    """Send an audio/video recording to Groq Whisper. Auto-chunks files > 22MB."""
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)

    if file_size_mb > 22.0:
        # ── Large file: split with ffmpeg then transcribe each chunk ──
        # Use a 5-min per-chunk timeout since each Groq call is independent.
        client = get_groq_client(timeout=300.0)
        full_transcript = []

        with tempfile.TemporaryDirectory() as temp_dir:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            output_pattern = os.path.join(temp_dir, "chunk_%03d.mp3")

            # -map MUST come before codec flags for the segment muxer to work.
            # We also strip video streams explicitly so pure-audio formats don't error.
            cmd = [
                ffmpeg_exe, "-y",
                "-i", file_path,
                "-map", "0:a:0",        # pick the first audio track
                "-f", "segment",
                "-segment_time", "600", # 10-minute chunks
                "-c:a", "libmp3lame",
                "-b:a", "64k",
                output_pattern,
            ]

            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            if result.returncode != 0:
                err_msg = result.stderr.decode("utf-8", errors="replace")[-800:]
                raise RuntimeError(f"ffmpeg failed (code {result.returncode}): {err_msg}")

            chunks = sorted(glob.glob(os.path.join(temp_dir, "chunk_*.mp3")))
            if not chunks:
                raise RuntimeError("ffmpeg produced no chunks — check the input format.")

            for idx, chunk_path in enumerate(chunks):
                print(f"[transcribe] Sending chunk {idx+1}/{len(chunks)} to Whisper...", flush=True)
                with open(chunk_path, "rb") as af:
                    transcription = call_whisper_with_retry(
                        client, 
                        file_tuple=(os.path.basename(chunk_path), af.read())
                    )
                full_transcript.append(f"--- Audio Part {idx + 1} ---")
                full_transcript.append(build_timed_transcript(transcription))

        return "\n".join(full_transcript)

    else:
        # ── Small file: send directly ──
        client = get_groq_client(timeout=120.0)
        with open(file_path, "rb") as af:
            transcription = call_whisper_with_retry(
                client, 
                file_tuple=(os.path.basename(file_path), af.read())
            )
        return build_timed_transcript(transcription)


def call_json_model(prompt, max_retries=2, current_model="llama-3.3-70b-versatile"):
    client = get_groq_client(timeout=900.0)
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You return only valid JSON. No extra text."},
                {"role": "user", "content": prompt}
            ],
            model=current_model,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        return json.loads(chat_completion.choices[0].message.content)
    except Exception as e:
        if max_retries > 0:
            print(f"[transcribe] Model {current_model} failed ({str(e)}). Retrying...", flush=True)
            # Switch to Mixtral on the final fallback if Llama-3.3 keeps failing due to 500 size limits
            next_model = "mixtral-8x7b-32768" if max_retries == 1 else current_model
            return call_json_model(prompt, max_retries - 1, current_model=next_model)
        raise e


def required_slide_count(transcript):
    """Estimate minimum deck depth from transcript size and audio chunk markers."""
    audio_parts = transcript.count("--- Audio Part")
    if audio_parts >= 3 or len(transcript) > 45000:
        return 8
    if audio_parts >= 2 or len(transcript) > 24000:
        return 6
    return 4


def fallback_deck_from_meeting(analysis, min_slides):
    """Create a useful deterministic deck if the LLM compresses the presentation."""
    sow = analysis.get("scope_of_work") or {}
    requirements = analysis.get("requirements") or []
    tasks = analysis.get("tasks") or []
    deadlines = analysis.get("deadlines") or []
    notes = analysis.get("notes") or []

    def take(items, count=5, default="No detail extracted"):
      values = []
      for item in items or []:
          if isinstance(item, str):
              values.append(item)
          elif isinstance(item, dict):
              values.append(item.get("statement") or item.get("task") or item.get("name") or json.dumps(item))
      return (values or [default])[:count]

    slides = [
        {
            "title": "Meeting Context and Objective",
            "bullets": [
                sow.get("project_title") or "Project scope discussion",
                sow.get("objective") or analysis.get("summary") or "Align stakeholders on project direction",
                "Source: uploaded meeting recording",
                "Output generated from transcript, extracted requirements, and SOW structure",
            ],
            "speaker_notes": "Open by framing the discussion and the reason this deck exists. Emphasize that the content is grounded in the uploaded conversation and should be reviewed by stakeholders before sign-off.",
        },
        {
            "title": "Executive Summary",
            "bullets": take([analysis.get("summary")], 1) + take(sow.get("next_steps"), 4),
            "speaker_notes": "Summarize the major themes from the meeting. Use this slide to help the audience understand the decisions, next steps, and why the proposed scope matters.",
        },
        {
            "title": "Confirmed Requirements",
            "bullets": take([r for r in requirements if r.get("classification") == "Firm Requirement"], 6, "No firm requirements extracted"),
            "speaker_notes": "Separate committed requirements from exploratory ideas. This slide should be used as the trust anchor for the proposed scope.",
        },
        {
            "title": "Proposed Scope",
            "bullets": take(sow.get("in_scope"), 6, "No in-scope items extracted"),
            "speaker_notes": "Walk through what the team is committing to deliver. Call out any items that need stakeholder confirmation before implementation begins.",
        },
        {
            "title": "Deliverables",
            "bullets": take(sow.get("deliverables"), 6, "No deliverables extracted"),
            "speaker_notes": "Explain each concrete output expected from the project. Keep the conversation focused on tangible delivery outcomes.",
        },
        {
            "title": "Milestones and Timeline",
            "bullets": take(sow.get("milestones"), 6, "No milestones extracted") + take(deadlines, 2, ""),
            "speaker_notes": "Review target dates, sequencing, and ownership. Highlight deadlines that were explicitly stated in the meeting.",
        },
        {
            "title": "Risks, Assumptions, and Open Questions",
            "bullets": take(sow.get("risks"), 3, "No risks extracted") + take(sow.get("assumptions"), 3, "No assumptions extracted"),
            "speaker_notes": "Use this slide to make uncertainty visible. Clarify which items could affect delivery if they are not resolved early.",
        },
        {
            "title": "Action Items and Next Steps",
            "bullets": take(tasks, 4, "No action items extracted") + take(notes, 2, "No additional notes extracted"),
            "speaker_notes": "Close with ownership and immediate follow-up. This slide should make it clear what happens after the meeting.",
        },
    ]

    return {
        "title": f"{sow.get('project_title') or 'Meeting'} - Project Presentation",
        "slides": slides[:max(min_slides, 1)],
    }


def ensure_deck_depth(analysis, transcript):
    """Expand shallow decks so long meetings do not produce two-slide presentations."""
    min_slides = required_slide_count(transcript)
    deck = analysis.get("presentation_deck") or {}
    slides = deck.get("slides") or []
    if len(slides) >= min_slides:
        return analysis

    deck_prompt = f"""
You are a senior consultant creating a detailed client presentation from a meeting analysis.

Return ONLY valid JSON:
{{
  "presentation_deck": {{
    "title": "client-ready deck title",
    "slides": [
      {{
        "title": "specific slide title",
        "bullets": ["4-6 concrete bullets grounded in the meeting"],
        "speaker_notes": "2-4 sentence presenter talk track"
      }}
    ]
  }}
}}

Rules:
- Generate at least {min_slides} slides.
- Do not collapse multiple topics into one slide.
- Include separate slides for context, objectives, confirmed requirements, proposed scope, deliverables, timeline, risks/assumptions, decisions needed, and next steps when content exists.
- Use only the supplied analysis and transcript excerpts. Do not invent commitments.
- Make slides detailed enough for a hackathon demo and client review.

Meeting analysis JSON:
{json.dumps(analysis)}

Transcript excerpt:
{transcript[:30000]}
"""
    try:
        expanded = call_json_model(deck_prompt, max_retries=1)
        expanded_deck = expanded.get("presentation_deck") or {}
        if len(expanded_deck.get("slides") or []) >= min_slides:
            analysis["presentation_deck"] = expanded_deck
            return analysis
    except Exception as e:
        print(f"[deck] Deck expansion failed: {e}", flush=True)

    analysis["presentation_deck"] = fallback_deck_from_meeting(analysis, min_slides)
    return analysis


def extract_meeting_intelligence(transcript):
    """Extract hackathon deliverables with long-context chunking and final synthesis."""
    chunks = chunk_text(transcript)
    if len(chunks) == 1:
        analysis = call_json_model(MEETING_PROMPT + transcript)
        return ensure_deck_depth(analysis, transcript)

    chunk_outputs = []
    for index, chunk in enumerate(chunks, start=1):
        chunk_outputs.append(call_json_model(
            MEETING_PROMPT
            + f"\nThis is chunk {index} of {len(chunks)}. Extract only items evidenced in this chunk.\n\n"
            + chunk
        ))

    synthesis_prompt = (
        MEETING_PROMPT
        + "\nSynthesize these chunk-level JSON analyses into one de-duplicated final output. "
        + "Preserve firm-vs-optional distinctions, keep evidence, and do not promote speculative ideas into committed scope. "
        + "Build a detailed presentation deck from the full meeting, not just the highest-level summary; include at least 8 slides when the chunk analyses contain enough material.\n\n"
        + json.dumps(chunk_outputs)
    )
    analysis = call_json_model(synthesis_prompt)
    return ensure_deck_depth(analysis, transcript)


@app.route("/", methods=["GET"])
def index():
    return '''
    <!doctype html>
    <html>
    <head>
        <title>Meeting Notes AI</title>
        <style>
            body { font-family: sans-serif; padding: 40px; background: #f4f7f6; }
            .container { max-width: 500px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: auto; }
            h2 { color: #333; margin-top: 0; }
            p { color: #666; font-size: 14px; }
            form { border: 2px dashed #ccc; padding: 20px; border-radius: 8px; text-align: center; }
            input[type="submit"] { background: #f55036; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 15px; font-weight: bold; }
            input[type="submit"]:hover { background: #d4442e; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Meeting Scope AI</h2>
            <p>Upload an audio/video recording &rarr; get diarisation, SOW, deck, and requirement classification.</p>
            <form action="/upload" method="post" enctype="multipart/form-data">
              <input type="file" name="file" accept="audio/*,video/*" required><br>
              <input type="submit" value="Upload & Analyze">
            </form>
        </div>
    </body>
    </html>
    '''


@app.route("/upload", methods=["POST"])
def upload_media():
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Upload a common audio/video file such as .mp3, .wav, .webm, .m4a, .ogg, .flac, .mp4, .mov, or .mkv"}), 400

    safe_filename = secure_filename(file.filename)
    save_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    file.save(save_path)

    try:
        # Step 1: Transcribe audio/video with timestamps for downstream diarisation.
        transcript = transcribe_media(save_path)

        # Step 2: Extract SOW, deck, speaker turns, and requirement classifications.
        meeting_notes = extract_meeting_intelligence(transcript)

        return jsonify({
            "success": True,
            "filename": safe_filename,
            "transcript": transcript,
            "meeting_notes": meeting_notes
        }), 200

    except Exception as e:
        err = str(e)
        if "timed out" in err.lower() or "timeout" in err.lower():
            return jsonify({"error": "Processing timed out. Try a shorter recording or split the file into parts."}), 504
        return jsonify({"error": f"Processing failed: {err}"}), 500


@app.errorhandler(413)
def file_too_large(e):
    return jsonify({"error": "File too large. Maximum upload size is 500 MB."}), 413


if __name__ == "__main__":
    app.run(debug=True, port=5000)
