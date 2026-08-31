import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'

const DEFAULT_DISTRICT_DATA = [
  { district: 'Bengaluru City', total: 3850, resolved: 2640, clearance: 68.5 },
  { district: 'Mysuru City', total: 1420, resolved: 1010, clearance: 71.1 },
  { district: 'Hubballi Dharwad', total: 1180, resolved: 780, clearance: 66.1 },
  { district: 'Mangaluru City', total: 980, resolved: 690, clearance: 70.4 },
  { district: 'Belagavi City', total: 850, resolved: 560, clearance: 65.8 },
  { district: 'Kalaburagi', total: 720, resolved: 490, clearance: 68.0 },
]

export default function DistrictBar({ data = [], year1 = 2023, year2 = 2024 }) {
  // Normalize data
  const chartData = data && data.length > 0
    ? data.map(d => ({
        district: d.district || d.DistrictName || 'District',
        total: d.cases || d.year1_count || d.total || 800,
        resolved: d.resolved || d.year2_count || Math.round((d.cases || 800) * 0.68),
        clearance: d.clearance || Math.round(((d.resolved || d.year2_count || Math.round((d.cases || 800) * 0.68)) / (d.cases || d.year1_count || d.total || 800)) * 100),
      }))
    : DEFAULT_DISTRICT_DATA

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData.slice(0, 6)} layout="vertical" margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 9, fill: '#8e8d8a', fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
        <YAxis
          dataKey="district" type="category" width={105}
          tick={{ fontSize: 10, fill: '#c0beb5' }} axisLine={false} tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(15, 18, 28, 0.95)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, fontSize: 11, color: '#e8e6e0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
          formatter={(value, name) => [`${value.toLocaleString('en-IN')} Cases`, name === 'total' ? 'Reported FIRs' : 'Resolved / Chargesheeted']}
        />
        <Bar dataKey="total" name="Total FIRs" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={8} isAnimationActive={false} />
        <Bar dataKey="resolved" name="Resolved" fill="#c8814a" radius={[0, 4, 4, 0]} barSize={8} isAnimationActive={false} />
        <Legend
          wrapperStyle={{ fontSize: 10, color: '#8e8d8a', paddingTop: 4 }}
          iconType="circle" iconSize={6}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
