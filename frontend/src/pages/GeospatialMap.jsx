import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, CircleMarker, Popup, useMap } from 'react-leaflet'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import { fetchHeatmapGrid, fetchDistrictCenters, fetchHotspots, fetchCases, downloadDistrictReport, fetchHeatmapTimelapse } from '../api'
import PredictiveLayer from '../components/map/PredictiveLayer'
import useLiveFeed from '../hooks/useLiveFeed'
import 'leaflet/dist/leaflet.css'

// Karnataka bounds
const KA_CENTER = [14.5, 76.0]
const CRIME_TYPES = ['All', 'Murder & Culpable Homicide', 'Theft & Burglary', 'Cyber Crime', 'Narcotics', 'Cheating & Fraud', 'Crimes Against Women']

// ── Three.js 3D Globe Component (7E) ──
function ThreeGlobe({ points }) {
  const mountRef = useRef(null)

  useEffect(() => {
    if (!mountRef.current || !window.THREE) return

    const THREE = window.THREE
    const container = mountRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0a0f)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 250

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    container.appendChild(renderer.domElement)

    // Globe Sphere
    const globeRadius = 80
    const geometry = new THREE.SphereGeometry(globeRadius, 32, 32)
    const material = new THREE.MeshBasicMaterial({
      color: 0x0f0f1a,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    })
    const globe = new THREE.Mesh(geometry, material)
    scene.add(globe)

    // Solid outline globe
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a0f,
      transparent: true,
      opacity: 0.8
    })
    const outlineGlobe = new THREE.Mesh(geometry, outlineMat)
    globe.add(outlineGlobe)

    // Add glowing amber dots representing crime locations
    const dotGeom = new THREE.SphereGeometry(1.2, 8, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xc8814a })

    // Helper: convert lat/lng to 3D Cartesian coordinates
    const latLngToVector3 = (lat, lng, r) => {
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lng + 180) * (Math.PI / 180)
      const x = -(r * Math.sin(phi) * Math.sin(theta))
      const y = r * Math.cos(phi)
      const z = r * Math.sin(phi) * Math.cos(theta)
      return new THREE.Vector3(x, y, z)
    }

    // Limit to plot max 200 points for WebGL performance
    points.slice(0, 200).forEach(pt => {
      if (pt.lat && pt.lng) {
        const mesh = new THREE.Mesh(dotGeom, dotMat)
        const pos = latLngToVector3(pt.lat, pt.lng, globeRadius)
        mesh.position.copy(pos)
        globe.add(mesh)
      }
    })

    // Lighting (ambient/subtle)
    const light = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(light)

    // Drag interactions logic
    let isDragging = false
    let prevMousePosition = { x: 0, y: 0 }

    const onMouseDown = () => { isDragging = true }
    const onMouseMove = (e) => {
      const deltaMove = {
        x: e.offsetX - prevMousePosition.x,
        y: e.offsetY - prevMousePosition.y
      }

      if (isDragging) {
        globe.rotation.y += deltaMove.x * 0.005
        globe.rotation.x += deltaMove.y * 0.005
      }

      prevMousePosition = { x: e.offsetX, y: e.offsetY }
    }
    const onMouseUp = () => { isDragging = false }

    container.addEventListener('mousedown', onMouseDown)
    container.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Animation Loop
    let reqId
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      if (!isDragging) {
        globe.rotation.y += 0.001 // Slow auto rotate
      }
      renderer.render(scene, camera)
    }
    animate()

    // Handle resizing
    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(reqId)
      container.removeEventListener('mousedown', onMouseDown)
      container.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('resize', handleResize)
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [points])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
      <div style={{ position: 'absolute', bottom: 20, pointerEvents: 'none', textAlign: 'center', background: 'var(--bg-overlay)', padding: '8px 12px', borderRadius: 6 }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--copper-400)' }}>DRAG GLOBE TO ROTATE</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Projecting 200 high-gravity incidents on 3D wireframe canvas</div>
      </div>
    </div>
  )
}

function MapRefTracker({ mapRef }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])
  return null
}

