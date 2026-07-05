import useLiveFeed from '../../hooks/useLiveFeed'

export default function LiveFeed() {
  const { events, connected } = useLiveFeed()

  // Format events for ticker display
  const tickerItems = events.map(e =>
    `${new Date(e.timestamp).toLocaleTimeString('en-IN')} · ` +
    `${e.severity === 'CRITICAL' ? '🔴 CRITICAL — ' : ''}` +
    `${e.crime_type} · ${e.district} · ${e.station} · ` +
    `Case ${e.crime_no?.slice(-8)}`
  )

  const tickerText = tickerItems.join('     ·     ')

  return (
    <div style={{
      gridColumn: '1 / -1',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      height: 32,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Live indicator */}
      <div style={{
        flexShrink: 0,
        padding: '0 12px',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        color: connected ? 'var(--status-success)' : 'var(--status-danger)',
        letterSpacing: '0.08em',
        height: '100%'
      }}>
        <span className="live-dot" style={{
          background: connected ? 'var(--status-success)' : 'var(--status-danger)'
        }} />
        LIVE
      </div>

      {/* Scrolling ticker */}
      <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
        <div style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          animation: 'ticker-scroll 60s linear infinite',
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: '32px',
          paddingLeft: '100%'
        }}>
          {tickerText || 'Awaiting intelligence feed...'}
        </div>
      </div>
    </div>
  )
}
