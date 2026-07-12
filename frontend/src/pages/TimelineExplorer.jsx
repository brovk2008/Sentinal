import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import { fetchCases, fetchCaseDetail, searchCases, enhanceDiagram, downloadCaseReport, fetchCaseResolution, reconstructTimeline } from '../api'
import CaseActionPanel from '../components/timeline/CaseActionPanel'
import CaseCompareModal from '../components/timeline/CaseCompareModal'
import AITimelineReconstruction from '../components/timeline/AITimelineReconstruction'
import FileUploader from '../components/FileUploader'

export default function TimelineExplorer() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [selectedCase, setSelectedCase] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showActionPanel, setShowActionPanel] = useState(false)
  const [compareIds, setCompareIds] = useState([])
  const [showCompareModal, setShowCompareModal] = useState(false)

  // Mermaid code state
  const [flowchartCode, setFlowchartCode] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  // Reconstruction states
  const [reconstructionData, setReconstructionData] = useState(null)
  const [reconstructing, setReconstructing] = useState(false)
  
  // Resolution Prediction states
  const [resolutionPrediction, setResolutionPrediction] = useState(null)
  const [resolutionPredicting, setResolutionPredicting] = useState(false)

  const handleReconstructTimeline = async () => {
    if (!caseId) return
    setReconstructing(true)
    try {
      const data = await reconstructTimeline(caseId)
      setReconstructionData(data)
    } catch (e) {
      console.error(e)
    }
    setReconstructing(false)
  }

  const handleDownloadReport = async () => {
    const caseObj = selectedCase?.case
    if (!caseId || !caseObj?.CrimeNo) return
    setReportLoading(true)
    try {
      await downloadCaseReport(caseId, caseObj.CrimeNo)
    } catch (e) {
      console.error(e)
    }
    setReportLoading(false)
  }

  const handlePredictResolution = async () => {
    if (!caseId) return
    setResolutionPredicting(true)
    try {
      const res = await fetchCaseResolution(caseId)
      setResolutionPrediction(res)
    } catch (e) {
      console.error(e)
    }
    setResolutionPredicting(false)
  }

  // Load case list
  useEffect(() => {
    setLoading(true)
    fetchCases({ page, limit: 30 }).then(res => {
      const caseList = res.cases || []
      setCases(caseList)
      setTotal(res.total || 0)
      setLoading(false)
      // Auto-select first case if no caseId in URL
      if (!caseId && caseList.length > 0) {
        navigate(`/timeline/${caseList[0].CaseMasterID}`, { replace: true })
      }
    }).catch(() => setLoading(false))
  }, [page])

  // Load case detail if caseId in URL
  useEffect(() => {
    if (caseId) {
      setDetailLoading(true)
      fetchCaseDetail(caseId).then(data => {
        setSelectedCase(data)
        setDetailLoading(false)
        
        // Generate base flowchart
        const caseDetail = data.case
        if (caseDetail) {
          const complainant = data.complainants?.[0]?.ComplainantName || 'Unknown Complainant'
          const baseCode = `graph TD
  C["Complainant: ${complainant}"] --> FIR["FIR Registered"]
  FIR --> PS["Station: ${caseDetail.StationName || 'Police Station'}"]
  PS --> INV["Investigation"]
`
          setFlowchartCode(baseCode)
        }
      }).catch(() => setDetailLoading(false))
    }
  }, [caseId])

  // Render mermaid when code changes
  useEffect(() => {
    if (!window.mermaid || !flowchartCode) return
    const id = 'mermaid-diagram-' + Date.now()
    const container = document.getElementById('mermaid-container')
    if (!container) return
    try {
      window.mermaid.render(id, flowchartCode).then(({ svg }) => {
        container.innerHTML = svg
      }).catch(e => {
        console.error('Mermaid render error:', e)
        container.innerHTML = `<pre style="font-size:10px;color:#5a5855">${flowchartCode}</pre>`
      })
    } catch (e) {
      console.error('Mermaid sync error:', e)
    }
  }, [flowchartCode])

  // AI enhance diagram click
  const handleEnhance = async () => {
    if (!caseId || !flowchartCode) return
    setEnhancing(true)
    try {
      const res = await enhanceDiagram(flowchartCode, caseId)
      if (res && res.enhanced_mermaid) {
        setFlowchartCode(res.enhanced_mermaid)
      }
    } catch (e) {
      console.error(e)
    }
    setEnhancing(false)
  }

  // Search
  useEffect(() => {
    if (search.length < 2) return
    const timer = setTimeout(() => {
      searchCases(search).then(setCases).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const selectCase = (id) => {
    navigate(`/timeline/${id}`)
  }

  const caseDetail = selectedCase?.case

  // Build timeline events from case detail
  const events = []
  if (caseDetail) {
    events.push({
      date: caseDetail.CrimeRegisteredDate,
      title: 'FIR Registered',
      desc: `Crime No: ${caseDetail.CrimeNo}`,
      color: '#e05252',
    })
    if (caseDetail.InfoReceivedPSDate) {
      events.push({
        date: caseDetail.InfoReceivedPSDate,
        title: 'Information Received at PS',
        desc: `Station: ${caseDetail.StationName}`,
        color: '#e0a832',
      })
    }
    selectedCase?.arrests?.forEach(a => {
      events.push({
        date: a.ArrestSurrenderDate,
        title: a.ArrestSurrenderTypeID === 1 ? 'Accused Arrested' : 'Accused Surrendered',
        desc: `Arrest ID: ${a.ArrestSurrenderID}`,
        color: '#4a9ede',
      })
    })
    selectedCase?.chargesheets?.forEach(cs => {
      events.push({
        date: cs.csdate,
        title: 'Chargesheet Filed',
        desc: `Type: ${cs.cstype === 'A' ? 'Chargesheet' : cs.cstype === 'B' ? 'False Case' : 'Undetected'}`,
        color: '#52b788',
      })
    })
    events.sort((a, b) => a.date?.localeCompare(b.date))
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Left panel — Case list */}
      <div style={{
        width: 300, borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)',
      }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            className="input"
            placeholder="Search cases..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 12 }}
          />
          {compareIds.length >= 2 && (
            <button
              className="btn btn-copper btn-sm animate-pulse"
              onClick={() => setShowCompareModal(true)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              📊 Compare {compareIds.length} Cases
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <LoadingPulse height={200} /> : cases.map(c => (
            <div
              key={c.CaseMasterID}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                background: String(c.CaseMasterID) === caseId ? 'rgba(200,129,74,0.08)' : 'transparent',
                borderLeft: String(c.CaseMasterID) === caseId ? '2px solid var(--copper-400)' : '2px solid transparent',
                display: 'flex',
                gap: 8,
                alignItems: 'center'
              }}
            >
              <input
                type="checkbox"
                checked={compareIds.includes(c.CaseMasterID)}
                onChange={(e) => {
                  e.stopPropagation()
                  const isChecked = e.target.checked
                  setCompareIds(prev => {
                    if (isChecked) {
                      if (prev.length >= 3) {
                        alert("You can compare up to 3 cases at a time.")
                        return prev
                      }
                      return [...prev, c.CaseMasterID]
                    } else {
                      return prev.filter(id => id !== c.CaseMasterID)
                    }
                  })
                }}
                style={{
                  accentColor: 'var(--copper-500)',
                  cursor: 'pointer'
                }}
              />
              <div style={{ flex: 1 }} onClick={() => selectCase(c.CaseMasterID)}>
                <div className="mono" style={{ fontSize: 11, marginBottom: 3 }}>
                  {c.CrimeNo}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Badge text={c.CaseStatusName} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.CrimeGroupName}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                  {c.DistrictName} · {c.CrimeRegisteredDate}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div style={{
          padding: '8px 12px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Page {page} · {total.toLocaleString()} cases</span>
          <button className="btn btn-sm" onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      {/* Center — Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!caseId ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{ fontSize: 32, opacity: 0.2 }}>◈</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Select a case from the list to view timeline
            </div>
          </div>
        ) : detailLoading ? (
          <LoadingPulse text="Loading case details..." />
        ) : caseDetail ? (
          <div className="fade-in">
            {/* Case header */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span className="mono" style={{ fontSize: 16 }}>{caseDetail.CrimeNo}</span>
                  <Badge text={caseDetail.CaseStatusName} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{caseDetail.CrimeGroupName}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {caseDetail.DistrictName} · {caseDetail.StationName} · IO: {caseDetail.OfficerName}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-sm"
                  disabled={reportLoading}
                  onClick={handleDownloadReport}
                  style={{ borderColor: 'var(--copper-400)', background: 'transparent', color: 'var(--copper-200)' }}
                >
                  {reportLoading ? 'Generating...' : '📄 Generate Report'}
                </button>
                <button
                  className="btn btn-sm"
                  disabled={resolutionPredicting}
                  onClick={handlePredictResolution}
                  style={{ borderColor: 'var(--copper-400)', background: 'rgba(200,129,74,0.05)', color: 'var(--copper-200)' }}
                >
                  {resolutionPredicting ? '🔮 Analyzing...' : '🔮 Predict Resolution'}
                </button>
                <button
                  className="btn btn-sm"
                  disabled={reconstructing}
                  onClick={handleReconstructTimeline}
                  style={{ borderColor: 'var(--copper-400)', background: 'rgba(200,129,74,0.05)', color: 'var(--copper-200)' }}
                >
                  {reconstructing ? '🔮 Reconstructing...' : '🔮 Reconstruct Timeline'}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setShowActionPanel(true)}
                  style={{ borderColor: 'var(--copper-400)', background: 'rgba(200,129,74,0.05)', color: 'var(--copper-200)' }}
                >
                  ⚙ Actions
                </button>
              </div>
            </div>

            {/* Brief Facts */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-label">BRIEF FACTS</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {caseDetail.BriefFacts}
              </p>
            </div>

            {/* Attach Evidence Files */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-label">ATTACH EVIDENCE FILES</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Upload case file evidence, suspect photos, CDR logs, or financial records. Zia and Catalyst LLM will auto-analyze the contents.
              </p>
              <FileUploader caseId={caseId} onUploadComplete={(f) => console.log('Uploaded to case:', f)} />
            </div>

            {/* Interactive Flowchart (Mermaid) (7D) */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Investigation Flowchart</div>
                <button
                  className="btn btn-sm btn-copper"
                  onClick={handleEnhance}
                  disabled={enhancing}
                >
                  {enhancing ? 'Enhancing...' : '✦ AI Enhance'}
                </button>
              </div>
              
              <div style={{
                background: 'var(--bg-secondary)', borderRadius: 6,
                border: '1px solid var(--border-subtle)', padding: 16,
                display: 'flex', justifyContent: 'center', overflowX: 'auto',
                minHeight: 120,
              }}>
                <div id="mermaid-container" style={{ width: '100%', textAlign: 'center' }} />
              </div>
            </div>

            {/* Timeline */}
            <div className="section-label">CASE TIMELINE</div>
            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 24 }}>
              <div style={{
                position: 'absolute', left: 7, top: 0, bottom: 0,
                width: 2, background: 'var(--border-subtle)',
              }} />
              {events.map((ev, i) => (
                <div key={i} style={{ position: 'relative', paddingBottom: 20 }}>
                  <div style={{
                    position: 'absolute', left: -20, top: 3,
                    width: 12, height: 12, borderRadius: '50%',
                    background: ev.color, border: '2px solid var(--bg-primary)',
                    zIndex: 1,
                  }} />
                  <div className="mono" style={{ fontSize: 10, marginBottom: 2 }}>{ev.date}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ev.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ev.desc}</div>
                </div>
              ))}
            </div>

            {/* Accused & Victims */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="card">
                <div className="section-label">ACCUSED ({selectedCase?.accused?.length || 0})</div>
                {selectedCase?.accused?.map((a, i) => (
                  <div key={i} style={{ padding: '4px 0', fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="mono">{a.PersonID}</span>
                    <span>{a.AccusedName}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Age {a.AgeYear}</span>
                    {!!a.is_priority && (
                      <span className="badge badge-danger" style={{ fontSize: 8, padding: '2px 4px', lineHeight: 1 }}>
                        PRIORITY
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="section-label">VICTIMS ({selectedCase?.victims?.length || 0})</div>
                {selectedCase?.victims?.map((v, i) => (
                  <div key={i} style={{ padding: '4px 0', fontSize: 12 }}>
                    {v.VictimName} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Age {v.AgeYear}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections */}
            {selectedCase?.sections?.length > 0 && (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="section-label">SECTIONS INVOKED</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedCase.sections.map((s, i) => (
                    <span key={i} className="badge badge-copper">
                      {s.ShortName} {s.SectionID}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Case Action Slide-in Panel */}
      {showActionPanel && (
        <CaseActionPanel
          caseId={caseId}
          currentStatusId={caseDetail?.CaseStatusID}
          accused={selectedCase?.accused || []}
          onClose={() => setShowActionPanel(false)}
          onSaveSuccess={() => {
            fetchCaseDetail(caseId).then(data => {
              setSelectedCase(data)
            })
          }}
        />
      )}

      {/* Case Comparison Modal */}
      {showCompareModal && (
        <CaseCompareModal
          caseIds={compareIds}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {/* Case Resolution Prediction Modal */}
      {resolutionPrediction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10000, animation: 'fade-in 0.2s ease',
        }}>
          <div className="card" style={{
            width: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)', letterSpacing: '0.05em' }}>
                CASE RESOLUTION FORECAST
              </div>
              <button
                onClick={() => setResolutionPrediction(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 6 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>FIR: {resolutionPrediction.crime_no}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Case ID: {resolutionPrediction.case_id}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Predicted Outcome:</span>
              <span style={{
                fontSize: 14, fontWeight: 700, color: 'var(--copper-400)'
              }}>
                {resolutionPrediction.predicted_outcome} ({resolutionPrediction.confidence})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Outcome Probabilities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {resolutionPrediction.all_outcomes.map(out => (
                  <div key={out.outcome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 100 }}>{out.outcome}</span>
                    <div style={{ flex: 1, background: 'var(--bg-secondary)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        background: out.outcome === 'Chargesheeted' ? '#52b788' :
                                    out.outcome === 'Undetected' ? '#e0a832' : '#e05252',
                        height: '100%',
                        width: out.percentage
                      }} />
                    </div>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', minWidth: 35, textAlign: 'right' }}>
                      {out.percentage}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Key Signal Metrics
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                <div style={{ background: 'var(--bg-primary)', padding: 6, borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>ACCUSED</div>
                  <div style={{ fontWeight: 600 }}>{resolutionPrediction.key_signals.accused_count}</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: 6, borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>ARRESTS</div>
                  <div style={{ fontWeight: 600 }}>{resolutionPrediction.key_signals.arrests_made}</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: 6, borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>GRAVITY</div>
                  <div style={{ fontWeight: 600 }}>{resolutionPrediction.key_signals.crime_gravity}</div>
                </div>
              </div>
            </div>

            <button
              className="btn btn-copper"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => setResolutionPrediction(null)}
            >
              Close Analyzer
            </button>
          </div>
        </div>
      )}

      {reconstructionData && (
        <AITimelineReconstruction
          data={reconstructionData}
          onClose={() => setReconstructionData(null)}
        />
      )}
    </div>
  )
}