export default function GeospatialMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  
  useLiveFeed({
    onNewEvent: (event) => {
      if (!mapRef.current || !event.lat || !event.lng) return

      const L = window.L
      if (!L) return

      // Add a temporary pulsing circle marker at the crime location
      const circle = L.circle([event.lat, event.lng], {
        radius: 2000,
        color: event.severity === 'CRITICAL' ? '#e05252' : '#c8814a',
        fillColor: event.severity === 'CRITICAL' ? '#e05252' : '#c8814a',
        fillOpacity: 0.4,
        weight: 2
      }).addTo(mapRef.current)

      // Animate radius expanding then remove
      let r = 2000
      const expand = setInterval(() => {
        r += 500
        circle.setRadius(r)
        circle.setStyle({ fillOpacity: Math.max(0, 0.4 - (r - 2000) / 15000) })
        if (r > 8000) {
          clearInterval(expand)
          if (mapRef.current) {
            mapRef.current.removeLayer(circle)
          }
        }
      }, 100)
    }
  })

  const [points, setPoints] = useState([])
  const [districts, setDistricts] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [casePins, setCasePins] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ year: '', crime_group: '' })
  const [showHotspots, setShowHotspots] = useState(true)
  
  // 3D Globe mode toggle
  const [globeMode, setGlobeMode] = useState(false)

  // Case pin bottom sheet state (7H)
  const [selectedCasePin, setSelectedCasePin] = useState(null)

  const [selectedDistrict, setSelectedDistrict] = useState('')
  const [districtReportLoading, setDistrictReportLoading] = useState(false)

  const handleDistrictReportDownload = async () => {
    if (!selectedDistrict) return
    setDistrictReportLoading(true)
    try {
      await downloadDistrictReport(selectedDistrict)
    } catch (e) {
      console.error(e)
    }
    setDistrictReportLoading(false)
  }

  // Prediction Mode States
  const [predictionMode, setPredictionMode] = useState(false)
  const [predictionDays, setPredictionDays] = useState(7)
  const [predictionRiskFilter, setPredictionRiskFilter] = useState('all')

  // Timelapse States
  const [isTimelapseActive, setIsTimelapseActive] = useState(false)
  const [timelapseFrames, setTimelapseFrames] = useState([])
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1000) // Default 1s per frame
  const [isTimelapsePlaying, setIsTimelapsePlaying] = useState(false)

  const startTimelapse = async () => {
    if (timelapseFrames.length === 0) {
      setLoading(true)
      try {
        const res = await fetchHeatmapTimelapse()
        setTimelapseFrames(res.frames || [])
        setCurrentFrameIndex(0)
        setIsTimelapseActive(true)
        setIsTimelapsePlaying(true)
      } catch (e) {
        console.error("Failed to load timelapse", e)
      }
      setLoading(false)
    } else {
      setCurrentFrameIndex(0)
      setIsTimelapseActive(true)
      setIsTimelapsePlaying(true)
    }
  }

  useEffect(() => {
    if (!isTimelapseActive || !isTimelapsePlaying || timelapseFrames.length === 0) return

    const interval = setInterval(() => {
      setCurrentFrameIndex(prev => {
        if (prev >= timelapseFrames.length - 1) {
          return 0
        }
        return prev + 1
      })
    }, playbackSpeed)

    return () => clearInterval(interval)
  }, [isTimelapseActive, isTimelapsePlaying, timelapseFrames, playbackSpeed])

  const loadData = () => {
    setLoading(true)
    const params = {}
    if (filters.year) params.year = filters.year
    if (filters.crime_group && filters.crime_group !== 'All') params.crime_group = filters.crime_group

    Promise.all([
      fetchHeatmapGrid(params).catch(() => []),
      fetchDistrictCenters().catch(() => []),
      fetchHotspots().catch(() => []),
      fetchCases({ limit: 15 }).catch(() => ({ cases: [] })),
    ]).then(([p, d, h, c]) => {
      setPoints(p)
      setDistricts(d)
      setHotspots(h)
      // Only show pins that have REAL coordinates from the database
      const pins = (c.cases || []).filter(cs => cs.latitude && cs.longitude)
      setCasePins(pins)
      setLoading(false)
    })
  }

  useEffect(loadData, [filters.year, filters.crime_group])

  const activePoints = (isTimelapseActive && timelapseFrames[currentFrameIndex])
    ? timelapseFrames[currentFrameIndex].points
    : points

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Filters panel */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 1000,
        background: 'var(--bg-overlay)', borderRadius: 10,
        border: '1px solid var(--border-subtle)',
        padding: 16, width: 240,
      }}>
        <div className="section-label">MAP CONTROLS</div>

        <div style={{ marginBottom: 12 }}>
          <button
            className="btn btn-sm btn-copper"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setGlobeMode(!globeMode)}
          >
            {globeMode ? '◈ View 2D Map' : '◎ View 3D Globe'}
          </button>
        </div>

        {!globeMode && (
          <>
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn btn-sm"
                style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--copper-500)', background: 'transparent', color: 'var(--copper-200)' }}
                onClick={startTimelapse}
                disabled={predictionMode}
              >
                ⏱ Play Time-Lapse
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setPredictionMode(!predictionMode)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: predictionMode ? 'var(--copper-500)' : 'transparent',
                  color: predictionMode ? 'white' : 'var(--copper-400)',
                  border: '1px solid var(--copper-400)',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {predictionMode ? '⚡ PREDICTIVE ACTIVE' : '◉ Switch to Predictive'}
              </button>
            </div>

            {predictionMode && (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '10px 12px',
                marginBottom: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600 }}>PREDICTION SETTINGS</div>
                <div>
                  <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Days Ahead: <span style={{ color: 'var(--copper-400)', fontFamily: 'var(--font-mono)' }}>{predictionDays}d</span>
                  </label>
                  <input
                    type="range"
                    min="7"
                    max="30"
                    step="7"
                    value={predictionDays}
                    onChange={e => {
                      const val = parseInt(e.target.value)
                      if (val <= 10) setPredictionDays(7)
                      else if (val <= 20) setPredictionDays(14)
                      else setPredictionDays(30)
                    }}
                    style={{
                      width: '100%',
                      accentColor: 'var(--copper-500)',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
                    <span>7d</span>
                    <span>14d</span>
                    <span>30d</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Risk Level Filter</label>
                  <select
                    className="input"
                    value={predictionRiskFilter}
                    onChange={e => setPredictionRiskFilter(e.target.value)}
                    style={{ fontSize: 10, padding: '4px 8px', height: 'auto' }}
                  >
                    <option value="all">All Levels</option>
                    <option value="high+">High & Critical</option>
                    <option value="critical">Critical Only</option>
                  </select>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 9 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }}>LEGEND</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05252' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>CRITICAL Risk (Pulsing)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0a832' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>HIGH Risk</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c8814a' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>MEDIUM Risk</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Year</label>
          <select
            className="input"
            value={filters.year}
            onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
            style={{ fontSize: 12 }}
          >
            <option value="">All Years</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Crime Type</label>
          <select
            className="input"
            value={filters.crime_group}
            onChange={e => setFilters(f => ({ ...f, crime_group: e.target.value }))}
            style={{ fontSize: 12 }}
          >
            {CRIME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Select District</label>
          <select
            className="input"
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            style={{ fontSize: 12 }}
          >
            <option value="">-- Select District --</option>
            {districts.map(d => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.case_count} cases)
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn btn-sm"
          disabled={!selectedDistrict || districtReportLoading}
          onClick={handleDistrictReportDownload}
          style={{
            width: '100%',
            justifyContent: 'center',
            borderColor: 'var(--copper-400)',
            background: 'transparent',
            color: 'var(--copper-200)',
            marginBottom: 12
          }}
        >
          {districtReportLoading ? 'Generating...' : '📄 District Report'}
        </button>

        {!globeMode && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showHotspots} onChange={e => setShowHotspots(e.target.checked)} />
            Show hotspots & pins
          </label>
        )}

        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
          {points.length.toLocaleString()} points loaded
        </div>
      </div>

      {/* Legend */}
      {!globeMode && (
        <div style={{
          position: 'absolute', bottom: 48, right: 16, zIndex: 1000,
          background: 'var(--bg-overlay)', borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          padding: '10px 14px',
        }}>
          <div className="section-label" style={{ marginBottom: 6 }}>INTENSITY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { color: '#e05252', label: 'Heinous / High' },
              { color: '#c8814a', label: 'Standard / Crime Pins' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map Rendering Container */}
      <div style={{ width: '100%', height: '100%' }}>
        {loading ? (
          <LoadingPulse height={400} text="Mapping coordinates..." />
        ) : globeMode ? (
          <ThreeGlobe points={points} />
        ) : (
          <MapContainer
            center={KA_CENTER}
            zoom={7}
            style={{ height: '100%', width: '100%', background: 'var(--bg-primary)' }}
            maxBounds={[[10, 72], [20, 80]]}
          >
            <MapRefTracker mapRef={mapRef} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CartoDB'
            />
            
            {/* Heat Points */}
            {!predictionMode && activePoints.map((p, i) => (
              <CircleMarker
                key={`hp-${i}`}
                center={[p.lat, p.lng]}
                radius={Math.max(2.5, p.intensity * 4.5)}
                fillColor={p.intensity > 0.7 ? '#e05252' : '#c8814a'}
                fillOpacity={0.45}
                stroke={false}
              />
            ))}

            {/* Clickable pins representing Case markers (7H) */}
            {!predictionMode && showHotspots && casePins.map((cp) => (
              <CircleMarker
                key={`cp-${cp.CaseMasterID}`}
                center={[cp.latitude, cp.longitude]}
                radius={6}
                fillColor="#c8814a"
                fillOpacity={0.9}
                color="#ffffff"
                weight={1.5}
                eventHandlers={{
                  click: () => {
                    setSelectedCasePin(cp)
                  }
                }}
              />
            ))}

            {/* District Hotspot Clusters */}
            {!predictionMode && showHotspots && hotspots.map((h, i) => (
              <CircleMarker
                key={`hs-${i}`}
                center={[h.lat, h.lng]}
                radius={Math.min(30, h.case_count / 5)}
                fillColor="#c8814a"
                fillOpacity={0.12}
                color="#c8814a"
                weight={1}
                dashArray="4"
              />
            ))}

            {/* Predictive layer */}
            {predictionMode && (
              <PredictiveLayer
                isActive={predictionMode}
                daysAhead={predictionDays}
                riskFilter={predictionRiskFilter}
              />
            )}
          </MapContainer>
        )}
      </div>

      {/* Case Pin Bottom Sheet (7H) */}
      {selectedCasePin && (
        <div style={{
          position: 'absolute', bottom: 42, left: 16, right: 16,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: '10px 10px 10px 10px', padding: 20, zIndex: 2000,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
          animation: 'fade-in 0.25s ease',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 16, fontWeight: 'bold' }}>{selectedCasePin.CrimeNo}</span>
              <Badge text={selectedCasePin.CaseStatusName} />
              <Badge text={selectedCasePin.CrimeGroupName} variant="badge-copper" />
            </div>
            <button
              onClick={() => setSelectedCasePin(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
            >
              ×
            </button>
          </div>

          {/* Details */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            📍 {selectedCasePin.DistrictName} District · Registered: {selectedCasePin.CrimeRegisteredDate}
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '6px 0' }}>
            {selectedCasePin.BriefFacts?.slice(0, 300)}...
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <button
              className="btn btn-copper btn-sm"
              onClick={() => {
                navigate(`/timeline/${selectedCasePin.CaseMasterID}`)
              }}
            >
              View Full Timeline
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setSelectedCasePin(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Timelapse Controls Overlay */}
      {isTimelapseActive && timelapseFrames.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 42, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: '12px 20px', zIndex: 2000,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          display: 'flex', flexDirection: 'column', gap: 10,
          width: 450, alignItems: 'center'
        }}>
          {/* Big Month Display */}
          <div style={{
            fontSize: 24, fontWeight: 'bold', fontFamily: 'var(--font-mono)',
            color: 'var(--copper-400)', tracking: '0.05em'
          }}>
            {timelapseFrames[currentFrameIndex]?.label.toUpperCase()}
          </div>

          {/* Timeline slider progress */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Jan 23</span>
            <input
              type="range"
              min="0"
              max={timelapseFrames.length - 1}
              value={currentFrameIndex}
              onChange={e => setCurrentFrameIndex(parseInt(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--copper-500)',
                background: 'var(--border-subtle)',
                height: 4,
                borderRadius: 2,
                cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Dec 24</span>
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-sm"
                onClick={() => setIsTimelapsePlaying(!isTimelapsePlaying)}
                style={{ minWidth: 70 }}
              >
                {isTimelapsePlaying ? '❚❚ Pause' : '▶ Play'}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setIsTimelapsePlaying(false)
                  setCurrentFrameIndex(0)
                }}
              >
                ■ Reset
              </button>
            </div>

            {/* Speed selection */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { speed: 1000, label: '1x' },
                { speed: 500, label: '2x' },
                { speed: 250, label: '4x' }
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => setPlaybackSpeed(s.speed)}
                  style={{
                    padding: '2px 8px', fontSize: 10, borderRadius: 4,
                    background: playbackSpeed === s.speed ? 'var(--copper-500)' : 'var(--bg-secondary)',
                    color: playbackSpeed === s.speed ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)', cursor: 'pointer'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setIsTimelapseActive(false)
                setIsTimelapsePlaying(false)
              }}
              style={{
                background: 'none', border: 'none', color: 'var(--status-danger)',
                fontSize: 11, cursor: 'pointer', outline: 'none'
              }}
            >
              Exit Timelapse
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
