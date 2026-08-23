import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { loginUser, redirectToHostedLogin } from '../lib/catalystAuth'
import { useTranslation } from 'react-i18next'
import { AlertCircle, UserCheck, Shield, Lock, ArrowRight } from 'lucide-react'
import logoImg from '../assets/logo.png'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('demo@sentinal.ksp')
  const [password, setPassword] = useState('Sentinal@2024')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await loginUser(email, password)
      setLoading(false)

      if (result.success) {
        navigate('/dashboard')
      } else {
        setError(result.error || 'Invalid credentials. Access Denied.')
      }
    } catch (err) {
      setLoading(false)
      setError('Authentication failed. Please retry.')
    }
  }

  const fillCredentials = (type) => {
    if (type === 'admin') {
      setEmail('brovaibhavkr2008@gmail.com')
      setPassword('Admin@2026')
    } else {
      setEmail('demo@sentinal.ksp')
      setPassword('Sentinal@2024')
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #14141e 0%, #0a0a0f 100%)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      padding: 20
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--card-radius)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6
        }}>
          <img
            src={logoImg}
            alt="Sentinal"
            style={{ height: 60, width: 'auto', objectFit: 'contain' }}
          />
          <div style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--copper-400)',
            letterSpacing: '0.15em',
            fontFamily: 'var(--font-mono)',
            margin: '6px 0 2px 0'
          }}>
            SENTINAL
          </div>
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em'
          }}>
            {t('auth.loginSubtitle') || 'Karnataka Police Intelligence Platform'}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              background: 'rgba(224, 82, 82, 0.08)',
              border: '1px solid var(--status-danger)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--status-danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick presets for convenience */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => fillCredentials('officer')}
              style={{ fontSize: 10, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <UserCheck size={12} color="#38bdf8" /> Demo Officer
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => fillCredentials('admin')}
              style={{ fontSize: 10, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Shield size={12} color="#f59e0b" /> Project Admin
            </button>
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              {t('auth.email') || 'Officer Email ID'}
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="demo@sentinal.ksp"
              required
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              {t('auth.password') || 'Secured Passphrase'}
            </label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-copper"
            disabled={loading}
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: 4,
              height: 38,
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{loading ? 'Authorizing Credentials...' : (t('auth.login') || 'Authenticate Access')}</span>
            {!loading && <ArrowRight size={14} />}
          </button>

          <div style={{ textAlign: 'center', margin: '4px 0', fontSize: 10, color: 'var(--text-muted)' }}>
            ── OR ──
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => redirectToHostedLogin()}
            style={{
              width: '100%',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: 11,
              color: '#94a3b8',
              height: 34,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Lock size={12} /> Sign In via Zoho Catalyst SSO
          </button>
        </form>

        {/* Footer info */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          fontSize: 10,
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div>CONFIDENTIAL SYSTEM · SECURED TERMINAL</div>
          <div>
            <Link to="/signup" style={{ color: 'var(--copper-400)', textDecoration: 'none', fontSize: 11 }}>
              {t('auth.signupTitle') || 'Register new officer account'} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
