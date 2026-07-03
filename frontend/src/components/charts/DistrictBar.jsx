import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function DistrictBar({ data = [], year1 = 2023, year2 = 2024 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
        <XAxis type="number" tick={{ fontSize: 10, fill: '#9a9890' }} axisLine={false} tickLine={false} />
        <YAxis
          dataKey="district" type="category" width={110}
          tick={{ fontSize: 10, fill: '#9a9890' }} axisLine={false} tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#13131f', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, fontSize: 12, color: '#e8e6e0',
          }}
        />
        <Bar dataKey="year1_count" name={String(year1)} fill="#534AB7" radius={[0, 3, 3, 0]} barSize={10} isAnimationActive={false} />
        <Bar dataKey="year2_count" name={String(year2)} fill="#c8814a" radius={[0, 3, 3, 0]} barSize={10} isAnimationActive={false} />
        <Legend
          wrapperStyle={{ fontSize: 10, color: '#9a9890' }}
          iconType="square" iconSize={8}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
