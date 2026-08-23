import { useState, useEffect } from 'react'
import {
  Smartphone, Coins, ShieldAlert, FileText,
  Scale, Brain, Sparkles, Search, User,
  Play, Pause, RotateCcw, X, HelpCircle
} from 'lucide-react'

function EventTypeIcon({ type, size = 13 }) {
  switch (type) {
    case 'cdr':         return <Smartphone size={size} color="#52e07a" />
    case 'financial':   return <Coins size={size} color="#52e0cc" />
    case 'arrest':      return <ShieldAlert size={size} color="#e05252" />
    case 'fir':         return <FileText size={size} color="var(--copper-400)" />
    case 'chargesheet': return <Scale size={size} color="#b452e0" />
    case 'ai_inferred': return <Brain size={size} color="var(--copper-400)" />
    default:            return <HelpCircle size={size} color="var(--text-muted)" />
  }
}

export default function AITimelineReconstruction({ data, onClose }) {
  const { events = [], narrative_summary = '', verdict_prediction = '' } = data
  
  const [isPlaying, setIsPlaying] = useState(true)
  const [visibleCount, setVisibleCount] = useState(1)
  const [speed, setSpeed] = useState(1000) // ms per event

  useEffect(() => {
    if (!isPlaying || visibleCount >= events.length) return
    const timer = setTimeout(() => {
      setVisibleCount(v => Math.min(events.length, v + 1))
    }, speed)
    return () => clearTimeout(timer)
  }, [isPlaying, visibleCount, events, speed])

  const getEventBorderColor = (type) => {
    return type === 'ai_inferred' ? 'var(--copper-500)' : 'var(--border-strong)'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,7,10,0.96)', zIndex: 10000,
      display: 'flex', flexDirection: 'column', padding: 24, overflow: 'hidden',
      color: 'var(--text-primary)', animation: 'fade-in 0.25s ease'
    }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} />
            <span>Forensic Case Timeline Reconstruction</span>
          </h2>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            AI-Inferred Chronology &amp; Evidence Cross-Matching Summary
          </div>
        </div>
        <button
          className="btn btn-sm"
          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={onClose}
        >
          <X size={14} />
          <span>Close Player</span>
        </button>
      </div>

      {/* Playback Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-overlay)', padding: '10px 18px', borderRadius: 30, width: 'fit-content', margin: '0 auto 20px', border: '1px solid var(--border-default)' }}>
        <button
          className="btn btn-sm btn-copper"
          style={{ padding: '6px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setIsPlaying(!isPlaying)}
        >
          {isPlaying ? (
            <>
              <Pause size={12} />
              <span>Pause Timeline</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>Play Reconstruction</span>
            </>
          )}
        </button>

        <button
          className="btn btn-sm"
          style={{ padding: '6px 12px', borderRadius: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={() => { setVisibleCount(1); setIsPlaying(true); }}
        >
          <RotateCcw size={12} />
          <span>Restart</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Speed:</span>
          {[2000, 1000, 500].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                background: speed === s ? 'var(--copper-500)' : 'transparent',
                color: speed === s ? '#000' : 'var(--text-secondary)',
                border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer', fontWeight: 600
              }}
            >
              {s === 2000 ? '0.5x' : s === 1000 ? '1x' : '2x'}
            </button>
          ))}
        </div>

        <div className="mono" style={{ fontSize: 11, color: 'var(--copper-400)', fontWeight: 700 }}>
          {visibleCount} / {events.length} Events Unfolded
        </div>
      </div>

      {/* Main Horizontal Timeline Display */}
      <div style={{
        flex: 1, overflowX: 'auto', display: 'flex', alignItems: 'center',
        padding: '40px 20px', gap: 24, position: 'relative'
      }}>
        {/* Central timeline track line */}
        <div style={{
          position: 'absolute', top: '50%', left: 20, right: 20, height: 2,
          background: 'linear-gradient(90deg, var(--copper-500), var(--border-strong))',
          transform: 'translateY(-50%)', zIndex: 1
        }} />

        {events.slice(0, visibleCount).map((ev, index) => (
          <div
            key={index}
            style={{
              flexShrink: 0, width: 260, background: 'var(--bg-card)',
              border: `1px solid ${getEventBorderColor(ev.event_type)}`,
              borderRadius: 8, padding: 14, position: 'relative', zIndex: 10,
              boxShadow: ev.event_type === 'ai_inferred' ? '0 0 15px rgba(200,129,74,0.3)' : '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 8,
              animation: 'fade-in 0.3s ease'
            }}
          >
            {/* Timeline node marker point */}
            <div style={{
              position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              width: 10, height: 10, borderRadius: '50%',
              background: ev.event_type === 'ai_inferred' ? 'var(--copper-400)' : '#4a9eff',
              border: '3px solid #07070a', zIndex: 20
            }} />

            {/* Date Tag */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 600 }}>
                {ev.date}
              </span>
              <span title={ev.event_type} style={{ display: 'flex', alignItems: 'center' }}>
                <EventTypeIcon type={ev.event_type} size={14} />
              </span>
            </div>

            {/* Title / Description */}
            <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3 }}>
              {ev.description}
            </div>

            {/* Inferred badge */}
            {ev.event_type === 'ai_inferred' && (
              <span style={{
                alignSelf: 'flex-start', padding: '1px 5px', borderRadius: 4,
                fontSize: 8, fontWeight: 700, background: 'rgba(200,129,74,0.15)', color: 'var(--copper-400)',
                display: 'flex', alignItems: 'center', gap: 4
              }}>
                <Brain size={9} />
                <span>AI INFERRED</span>
              </span>
            )}

            {/* Source */}
            {ev.evidence_source && (
              <div style={{ fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Search size={10} />
                <span>Source: {ev.evidence_source}</span>
              </div>
            )}

            {/* Actors */}
            {ev.actors && ev.actors.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {ev.actors.map((actor, idx) => (
                  <span key={idx} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 2, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <User size={8} />
                    <span>{actor}</span>
                  </span>
                ))}
              </div>
            )}

          </div>
        ))}
      </div>

      {/* Narrative & Verdict predictions summary */}
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
        borderRadius: 10, padding: 16, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20,
        boxShadow: '0 -4px 30px rgba(0,0,0,0.5)', marginTop: 'auto', zIndex: 100
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--copper-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Narrative Crime Reconstruction Summary
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {narrative_summary || "Timeline player initialized. Chronological simulation of events compiled."}
          </p>
        </div>
        
        <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--copper-400)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            AI Verdict Projection
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            {verdict_prediction || "Computing resolution outcomes..."}
          </div>
        </div>
      </div>

    </div>
  )
}
