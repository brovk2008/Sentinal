import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icons'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const cached = localStorage.getItem('sentinal_user')
    if (cached) {
      setUser(JSON.parse(cached))
    }
  }, [])

  if (!user) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)' }}>
        Loading user profile...
      </div>
    )
  }

  const getDisplayName = (u) => {
    if (!u) return 'Officer'
    if (u.first_name && u.first_name.trim()) return `${u.first_name} ${u.last_name || ''}`.trim()
    if (u.email_id) return u.email_id.split('@')[0]
    return 'Officer'
  }

  const handleSignOut = () => {
    localStorage.removeItem('sentinal_authed')
    localStorage.removeItem('sentinal_user')
    window.location.href = '/__catalyst/auth/logout?service_url=' +
      encodeURIComponent(window.location.origin + '/#/login')
  }

  return (
    <div style={{ padding: 40, maxWidth: 640, margin: '0 auto' }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 12,
        padding: 32,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--copper-500), var(--copper-300))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 700, color: '#000'
          }}>
            {getDisplayName(user).slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 22, fontWeight: 700 }}>
              {getDisplayName(user)}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {user.email_id}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <div style={{
            display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between',
            paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Role</span>
            <span className="mono" style={{ color: 'var(--copper-300)', fontSize: 13, fontWeight: 600 }}>
              {user.role?.toUpperCase() || 'OFFICER'}
            </span>
          </div>
          <div style={{
            display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between',
            paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>User ID</span>
            <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {user.user_id || 'N/A'}
            </span>
          </div>
          <div style={{
            display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between',
            paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Security Domain</span>
            <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {user.email_id?.split('@')[1] || 'Karnataka Police'}
            </span>
          </div>
          <div style={{
            display: 'flex', justifyItems: 'space-between', justifyContent: 'space-between',
            paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Jurisdiction</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              State Crime Intelligence Unit
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate('/timeline?officer=me')}
            style={{ flex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="cases" size={14} />
            My Active Cases
          </button>
          <button
            onClick={handleSignOut}
            style={{
              flex: 1, height: 40,
              background: 'rgba(224, 82, 82, 0.1)',
              border: '1px solid rgba(224, 82, 82, 0.4)',
              color: '#e05252', borderRadius: 6, fontWeight: 600,
              cursor: 'pointer', transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(224, 82, 82, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(224, 82, 82, 0.1)'}
          >
            <Icon name="close" size={14} color="#e05252" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
