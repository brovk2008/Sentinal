import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { compareCases } from '../../api'
import LoadingPulse from '../shared/LoadingPulse'

export default function CaseCompareModal({ caseIds = [], onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (caseIds.length < 2 || caseIds.length > 3) {
      setError('Please select between 2 and 3 cases to compare.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    compareCases(caseIds)
      .then(res => {
        setData(res)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setError('Failed to load case comparisons.')
        setLoading(false)
      })
  }, [caseIds])

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 5, 8, 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      padding: 20
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--card-radius)',
        width: '100%',
        maxWidth: 900,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-secondary)'
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--copper-400)', letterSpacing: '0.04em', margin: 0 }}>
            CASE COMPARATIVE BRIEFING
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 20,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            ×
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ padding: 40 }}>
              <LoadingPulse text="Synthesizing connection patterns via Catalyst QuickML..." />
            </div>
          ) : error ? (
            <div style={{ color: 'var(--status-danger)', textAlign: 'center', padding: 30 }}>
              ⚠️ {error}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Cases Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${data.cases.length}, 1fr)`,
                gap: 12
              }}>
                {data.cases.map((c, idx) => (
                  <div key={idx} style={{
                    padding: 12,
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>CASE {idx + 1}</div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--copper-400)' }}>
                      {c.metadata.CrimeNo}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, margin: '4px 0 2px 0' }}>{c.metadata.CrimeGroupName}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      {c.metadata.DistrictName} · {c.metadata.StationName}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      Registered: {c.metadata.CrimeRegisteredDate?.slice(0, 10)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Overlaps & Metrics Bar */}
              <div style={{
                background: 'rgba(200, 129, 74, 0.05)',
                border: '1px dashed var(--copper-500)',
                borderRadius: 6,
                padding: '12px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16
              }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shared Accused</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                    {data.shared_accused.length > 0 ? (
                      <span style={{ color: 'var(--status-danger)' }}>{data.shared_accused.join(', ')}</span>
                    ) : (
                      'None'
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Shared Sections</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                    {data.shared_sections.length > 0 ? (
                      <span style={{ color: 'var(--copper-300)' }}>{data.shared_sections.join(', ')}</span>
                    ) : (
                      'None'
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Crime Distance</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                    {data.distances.length > 0 ? (
                      <span>{data.distances.join(' / ')} km</span>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Span</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>
                    {data.time_delta_days !== null ? `${data.time_delta_days} days` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* AI Briefing summary */}
              <div>
                <div className="section-label" style={{ marginBottom: 6 }}>INTELLIGENCE CORRELATION BRIEFING</div>
                <div className="scanlines" style={{
                  padding: '16px 20px',
                  background: '#0a0a0f',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  lineHeight: 1.6
                }}>
                  <ReactMarkdown
                    components={{
                      h3: ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--copper-400)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</h3>,
                      li: ({ children }) => <li style={{ marginBottom: 4, marginLeft: 16, listStyleType: 'square' }}>{children}</li>,
                      p: ({ children }) => <p style={{ marginBottom: 8 }}>{children}</p>,
                      strong: ({ children }) => <strong style={{ color: 'var(--copper-300)' }}>{children}</strong>,
                    }}
                  >
                    {data.summary}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--bg-secondary)'
        }}>
          <button
            className="btn btn-copper"
            onClick={onClose}
          >
            Close Briefing
          </button>
        </div>
      </div>
    </div>
  )
}
