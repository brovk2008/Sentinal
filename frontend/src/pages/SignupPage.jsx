import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signupUser } from '../lib/catalystAuth'

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const result = await signupUser(form.name, form.email, form.password)
    setLoading(false)

    if (result.success) {
      setSuccess('Account created. Check your email to verify, then login.')
      setTimeout(() => navigate('/login'), 2500)
    } else {
      setError(result.error || 'Signup failed. Please try again.')
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    padding: '9px 12px',
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
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
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--card-radius)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            fontSize: 24, fontWeight: 'bold', color: 'var(--copper-400)',
            letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
          }}>
            PROJECT SENTINAL
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Officer Account Registration
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              background: 'rgba(224,82,82,0.08)', border: '1px solid var(--status-danger)',
              borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--status-danger)', textAlign: 'center',
            }}>⚠️ {error}</div>
          )}
          {success && (
            <div style={{
              background: 'rgba(72,199,142,0.08)', border: '1px solid var(--status-success)',
              borderRadius: 6, padding: 10, fontSize: 12, color: 'var(--status-success)', textAlign: 'center',
            }}>✅ {success}</div>
          )}

          {[
            { label: 'Full Name', name: 'name', type: 'text', placeholder: 'Inspector Rajesh Kumar' },
            { label: 'Officer Email ID', name: 'email', type: 'email', placeholder: 'officer@ksp.gov.in' },
            { label: 'Secured Passphrase', name: 'password', type: 'password', placeholder: '••••••••' },
            { label: 'Confirm Passphrase', name: 'confirm', type: 'password', placeholder: '••••••••' },
          ].map(field => (
            <div key={field.name}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {field.label}
              </label>
              <input
                name={field.name}
                type={field.type}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                required
                style={inputStyle}
              />
            </div>
          ))}

          <button
            type="submit"
            className="btn btn-copper"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4, height: 38, fontSize: 13, fontWeight: 600 }}
          >
            {loading ? 'Creating Account...' : 'Register Officer Account →'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            Already have access?{' '}
            <Link to="/login" style={{ color: 'var(--copper-400)', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center', background: 'var(--bg-secondary)',
          fontSize: 10, color: 'var(--text-muted)',
        }}>
          CONFIDENTIAL SYSTEM · SECURED TERMINAL
        </div>
      </div>
    </div>
  )
}
