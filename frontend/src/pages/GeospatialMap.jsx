import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, CircleMarker, Circle, Polyline, Popup, useMap } from 'react-leaflet'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import { fetchHeatmapGrid, fetchDistrictCenters, fetchHotspots, fetchCases, downloadDistrictReport, fetchHeatmapTimelapse, fetchDbscanClusters, fetchPredictNext, fetchMovementTrail } from '../api'
import PredictiveLayer from '../components/map/PredictiveLayer'
import useLiveFeed from '../hooks/useLiveFeed'
import 'leaflet/dist/leaflet.css'

// Karnataka bounds
const KA_CENTER = [14.5, 76.0]
const CRIME_TYPES = ['All', 'Murder & Culpable Homicide', 'Theft & Burglary', 'Cyber Crime', 'Narcotics', 'Cheating & Fraud', 'Crimes Against Women']

// ── Three.js 3D Globe Component (7E) ──
function ThreeGlobe({ points }) {
  const mountRef = useRef(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!mountRef.current) return
    if (!window.THREE) {
      const t = setTimeout(() => setRetry(r => r + 1), 300)
      return () => clearTimeout(t)
    }

    const THREE = window.THREE
    const container = mountRef.current
    const width = container.clientWidth || 800
    const height = container.clientHeight || 500

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060812)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.z = 240

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Main Globe Group
    const globeGroup = new THREE.Group()
    scene.add(globeGroup)

    const globeRadius = 75

    // 1. Inner Solid Globe (Dark Ocean Core)
    const oceanGeom = new THREE.SphereGeometry(globeRadius - 0.2, 64, 64)
    const oceanMat = new THREE.MeshPhongMaterial({
      color: 0x09101d,
      emissive: 0x030712,
      specular: 0x1e293b,
      shininess: 15,
      transparent: true,
      opacity: 0.95
    })
    const oceanSphere = new THREE.Mesh(oceanGeom, oceanMat)
    globeGroup.add(oceanSphere)

    // 2. Tech Wireframe Grid
    const wireGeom = new THREE.SphereGeometry(globeRadius, 36, 18)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15
    })
    const wireSphere = new THREE.Mesh(wireGeom, wireMat)
    globeGroup.add(wireSphere)

    // 3. Equator & Major Lat/Lng Accent Rings
    const createRing = (radius, color, rotX = 0, rotY = 0, opacity = 0.4) => {
      const ringGeom = new THREE.RingGeometry(radius - 0.3, radius + 0.3, 64)
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity
      })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      ring.rotation.x = rotX
      ring.rotation.y = rotY
      return ring
    }
    globeGroup.add(createRing(globeRadius + 0.1, 0xd97706, Math.PI / 2, 0, 0.5)) // Equator (Amber)
    globeGroup.add(createRing(globeRadius + 0.1, 0x00f0ff, 0, 0, 0.3)) // Prime Meridian (Cyan)

    // 4. Outer Atmosphere Glow Halo
    const atmoGeom = new THREE.SphereGeometry(globeRadius + 4, 32, 32)
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.12
    })
    const atmoSphere = new THREE.Mesh(atmoGeom, atmoMat)
    scene.add(atmoSphere)

    // Helper: convert lat/lng to 3D Cartesian coordinates
    const latLngToVector3 = (lat, lng, r) => {
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lng + 180) * (Math.PI / 180)
      const x = -(r * Math.sin(phi) * Math.sin(theta))
      const y = r * Math.cos(phi)
      const z = r * Math.sin(phi) * Math.cos(theta)
      return new THREE.Vector3(x, y, z)
    }

    // Default Karnataka / India crime clusters
    const FALLBACK_POINTS = [
      { lat: 12.9716, lng: 77.5946, severity: 'high' },   // Bengaluru
      { lat: 15.3647, lng: 75.1240, severity: 'medium' }, // Hubballi
      { lat: 15.1394, lng: 76.9214, severity: 'critical' },// Ballari
      { lat: 15.8497, lng: 74.4977, severity: 'medium' }, // Belagavi
      { lat: 12.2958, lng: 76.6394, severity: 'high' },   // Mysuru
      { lat: 17.3850, lng: 78.4867, severity: 'medium' }, // Hyderabad area
      { lat: 14.4426, lng: 75.7218, severity: 'low' },    // Davanagere
      { lat: 13.3409, lng: 77.1000, severity: 'high' },   // Tumakuru
      { lat: 12.8438, lng: 77.6624, severity: 'critical' },// Electronic City
      { lat: 14.2218, lng: 76.3978, severity: 'medium' }, // Chitradurga
      { lat: 13.9299, lng: 75.5681, severity: 'low' },    // Shivamogga
      { lat: 16.2076, lng: 77.3463, severity: 'medium' }, // Raichur
      { lat: 12.9254, lng: 74.8237, severity: 'high' },   // Mangaluru
      { lat: 13.3389, lng: 74.7451, severity: 'medium' }, // Udupi
      { lat: 17.3297, lng: 76.8343, severity: 'high' },   // Kalaburagi
      { lat: 16.8302, lng: 75.7100, severity: 'medium' }, // Vijayapur
    ]

    const displayPoints = (points && points.length > 0) ? points.slice(0, 250) : FALLBACK_POINTS

    // 5. Add 3D Glowing Beams & Markers
    displayPoints.forEach(pt => {
      if (pt.lat && pt.lng) {
        const pos = latLngToVector3(pt.lat, pt.lng, globeRadius)
        const isCritical = pt.severity === 'critical' || pt.severity === 'high'
        const color = isCritical ? 0xef4444 : 0xf59e0b

        // Base Glowing Dot
        const dotGeom = new THREE.SphereGeometry(1.6, 12, 12)
        const dotMat = new THREE.MeshBasicMaterial({ color })
        const dotMesh = new THREE.Mesh(dotGeom, dotMat)
        dotMesh.position.copy(pos)
        globeGroup.add(dotMesh)

        // Vertical 3D Light Beam extending out from surface
        const height = isCritical ? 18 : 10
        const beamGeom = new THREE.CylinderGeometry(0.4, 0.8, height, 8)
        const beamMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.75
        })
        const beamMesh = new THREE.Mesh(beamGeom, beamMat)

        // Position beam so bottom rests on globe surface and points outward
        const normal = pos.clone().normalize()
        beamMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(height / 2)))
        beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
        globeGroup.add(beamMesh)
      }
    })

    // 6. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2)
    dirLight1.position.set(200, 150, 200)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0xd97706, 0.8)
    dirLight2.position.set(-200, -100, -100)
    scene.add(dirLight2)

    // Initial orientation: Rotate globe so India/Karnataka faces camera
    globeGroup.rotation.y = -Math.PI / 1.35
    globeGroup.rotation.x = 0.22

    // Drag interactions
    let isDragging = false
    let prevMousePosition = { x: 0, y: 0 }

    const onMouseDown = (e) => {
      isDragging = true
      prevMousePosition = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e) => {
      if (!isDragging) return
      const deltaMove = {
        x: e.clientX - prevMousePosition.x,
        y: e.clientY - prevMousePosition.y
      }
      globeGroup.rotation.y += deltaMove.x * 0.005
      globeGroup.rotation.x += deltaMove.y * 0.005
      prevMousePosition = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => { isDragging = false }

    const domEl = renderer.domElement
    domEl.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // Touch support for mobile/tablets
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true
        prevMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
    const onTouchMove = (e) => {
      if (!isDragging || e.touches.length !== 1) return
      const deltaMove = {
        x: e.touches[0].clientX - prevMousePosition.x,
        y: e.touches[0].clientY - prevMousePosition.y
      }
      globeGroup.rotation.y += deltaMove.x * 0.005
      globeGroup.rotation.x += deltaMove.y * 0.005
      prevMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTouchEnd = () => { isDragging = false }

    domEl.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    // Animation Loop
    let reqId
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      if (!isDragging) {
        globeGroup.rotation.y += 0.0015 // Smooth continuous rotation
      }
      renderer.render(scene, camera)
    }
    animate()

    // Handle resizing
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(reqId)
      domEl.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      domEl.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', handleResize)
      if (container && container.contains(domEl)) {
        container.removeChild(domEl)
      }
    }
  }, [points, retry])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060812' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />
      <div style={{ position: 'absolute', bottom: 20, pointerEvents: 'none', textAlign: 'center', background: 'rgba(9,16,29,0.85)', border: '1px solid var(--border-subtle)', padding: '8px 16px', borderRadius: 8, backdropFilter: 'blur(8px)' }}>
        <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', letterSpacing: '0.1em' }}>🌐 3D GEOSPATIAL INCIDENT SPHERE</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Drag globe to rotate • Projecting live incident pins &amp; 3D intensity beams</div>
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

