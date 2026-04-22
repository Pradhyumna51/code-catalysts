# 🌌 CHRONOS-SOW: Meeting-to-Artifact Automator

**Transform any meeting recording into structured project documentation in minutes.**

CHRONOS-SOW is a high-performance AI intelligence dashboard designed to bridge the gap between "meeting minutes" and "actionable project management." It ingests audio or video recordings and automatically synthesizes a full suite of project artifacts, allowing teams to focus on execution rather than documentation.

---

## ✨ Key Features

- **🎙️ multi-modal Ingestion:** Record live meetings directly in the browser or upload existing media files (MP4, MOV, WAV, MP3).
- **📝 Automated Scope of Work (SOW):** Generates professional SOWs including Project Objectives, Deliverables (In/Out of Scope), Key Milestones, and Risk Analysis.
- **📊 Presentation Engine:** Automatically crafts slide decks based on meeting transcripts, complete with speaker notes for immediate client-facing use.
- **✅ Intelligent Action Tracking:** Extracts tasks, assigns priorities (High/Medium/Low), and tracks owners automatically.
- **📅 Visual Timeline:** Aggregates all detected deadlines and milestones into a unified project timeline.
- **📁 Meeting Archive:** Securely store and manage past meeting intelligence with restore/delete capabilities.
- **📄 PDF Export:** One-click conversion of generated SOWs into professional PDF documents.

---

## 🎨 Design Philosophy: "Corporate Innovation"

The UI is built with a premium, state-of-the-art aesthetic:
- **Deep Charcoal Palette:** Low-strain, high-contrast professional dark mode.
- **Electric Blue Accents:** Dynamic glows, active states, and interactive feedback.
- **Glassmorphism:** Deep backdrop blurs and 1px reflection borders for a premium depth effect.
- **Interactive Particle Network:** A custom Canvas-based geometric background that reacts to cursor movement.
- **Rich Micro-animations:** Pulse effects, gradient shifts, and smooth transitions that make the app feel alive.

---

## 🛠️ Tech Stack

### Frontend
- **React 18** (Vite-based)
- **Vanilla CSS** (No utility frameworks, bespoke design system)
- **Lucide React** (Iconography)
- **jsPDF** (PDF Generation)
- **HTML5 Canvas** (Particle Network)

### Backend
- **Python / Flask**
- **OpenAI Whisper** (Speech-to-Text)
- **Advanced LLMs** (Meeting Analysis & Artifact Synthesis)

---

## 🚀 Getting Started

### Prerequisites
- Node.js & npm
- Python 3.10+
- FFmpeg (for audio processing)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd meeting_hackathon
   ```

2. **Setup Backend:**
   ```bash
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   ```

3. **Setup Frontend:**
   ```bash
   cd frontend/ai-meeting-notes
   npm install
   ```

### Running the App

1. **Start the Backend:**
   ```bash
   # From the root directory
   python app.py
   ```

2. **Start the Frontend:**
   ```bash
   # In a new terminal, from frontend/ai-meeting-notes
   npm run dev
   ```

---

## 📖 Usage

1. **Landing Page:** Enter the dashboard via the high-tech landing page.
2. **Ingest Media:** Click the **Upload Zone** to drop a file or use the **Microphone** to record live.
3. **Artifact Generation:** Wait for the AI pipeline to transcribe and analyze.
4. **Review & Export:** Navigate through the sidebar tabs to review your SOW, Slides, and Tasks. Use "Export PDF" on the SOW tab for distribution.

---

Developed for the **AI Meeting Intelligence Hackathon**. 
