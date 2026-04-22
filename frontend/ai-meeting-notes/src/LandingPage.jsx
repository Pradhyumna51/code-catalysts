import { useState, useEffect } from 'react';
import { FileText, Mic, Presentation, CheckSquare, Zap, ArrowRight, Shield } from 'lucide-react';
import ParticleNetwork from './ParticleNetwork';
import './LandingPage.css';

const FEATURES = [
  {
    icon: Mic,
    title: 'Audio Intelligence',
    desc: 'Record live or upload any media file. Whisper-powered transcription with speaker diarization.',
    color: '#00A3FF',
  },
  {
    icon: FileText,
    title: 'SOW Generation',
    desc: 'Auto-generate Scope of Work documents with requirements, milestones, and risk analysis.',
    color: '#8B5CF6',
  },
  {
    icon: Presentation,
    title: 'Slide Decks',
    desc: 'Client-ready presentations with speaker notes, generated directly from your meeting transcript.',
    color: '#06D6A0',
  },
  {
    icon: CheckSquare,
    title: 'Action Tracking',
    desc: 'Extract, prioritize, and assign tasks automatically. Track completion across all meetings.',
    color: '#F472B6',
  },
];

const STATS = [
  { value: '70B', label: 'Parameter LLM' },
  { value: '<5m', label: 'Processing Time' },
  { value: '100%', label: 'Automated' },
  { value: 'PDF', label: 'Export Ready' },
];

export default function LandingPage({ onEnter }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(() => onEnter(), 600);
  };

  return (
    <div className={`landing-root ${visible ? 'visible' : ''} ${exiting ? 'exiting' : ''}`}>
      <ParticleNetwork />

      {/* Ambient glow orbs */}
      <div className="landing-orb orb-1"></div>
      <div className="landing-orb orb-2"></div>
      <div className="landing-orb orb-3"></div>

      <div className="landing-scroll-area">
        {/* Hero Section */}
        <section className="landing-hero">
          <div className="hero-badge">
            <Zap size={14} />
            <span>AI-Powered Meeting Intelligence</span>
          </div>

          <h1 className="hero-title">
            <span className="hero-title-main">CHRONOS-SOW</span>
            <span className="hero-title-sub">Meeting-to-Artifact Automator</span>
          </h1>

          <p className="hero-desc">
            Transform any meeting recording into structured project documentation — 
            Scope of Work, slide decks, action items, and timelines — in under five minutes.
          </p>

          <div className="hero-actions">
            <button className="hero-cta" onClick={handleEnter}>
              <span>Launch Dashboard</span>
              <ArrowRight size={20} />
            </button>
          </div>

          {/* Stats row */}
          <div className="hero-stats">
            {STATS.map((s, i) => (
              <div key={i} className="stat-block">
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="landing-features">
          <h2 className="features-heading">One Upload. Four Deliverables.</h2>
          <p className="features-subheading">
            Every meeting becomes actionable project artifacts, automatically.
          </p>

          <div className="features-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i} 
                  className="feature-card"
                  style={{ '--feature-color': f.color }}
                >
                  <div className="feature-icon-wrap">
                    <Icon size={24} />
                  </div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pipeline visual */}
        <section className="landing-pipeline">
          <h2 className="pipeline-heading">The Pipeline</h2>
          <div className="pipeline-steps">
            {['Upload / Record', 'Whisper Transcription', 'LLM Extraction', 'SOW + Deck + Tasks'].map((step, i) => (
              <div key={i} className="pipeline-step">
                <div className="pipeline-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="pipeline-label">{step}</div>
                {i < 3 && <div className="pipeline-connector"></div>}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="landing-bottom-cta">
          <div className="bottom-cta-card">
            <Shield size={32} className="bottom-cta-icon" />
            <h2>Ready to automate your meeting workflow?</h2>
            <p>No signup required. Process your first meeting in minutes.</p>
            <button className="hero-cta" onClick={handleEnter}>
              <span>Get Started</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
