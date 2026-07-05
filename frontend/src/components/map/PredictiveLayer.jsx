import { useState, useEffect } from 'react'
import { CircleMarker, Popup } from 'react-leaflet'
import { fetchPredictiveHotspots } from '../../api'

const pulseStyle = `
  @keyframes predictive-pulse {
    0% {
      stroke-width: 1.5;
      fill-opacity: 0.12;
      transform: scale(0.96);
    }
    50% {
      stroke-width: 3.5;
      fill-opacity: 0.35;
      transform: scale(1.08);
    }
    100% {
      stroke-width: 1.5;
      fill-opacity: 0.12;
      transform: scale(0.96);
    }
  }
  .predictive-pulse-critical {
    animation: predictive-pulse 2.2s infinite ease-in-out;
  }
`;

export default function PredictiveLayer({ isActive, daysAhead, riskFilter = 'all' }) {
  const [predictions, setPredictions] = useState([])

  useEffect(() => {
    if (!isActive) return
    fetchPredictiveHotspots(daysAhead)
      .then(res => {
        if (res && res.predictions) {
          setPredictions(res.predictions)
        }
      })
      .catch(err => console.error('[PredictiveLayer] Failed to load hotspots:', err))
  }, [isActive, daysAhead])

  if (!isActive) return null

  // Filter predictions
  const filtered = predictions.filter(p => {
    if (riskFilter === 'critical') {
      return p.risk_level === 'CRITICAL'
    } else if (riskFilter === 'high+') {
      return p.risk_level === 'CRITICAL' || p.risk_level === 'HIGH'
    }
    return true
  })

  // Color map
  const getColor = (level) => {
    switch (level) {
      case 'CRITICAL': return '#e05252' // red
      case 'HIGH': return '#e0a832' // amber
      case 'MEDIUM': return '#c8814a' // copper
      default: return '#52b788' // green
    }
  }

  return (
    <>
      <style>{pulseStyle}</style>
      {filtered.map((p) => {
        const color = getColor(p.risk_level)
        const isCritical = p.risk_level === 'CRITICAL'
        const radiusVal = 10 + p.hotspot_prob * 25

        return (
          <div key={`pred-${p.station_id}`}>
            {/* Pulsing ring for critical stations */}
            <CircleMarker
              center={[p.lat, p.lng]}
              radius={radiusVal}
              pathOptions={{
                className: isCritical ? 'predictive-pulse-critical' : '',
                color: color,
                fillColor: color,
                fillOpacity: isCritical ? 0.25 : 0.18,
                weight: isCritical ? 2 : 1,
              }}
            />

            {/* Inner solid center dot */}
            <CircleMarker
              center={[p.lat, p.lng]}
              radius={5}
              pathOptions={{
                color: '#ffffff',
                fillColor: color,
                fillOpacity: 0.95,
                weight: 1,
              }}
            >
              <Popup>
                <div style={{ padding: '4px 6px', color: 'var(--text-primary)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                    {p.station_name}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 11 }}>
                    {p.district_name} District
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Risk Class:</span>
                      <span style={{
                        color: color, fontWeight: 700, fontSize: 11
                      }}>
                        {p.risk_level}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Probability:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {(p.hotspot_prob * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Recent Cases:</span>
                      <span>{p.recent_cases}</span>
                    </div>
                  </div>

                  <a
                    href={`/timeline?q=${encodeURIComponent(p.station_name)}`}
                    style={{
                      display: 'inline-block',
                      width: '100%',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 4,
                      padding: '4px 0',
                      color: 'var(--copper-400)',
                      textDecoration: 'none',
                      fontSize: 11,
                      fontWeight: 500,
                      marginTop: 4
                    }}
                  >
                    View Station Cases
                  </a>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        )
      })}
    </>
  )
}
