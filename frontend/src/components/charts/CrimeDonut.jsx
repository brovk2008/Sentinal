import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ZiaText } from '../layout/ZiaTranslate'

const COLOR_HEX = [
  '#38bdf8', // Cyber - Cyan
  '#f59e0b', // Theft - Amber
  '#a855f7', // Fraud - Purple
  '#10b981', // Narcotics - Emerald
  '#f43f5e', // Heinous - Rose
  '#c8814a', // Extortion - Copper
  '#64748b', // Other - Slate
  '#ec4899', // Crimes against Women - Pink
  '#06b6d4', // Economic - Teal
]

export default function CrimeDonut({ data = [], total }) {
  const computedTotal = total || data.reduce((s, d) => s + d.value, 0) || 10000

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%', minWidth: 0, width: '100%' }}>
      {/* Donut Graphic */}
      <div style={{ width: 125, height: 125, position: 'relative', flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={36} outerRadius={58}
              dataKey="value"
              stroke="#0a0c14"
              strokeWidth={2}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLOR_HEX[i % COLOR_HEX.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 18, 28, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 11, color: '#e8e6e0',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
              formatter={(value, name) => [`${value.toLocaleString('en-IN')} Cases (${((value / computedTotal) * 100).toFixed(1)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {computedTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 7, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>
            TOTAL FIRs
          </div>
        </div>
      </div>

      {/* Legend List */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        overflowY: 'auto', maxHeight: '100%', flex: 1, minWidth: 0,
      }}>
        {data.map((d, i) => {
          const color = COLOR_HEX[i % COLOR_HEX.length]
          const pct = ((d.value / computedTotal) * 100).toFixed(1)
          return (
            <div
              key={d.name || i}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '3px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.03)',
                fontSize: 10,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: 2,
                  background: color,
                  boxShadow: `0 0 4px ${color}88`,
                  flexShrink: 0,
                }} />
                <span style={{
                  color: 'var(--text-secondary)',
                  textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                  fontSize: 10,
                }} title={d.name}>
                  <ZiaText>{d.name}</ZiaText>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-primary)' }}>{d.value.toLocaleString('en-IN')}</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, color: color,
                  background: `${color}18`, padding: '1px 3px', borderRadius: 3,
                }}>
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
