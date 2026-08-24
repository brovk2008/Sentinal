/**
 * BackendWakeup.jsx
 * Shows a non-blocking toast banner when AppSail is cold-starting (503 warm-up).
 * Disappears automatically once the backend responds successfully or after 5 seconds.
 */
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function BackendWakeup() {
  const [warming, setWarming] = useState(false)
  const [dots, setDots] = useState('')

  useEffect(() => {
    let dismissTimer = null
    const handler = (e) => {
      const isWarm = e.detail?.warming ?? false
      setWarming(isWarm)
      if (isWarm) {
        // Auto-dismiss safety: never stay stuck on screen for more than 5s
        if (dismissTimer) clearTimeout(dismissTimer)
        dismissTimer = setTimeout(() => setWarming(false), 5000)
      }
    }
    window.addEventListener('backend-wakeup', handler)
    return () => {
      window.removeEventListener('backend-wakeup', handler)
      if (dismissTimer) clearTimeout(dismissTimer)
    }
  }, [])

  // Animated dots
  useEffect(() => {
    if (!warming) return
    const id = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.')
    }, 500)
    return () => clearInterval(id)
  }, [warming])

  if (!warming) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 48,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      background: 'rgba(10,10,22,0.96)',
      border: '1px solid rgba(200,129,74,0.5)',
      borderRadius: 12,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      animation: 'fadeInUp 0.3s ease',
      minWidth: 280,
    }}>
      {/* Pulsing indicator */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: '#c8814a',
        animation: 'pulse 1s ease-in-out infinite',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#e8a87c', fontFamily: 'var(--font-sans)' }}>
          Backend Warming Up{dots}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
          AppSail cold-start detected — retrying automatically
        </div>
      </div>
      <button
        onClick={() => setWarming(false)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
        }}
        title="Dismiss"
      >
        <X size={14} />
      </button>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}

