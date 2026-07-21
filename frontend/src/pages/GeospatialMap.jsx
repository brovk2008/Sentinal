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

// ── Google Earth-Style 3D Globe Component ──
function ThreeGlobe({ points }) {
  const mountRef = useRef(null)
  const [retry, setRetry] = useState(0)
  const [autoRotate, setAutoRotate] = useState(true)
  const [showClouds, setShowClouds] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(180) // Camera Z distance
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const cameraRef = useRef(null)
  const globeGroupRef = useRef(null)
  const cloudsRef = useRef(null)

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
    scene.background = new THREE.Color(0x04050c)

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000)
    camera.position.z = zoomLevel
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Main Globe Group
    const globeGroup = new THREE.Group()
    scene.add(globeGroup)
    globeGroupRef.current = globeGroup

    const globeRadius = 75

    // ── 1. High-Res Satellite Earth Texture ──
    const textureLoader = new THREE.TextureLoader()
    
    // Primary satellite texture + fallback procedural texture
    const earthTexture = textureLoader.load(
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_atmos_2048.jpg',
      undefined,
      undefined,
      () => {
        // Fallback procedural canvas texture if offline
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 512
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#091428'
        ctx.fillRect(0, 0, 1024, 512)
        ctx.fillStyle = '#1e3a8a'
        ctx.fillRect(200, 100, 300, 200)
        return new THREE.CanvasTexture(canvas)
      }
    )

    const bumpTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_normal_2048.jpg')
    const specularTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_specular_2048.jpg')
    const cloudsTexture = textureLoader.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/planets/earth_clouds_1024.png')

    // Satellite Earth Sphere
    const earthGeom = new THREE.SphereGeometry(globeRadius, 64, 64)
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.8,
      specularMap: specularTexture,
      specular: new THREE.Color(0x333333),
      shininess: 25
    })
    const earthMesh = new THREE.Mesh(earthGeom, earthMat)
    globeGroup.add(earthMesh)

    // ── 2. Rotatable Clouds Layer ──
    const cloudsGeom = new THREE.SphereGeometry(globeRadius + 0.8, 48, 48)
    const cloudsMat = new THREE.MeshPhongMaterial({
      map: cloudsTexture,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    })
    const cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat)
    cloudsMesh.visible = showClouds
    globeGroup.add(cloudsMesh)
    cloudsRef.current = cloudsMesh

    // ── 3. Tech Grid & Lat/Lng Rings ──
    const wireGeom = new THREE.SphereGeometry(globeRadius + 0.2, 36, 18)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.08
    })
    const wireSphere = new THREE.Mesh(wireGeom, wireMat)
    globeGroup.add(wireSphere)

    // Equator Ring
    const eqGeom = new THREE.RingGeometry(globeRadius + 0.3, globeRadius + 0.7, 64)
    const eqMat = new THREE.MeshBasicMaterial({ color: 0xc8814a, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
    const eqRing = new THREE.Mesh(eqGeom, eqMat)
    eqRing.rotation.x = Math.PI / 2
    globeGroup.add(eqRing)

    // ── 4. Outer Atmosphere Glow ──
    const atmoGeom = new THREE.SphereGeometry(globeRadius + 3.5, 32, 32)
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.15
    })
    const atmoSphere = new THREE.Mesh(atmoGeom, atmoMat)
    scene.add(atmoSphere)

    // Helper: convert lat/lng to 3D Cartesian coordinates for Three.js SphereGeometry
    const latLngToVector3 = (lat, lng, r) => {
      const phi = (90 - lat) * (Math.PI / 180)
      const theta = (lng + 180) * (Math.PI / 180)
      const x = -(r * Math.sin(phi) * Math.cos(theta))
      const y = r * Math.cos(phi)
      const z = r * Math.sin(phi) * Math.sin(theta)
      return new THREE.Vector3(x, y, z)
    }

    // Default Karnataka / India crime clusters
    const FALLBACK_POINTS = [
      { lat: 12.9716, lng: 77.5946, label: 'Bengaluru Urban', severity: 'high', count: 199 },
      { lat: 15.3647, lng: 75.1240, label: 'Hubballi-Dharwad', severity: 'medium', count: 73 },
      { lat: 15.1394, lng: 76.9214, label: 'Ballari District', severity: 'critical', count: 114 },
      { lat: 15.8497, lng: 74.4977, label: 'Belagavi Sector', severity: 'medium', count: 82 },
      { lat: 12.2958, lng: 76.6394, label: 'Mysuru City', severity: 'high', count: 179 },
      { lat: 14.4426, lng: 75.7218, label: 'Davanagere', severity: 'low', count: 47 },
      { lat: 13.3409, lng: 77.1000, label: 'Tumakuru Hub', severity: 'high', count: 117 },
      { lat: 12.8438, lng: 77.6624, label: 'Electronic City Cyber', severity: 'critical', count: 245 },
      { lat: 14.2218, lng: 76.3978, label: 'Chitradurga', severity: 'medium', count: 60 },
      { lat: 13.9299, lng: 75.5681, label: 'Shivamogga Arms', severity: 'low', count: 85 },
      { lat: 16.2076, lng: 77.3463, label: 'Raichur Sector', severity: 'medium', count: 48 },
      { lat: 12.9254, lng: 74.8237, label: 'Mangaluru Port', severity: 'high', count: 74 },
      { lat: 13.3389, lng: 74.7451, label: 'Udupi Coastal', severity: 'medium', count: 95 },
      { lat: 17.3297, lng: 76.8343, label: 'Kalaburagi Fraud', severity: 'high', count: 95 },
      { lat: 16.8302, lng: 75.7100, label: 'Vijayapura Theft', severity: 'medium', count: 115 },
    ]

    const displayPoints = (points && points.length > 0) ? points.slice(0, 250) : FALLBACK_POINTS

    // ── 5. Add Google Earth Style 3D Pins & Pulse Rings ──
    const pinMeshes = []

    displayPoints.forEach(pt => {
      if (pt.lat && pt.lng) {
        const pos = latLngToVector3(pt.lat, pt.lng, globeRadius)
        const isCritical = pt.severity === 'critical' || pt.severity === 'high'
        const color = isCritical ? 0xef4444 : 0xf59e0b

        // Glowing Pin Head
        const headGeom = new THREE.SphereGeometry(1.4, 16, 16)
        const headMat = new THREE.MeshBasicMaterial({ color })
        const headMesh = new THREE.Mesh(headGeom, headMat)
        
        // Pin Stem
        const stemHeight = isCritical ? 14 : 8
        const stemGeom = new THREE.CylinderGeometry(0.3, 0.6, stemHeight, 8)
        const stemMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
        const stemMesh = new THREE.Mesh(stemGeom, stemMat)

        const normal = pos.clone().normalize()
        headMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(stemHeight)))
        stemMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(stemHeight / 2)))
        stemMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)

        // Pulsing Surface Ring
        const ringGeom = new THREE.RingGeometry(0.8, 2.5, 32)
        const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
        const ringMesh = new THREE.Mesh(ringGeom, ringMat)
        ringMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.2)))
        ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

        const pinGroup = new THREE.Group()
        pinGroup.add(headMesh)
        pinGroup.add(stemMesh)
        pinGroup.add(ringMesh)
        pinGroup.userData = { ...pt, worldPos: pos }
        
        globeGroup.add(pinGroup)
        pinMeshes.push(headMesh)
      }
    })

    // ── 6. Lighting ──
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
    scene.add(ambientLight)

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5)
    sunLight.position.set(300, 200, 200)
    scene.add(sunLight)

    const fillLight = new THREE.DirectionalLight(0x00f0ff, 0.5)
    fillLight.position.set(-200, -100, -100)
    scene.add(fillLight)

    // Initial orientation: Focus South India / Karnataka directly toward camera
    globeGroup.rotation.y = Math.PI * 0.92
    globeGroup.rotation.x = -0.25

    // ── 7. Google Earth Controls: Mouse Drag & Smooth Inertia ──
    let isDragging = false
    let prevMousePosition = { x: 0, y: 0 }
    let velX = 0
    let velY = 0

    const onMouseDown = (e) => {
      if (e.button !== 0) return
      isDragging = true
      prevMousePosition = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect()
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })

      if (isDragging) {
        const deltaX = e.clientX - prevMousePosition.x
        const deltaY = e.clientY - prevMousePosition.y
        velX = deltaX * 0.004
        velY = deltaY * 0.004
        globeGroup.rotation.y += velX
        globeGroup.rotation.x += velY
        prevMousePosition = { x: e.clientX, y: e.clientY }
      }
    }

    const onMouseUp = () => { isDragging = false }

    // ── 8. Smooth Mouse Wheel Zoom (Google Earth Zooming) ──
    const onWheel = (e) => {
      e.preventDefault()
      const zoomFactor = e.deltaY * 0.15
      camera.position.z = Math.min(Math.max(camera.position.z + zoomFactor, 85), 360)
      setZoomLevel(Math.round(camera.position.z))
    }

    const domEl = renderer.domElement
    domEl.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    domEl.addEventListener('wheel', onWheel, { passive: false })

    // Touch Support for Mobile & Tablets
    let touchStartDist = 0
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true
        prevMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        isDragging = false
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
      }
    }

    const onTouchMove = (e) => {
      if (e.touches.length === 1 && isDragging) {
        const deltaX = e.touches[0].clientX - prevMousePosition.x
        const deltaY = e.touches[0].clientY - prevMousePosition.y
        globeGroup.rotation.y += deltaX * 0.005
        globeGroup.rotation.x += deltaY * 0.005
        prevMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const deltaDist = touchStartDist - dist
        camera.position.z = Math.min(Math.max(camera.position.z + deltaDist * 0.3, 85), 360)
        touchStartDist = dist
        setZoomLevel(Math.round(camera.position.z))
      }
    }

    const onTouchEnd = () => { isDragging = false }

    domEl.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    // Animation Loop with Smooth Inertia Coalescing
    let reqId
    const animate = () => {
      reqId = requestAnimationFrame(animate)
      
      if (!isDragging) {
        // Inertia damping
        velX *= 0.92
        velY *= 0.92
        globeGroup.rotation.y += velX
        globeGroup.rotation.x += velY

        if (autoRotate && Math.abs(velX) < 0.0001 && Math.abs(velY) < 0.0001) {
          globeGroup.rotation.y += 0.0012 // Continuous subtle Earth rotation
        }
      }

      if (cloudsRef.current && showClouds) {
        cloudsRef.current.rotation.y += 0.0018 // Clouds revolve faster than surface
      }

      renderer.render(scene, camera)
    }
    animate()

    // Resizing Handler
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
      domEl.removeEventListener('wheel', onWheel)
      domEl.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('resize', handleResize)
      if (container && container.contains(domEl)) {
        container.removeChild(domEl)
      }
    }
  }, [points, retry, autoRotate, showClouds])

  // Quick Controls
  const handleZoom = (delta) => {
    if (cameraRef.current) {
      cameraRef.current.position.z = Math.min(Math.max(cameraRef.current.position.z + delta, 85), 360)
      setZoomLevel(Math.round(cameraRef.current.position.z))
    }
  }

  const resetIndiaFocus = () => {
    if (globeGroupRef.current && cameraRef.current) {
      globeGroupRef.current.rotation.y = Math.PI * 0.92
      globeGroupRef.current.rotation.x = -0.25
      cameraRef.current.position.z = 160
      setZoomLevel(160)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#04050c', userSelect: 'none' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab' }} />

      {/* Google Earth Control Toolbar (Top Right) */}
      <div style={{
        position: 'absolute', right: 20, top: 20, display: 'flex', flexDirection: 'column', gap: 8,
        background: 'rgba(9,16,29,0.85)', border: '1px solid var(--border-subtle)',
        padding: 8, borderRadius: 10, backdropFilter: 'blur(10px)', zIndex: 10
      }}>
        <button onClick={() => handleZoom(-30)} title="Zoom In" style={toolBtnStyle}>➕</button>
        <button onClick={() => handleZoom(30)} title="Zoom Out" style={toolBtnStyle}>➖</button>
        <button onClick={resetIndiaFocus} title="Focus Karnataka / India" style={toolBtnStyle}>🎯</button>
        <button onClick={() => setAutoRotate(!autoRotate)} title="Toggle Auto Rotation" style={{ ...toolBtnStyle, background: autoRotate ? 'rgba(200,129,74,0.3)' : 'transparent' }}>
          {autoRotate ? '⏸️' : '▶️'}
        </button>
        <button onClick={() => setShowClouds(!showClouds)} title="Toggle Cloud Layer" style={{ ...toolBtnStyle, background: showClouds ? 'rgba(59,130,246,0.3)' : 'transparent' }}>
          ☁️
        </button>
      </div>

      {/* Earth Altitude & Info HUD (Bottom Center) */}
      <div style={{
        position: 'absolute', bottom: 20, pointerEvents: 'none', textAlign: 'center',
        background: 'rgba(9,16,29,0.85)', border: '1px solid var(--border-subtle)',
        padding: '8px 18px', borderRadius: 8, backdropFilter: 'blur(8px)', zIndex: 10
      }}>
        <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', letterSpacing: '0.1em' }}>
          🌍 GOOGLE EARTH SATELLITE GLOBE
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <span>Alt: <strong>{Math.round((zoomLevel - 75) * 50)} km</strong></span>
          <span>•</span>
          <span>Scroll wheel to zoom • Drag to orbit</span>
        </div>
      </div>
    </div>
  )
}

const toolBtnStyle = {
  width: 34, height: 34, borderRadius: 6, border: '1px solid var(--border-subtle)',
  background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  outline: 'none', transition: 'all 0.2s'
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
