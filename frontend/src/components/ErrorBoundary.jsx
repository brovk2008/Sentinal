/**
 * ErrorBoundary.jsx — Catches React render errors and shows a recovery UI
 * instead of a blank white screen. All major pages are wrapped in this.
 */
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', minHeight: 300,
        gap: 16, padding: 40, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e05252' }}>
          Page Render Error
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.45)', maxWidth: 400,
          fontFamily: 'monospace', background: 'rgba(224,82,82,0.08)',
          border: '1px solid rgba(224,82,82,0.2)', borderRadius: 8,
          padding: '10px 14px',
        }}>
          {this.state.error?.message || 'Unknown error'}
        </div>
        <button
          onClick={() => {
            this.setState({ hasError: false, error: null })
            window.location.reload()
          }}
          style={{
            padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(200,129,74,0.85)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 13,
            fontFamily: 'var(--font-sans)',
          }}
        >
          🔄 Reload Page
        </button>
      </div>
    )
  }
}
