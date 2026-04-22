import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  Loader2,
  Menu,
  Mic,
  Presentation,
  Square,
  Trash2,
  UploadCloud,
  Wand2,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import ParticleNetwork from './ParticleNetwork';
import LandingPage from './LandingPage';
import './App.css';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: BarChart3 },
  { label: 'Scopes of Work', icon: FileText },
  { label: 'Presentations', icon: Presentation },
  { label: 'Action Items', icon: CheckSquare },
  { label: 'Timeline', icon: CalendarDays },
  { label: 'Archive', icon: Archive },
];

const STORAGE_KEY = 'ai_meeting_history_sow';

function loadMeetings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveMeetings(meetings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}

function exportSOWtoPDF(m) {
  if (!m || !m.scope_of_work) return;
  const sow = m.scope_of_work;
  const doc = new jsPDF();
  
  let y = 20;
  const lh = 7, mg = 20, ph = doc.internal.pageSize.height;
  const chk = (h) => { if (y + h > ph - mg) { doc.addPage(); y = 20; } };

  const addHeader = (text, size = 16, pt = 10) => {
    chk(20);
    y += pt;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.text(text, mg, y);
    y += lh;
  };

  const addBullets = (list) => {
    if (!list || list.length === 0) return;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    list.forEach(item => {
      const text = typeof item === 'string' ? item : JSON.stringify(item);
      const w = doc.splitTextToSize(`• ${text}`, 170);
      chk(w.length * lh);
      doc.text(w, mg, y);
      y += w.length * lh + 2;
    });
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(sow.project_title || 'Scope of Work', mg, y);
  y += 10;
  
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date(m.id).toLocaleString()}`, mg, y);
  y += 15;

  if (sow.objective) {
    addHeader('Objective', 14, 0);
    doc.setFont('helvetica', 'normal');
    const w = doc.splitTextToSize(sow.objective, 170);
    doc.text(w, mg, y);
    y += w.length * lh + 5;
  }

  if (sow.deliverables?.length) {
    addHeader('Deliverables', 14);
    addBullets(sow.deliverables);
  }

  if (sow.in_scope?.length) {
    addHeader('In Scope', 14);
    addBullets(sow.in_scope);
  }

  if (sow.out_of_scope?.length) {
    addHeader('Out of Scope', 14);
    addBullets(sow.out_of_scope);
  }

  if (sow.milestones?.length) {
    addHeader('Key Milestones', 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    sow.milestones.forEach(ms => {
      const msText = `- ${ms.name} (Owner: ${ms.owner || 'Unassigned'}) - Target: ${ms.deadline || 'TBD'}`;
      const w = doc.splitTextToSize(msText, 170);
      chk(w.length * lh);
      doc.text(w, mg, y);
      y += w.length * lh + 2;
    });
  }

  if (sow.assumptions?.length) {
    addHeader('Assumptions', 14);
    addBullets(sow.assumptions);
  }
  
  if (sow.risks?.length) {
    addHeader('Risks', 14);
    addBullets(sow.risks);
  }

  doc.save(`${(sow.project_title || 'scope_of_work').replace(/\s+/g, '_').toLowerCase()}.pdf`);
}

function SOWView({ meetings, onExportPDF, onArchive }) {
  if (meetings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><FileText size={32} /></div>
        <h3 className="empty-title">No Scopes of Work generated</h3>
        <p className="empty-desc">Record a meeting outlining deliverable objectives.</p>
      </div>
    );
  }

  return (
    <div className="sow-list">
      {meetings.map(m => {
        const sow = m.scope_of_work || {};
        if (!sow.project_title) return null;

        return (
          <div key={m.id} className="sow-card">
            <div className="sow-header">
              <div>
                <h2 className="sow-title">{sow.project_title}</h2>
                <p className="sow-meta">From audio: {m.filename} • {new Date(m.id).toLocaleDateString()}</p>
              </div>
              <div className="sow-actions">
                <button onClick={() => onArchive(m.id)} className="btn-secondary">
                  <Archive size={16} /> Archive
                </button>
                <button onClick={() => onExportPDF(m)} className="btn-primary">
                  <Download size={16} /> Export PDF
                </button>
              </div>
            </div>
            
            <div className="sow-body">
              <div className="sow-section full-width">
                <h3 className="section-label">Objective</h3>
                <p>{sow.objective}</p>
              </div>

              <div className="sow-section">
                <h3 className="section-label success">In Scope & Deliverables</h3>
                <div className="sow-list-ui">
                  {(sow.deliverables || []).map((d, i) => (
                    <div key={i} className="sow-list-item">
                      <span className="item-bullet success">•</span> {d}
                    </div>
                  ))}
                  {(sow.in_scope || []).map((d, i) => (
                    <div key={i} className="sow-list-item">
                      <CheckCircle2 size={16} className="item-bullet success" /> {d}
                    </div>
                  ))}
                </div>
              </div>

              <div className="sow-section">
                <h3 className="section-label danger">Out of Scope & Risks</h3>
                <div className="sow-list-ui">
                  {(sow.out_of_scope || []).map((d, i) => (
                    <div key={i} className="sow-list-item">
                      <span className="item-bullet danger">×</span> {d}
                    </div>
                  ))}
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                    {(sow.risks || []).map((d, i) => (
                      <div key={i} className="sow-list-item">
                        <span className="item-bullet warning">⚠</span> {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {sow.milestones?.length > 0 && (
                <div className="sow-section full-width table-wrapper">
                  <h3 className="section-label accent">Timeline / Milestones</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Milestone</th>
                        <th>Deadline</th>
                        <th>Owner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sow.milestones.map((ms, i) => (
                        <tr key={i}>
                          <td>{ms.name}</td>
                          <td style={{ fontWeight: 600 }}>{ms.deadline}</td>
                          <td><span className="badge-default">{ms.owner}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <details className="sow-details">
                <summary>
                  <span>Full Meeting Transcription</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {m.transcript ? `${m.transcript.length.toLocaleString()} chars` : 'No transcript'}
                    <ChevronDown size={14} style={{ marginLeft: '8px', verticalAlign: 'middle' }} />
                  </span>
                </summary>
                <div className="sow-details-content">
                  {m.transcript ? (
                    <div className="transcript-box">{m.transcript}</div>
                  ) : (
                    <div className="transcript-box" style={{ color: 'var(--text-muted)' }}>
                      No transcription was saved for this meeting.
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PresentationsView({ meetings, showToast }) {
  if (meetings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Presentation size={32} /></div>
        <h3 className="empty-title">No presentations generated</h3>
        <p className="empty-desc">Record a meeting to auto-generate slide decks.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      {meetings.map((m) => {
        const deck = m.presentation_deck;
        if (!deck || !deck.slides) return null;

        return (
          <div key={m.id}>
            <div className="deck-title-area">
              <h2 className="deck-title">{deck.title}</h2>
              <p className="deck-subtitle">Generated from {m.filename}</p>
            </div>
            
            <div className="slides-grid">
              {deck.slides.map((slide, idx) => (
                <div key={idx} className="slide-card">
                  <div className="slide-visual">
                    <div className="slide-glow"></div>
                    <h3 className="slide-title">{slide.title}</h3>
                    <ul className="slide-content">
                      {(slide.bullets || []).map((b, i) => (
                        <li key={i}>
                          <span style={{ color: 'var(--accent-color)' }}>•</span> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="slide-notes-area">
                    <div className="slide-notes-header">
                      <span className="slide-notes-label">Speaker Notes</span>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(slide.speaker_notes); showToast("Copied speaker notes!"); }}
                        className="btn-icon"
                        title="Copy to clipboard"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="slide-notes-text">"{slide.speaker_notes}"</p>
                  </div>
                  <div className="slide-footer">
                    <span className="slide-number">Slide {idx + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionItemsView({ meetings, showToast, onToggleDone }) {
  const allTasks = meetings.flatMap((m) =>
    (m.tasks || []).map((t, taskIndex) => ({
      ...t,
      meetingId: m.id,
      meetingName: m.filename,
      meetingDate: m.id,
      taskIndex,
      taskText: typeof t === 'string' ? t : t.task,
      assignee: typeof t === 'string' ? 'Unassigned' : (t.assignee || 'Unassigned'),
      priority: typeof t === 'string' ? 'Medium' : (t.priority || 'Medium'),
      done: typeof t === 'string' ? false : Boolean(t.done),
    }))
  );

  const grouped = {
    High: allTasks.filter((t) => t.priority === 'High' && !t.done),
    Medium: allTasks.filter((t) => t.priority === 'Medium' && !t.done),
    Low: allTasks.filter((t) => t.priority === 'Low' && !t.done),
    Done: allTasks.filter((t) => t.done),
  };
  const completedCount = grouped.Done.length;

  if (allTasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><CheckSquare size={32} /></div>
        <h3 className="empty-title">No action items yet</h3>
        <p className="empty-desc">Process a meeting to extract tasks and action items.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="action-items-header">
        <h2 className="action-items-title">All Action Items</h2>
        <div className="action-stats">
          <span className="stat-tag stat-done">{completedCount} done</span>
          <span className="stat-tag stat-open">{allTasks.length - completedCount} open</span>
        </div>
      </div>
      
      {['High', 'Medium', 'Low', 'Done'].map((level) => {
        if (grouped[level].length === 0) return null;
        return (
          <div key={level}>
            <div className={`task-group-badge ${level}`}>
              {level === 'Done' ? 'Completed' : `${level} Priority`} - {grouped[level].length}
            </div>
            <div className="task-list">
              {grouped[level].map((t, i) => (
                <div key={`${t.meetingId}-${t.taskIndex}-${i}`} className={`task-item ${t.done ? 'done' : ''}`}>
                  <button
                    onClick={() => onToggleDone(t.meetingId, t.taskIndex)}
                    className="task-check-btn"
                    title={t.done ? 'Mark as open' : 'Mark as done'}
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <div className="task-body">
                    <p className="task-text">{t.taskText}</p>
                    <div className="task-meta">
                      <button
                        onClick={() => onToggleDone(t.meetingId, t.taskIndex)}
                        className="task-btn-action"
                      >
                        {t.done ? 'Reopen' : 'Mark done'}
                      </button>
                      <button 
                        onClick={() => { navigator.clipboard.writeText(t.taskText); showToast("Copied task to clipboard!"); }}
                        className="btn-icon"
                        title="Copy task"
                      >
                        <Copy size={14} />
                      </button>
                      <span className="task-assignee">{t.assignee}</span>
                      <span className="task-source">from · {t.meetingName}</span>
                      <span className="task-source">· {new Date(t.meetingDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({ meetings }) {
  const allDeadlines = meetings.flatMap((m) => {
    const milestones = m.scope_of_work?.milestones || [];
    return milestones.map((ms) => ({
      date: ms.deadline,
      text: ms.name + (ms.owner && ms.owner !== 'Unassigned' ? ` (Assigned to: ${ms.owner})` : ''),
      meetingName: m.filename,
      meetingId: m.id
    }));
  });

  if (allDeadlines.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><CalendarDays size={32} /></div>
        <h3 className="empty-title">No deadlines found</h3>
        <p className="empty-desc">Process meetings that mention specific dates or deadlines.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="timeline-header">
        <h2 className="timeline-title">Full Deadline Timeline</h2>
        <span className="timeline-badge">{allDeadlines.length} deadlines</span>
      </div>
      <div className="timeline-list">
        {allDeadlines.map((d, i) => (
          <div key={i} className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-card">
              {d.date && <span className="timeline-date">{d.date}</span>}
              <p className="timeline-text">{d.text}</p>
              <p className="timeline-subtext">
                From: {d.meetingName} · {new Date(d.meetingId).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingTimelinesView({ meetings }) {
  const meetingsWithDeadlines = meetings
    .map((meeting) => ({
      ...meeting,
      milestones: meeting.scope_of_work?.milestones || [],
    }))
    .filter((meeting) => meeting.milestones.length > 0);

  if (meetingsWithDeadlines.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><CalendarDays size={32} /></div>
        <h3 className="empty-title">No deadlines found</h3>
        <p className="empty-desc">Process meetings that mention specific dates or deadlines.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="timeline-header">
        <h2 className="timeline-title">Meeting Timelines</h2>
        <span className="timeline-badge">{meetingsWithDeadlines.length} meetings</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {meetingsWithDeadlines.map((meeting) => (
          <div key={meeting.id} className="timeline-meeting-card">
            <div className="timeline-meeting-header">
              <div>
                <h3 className="timeline-meeting-title">{meeting.scope_of_work?.project_title || meeting.filename}</h3>
                <p className="timeline-subtext">
                  {meeting.filename} - {new Date(meeting.id).toLocaleDateString()}
                </p>
              </div>
              <span className="timeline-badge">{meeting.milestones.length} milestones</span>
            </div>

            <div className="timeline-list">
              {meeting.milestones.map((ms, i) => (
                <div key={i} className="timeline-item">
                  <span className="timeline-dot" />
                  <div className="timeline-card">
                    {ms.deadline && <span className="timeline-date">{ms.deadline}</span>}
                    <p className="timeline-text">
                      {ms.name}
                      {ms.owner && ms.owner !== 'Unassigned' ? ` (Assigned to: ${ms.owner})` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArchiveView({ archivedMeetings, onRestore, onPermanentDelete }) {
  if (archivedMeetings.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Archive size={32} /></div>
        <h3 className="empty-title">Archive is empty</h3>
        <p className="empty-desc" style={{ maxWidth: '400px' }}>
          Meetings you delete will appear here. You can restore them or permanently delete them later.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="archive-header">
        <h2 className="archive-title">Archived Meetings</h2>
      </div>
      <div className="archive-list">
        {archivedMeetings.map(m => (
          <div key={m.id} className="archive-card">
            <div>
              <p className="archive-info-title">{m.scope_of_work?.project_title || m.filename}</p>
              <p className="archive-info-date">Archived • {new Date(m.id).toLocaleDateString()}</p>
            </div>
            <div className="archive-actions">
              <button onClick={() => onRestore(m.id)} className="btn-restore">Restore</button>
              <button onClick={() => onPermanentDelete(m.id)} className="btn-delete">
                <Trash2 size={16} /> Delete Permanently
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [meetings, setMeetings] = useState(loadMeetings);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showLanding, setShowLanding] = useState(true);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const archiveMeeting = (id) => {
    const updated = meetings.map(m => m.id === id ? { ...m, isArchived: true } : m);
    setMeetings(updated);
    saveMeetings(updated);
    showToast("Meeting moved to archive");
  };

  const removeMeetingPermanent = (id) => {
    const updated = meetings.filter(m => m.id !== id);
    setMeetings(updated);
    saveMeetings(updated);
    showToast("Meeting permanently deleted");
  };

  const restoreMeeting = (id) => {
    const updated = meetings.map(m => m.id === id ? { ...m, isArchived: false } : m);
    setMeetings(updated);
    saveMeetings(updated);
    showToast("Meeting restored to active");
  };

  const toggleTaskDone = (meetingId, taskIndex) => {
    const updated = meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;

      const tasks = (meeting.tasks || []).map((task, index) => {
        if (index !== taskIndex) return task;
        if (typeof task === 'string') {
          return { task, assignee: 'Unassigned', priority: 'Medium', done: true };
        }
        return { ...task, done: !task.done };
      });

      return { ...meeting, tasks };
    });

    setMeetings(updated);
    saveMeetings(updated);
    showToast("Task status updated");
  };

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    saveMeetings(meetings);
  }, [meetings]);

  const processAudioFile = async (currentFile) => {
    if (!currentFile) return;
    setIsLoading(true); setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
      const formData = new FormData();
      formData.append('file', currentFile);
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('The backend returned an empty response. The upload may have timed out or the Flask server may have stopped while processing.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        const preview = responseText.slice(0, 180).replace(/\s+/g, ' ');
        throw new Error(`The backend returned a non-JSON response: ${preview || 'empty body'}`);
      }
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      const mn = data.meeting_notes || {};
      const newMeeting = {
        id: Date.now(),
        filename: currentFile.name,
        transcript: data.transcript || '',
        summary: mn.summary || 'No summary generated.',
        scope_of_work: mn.scope_of_work || null,
        presentation_deck: mn.presentation_deck || null,
        tasks: (mn.tasks || []).map((task) => (
          typeof task === 'string'
            ? { task, assignee: 'Unassigned', priority: 'Medium', done: false }
            : { ...task, done: false }
        )),
        timeline: mn.deadlines || [],
        notes: mn.notes || [],
      };
      
      setMeetings((prev) => [newMeeting, ...prev]);
      setActiveTab('Scopes of Work');
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request cancelled or timed out. Please try a shorter file or check the server is running.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      clearTimeout(timeout);
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const cancelProcessing = () => {
    abortControllerRef.current?.abort();
  };

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) processAudioFile(selectedFile);
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) processAudioFile(e.dataTransfer.files[0]);
  };

  const toggleRecording = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        processAudioFile(recordedFile);
      };
      mr.start();
      setIsRecording(true); setError(null);
    } catch {
      setError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const activeMeetings = meetings.filter(m => !m.isArchived);
  const archivedMeetings = meetings.filter(m => m.isArchived);

  const Sidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-icon-wrap"><Wand2 size={20} /></div>
        <div>
          <p className="sidebar-title">CHRONOS-SOW</p>
          <p className="sidebar-subtitle">Meeting-to-Artifact Automator</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => { setActiveTab(label); setSidebarOpen(false); }}
            className={`nav-item ${activeTab === label ? 'active' : ''}`}
          >
            <Icon size={20} />
            {label}
            {label !== 'Dashboard' && label !== 'Archive' && label !== 'Action Items' && activeMeetings.length > 0 && (
              <span className="nav-badge">{activeMeetings.length}</span>
            )}
            {label === 'Action Items' && (
              <span className="nav-badge">
                {activeMeetings.reduce((a, m) => a + (m.tasks || []).filter((task) => typeof task === 'string' || !task.done).length, 0)}
              </span>
            )}
            {label === 'Archive' && archivedMeetings.length > 0 && (
              <span className="nav-badge">{archivedMeetings.length}</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );

  const DashboardContent = () => {
    const [loadingTextIdx, setLoadingTextIdx] = useState(0);
    const loadingTexts = [
      "Transcribing audio footprint...",
      "Extracting action items & deadlines...",
      "Synthesizing Scope of Work...",
      "Generating slide decks...",
      "Finalizing documentation..."
    ];

    useEffect(() => {
      if (isLoading) {
        const int = setInterval(() => setLoadingTextIdx((prev) => (prev + 1) % loadingTexts.length), 4000);
        return () => clearInterval(int);
      }
    }, [isLoading]);

    return (
      <div className="content-container centered">
        <div className="dashboard-header">
          <h1>CHRONOS-SOW<br /><span style={{ fontSize: '22px', fontWeight: 600, opacity: 0.7 }}>MEETING-TO-ARTIFACT AUTOMATOR</span></h1>
          <p>Drop a file or start recording. Documentation is generated automatically.</p>
        </div>

        {isLoading ? (
          <div className="loading-panel">
            <div className="loading-glow"></div>
            <Loader2 size={48} className="spinner" />
            <h2 className="loading-title">{loadingTexts[loadingTextIdx]}</h2>
            <p className="loading-subtitle">Large media files mapped against 70B models may take several minutes.</p>
            <button onClick={cancelProcessing} className="btn-cancel">Cancel Process</button>
          </div>
        ) : (
          <div className="dashboard-grid">
            <div 
              className="glass-panel upload-zone"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*,video/*" style={{ display: 'none' }} />
              <div className="upload-icon"><UploadCloud size={32} /></div>
              <p className="upload-title">Drag & drop media file</p>
              <p className="upload-subtitle">Auto-processes: MP4, MOV, WAV, MP3</p>
            </div>

            <div className={`glass-panel record-panel ${isRecording ? 'recording' : ''}`}>
              {isRecording && (
                <>
                  <div className="rec-pulse-overlay" />
                  <div className="rec-ring-1" />
                  <div className="rec-ring-2" />
                  <div className="waveform-bg">
                    <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                    <div className="bar"></div><div className="bar"></div><div className="bar"></div>
                    <div className="bar"></div>
                  </div>
                </>
              )}
              
              <button 
                onClick={toggleRecording}
                className={`record-btn ${isRecording ? 'recording' : ''}`}
              >
                {isRecording ? <Square size={32} fill="currentColor" /> : <Mic size={32} />}
              </button>
              <p className="upload-title" style={{ marginTop: '24px', zIndex: 10 }}>
                {isRecording ? 'Recording in progress...' : 'Record meeting live'}
              </p>
              <p className="upload-subtitle" style={{ zIndex: 10 }}>
                {isRecording ? 'Click to stop and auto-process' : 'Uses native browser microphone'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="error-panel">
            <p className="error-title">Processing Error</p>
            <p className="error-desc">{error}</p>
            <button onClick={() => setError(null)} className="btn-dismiss">Dismiss & Try Again</button>
          </div>
        )}
      </div>
    );
  };

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-mobile">
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
          <div style={{ position: 'relative', zIndex: 50, height: '100%' }}>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="sidebar-desktop">
        <Sidebar />
      </div>

      <div className="main-wrapper">
        <ParticleNetwork />
        <header className="topbar">
          <div className="topbar-left">
            <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn">
              <Menu size={24} />
            </button>
            <div className="page-heading" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '6px', height: '24px', backgroundColor: 'var(--accent-color)', borderRadius: '4px', boxShadow: 'var(--shadow-glow)' }}></div>
              <h1 className="page-title" style={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>{activeTab}</h1>
            </div>
          </div>
        </header>

        <main className="content-area">
          {toastMessage && (
            <div className="toast-container">
              <div className="toast-box">
                <CheckCircle2 size={20} className="toast-icon" />
                <p className="toast-text">{toastMessage}</p>
              </div>
            </div>
          )}

          <div className="content-container">
            {activeTab === 'Dashboard' && <DashboardContent />}
            {activeTab === 'Scopes of Work' && <SOWView meetings={activeMeetings} onExportPDF={exportSOWtoPDF} onArchive={archiveMeeting} />}
            {activeTab === 'Presentations' && <PresentationsView meetings={activeMeetings} showToast={showToast} />}
            {activeTab === 'Action Items' && <ActionItemsView meetings={activeMeetings} showToast={showToast} onToggleDone={toggleTaskDone} />}
            {activeTab === 'Timeline' && <MeetingTimelinesView meetings={activeMeetings} />}
            {activeTab === 'Archive' && <ArchiveView archivedMeetings={archivedMeetings} onRestore={restoreMeeting} onPermanentDelete={removeMeetingPermanent} />}
          </div>
        </main>
      </div>
    </div>
  );
}
