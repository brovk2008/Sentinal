import { useState, useEffect } from 'react'

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

  const eventIcons = {
    'cdr':         '📱',
    'financial':   '💰',
    'arrest':      '👮',
    'fir':         '📋',
    'chargesheet': '⚖️',
    'ai_inferred': '🤖'
  }

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
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase', margin: 0, letterSpacing: '0.05em' }}>
            🔮 Forensic Case Timeline Reconstruction
          </h2>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            AI-Inferred Chronology & Evidence Cross-Matching Summary
          </div>
        </div>
        <button
          className="btn btn-sm"
          style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-default)' }}
          onClick={onClose}
        >
          Close Player
        </button>
      </div>

      {/* Playback Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-overlay)', padding: '10px 18px', borderRadius: 30, width: 'fit-content', margin: '0 auto 20px', border: '1px solid var(--border-default)' }}>
        <button
          className="btn btn-sm btn-copper"
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ fontSize: 11, minWidth: 70, justifyContent: 'center' }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setVisibleCount(1)}
          style={{ fontSize: 11, border: '1px solid var(--border-default)' }}
        >
          Reset
        </button>
        
        <span style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
          <span>Speed:</span>
          <button className={`btn btn-xs ${speed === 1500 ? 'btn-copper' : ''}`} onClick={() => setSpeed(1500)}>Slow</button>
          <button className={`btn btn-xs ${speed === 1000 ? 'btn-copper' : ''}`} onClick={() => setSpeed(1000)}>Normal</button>
          <button className={`btn btn-xs ${speed === 500 ? 'btn-copper' : ''}`} onClick={() => setSpeed(500)}>Fast</button>
        </div>

        <span style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--copper-400)' }}>
          Step {visibleCount} / {events.length}
        </div>
      </div>

      {/* Horizontal timeline track */}
      <div style={{
        flex: 1, display: 'flex', gap: 16, overflowX: 'auto', padding: '20px 10px',
        alignItems: 'center', position: 'relative', width: '100%'
      }}>
        {/* Horizontal connect line */}
        <div style={{
          position: 'absolute', left: 40, right: 40, top: '50%', height: 3,
          background: 'linear-gradient(90deg, var(--copper-700), rgba(200,129,74,0.1))',
          zIndex: 1
        }} />

        {events.slice(0, visibleCount).map((ev, index) => (
          <div
            key={index}
            style={{
              minWidth: 260, maxWidth: 260, background: 'var(--bg-card)',
              border: `1px solid ${getEventBorderColor(ev.event_type)}`,
              borderStyle: ev.event_type === 'ai_inferred' ? 'dashed' : 'solid',
              borderRadius: 8, padding: 12, position: 'relative', zIndex: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              animation: 'fade-in 0.3s ease',
              display: 'flex', flexDirection: 'column', gap: 6
            }}
          >
            {/* Timeline node marker */}
            <div style={{
              position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
              width: 14, height: 14, borderRadius: '50%',
              background: ev.event_type === 'ai_inferred' ? 'var(--copper-500)' : 'var(--copper-400)',
              border: '3px solid #07070a', zIndex: 20
            }} />

            {/* Date Tag */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 600 }}>
                {ev.date}
              </span>
              <span style={{ fontSize: 13 }} title={ev.event_type}>
                {eventIcons[ev.event_type] || '❓'}
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
                fontSize: 8, fontWeight: 700, background: 'rgba(200,129,74,0.15)', color: 'var(--copper-400)'
              }}>
                🤖 AI INFERRED
              </span>
            )}

            {/* Source */}
            {ev.evidence_source && (
              <div style={{ fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4 }}>
                🔍 Source: {ev.evidence_source}
              </div>
            )}

            {/* Actors */}
            {ev.actors && ev.actors.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                {ev.actors.map((actor, idx) => (
                  <span key={idx} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                    👤 {actor}
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
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
            Probabilities computed from historical Chargesheet filings.
          </div>
        </div>
      </div>

    </div>
  )
}
