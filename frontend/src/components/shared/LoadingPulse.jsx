export default function LoadingPulse({ height = 200, text = 'Loading intelligence...' }) {
  return (
    <div style={{
      height,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid var(--border-subtle)',
        borderTop: '2px solid var(--copper-400)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
        {text}
      </div>
    </div>
  )
}
