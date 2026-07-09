import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Delay simulation for premium transition look
    setTimeout(() => {
      if (email === 'demo@sentinal.ksp' && password === 'Sentinal@2024') {
        localStorage.setItem('sentinal_token', 'mock-valid-sentinal-jwt-token')
        navigate('/dashboard')
      } else {
        setError('Invalid credentials. Access Denied.')
      }
      setLoading(false)
    }, 800)
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
        maxWidth: 400,
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
          <div style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: 'var(--copper-400)',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-mono)'
          }}>
            PROJECT SENTINAL
          </div>
          <div style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em'
          }}>
            Karnataka Police Crime Intelligence Portal
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleLogin} style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              background: 'rgba(224, 82, 82, 0.08)',
              border: '1px solid var(--status-danger)',
              borderRadius: 6,
              padding: 10,
              fontSize: 12,
              color: 'var(--status-danger)',
              textAlign: 'center'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>
              Officer Email ID
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
              Secured Passphrase
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
              marginTop: 8,
              height: 38,
              fontSize: 13,
              fontWeight: 600
            }}
          >
            {loading ? 'Authorizing Credentials...' : 'Authenticate Access →'}
          </button>
        </form>

        {/* Footer info */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          fontSize: 10,
          color: 'var(--text-muted)'
        }}>
          CONFIDENTIAL SYSTEM · SECURED TERMINAL
        </div>
      </div>
    </div>
  )
}