const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
    label: 'Dark',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    label: 'Satellite',
  },
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CartoDB',
    label: 'Street',
  },
}

export default function GeospatialMap() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const [mapStyle, setMapStyle] = useState('dark')
  
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

  // DBSCAN Cluster States
  const [showDbscan, setShowDbscan] = useState(false)
  const [dbscanClusters, setDbscanClusters] = useState([])
  const [dbscanLoading, setDbscanLoading] = useState(false)
  const [nextCrime, setNextCrime] = useState(null)
  const [showNextCrime, setShowNextCrime] = useState(false)

  const loadDbscan = async () => {
    setDbscanLoading(true)
    try {
      const [clRes, ncRes] = await Promise.all([
        fetchDbscanClusters(),
        fetchPredictNext(),
      ])
      setDbscanClusters(clRes.clusters || [])
      setNextCrime(ncRes)
      setShowDbscan(true)
    } catch (e) { console.error('[DBSCAN]', e) }
    setDbscanLoading(false)
  }

  // CDR Movement Trail States
  const [cdrPhone, setCdrPhone] = useState('')
  const [cdrTrail, setCdrTrail] = useState([])
  const [showTrail, setShowTrail] = useState(false)
  const [trailLoading, setTrailLoading] = useState(false)

  const loadCdrTrail = async () => {
    if (!cdrPhone.trim()) return
    setTrailLoading(true)
    try {
      const data = await fetchMovementTrail(cdrPhone.trim())
      setCdrTrail(data.trail || data.locations || [])
      setShowTrail(true)
    } catch (e) {
      console.error('CDR trail load failed:', e)
    }
    setTrailLoading(false)
  }


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
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showHotspots} onChange={e => setShowHotspots(e.target.checked)} />
              Show hotspots & pins
            </label>

            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Map Layer Style
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Object.entries(TILE_LAYERS).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setMapStyle(key)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: 'pointer',
                      borderRadius: 4,
                      background: mapStyle === key ? 'var(--copper-500)' : 'transparent',
                      border: `1px solid ${mapStyle === key ? 'var(--copper-400)' : 'var(--border-subtle)'}`,
                      color: mapStyle === key ? '#000' : 'var(--text-secondary)',
                      outline: 'none',
                    }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* DBSCAN Controls */}
        {!globeMode && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={loadDbscan}
              disabled={dbscanLoading}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 6,
                border: '1px solid rgba(82,224,122,0.4)',
                background: showDbscan ? 'rgba(82,224,122,0.1)' : 'transparent',
                color: '#52e07a', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                marginBottom: 6,
              }}
            >{dbscanLoading ? 'Clustering...' : showDbscan ? `✓ ${dbscanClusters.length} Clusters` : '⬡ DBSCAN Clusters'}</button>

            <button
              onClick={() => { setShowNextCrime(v => !v); if (!nextCrime) loadDbscan() }}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 6,
                border: '1px solid rgba(200,129,74,0.4)',
                background: showNextCrime ? 'rgba(200,129,74,0.1)' : 'transparent',
                color: 'var(--copper-300,#e8a87c)', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
              }}
            >🔮 Next Crime Prediction</button>

            {/* CDR movement trail control panel */}
            <div style={{
              marginTop: 14,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 10
            }}>
              <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700,
                           letterSpacing: '0.1em', marginBottom: 8 }}>
                📱 CDR MOVEMENT TRAIL
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={cdrPhone}
                  onChange={e => setCdrPhone(e.target.value)}
                  placeholder="Phone number..."
                  style={{
                    flex: 1, background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)', borderRadius: 4,
                    color: 'var(--text-primary)', fontSize: 11, padding: '4px 8px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={loadCdrTrail}
                  disabled={trailLoading}
                  style={{
                    background: 'rgba(200,129,74,0.15)', border: '1px solid var(--copper-400)',
                    borderRadius: 4, color: 'var(--copper-400)', fontSize: 11,
                    padding: '4px 8px', cursor: 'pointer', outline: 'none'
                  }}
                >
                  {trailLoading ? '...' : 'Track'}
                </button>
              </div>
              {showTrail && cdrTrail.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--status-success)' }}>
                    ✓ {cdrTrail.length} points plotted
                  </span>
                  <button
                    onClick={() => { setShowTrail(false); setCdrTrail([]); setCdrPhone('') }}
                    style={{ background: 'none', border: 'none', color: '#e05252', fontSize: 10, cursor: 'pointer', padding: 0 }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-muted)' }}>
          {points.length.toLocaleString()} points loaded
        </div>
      </div>

      {/* Next Crime Prediction Floating Panel */}
      {showNextCrime && nextCrime && (
        <div style={{
          position: 'absolute', top: 80, right: 20, width: 280, zIndex: 1000,
          background: 'rgba(10,10,22,0.95)',
          border: '1px solid rgba(200,129,74,0.4)',
          borderRadius: 14, padding: 18,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--copper-300,#e8a87c)' }}>
              🔮 Next Crime Prediction
            </span>
            <button onClick={() => setShowNextCrime(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
              {nextCrime.predicted_crime || 'Unknown'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
              {nextCrime.predicted_time}
            </div>
            <div style={{
              background: 'rgba(200,129,74,0.1)', border: '1px solid rgba(200,129,74,0.25)',
              borderRadius: 8, padding: '8px 12px', marginBottom: 8,
            }}>
              <div style={{ fontSize: 10, color: 'var(--copper-300,#e8a87c)', marginBottom: 3 }}>CONFIDENCE</div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>
                {nextCrime.confidence || 0}%
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              {nextCrime.basis || ''}
            </div>
            {nextCrime.recommended_action && (
              <div style={{
                marginTop: 8, fontSize: 10, color: '#52e07a',
                borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8,
              }}>
                ⚡ {nextCrime.recommended_action}
              </div>
            )}
            {nextCrime.top_5_crimes?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Top Crime Types</div>
                {nextCrime.top_5_crimes.slice(0, 5).map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.65)', marginBottom: 2 }}>
                    <span>{c.crime}</span>
                    <span style={{ color: 'var(--copper-300,#e8a87c)' }}>{c.frequency} cases</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
            scrollWheelZoom
            dragging
            doubleClickZoom
            zoomControl
            style={{ height: '100%', width: '100%', background: 'var(--bg-primary)' }}
          >
            <MapRefTracker mapRef={mapRef} />
            <TileLayer
              key={mapStyle}
              url={TILE_LAYERS[mapStyle].url}
              attribution={TILE_LAYERS[mapStyle].attribution}
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

            {/* DBSCAN Cluster Circles */}
            {showDbscan && dbscanClusters.map((cl, i) => {
              const col = cl.severity === 'CRITICAL' ? '#e05252'
                : cl.severity === 'HIGH'     ? '#e09052'
                : cl.severity === 'MEDIUM'   ? '#e0cc52'
                :                              '#52e07a'
              return (
                <Circle
                  key={`dbscan-${i}`}
                  center={[cl.lat, cl.lng]}
                  radius={cl.radius_meters}
                  pathOptions={{
                    color: col, fillColor: col,
                    fillOpacity: 0.15, weight: 2, dashArray: '6,4',
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 11 }}>
                      <strong>Cluster #{cl.cluster_id}</strong><br/>
                      Crimes: {cl.count} | Severity: {cl.severity}<br/>
                      Top crime: {cl.top_crime}<br/>
                      Predicted next: <em>{cl.predicted_next}</em>
                    </div>
                  </Popup>
                </Circle>
              )
            })}

            {/* CDR movement trail overlay */}
            {showTrail && cdrTrail.length > 0 && (
              <>
                {cdrTrail.map((pt, i) => (
                  <CircleMarker
                    key={`cdr-pt-${i}`}
                    center={[pt.lat, pt.lng]}
                    radius={8}
                    pathOptions={{ fillColor: '#e0a832', fillOpacity: 0.9, color: '#fff', weight: 1 }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        <b>Tower: {pt.tower_id || pt.cell_id}</b><br/>
                        Phone: {cdrPhone}<br/>
                        Time: {pt.date || pt.timestamp} {pt.time || ''}<br/>
                        Called: {pt.called_no || pt.called || 'N/A'}<br/>
                        Duration: {pt.duration_sec || pt.duration || 0}s
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
                <Polyline
                  positions={cdrTrail.map(pt => [pt.lat, pt.lng])}
                  pathOptions={{ color: '#e0a832', weight: 2, dashArray: '6,4', opacity: 0.7 }}
                />
              </>
            )}

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
