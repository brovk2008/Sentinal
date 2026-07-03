export default function RiskGauge({ value = 78, label = 'Crime Risk Index' }) {
  const radius = 56
  const stroke = 9
  const circumference = Math.PI * radius // Half-circle arc length
  const progress = (value / 100) * circumference
  const cx = 80
  const cy = 80

  // Color based on value
  const color = value >= 70 ? '#e05252' : value >= 40 ? '#e0a832' : '#52b788'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
      {/* viewBox tall enough: width=160, height=110 so arc + text never clips */}
      <svg width="100%" viewBox="0 0 160 110" style={{ maxWidth: 160, overflow: 'visible' }}>
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        {/* Value text centered inside arc */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#e8e6e0"
              fontFamily="'JetBrains Mono', monospace" fontSize="24" fontWeight="700">
          {value}%
        </text>
        {/* Label below value */}
        <text
          x={cx} y={cy + 8} textAnchor="middle" fill="#5a5855" fontSize="9"
          style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          {label}
        </text>
        {/* Min/max ticks */}
        <text x={cx - radius - 4} y={cy + 16} textAnchor="middle" fill="#4a4845" fontSize="8">0</text>
        <text x={cx + radius + 4} y={cy + 16} textAnchor="middle" fill="#4a4845" fontSize="8">100</text>
      </svg>
    </div>
  )
}
