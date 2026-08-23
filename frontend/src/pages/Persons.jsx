import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Link2, Zap, ShieldAlert, Activity, FileText, User, X } from 'lucide-react'
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

  const loadPersons = async () => {
    setLoading(true)
    try {
      const res = await fetchRepeatOffenders(50)
      setOffenders(res.offenders || res || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPersons()
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!search.trim()) return loadPersons()
    setLoading(true)
    try {
      const res = await searchPersons(search.trim())
      setOffenders(res.persons || res || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            Persons of Interest & Repeat Offenders
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Unified criminal registry across 41 Karnataka police districts · MO profiles · Syndicate affiliations
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, minWidth: 320 }}>
          <input
            type="text"
            className="input"
            placeholder="Search by suspect name, alias, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 12 }}
          />
          <button type="submit" className="btn btn-copper btn-sm">
            Search
          </button>
        </form>
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingPulse height={300} />
      ) : offenders.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No persons of interest found matching your query.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {offenders.map((o, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                border: o.is_priority ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
                background: o.is_priority ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {o.AccusedName || o.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Person ID: <span className="mono">{o.PersonID || o.accused_id || `#${idx + 1}`}</span>
                  </div>
                </div>
                {o.is_priority && (
                  <span className="badge badge-danger" style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldAlert size={10} /> HIGH RISK
                  </span>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                <div><b>Age:</b> {o.AgeYear || o.age || 'N/A'}</div>
                <div><b>Total Cases:</b> <span style={{ color: 'var(--copper-400)', fontWeight: 700 }}>{o.case_count || o.total_cases || 1}</span></div>
                <div><b>Arrests:</b> {o.arrest_count || 0}</div>
              </div>

              {/* Districts */}
              {o.districts && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} color="var(--copper-400)" />
                  <span>{Array.isArray(o.districts) ? o.districts.slice(0, 3).join(', ') : o.districts}</span>
                </div>
              )}

              {/* Sections */}
              {o.sections && (
                <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                  {Array.isArray(o.sections) ? o.sections.slice(0, 4).join(' · ') : o.sections}
                </div>
              )}

              {/* Syndicate */}
              {o.syndicate?.length > 0 && (
                <div style={{
                  marginTop: 4, padding: '6px 8px', borderRadius: 4,
                  background: 'rgba(200,129,74,0.08)', border: '1px solid var(--border-strong)',
                  fontSize: 10, color: 'var(--copper-400)', display: 'flex', alignItems: 'center', gap: 5
                }}>
                  <Link2 size={11} />
                  <span>{o.syndicate[0].syndicate_name} — {o.syndicate[0].role}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                marginTop: 'auto',
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                <button
                  className="btn btn-sm btn-outline"
                  style={{ fontSize: 10, padding: '6px 12px', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/accused/${o.accused_id || o.AccusedMasterID || o.PersonID}`);
                  }}
                >
                  <User size={12} />
                  <span>View Criminal Dossier</span>
                </button>

                <button
                  className="btn btn-sm btn-copper"
                  style={{ fontSize: 10, padding: '6px 12px', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
                  disabled={assessingId === (o.accused_id || o.AccusedMasterID)}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const targetId = o.accused_id || o.AccusedMasterID || o.PersonID;
                    setAssessingId(targetId);
                    try {
                      const res = await fetchReoffendRisk(targetId);
                      setRiskScores(prev => ({ ...prev, [targetId]: res }));
                      setActiveRiskPerson(res);
                    } catch (err) {
                      console.error('[Persons] Failed to run risk assessment:', err);
                    } finally {
                      setAssessingId(null);
                    }
                  }}
                >
                  <Zap size={12} />
                  <span>{assessingId === (o.accused_id || o.AccusedMasterID) ? 'Assessing Risk...' : 'Run Risk Assessment'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Recidivism Risk Assessment
              </div>
              <button
                onClick={() => setActiveRiskPerson(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assessed Accused:</span>
                <b>{activeRiskPerson.accused_name || 'Suspect'}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Risk Score:</span>
                <span style={{
                  color: activeRiskPerson.risk_score >= 0.7 ? '#ef4444' : '#f59e0b',
                  fontWeight: 700
                }}>
                  {(activeRiskPerson.risk_score * 100).toFixed(1)}% ({activeRiskPerson.risk_level})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Primary Crime Speciality:</span>
                <b>{activeRiskPerson.crime_speciality || 'General Offence'}</b>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 6, marginTop: 4 }}>
                <div style={{ color: 'var(--copper-400)', fontWeight: 600, marginBottom: 4 }}>AI Criminological Rationale:</div>
                <div style={{ color: '#cbd5e1', lineHeight: 1.5 }}>{activeRiskPerson.rationale || 'High frequency of near-repeat offenses and historical bail violation probability.'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
