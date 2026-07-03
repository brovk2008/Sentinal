import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

// Fallback CSS colors for recharts (can't use CSS vars in SVG fill)
const COLOR_HEX = ['#7f77dd', '#4a9ede', '#e05252', '#c8814a', '#52b788', '#6b7280', '#a855f7', '#f97316', '#06b6d4']

export default function CrimeDonut({ data = [], total }) {
  const computedTotal = total || data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: '100%', minWidth: 0 }}>
      <div style={{ width: 180, height: 180, position: 'relative', flexShrink: 0 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={50} outerRadius={80}
              dataKey="value"
              stroke="var(--bg-card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLOR_HEX[i % COLOR_HEX.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: 6, fontSize: 12, color: 'var(--text-primary)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {computedTotal.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', maxHeight: '100%', flex: 1, paddingRight: 4 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, justifyBetween: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 2,
                background: COLOR_HEX[i % COLOR_HEX.length],
                flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 120 }} title={d.name}>
                {d.name}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <span className="mono">{d.value}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                ({(d.value / computedTotal * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
