import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function TrendLine({ data = [], dataKey = 'count', color = '#c8814a' }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <XAxis
          dataKey="month" tick={{ fontSize: 9, fill: '#9a9890' }}
          axisLine={false} tickLine={false}
        />
        <YAxis tick={{ fontSize: 9, fill: '#9a9890' }} axisLine={false} tickLine={false} width={30} />
        <Tooltip
          contentStyle={{
            background: '#13131f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, fontSize: 12, color: '#e8e6e0',
          }}
        />
        <Line
          type="monotone" dataKey={dataKey}
          stroke={color} strokeWidth={2}
          dot={false} activeDot={{ r: 4, fill: color }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
