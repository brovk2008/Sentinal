import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAlerts, searchCases } from '../../api'

export default function Topbar() {
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())
  const [alertCount, setAlertCount] = useState(0)
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    fetchAlerts(10).then(a => {
      setAlerts(a)
      setAlertCount(a.length)
    }).catch(() => {})
    return () => clearInterval(timer)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowAlerts(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([])
      return
    }
    const delayDebounce = setTimeout(() => {
      searchCases(search)
        .then(res => {
          setSearchResults(res.slice(0, 8))
          setShowSearchDropdown(true)
        })
        .catch(() => {})
    }, 400)

    return () => clearTimeout(delayDebounce)
  }, [search])

  const handleResultClick = (caseId) => {
    setSearch('')
    setShowSearchDropdown(false)
    navigate(`/timeline/${caseId}`)
  }

  const getAlertColor = (severity) => {
    if (severity === 'critical') return 'var(--status-danger)'
    if (severity === 'high') return 'var(--status-warning)'
    return 'var(--status-info)'
  }

  return (
    <header style={{
      gridColumn: '2',
      gridRow: '1',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: 'var(--topbar-height)',
      zIndex: 90,
    }}>
      {/* Left — title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.02em',
        }}>
          COMMAND CENTER
        </div>
        <div className="badge badge-success" style={{ fontSize: 9 }}>
          <span className="live-dot" style={{ marginRight: 4 }} />
          LIVE
        </div>
      </div>

      {/* Right — clock, alerts, search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Search */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <input
            className="input"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setShowSearchDropdown(true)
            }}
            placeholder="Search cases, persons, details..."
            style={{
              width: 280,
              paddingLeft: 32,
              fontSize: 12,
              height: 32,
              background: 'var(--bg-primary)',
            }}
          />
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: 'var(--text-muted)',
          }}>⌕</span>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border-default)',
              borderRadius: 6, marginTop: 4, zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
              {searchResults.map(res => (
                <div
                  key={res.CaseMasterID}
                  onClick={() => handleResultClick(res.CaseMasterID)}
                  style={{
                    padding: '8px 12px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 11,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="mono" style={{ color: 'var(--copper-400)', fontWeight: 'bold' }}>
                    {res.CrimeNo}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {res.CrimeGroupName} — {res.BriefFacts?.slice(0, 45)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alert Bell and Sliding Notification Panel (7B) */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowAlerts(!showAlerts)}
            style={{ position: 'relative', cursor: 'pointer', fontSize: 16 }}
          >
            🔔
            {alertCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -6,
                background: 'var(--status-danger)', color: 'white',
                fontSize: 9, fontWeight: 700,
                borderRadius: 8, padding: '1px 5px',
                minWidth: 14, textAlign: 'center',
              }}>
                {alertCount}
              </span>
            )}
          </div>

          {/* Notification sliding drawer */}
          {showAlerts && (
            <div style={{
              position: 'absolute', top: '100%', right: 0,
              width: 320, background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 8, marginTop: 8, zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              padding: 12, maxHeight: 400, overflowY: 'auto',
            }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Alert Notifications</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.map(a => (
                  <div
                    key={a.id}
                    onClick={() => {
                      setShowAlerts(false)
                      if (a.case_id) navigate(`/timeline/${a.case_id}`)
                    }}
                    style={{
                      padding: 8, background: 'var(--bg-secondary)',
                      borderRadius: 6, cursor: a.case_id ? 'pointer' : 'default',
                      borderLeft: `3px solid ${getAlertColor(a.severity)}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 500 }}>
                      <span>{a.title}</span>
                      <span className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>Q4 2024</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {a.description}
                    </div>
                    {a.case_id && (
                      <div className="mono" style={{ fontSize: 9, color: 'var(--copper-400)', marginTop: 4 }}>
                        Case link: CM-{a.case_id}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clock */}
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
          {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          {' '}
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        {/* User avatar */}
        <div style={{
          width: 30, height: 30,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--copper-500), var(--copper-400))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, color: 'white',
        }}>
          SP
        </div>
      </div>
    </header>
  )
}
