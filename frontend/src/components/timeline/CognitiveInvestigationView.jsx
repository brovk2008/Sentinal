import { useState, useEffect } from 'react'
import { autonomousInvestigate } from '../../api'
import { Brain, Award, Scale, FileText, X, Activity, User, Copy, Check, AlertOctagon, Search, Zap, RefreshCw } from 'lucide-react'

export default function CognitiveInvestigationView({ caseId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customFacts, setCustomFacts] = useState('')
  const [copiedIndex, setCopiedIndex] = useState(null)

  const runInvestigation = async (facts = null) => {
    setLoading(true)
    setError(null)
    try {
      const res = await autonomousInvestigate(caseId, facts || null)
      setData(res)
    } catch (err) {
      console.error('Cognitive investigation failed:', err)
      setError('Investigation reasoning failed. Please verify network/API status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (caseId) {
      runInvestigation()
    }
  }, [caseId])

  const copyDirective = (text, idx) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(5, 7, 12, 0.97)', zIndex: 10000,
      display: 'flex', flexDirection: 'column', padding: '24px 32px', overflowY: 'auto',
      color: 'var(--text-primary)', animation: 'fade-in 0.25s ease', fontFamily: 'var(--font-sans)'
    }}>
      
      {/* ── Top Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: 'rgba(217, 119, 6, 0.15)',
            border: '1px solid rgba(217, 119, 6, 0.4)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#f59e0b'
          }}>
            <Brain size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase', color: '#f59e0b' }}>
                Autonomous Cognitive Investigation Agent
              </h2>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', fontWeight: 600
              }}>
                Heuer ACH + Tree-of-Thoughts
              </span>
              {data?.elapsed_ms && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={12} color="#f59e0b" /> {data.elapsed_ms}ms
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Case #{caseId} · FIR: {data?.crime_no || 'Loading...'} · {data?.crime_type || 'Cognizable Offence'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-sm btn-copper"
            onClick={() => runInvestigation(customFacts)}
            disabled={loading}
            style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Reasoning...' : 'Re-Evaluate Hypotheses'}</span>
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            style={{ fontSize: 12, padding: '6px 14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Brain size={36} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Executing 4-Stage Autonomous Cognitive Reasoning Loop
          </div>
          <div style={{ fontSize: 12 }}>
            Probing SQL, CDR, Financial Ledgers & Cross-Examining Competing Hypotheses...
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 20
        }}>
          {error}
        </div>
      )}

      {!loading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          
          {/* ── Left Column: ACH Matrix & Surviving Lead ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Primary Winning Deduction */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(217, 119, 6, 0.4)', borderRadius: 10, padding: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={13} color="#f59e0b" /> Primary Surviving Deductive Lead
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                    {data.primary_lead?.title}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '4px 12px', borderRadius: 20, textAlign: 'center'
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>
                    {data.primary_lead?.confidence_percentage}%
                  </div>
                  <div style={{ fontSize: 9, color: '#a7f3d0', textTransform: 'uppercase' }}>
                    Confidence
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#e2e8f0', marginBottom: 14 }}>
                {data.primary_lead?.narrative}
              </p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Motive:</span> <b>{data.primary_lead?.motive}</b>
                </div>
                {data.primary_lead?.suspect_profiles?.map((prof, i) => (
                  <div key={i} style={{ fontSize: 11, background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '4px 10px', borderRadius: 6, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <User size={12} /> {prof}
                  </div>
                ))}
              </div>
            </div>

            {/* Heuer Analysis of Competing Hypotheses (ACH) Matrix Table */}
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Scale size={14} color="#f59e0b" /> Heuer Evidence Falsification Matrix (ACH)
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  +1 Consistent · -1 Contradicted · 0 Neutral
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 6px', color: 'var(--text-muted)', fontWeight: 600, width: '45%' }}>Evidence Artifact (SQL Cited)</th>
                      {data.competing_hypotheses?.map((h) => (
                        <th key={h.hypothesis_id} style={{ padding: '8px 6px', textAlign: 'center', color: h.status === 'ELIMINATED' ? '#f87171' : '#38bdf8' }}>
                          <div>{h.hypothesis_id}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}>
                            {h.status === 'ELIMINATED' ? 'Falsified' : `${h.confidence_percentage}%`}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence_matrix?.map((ev, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '8px 6px' }}>
                          <div style={{ fontWeight: 500, color: '#f1f5f9', fontSize: 11 }}>{ev.description}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ev.citation}</div>
                        </td>
                        {data.competing_hypotheses?.map((h) => {
                          const val = ev.evaluations?.[h.hypothesis_id] || '0'
                          return (
                            <td key={h.hypothesis_id} style={{ padding: '8px 6px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                                background: val === '+1' ? 'rgba(16, 185, 129, 0.2)' : (val === '-1' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.1)'),
                                color: val === '+1' ? '#34d399' : (val === '-1' ? '#f87171' : '#94a3b8'),
                                border: `1px solid ${val === '+1' ? 'rgba(16, 185, 129, 0.3)' : (val === '-1' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(148, 163, 184, 0.2)')}`
                              }}>
                                {val}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Falsified / Eliminated Theories */}
            {data.eliminated_theories?.length > 0 && (
              <div className="card" style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10, padding: 16 }}>
                <div className="section-label" style={{ color: '#f87171', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertOctagon size={14} color="#f87171" /> Falsified & Eliminated Theories ({data.eliminated_theories.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.eliminated_theories.map((el, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                      <b style={{ color: '#fca5a5' }}>[{el.hypothesis_id}]</b>: {el.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Deductive Log & Legal Directives ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Deductive Thought Process Terminal */}
            <div className="card" style={{ background: 'rgba(10, 15, 26, 0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color="#f59e0b" /> Deductive Thought Trajectory Feed
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                {data.thought_process_log?.map((logMsg, i) => (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.5, fontFamily: 'var(--font-mono)', color: '#94a3b8', borderLeft: '2px solid #f59e0b', paddingLeft: 8 }}>
                    {logMsg}
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory CrPC Legal Orders */}
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
              <div className="section-label" style={{ marginBottom: 10, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} color="#38bdf8" /> Statutory Legal Orders (CrPC / BNSS)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.actionable_legal_directives?.map((dir, i) => (
                  <div key={i} style={{
                    padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8
                  }}>
                    <div style={{ fontSize: 12, lineHeight: 1.4, color: '#e2e8f0' }}>
                      {dir}
                    </div>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => copyDirective(dir, i)}
                      style={{ fontSize: 10, padding: '4px 8px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {copiedIndex === i ? (
                        <>
                          <Check size={11} color="#34d399" />
                          <span style={{ color: '#34d399' }}>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy Notice</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Intelligence Gaps */}
            {data.intelligence_gaps?.length > 0 && (
              <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
                <div className="section-label" style={{ marginBottom: 8, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} color="#f59e0b" /> Critical Intelligence Gaps
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
                  {data.intelligence_gaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
