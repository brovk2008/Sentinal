import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import Icon from '../components/Icons'
import { fetchRepeatOffenders, searchPersons, fetchReoffendRisk } from '../api'

export default function Persons() {
  const navigate = useNavigate()
  const [offenders, setOffenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState(null)
  
  // Risk assessment states
  const [riskScores, setRiskScores] = useState({})
  const [activeRiskPerson, setActiveRiskPerson] = useState(null)
  const [assessingId, setAssessingId] = useState(null)

  useEffect(() => {
    fetchRepeatOffenders(30).then(data => {
      setOffenders(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (search.length < 2) return
    const timer = setTimeout(() => {
      searchPersons(search).then(setOffenders).catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const CRIME_COLORS = {
    'Cyber Crime': '#4a9ede',
    'Narcotics': '#52b788',
    'Murder & Culpable Homicide': '#e05252',
    'Robbery & Dacoity': '#e0a832',
    'Cheating & Fraud': '#c8814a',
    'Theft & Burglary': '#7f77dd',
    'Crimes Against Women': '#a855f7',
  }

  if (loading) return <LoadingPulse height={400} text="Loading person database..." />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Persons of Interest</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {offenders.length} repeat offenders identified
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <input
          className="input"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260, fontSize: 12 }}
        />
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 20,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 14,
        alignContent: 'start',
      }}>
        {offenders.map((o, idx) => (
          <div
            key={o.name + idx}
            className="card"
            style={{
              padding: 16, cursor: 'pointer',
              transition: 'border-color 0.2s, transform 0.2s',
            }}
            onClick={() => setSelectedPerson(o === selectedPerson ? null : o)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--copper-400)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {/* Avatar */}
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--copper-600), var(--copper-400))',
                border: '2px solid var(--copper-400)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>
                {o.name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                  <Link to={`/accused/${o.accused_id}`} style={{ textDecoration: 'none', color: 'var(--copper-300)' }}>
                    {o.name} →
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {o.case_count >= 10 && <Badge text="MOST WANTED" variant="badge-danger" />}
                  {o.case_count >= 5 && o.case_count < 10 && <Badge text="REPEAT OFFENDER" variant="badge-warning" />}
                  <span className="badge badge-copper">{o.case_count} cases</span>
                </div>
              </div>
            </div>

            {/* Crime type tags */}
            {o.crime_types && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {o.crime_types.slice(0, 4).map((ct, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 9, fontWeight: 500,
                      background: `${CRIME_COLORS[ct] || '#6b7280'}22`,
                      color: CRIME_COLORS[ct] || '#6b7280',
                    }}
                  >
                    {ct}
                  </span>
                ))}
              </div>
            )}

            {/* Districts */}
            {o.districts && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                📍 {o.districts.slice(0, 3).join(', ')}
              </div>
            )}

            {/* Sections */}
            {o.sections && (
              <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                {o.sections.slice(0, 4).join(' · ')}
              </div>
            )}

            {/* Syndicate */}
            {o.syndicate?.length > 0 && (
              <div style={{
                marginTop: 8, padding: '6px 8px', borderRadius: 4,
                background: 'rgba(200,129,74,0.08)', border: '1px solid var(--border-strong)',
                fontSize: 10, color: 'var(--copper-400)',
              }}>
                🔗 {o.syndicate[0].syndicate_name} — {o.syndicate[0].role}
              </div>
            )}
            {/* Action Buttons */}
            <div style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {/* Dossier button (always visible) */}
              <button
                className="btn btn-sm btn-outline"
                style={{ fontSize: 10, padding: '6px 12px', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/accused/${o.accused_id}`);
                }}
              >
                <Icon name="person" size={12} />
                View Criminal Dossier
              </button>

              {/* Risk Assessment */}
              {riskScores[o.accused_id] ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Recidivism Risk:</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: riskScores[o.accused_id].risk_score >= 0.8 ? '#e05252' :
                             riskScores[o.accused_id].risk_score >= 0.6 ? '#e0a832' :
                             riskScores[o.accused_id].risk_score >= 0.4 ? '#c8814a' : '#52b788'
                    }}>
                      {(riskScores[o.accused_id].risk_score * 100).toFixed(1)}% ({riskScores[o.accused_id].risk_level})
                    </span>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 10, padding: '6px 12px', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRiskPerson(riskScores[o.accused_id]);
                    }}
                  >
                    <Icon name="predict" size={12} />
                    View Risk Assessment Report
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-sm btn-copper"
                  style={{ fontSize: 10, padding: '6px 12px', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                  disabled={assessingId === o.accused_id}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setAssessingId(o.accused_id);
                    try {
                      const res = await fetchReoffendRisk(o.accused_id);
                      setRiskScores(prev => ({ ...prev, [o.accused_id]: res }));
                    } catch (err) {
                      console.error('[Persons] Failed to run risk assessment:', err);
                    } finally {
                      setAssessingId(null);
                    }
                  }}
                >
                  <Icon name="predict" size={12} />
                  {assessingId === o.accused_id ? 'Assessing Risk...' : '⚡ Run Risk Assessment'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Risk Report Modal */}
      {activeRiskPerson && (
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
                RECIDIVISM RISK ASSESSMENT
              </div>
              <button
                onClick={() => setActiveRiskPerson(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 6 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--copper-600), var(--copper-400))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: 'white'
              }}>
                {activeRiskPerson.accused_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{activeRiskPerson.accused_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Accused ID: {activeRiskPerson.accused_id}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Risk Level classification:</span>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: activeRiskPerson.risk_level === 'CRITICAL' ? '#e05252' :
                       activeRiskPerson.risk_level === 'HIGH' ? '#e0a832' :
                       activeRiskPerson.risk_level === 'MEDIUM' ? '#c8814a' : '#52b788'
              }}>
                {activeRiskPerson.risk_level} ({activeRiskPerson.risk_percent})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Contributing Risk Factors
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {activeRiskPerson.risk_factors.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#e05252' }}>•</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 8 }}>
              <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-primary)', padding: 8, borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TOTAL CASES</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {activeRiskPerson.total_cases}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-primary)', padding: 8, borderRadius: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ARRESTS RECORDED</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {activeRiskPerson.arrest_count}
                </div>
              </div>
            </div>

            <button
              className="btn btn-copper"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => setActiveRiskPerson(null)}
            >
              Close Assessment
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
