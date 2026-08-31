import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { ZiaText } from '../layout/ZiaTranslate'

const sparkData = [
  { v: 30 }, { v: 45 }, { v: 38 }, { v: 52 }, { v: 48 },
  { v: 60 }, { v: 55 }, { v: 70 }, { v: 65 }, { v: 78 },
  { v: 72 }, { v: 85 },
]

export default function KpiCard({
  label,
  value,
  change,
  changeType = 'up',
  onClick,
  sparklineData,
  accentColor = '#c8814a',
  subtext,
  icon: Icon,
}) {
  const isUp = changeType === 'up'
  const isLive = change && String(change).toLowerCase().includes('live')

  const data = sparklineData && sparklineData.length > 0
    ? sparklineData.map(v => ({ v }))
    : sparkData

  const gradientId = `kpiGrad-${label.replace(/[^a-zA-Z0-9]/g, '')}`

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
        borderTop: `2px solid ${accentColor}`,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, var(--bg-card) 100%)',
        boxShadow: `0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)`,
        transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.35), 0 0 15px ${accentColor}22`
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)'
        }
      }}
    >
      {/* Sparkline background */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0, width: '55%', height: '55%',
        opacity: 0.35, pointerEvents: 'none',
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity={0.6} />
                <stop offset="100%" stopColor={accentColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="v" stroke={accentColor}
              fill={`url(#${gradientId})`} strokeWidth={1.5}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Header with Icon and Label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div className="section-label" style={{ marginBottom: 0, color: 'var(--text-secondary)', fontSize: 10 }}>
          <ZiaText>{label}</ZiaText>
        </div>
        {Icon && (
          <div style={{ color: accentColor, opacity: 0.85 }}>
            <Icon size={14} />
          </div>
        )}
      </div>

      {/* Value */}
      <div
        data-testid="kpi-value"
        style={{
          fontSize: 24, fontWeight: 700, color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)', lineHeight: 1.1,
          marginTop: 2, position: 'relative', zIndex: 2,
          letterSpacing: '-0.02em',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>

      {/* Change & Subtext Row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 4, position: 'relative', zIndex: 2,
      }}>
        {change && (
          <div style={{
            fontSize: 10, fontWeight: 600,
            color: isLive ? '#38bdf8' : isUp ? 'var(--status-success)' : 'var(--status-danger)',
            display: 'flex', alignItems: 'center', gap: 3,
            background: isLive ? 'rgba(56, 189, 248, 0.12)' : isUp ? 'rgba(82, 183, 136, 0.12)' : 'rgba(224, 82, 82, 0.12)',
            padding: '1px 6px', borderRadius: 4,
          }}>
            {isLive ? '●' : isUp ? '▲' : '▼'} {change}
          </div>
        )}
        {subtext && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            <ZiaText>{subtext}</ZiaText>
          </div>
        )}
      </div>

      {onClick && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          color: 'var(--text-muted)', fontSize: 13, opacity: 0.6,
        }}>›</div>
      )}
    </div>
  )
}
