import { AreaChart, Area, ResponsiveContainer } from 'recharts'

const sparkData = [
  { v: 30 }, { v: 45 }, { v: 38 }, { v: 52 }, { v: 48 },
  { v: 60 }, { v: 55 }, { v: 70 }, { v: 65 }, { v: 78 },
  { v: 72 }, { v: 85 },
]

export default function KpiCard({ label, value, change, changeType = 'up', onClick, sparklineData }) {
  const isUp = changeType === 'up'

  const data = sparklineData && sparklineData.length > 0
    ? sparklineData.map(v => ({ v }))
    : sparkData

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Sparkline background */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0, width: '50%', height: '50%',
        opacity: 0.15,
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <Area
              type="monotone" dataKey="v" stroke="var(--copper-400)"
              fill="var(--copper-500)" strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="section-label" style={{ marginBottom: 0 }}>{label}</div>
      <div
        data-testid="kpi-value"
        style={{
          fontSize: 26, fontWeight: 700, color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)', lineHeight: 1.1,
        }}
      >
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      {change && (
        <div style={{
          fontSize: 11,
          color: isUp ? 'var(--status-success)' : 'var(--status-danger)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {isUp ? '▲' : '▼'} {change}
        </div>
      )}
      {onClick && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          color: 'var(--text-muted)', fontSize: 14,
        }}>›</div>
      )}
    </div>
  )
}
