import { useState, useEffect } from 'react'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import { fetchRepeatOffenders, searchPersons } from '../api'

export default function Persons() {
  const [offenders, setOffenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPerson, setSelectedPerson] = useState(null)

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
        gridTemplateColumns: 'repeat(auto-fill, minmax(300, 1fr))',
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
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{o.name}</div>
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
          </div>
        ))}
      </div>
    </div>
  )
}
