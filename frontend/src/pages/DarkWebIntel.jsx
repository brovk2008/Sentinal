import { useState, useEffect } from 'react'
import { fetchDarkWebFeed, fetchThreatAssessment } from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'

// Cyber blue theme constants
const DW = {
  bg: '#030810',
  bgCard: 'rgba(10, 20, 40, 0.4)',
  bgTerminal: 'rgba(5, 8, 16, 0.7)',
  bgModal: '#040d1a',
  border: '#1a3a6b',
  borderBright: '#2a5a9b',
  text: '#4a9eff',
  textDim: '#16578a',
  textBright: '#a8d4ff',
  success: '#52b788',
  danger: '#e05252',
  warning: '#e0a832',
};

export default function DarkWebIntel() {
  const [feed, setFeed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeChannel, setActiveChannel] = useState(null)
  
  // Threat assessment modal state
  const [assessmentModal, setAssessmentModal] = useState(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [assessmentText, setAssessmentText] = useState('')

  const loadFeed = async () => {
    try {
      const res = await fetchDarkWebFeed()
      setFeed(res)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadFeed().then(() => setLoading(false))

    // Auto refresh chatter feed every 30 seconds
    const interval = setInterval(loadFeed, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleActorClick = async (syndicateName) => {
    if (!syndicateName) return
    setAssessmentModal(syndicateName)
    setAssessmentLoading(true)
    setAssessmentText('')
    try {
      const res = await fetchThreatAssessment(syndicateName)
      setAssessmentText(res.assessment)
    } catch (err) {
      setAssessmentText("Could not compile threat dossier.")
    }
    setAssessmentLoading(false)
  }

  if (loading) {
    return <LoadingPulse height={400} text="Securing Tor Node Connection..." />
  }

  if (!feed) {
    return (
      <div style={{ padding: 24, color: DW.danger }}>
        Failed to capture simulated onion server feed. Confirm backend connection.
      </div>
    )
  }

  const { channels, chatter, actors, top_keywords, threat_score, threat_label } = feed

  // Filter chatter if activeChannel selected
  const filteredChatter = activeChannel
    ? chatter.filter(c => c.linked_syndicate && c.linked_syndicate.toLowerCase().includes(activeChannel.replace('#', '').replace(/-/g, ' ').split(' ')[0]))
    : chatter

  return (
    <div style={{
      position: 'relative',
      height: 'calc(100vh - var(--topbar-height) - 32px)',
      background: DW.bg,
      color: DW.text,
      fontFamily: 'var(--font-mono)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: 16,
      userSelect: 'none'
    }}>
      
      {/* Scan lines CSS overlay style */}
      <style>{`
        .matrix-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(0, 100, 255, 0.04), rgba(0, 200, 255, 0.02), rgba(0, 50, 255, 0.04));
          background-size: 100% 4px, 6px 100%;
          pointer-events: none;
          z-index: 10;
        }
        .classified-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 7vw;
          font-weight: 900;
          color: rgba(224, 82, 82, 0.03);
          letter-spacing: 0.2em;
          pointer-events: none;
          z-index: 1;
        }
      `}</style>
      
      <div className="matrix-overlay" />
      <div className="classified-bg">CLASSIFIED</div>

      {/* TOP HEADER STATUS ROW */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${DW.border}`, paddingBottom: 10, marginBottom: 14, zIndex: 20
      }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: DW.text }}>
            🛰️ DARK WEB THREAT MONITORING
          </h2>
          <div style={{ fontSize: 9, color: DW.textDim, marginTop: 2 }}>
            Karnataka Cyber Defense Division · Proxy Active
          </div>
        </div>

        {/* Threat index meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 10, color: DW.textDim }}>THREAT LEVEL:</div>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: threat_label === 'CRITICAL' || threat_label === 'HIGH' ? DW.danger : DW.warning
          }}>
            {threat_label} ({threat_score}%)
          </div>
          <div style={{ width: 140, height: 10, background: '#111', borderRadius: 5, border: `1px solid ${DW.border}`, overflow: 'hidden' }}>
            <div style={{
              width: `${threat_score}%`, height: '100%',
              background: threat_label === 'CRITICAL' ? DW.danger : DW.warning
            }} />
          </div>
        </div>
      </div>

      {/* THREE-PANEL GRID LAYOUT */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: 16,
        overflow: 'hidden', zIndex: 20, marginBottom: 10
      }}>
        
        {/* PANEL 1: THREAT CHANNELS */}
        <div style={{
          background: DW.bgCard, border: `1px solid ${DW.border}`,
          borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
          overflowY: 'auto'
        }}>
          <div style={{ fontSize: 11, color: DW.textDim, borderBottom: `1px solid ${DW.border}`, paddingBottom: 4 }}>
            ACTIVE CHANNELS
          </div>
          
          <div
            onClick={() => setActiveChannel(null)}
            style={{
              padding: 8, borderRadius: 4, cursor: 'pointer',
              background: !activeChannel ? 'rgba(74, 158, 255, 0.08)' : 'transparent',
              border: '1px solid transparent',
              fontSize: 10
            }}
          >
            #all-channels-stream
          </div>

          {channels.map((chan, i) => (
            <div
              key={i}
              onClick={() => setActiveChannel(chan.name)}
              style={{
                padding: 8, borderRadius: 4, cursor: 'pointer',
                background: activeChannel === chan.name ? 'rgba(74, 158, 255, 0.08)' : 'transparent',
                border: activeChannel === chan.name ? `1px solid ${DW.border}` : '1px solid transparent',
                display: 'flex', flexDirection: 'column', gap: 4
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>{chan.name}</span>
                <span style={{ fontSize: 9, color: chan.threat_level === 'CRITICAL' ? DW.danger : DW.warning }}>
                  {chan.threat_level}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: DW.textDim }}>
                <span>{chan.message_count} msgs</span>
                <span>Active {chan.last_activity}</span>
              </div>
            </div>
          ))}
        </div>

        {/* PANEL 2: LIVE CHATTER TERMINAL */}
        <div style={{
          background: DW.bgTerminal, border: `1px solid ${DW.border}`,
          borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{ fontSize: 11, color: DW.textDim, borderBottom: `1px solid ${DW.border}`, paddingBottom: 4, marginBottom: 10 }}>
            RAW COMMUNICATION INTERCEPT STREAM {activeChannel ? `(${activeChannel})` : ''}
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
            paddingRight: 4
          }}>
            {filteredChatter.map((chat, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', gap: 8, fontSize: 11, padding: 8, borderRadius: 4,
                  borderLeft: chat.is_flagged ? `3px solid ${DW.danger}` : '1px solid transparent',
                  background: chat.is_flagged ? 'rgba(224, 82, 82, 0.04)' : 'rgba(74, 158, 255, 0.02)'
                }}
              >
                <span style={{ color: DW.textDim, flexShrink: 0 }}>[{chat.time}]</span>
                <span
                  style={{ color: '#fff', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => handleActorClick(chat.linked_syndicate)}
                >
                  &lt;{chat.handle}&gt;:
                </span>
                <span style={{ color: chat.is_flagged ? '#ff8e8e' : DW.textBright }}>
                  "{chat.message}"
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL 3: INTELLIGENCE METRICS */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto'
        }}>
          {/* Top Threat Actors */}
          <div style={{
            background: DW.bgCard, border: `1px solid ${DW.border}`,
            borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8
          }}>
            <div style={{ fontSize: 11, color: DW.textDim, borderBottom: `1px solid ${DW.border}`, paddingBottom: 4 }}>
              THREAT ACTORS DETECTED
            </div>
            
            {actors.map((actor, idx) => (
              <div
                key={idx}
                onClick={() => handleActorClick(actor.linked_syndicate)}
                style={{
                  padding: 8, background: 'rgba(5,8,16,0.4)', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${DW.border}`, display: 'flex', flexDirection: 'column', gap: 4
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{actor.handle}</span>
                  <span style={{ color: actor.risk_level === 'CRITICAL' ? DW.danger : DW.warning }}>
                    {actor.risk_level}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: DW.textDim, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Mentions: {actor.mentions}</span>
                  <span>{actor.linked_syndicate || 'Unknown Org'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Keyword Frequencies */}
          <div style={{
            background: DW.bgCard, border: `1px solid ${DW.border}`,
            borderRadius: 6, padding: 12
          }}>
            <div style={{ fontSize: 11, color: DW.textDim, borderBottom: `1px solid ${DW.border}`, paddingBottom: 4, marginBottom: 8 }}>
              KEYWORDS CORRELATED
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {top_keywords.map((kw, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '2px 6px', border: `1px solid ${DW.border}`, borderRadius: 4,
                    fontSize: 9, background: 'rgba(74, 158, 255, 0.04)', color: DW.text
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ASSESSMENTS MODAL WINDOW */}
      {assessmentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            width: 440, background: DW.bgModal, border: `2px solid ${DW.border}`, borderRadius: 8,
            padding: 20, color: DW.text, fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 14
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${DW.border}`, paddingBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>🔍 Dossier: {assessmentModal}</div>
              <button
                onClick={() => setAssessmentModal(null)}
                style={{ background: 'none', border: 'none', color: DW.danger, fontSize: 18, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {assessmentLoading ? (
              <div style={{ fontSize: 11, textAlign: 'center', color: DW.textDim, padding: 20 }}>
                Compiling intelligence assessment via QuickML...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 10, color: DW.textDim, textTransform: 'uppercase' }}>
                  Target Syndicate Assessment:
                </div>
                <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.5, background: 'rgba(74, 158, 255, 0.03)', padding: 12, border: `1px solid ${DW.border}`, borderRadius: 4 }}>
                  {assessmentText}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: 8, color: DW.warning }}>
              ⚠️ Classification: CONFIDENTIAL · AI-inferred projection report
            </div>
          </div>
        </div>
      )}

      {/* CLASSIFIED DISCLAIMER BOTTOM BANNER */}
      <div style={{
        textAlign: 'center', padding: '6px 10px', background: 'rgba(255,204,0,0.08)',
        border: '1px solid rgba(255,204,0,0.3)', borderRadius: 4, fontSize: 9, color: '#ffcc00',
        zIndex: 20
      }}>
        ⚠️ CLASSIFIED DEMO MODE: SIMULATED INTELLIGENCE — For demonstration purposes only
      </div>

    </div>
  )
}
