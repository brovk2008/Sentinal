import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import { fetchLiveRiskScore, fetchSyndicates } from '../api'
import useLiveFeed from '../hooks/useLiveFeed'
import 'leaflet/dist/leaflet.css'

function TacticalMapTracker({ liveEvent }) {
  const map = useMap()
  useEffect(() => {
    if (!liveEvent || !liveEvent.lat || !liveEvent.lng) return
    map.panTo([liveEvent.lat, liveEvent.lng])
  }, [liveEvent, map])
  return null
}

export default function WarRoom() {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState('02:14:33')
  const [prediction, setPrediction] = useState(null)
  const [operations, setOperations] = useState([])
  const [lastLiveEvent, setLastLiveEvent] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Listen to live SSE feed
  const { events } = useLiveFeed({
    onNewEvent: (event) => {
      setLastLiveEvent(event)
    }
  })

  // Fetch top risk for countdown
  useEffect(() => {
    fetchLiveRiskScore().then(data => {
      const topHotspot = data.top_hotspots?.[0]
      if (topHotspot) {
        const hoursAhead = Math.random() * 3 + 1
        setPrediction({
          district: topHotspot.district_name,
          station: topHotspot.station_name,
          confidence: Math.round(topHotspot.hotspot_prob * 100),
          target_time: new Date(Date.now() + hoursAhead * 3600 * 1000)
        })
      }
    }).catch(() => { })

    // Fetch operations list seeded from actual syndicates
    fetchSyndicates().then(data => {
      const synList = data || []
      const ops = synList.map((s, idx) => {
        const codenames = ['SHADOW NET', 'BLACK CIRCUIT', 'EAGLE EYE', 'GOLDEN COBRA', 'SILENT WARRIOR', 'VOID WALKER']
        const name = `OP ${codenames[idx % codenames.length]} (${s.syndicate_name})`
        let status = 'SURVEILLANCE'
        let color = '#52b788'
        if (s.total_cases >= 100) {
          status = 'PURSUING'
          color = '#e05252'
        } else if (s.total_cases >= 50) {
          status = 'MONITORING'
          color = '#e0a832'
        }
        return {
          id: s.syndicate_id,
          name,
          cases: s.total_cases,
          status,
          color
        }
      })
      setOperations(ops)
    }).catch(() => { })
  }, [])

  // Timer loop
  useEffect(() => {
    if (!prediction) return
    const interval = setInterval(() => {
      const diff = prediction.target_time - Date.now()
      if (diff <= 0) {
        setCountdown('THREAT WINDOW ACTIVE')
        clearInterval(interval)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [prediction])

  // Full screen shortcut
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => setIsFullscreen(true))
        } else {
          document.exitFullscreen().then(() => setIsFullscreen(false))
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#040406', zIndex: 9999, display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', padding: 12,
      overflow: 'hidden', boxSizing: 'border-box'
    }}>

      {/* ─── HEADER BAR ─── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '2px solid var(--border-default)', paddingBottom: 8, marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="live-dot" style={{ background: '#e05252' }} />
          <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.15em' }}>
            PROJECT SENTINAL ● OPERATION WAR ROOM ● KSP TACTICAL COMMAND
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Press [F] for Fullscreen</span>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'transparent', border: '1px solid #e05252', borderRadius: 4,
              color: '#e05252', padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 600
            }}
          >
            [EXIT WAR ROOM ×]
          </button>
        </div>
      </div>

      {/* ─── TOP CONTENT ROW (COUNTDOWN + OPERATIONS + LIVE FEED) ─── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 12,
        height: '240px', marginBottom: 12
      }}>
        {/* PANEL 1: OPERATIONS */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
            ACTIVE OPERATIONS
          </div>
          {operations.slice(0, 6).map((op, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: 170 }}>{op.name}</div>
              <div style={{ color: op.color, fontWeight: 'bold' }}>{op.status}</div>
            </div>
          ))}
        </div>

        {/* PANEL 2: LIVE ALERTS TIMELINES */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PREDICTED INCIDENT COUNTDOWN WINDOW</div>
          <div style={{
            fontSize: countdown.includes('ACTIVE') ? 22 : 36,
            fontWeight: 900,
            color: countdown.includes('ACTIVE') ? '#e05252' : 'var(--copper-400)',
            letterSpacing: '0.1em'
          }}>
            {countdown}
          </div>
          {prediction && (
            <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-secondary)' }}>
              LOCATION: <span style={{ color: 'var(--text-primary)' }}>{prediction.district} ({prediction.station} PS)</span> · CONFIDENCE: <span style={{ color: 'var(--status-success)', fontWeight: 700 }}>{prediction.confidence}%</span>
            </div>
          )}
        </div>

        {/* PANEL 3: INTERCEPT CHATTER STREAM */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
            LIVE COMMS STREAM Intercept
          </div>
          {events.slice(0, 10).map((ev, i) => (
            <div key={i} style={{ fontSize: 9, lineHeight: 1.3, padding: 4, background: 'rgba(255,255,255,0.01)', borderLeft: ev.severity === 'CRITICAL' ? '2px solid #e05252' : 'none' }}>
              <span style={{ color: 'var(--copper-400)' }}>[{new Date(ev.timestamp).toLocaleTimeString()}]</span> {ev.crime_type} in {ev.district} (severity: {ev.severity})
            </div>
          ))}
        </div>
      </div>

      {/* ─── TACTICAL MAP CONTAINER ─── */}
      <div style={{
        flex: 1, border: '1px solid var(--border-default)', borderRadius: 6,
        overflow: 'hidden', position: 'relative', marginBottom: 12
      }}>
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 1000,
          background: 'rgba(4,4,6,0.9)', border: '1px solid var(--border-strong)',
          borderRadius: 4, padding: '6px 12px', fontSize: 10
        }}>
          🌍 TACTICAL GEOSPATIAL MAP FEED OVERLAY · PREDICTIVE ACTIVE
        </div>
        <MapContainer
          center={[12.97, 77.59]}
          zoom={9}
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0a0a0f' }}
        >
          <TacticalMapTracker liveEvent={lastLiveEvent} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CartoDB'
          />
          {lastLiveEvent && lastLiveEvent.lat && (
            <CircleMarker
              center={[lastLiveEvent.lat, lastLiveEvent.lng]}
              radius={14}
              fillColor="#e05252"
              fillOpacity={0.7}
              stroke={true}
              color="#e05252"
              weight={2}
            />
          )}
        </MapContainer>
      </div>

      {/* ─── RESOURCES STATUS BAR ─── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, height: '90px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>RESOURCE OFFICERS DEPLOYED</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 9 }}>
            <div>Arjun R: <span style={{ color: '#52b788' }}>ACTIVE</span></div>
            <div>Priya S: <span style={{ color: '#52b788' }}>ACTIVE</span></div>
            <div>Ravi K: <span style={{ color: 'var(--text-muted)' }}>STANDBY</span></div>
            <div>Meera D: <span style={{ color: '#52b788' }}>ACTIVE</span></div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-default)',
          borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>UNIT LOGISTICS DEPLOYMENTS</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 10, marginTop: 4 }}>
            <div>🚨 Bengaluru HQ: <span style={{ color: 'var(--copper-400)', fontWeight: 700 }}>18 units</span></div>
            <div>🚨 Mysuru Command: <span style={{ color: 'var(--copper-400)', fontWeight: 700 }}>12 units</span></div>
            <div>🚨 Belagavi Border: <span style={{ color: 'var(--copper-400)', fontWeight: 700 }}>8 units</span></div>
          </div>
        </div>
      </div>

    </div>
  )
}
