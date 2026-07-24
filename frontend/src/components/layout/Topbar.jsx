import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAlerts, searchCases } from '../../api'
import { logoutUser } from '../../lib/catalystAuth'
import { useTranslation } from 'react-i18next'

export default function Topbar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())
  const [alertCount, setAlertCount] = useState(0)
  const [alerts, setAlerts] = useState([])
  const [showAlerts, setShowAlerts] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showLang, setShowLang] = useState(false)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)
  const userRef = useRef(null)
  const langRef = useRef(null)

  const LANGS = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'hi', label: 'हिं', name: 'Hindi' },
    { code: 'kn', label: 'ಕನ್', name: 'Kannada' },
    { code: 'ta', label: 'தமிழ்', name: 'Tamil' },
    { code: 'te', label: 'తె', name: 'Telugu' },
    { code: 'ur', label: 'اردو', name: 'Urdu' },
  ]

  const switchLanguage = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('sentinal_lang', code)
    window.dispatchEvent(new CustomEvent('sentinal-language-changed', { detail: { lang: code } }))
    setShowLang(false)
  }

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    fetchAlerts(10).then(a => {
      setAlerts(a)
      setAlertCount(a.length)
    }).catch(() => { })
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
      if (userRef.current && !userRef.current.contains(event.target)) {
        setShowUserDropdown(false)
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setShowLang(false)
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
        .catch(() => { })
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

  // Parse user from localstorage dynamically
  const user = JSON.parse(localStorage.getItem('sentinal_user') || '{}')
  const getDisplayName = (u) => {
    if (!u) return 'Officer'
    if (u.first_name && u.first_name.trim()) return u.first_name
    if (u.email_id) return u.email_id.split('@')[0]
    return 'Officer'
  }
  const displayName = getDisplayName(user)
  const initials = displayName.slice(0, 2).toUpperCase()

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

        <button
          onClick={() => navigate('/assistant?voice=true')}
          title="Voice Intelligence Query"
          style={{
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: 6, padding: '4px 8px',
            color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            outline: 'none'
          }}
        >
          🎙️
        </button>

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

        {/* Language Switcher */}
        <div ref={langRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLang(v => !v)}
            title={t('common.language')}
            style={{
              padding: '5px 9px', borderRadius: 6,
              border: '1px solid var(--border-default)',
              background: showLang ? 'var(--bg-card-hover)' : 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
              letterSpacing: '0.01em', transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            🌐 {LANGS.find(l => l.code === i18n.language)?.label || 'EN'}
          </button>
          {showLang && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 8, zIndex: 1001,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              overflow: 'hidden', minWidth: 130,
            }}>
              {LANGS.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => switchLanguage(lang.code)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px', background: i18n.language === lang.code
                      ? 'rgba(200,129,74,0.15)' : 'none',
                    border: 'none',
                    color: i18n.language === lang.code ? 'var(--copper-300)' : 'var(--text-primary)',
                    fontSize: 12, cursor: 'pointer',
                    fontWeight: i18n.language === lang.code ? 700 : 400,
                    fontFamily: 'var(--font-sans)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (i18n.language !== lang.code) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                  onMouseLeave={e => { if (i18n.language !== lang.code) e.currentTarget.style.background = 'none' }}
                >
                  {lang.label} — {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Demo Toggle Button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-demo-mode'))}
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--copper-400)',
            background: 'rgba(200, 129, 74, 0.1)',
            color: 'var(--copper-200)',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          ▶ DEMO
        </button>

        {/* User profile with dropdown */}
        <div ref={userRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', fontSize: 11 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{displayName}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{user.email_id?.split('@')[1] || 'Karnataka Police'}</span>
          </div>
          <div
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--copper-500), var(--copper-400))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white',
              cursor: 'pointer',
              userSelect: 'none',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {initials}
          </div>

          {showUserDropdown && (
            <div style={{
              position: 'absolute', top: '100%', right: 0,
              width: 140, background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 6, marginTop: 8, zIndex: 1000,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <button
                onClick={() => { setShowUserDropdown(false); navigate('/profile'); }}
                style={{
                  padding: '8px 12px', background: 'none', border: 'none',
                  color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer',
                  textAlign: 'left', outline: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                View Profile
              </button>
              <button
                onClick={() => { setShowUserDropdown(false); navigate('/timeline?officer=me'); }}
                style={{
                  padding: '8px 12px', background: 'none', border: 'none',
                  color: 'var(--text-primary)', fontSize: 11, cursor: 'pointer',
                  textAlign: 'left', outline: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                My Cases
              </button>
              <button
                onClick={logoutUser}
                style={{
                  padding: '8px 12px', background: 'none', border: 'none',
                  color: 'var(--status-danger)', fontSize: 11, cursor: 'pointer',
                  textAlign: 'left', borderTop: '1px solid var(--border-subtle)',
                  outline: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
