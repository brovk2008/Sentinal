export default function CaseTag({ crimeNo, crimeType, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      <span className="mono" style={{ fontSize: 11 }}>{crimeNo}</span>
      {crimeType && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{crimeType}</span>
      )}
    </div>
  )
}
