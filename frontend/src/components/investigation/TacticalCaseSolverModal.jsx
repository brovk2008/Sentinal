import { useState } from 'react'
import { X, Upload, Scan, ShieldAlert, CheckCircle2, User, PhoneCall, ArrowRight, Zap, Target } from 'lucide-react'
import { solveCaseWithAI, matchSuspectFace } from '../../api'

export default function TacticalCaseSolverModal({ isOpen, onClose, caseId = 1 }) {
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [loading, setLoading] = useState(false)
  const [solverResult, setSolverResult] = useState(null)

  if (!isOpen) return null

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
      const base64Data = reader.result.split(',')[1]
      setImageBase64(base64Data)
    }
    reader.readAsDataURL(file)
  }

  const handleRunPatternResolver = async () => {
    setLoading(true)
    try {
      const res = await solveCaseWithAI(caseId, imageBase64)
      if (res && res.success) {
        setSolverResult(res)
      }
    } catch (err) {
      console.error('Failed to run AI case solver:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(4,5,12,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#09101d', border: '1px solid rgba(200,129,74,0.4)',
        borderRadius: 12, width: '100%', maxWidth: 840, maxHeight: '90vh',
        overflow: 'auto', padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        color: '#fff', fontFamily: 'Inter, sans-serif'
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#c8814a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Scan size={20} />
              <span>MULTI-MODAL AI CASE SOLVER &amp; PATTERN RESOLVER</span>
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              Biometric Facial Matching • MO Fingerprint Vector • CDR Spatial Overlap • Tactical Leads
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Upload & Trigger Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, marginBottom: 24 }}>
          {/* Photo Scan Input */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(200,129,74,0.4)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#c8814a', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Scanned CCTV / Suspect Evidence Photo
            </div>
            {imagePreview ? (
              <img src={imagePreview} alt="Suspect Scan" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, marginBottom: 10, border: '1px solid #c8814a' }} />
            ) : (
              <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'rgba(255,255,255,0.4)' }}>
                <Upload size={24} color="#c8814a" />
                <span style={{ fontSize: 11 }}>Upload Photo or CCTV Still</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }} />
          </div>

          {/* Trigger Action */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              The pattern solver cross-examines uploaded facial evidence against stored accused mugshots, CDR tower locations, and historical MO fingerprints across Karnataka police stations.
            </div>
            <button
              onClick={handleRunPatternResolver}
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #c8814a, #9e5b2b)',
                color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 6,
                fontSize: 13, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <Zap size={16} />
              <span>{loading ? 'RUNNING MULTI-MODAL PATTERN RESOLVER...' : 'RUN AI CASE SOLVER & MATCH FACE'}</span>
            </button>
          </div>
        </div>

        {/* Solver Results View */}
        {solverResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Prime Suspect & Match Scores */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
              {/* Suspect Identity Unmasked */}
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', padding: 18, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  PRIME SUSPECT UNMASKED
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                  {solverResult.prime_suspect.name}
                </div>
                <div style={{ fontSize: 12, color: '#c8814a', fontWeight: 600, marginBottom: 8 }}>
                  Aliases: {solverResult.unmasked_identity.known_aliases.join(', ')}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 12 }}>
                  <span>Status: <strong>{solverResult.prime_suspect.arrest_status}</strong></span>
                  <span>Risk: <strong style={{ color: '#ef4444' }}>{solverResult.unmasked_identity.risk_tier}</strong></span>
                </div>
              </div>

              {/* Tactical Score Gauge */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,129,74,0.3)', padding: 18, borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#c8814a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  OVERALL SUSPECT MATCH INDEX
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginBottom: 6 }}>
                  {solverResult.tactical_breakdown.overall_suspect_score}%
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
                  <div>Biometric Face Match: {solverResult.tactical_breakdown.facial_biometric_score}%</div>
                  <div>MO Pattern Alignment: {solverResult.tactical_breakdown.mo_pattern_alignment}%</div>
                  <div>CDR Tower Overlap: {solverResult.tactical_breakdown.cdr_tower_overlap}%</div>
                </div>
              </div>
            </div>

            
            {/* NCRB Solvability & Resolution Benchmark Card */}
            {solverResult.ncrb_solvability_assessment && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(200,129,74,0.1), rgba(16,185,129,0.08))',
                border: '1px solid rgba(200,129,74,0.35)', padding: 16, borderRadius: 8,
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16
              }}>
                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    NCRB Solvability Probability
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                    {solverResult.ncrb_solvability_assessment.calculated_solvability_score}%
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    National Clearance: {solverResult.ncrb_solvability_assessment.ncrb_base_clearance}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Est. Days to Resolution
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#c8814a' }}>
                    {solverResult.ncrb_solvability_assessment.estimated_days_to_resolution} Days
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Calibrated on 80K Indian Crime Corpus
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Investigation Priority
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>
                    {solverResult.ncrb_solvability_assessment.recommended_priority} PRIORITY
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    High Solvability Lead
                  </div>
                </div>
              </div>
            )}

            
            {/* 4-Phase Solved Case Resolution Playbook */}
            {solverResult.investigation_workflow_phases && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(200,129,74,0.3)', padding: 18, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#c8814a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ArrowRight size={14} />
                  <span>STEP-BY-STEP CASE RESOLUTION PLAYBOOK (DERIVED FROM SOLVED CASE DATASETS)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {solverResult.investigation_workflow_phases.map((phase) => (
                    <div key={phase.phase} style={{ background: 'rgba(4,5,12,0.8)', border: '1px solid rgba(255,255,255,0.08)', padding: 12, borderRadius: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#c8814a', marginBottom: 4 }}>
                        PHASE {phase.phase}: {phase.title.toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {phase.steps.map((step, idx) => (
                          <div key={idx} style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                            <span style={{ color: '#10b981' }}>✓</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Tactical Leads */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: 18, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#c8814a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target size={14} />
                <span>ACTIONABLE INVESTIGATIVE TACTICS GENERATED BY AI</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {solverResult.tactical_leads.map((lead, idx) => (
                  <div key={idx} style={{ background: 'rgba(4,5,12,0.6)', borderLeft: '3px solid #c8814a', padding: 10, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{lead.action}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{lead.rationale}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                      {lead.priority}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
