import { useState, useEffect } from 'react'
import { fetchAlerts } from '../../api'

export default function LiveFeed() {
  const [alerts, setAlerts] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    const load = () => {
      fetchAlerts(10).then(setAlerts).catch(() => {})
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (alerts.length === 0) return
    const timer = setInterval(() => {
      setCurrentIdx(i => (i + 1) % alerts.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [alerts.length])

  const current = alerts[currentIdx]

  return (
    <div style={{
      gridColumn: '1 / 3',
      gridRow: '3',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      overflow: 'hidden',
      fontSize: 11,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        color: 'var(--copper-400)', fontFamily: 'var(--font-mono)', fontSize: 10,
        fontWeight: 600, flexShrink: 0,
      }}>
        <span className="live-dot" style={{ background: 'var(--status-danger)' }} />
        INTEL FEED
      </div>
      <div style={{
        marginLeft: 16, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
      }}>
        {current ? (
          <span>
            <span className="badge badge-danger" style={{ marginRight: 8, fontSize: 8 }}>
              {current.type}
            </span>
            {current.title} — {current.description}
          </span>
        ) : (
          'Monitoring all systems...'
        )}
      </div>
      <div className="mono" style={{ flexShrink: 0, marginLeft: 16, fontSize: 10, color: 'var(--text-muted)' }}>
        {alerts.length > 0 ? `${currentIdx + 1}/${alerts.length}` : '—'}
      </div>
    </div>
  )
}
