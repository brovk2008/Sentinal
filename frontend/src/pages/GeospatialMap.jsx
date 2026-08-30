import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, CircleMarker, Circle, Polyline, Popup, useMap } from 'react-leaflet'
import { Plus, Minus, Crosshair, Play, Pause, Cloud, Globe, Zap, FileText, Hexagon, Sparkles, Smartphone, Check, MapPin, RotateCcw, Radio, Satellite, Layers, Compass, Target, X } from 'lucide-react'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import { fetchHeatmapGrid, fetchDistrictCenters, fetchHotspots, fetchCases, downloadDistrictReport, fetchHeatmapTimelapse, fetchDbscanClusters, fetchPredictNext, fetchMovementTrail } from '../api'
import PredictiveLayer from '../components/map/PredictiveLayer'
import useLiveFeed from '../hooks/useLiveFeed'
import 'leaflet/dist/leaflet.css'

// Karnataka bounds
const KA_CENTER = [14.5, 76.0]
const CRIME_TYPES = ['All', 'Murder & Culpable Homicide', 'Theft & Burglary', 'Cyber Crime', 'Narcotics', 'Cheating & Fraud', 'Crimes Against Women']

// ── CesiumJS 3D Globe Component ──
function CesiumGlobe({ points, casePins = [], hotspots = [] }) {
  const mountRef = useRef(null)
  const viewerRef = useRef(null)
  const [cesiumReady, setCesiumReady] = useState(false)
  const [buildings3DEnabled, setBuildings3DEnabled] = useState(true)

  // Inject Cesium CSS + JS from CDN
  useEffect(() => {
    
    // Hide Cesium Ion notice banner
    const creditStyleId = 'cesium-hide-credits'
    if (!document.getElementById(creditStyleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = creditStyleId
      styleEl.innerHTML = '.cesium-widget-credits, .cesium-credit-textContainer, .cesium-credit-expand-link { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }'
      document.head.appendChild(styleEl)
    }

    const CESIUM_VERSION = '1.121'
    const cssId = 'cesium-css'
    const jsId = 'cesium-js'

    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = 'https://cesium.com/downloads/cesiumjs/releases/' + CESIUM_VERSION + '/Build/Cesium/Widgets/widgets.css'
      document.head.appendChild(link)
    }

    if (!document.getElementById(jsId)) {
      const script = document.createElement('script')
      script.id = jsId
      script.src = 'https://cesium.com/downloads/cesiumjs/releases/' + CESIUM_VERSION + '/Build/Cesium/Cesium.js'
      script.async = true
      script.onload = () => setCesiumReady(true)
      document.head.appendChild(script)
    } else if (window.Cesium) {
      setCesiumReady(true)
    }
  }, [])

  // Initialize Cesium viewer with 3D Terrain, Satellite & 3D Buildings
  useEffect(() => {
    if (!cesiumReady || !mountRef.current || viewerRef.current) return

    const Cesium = window.Cesium
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ4NS01NDI1OTM5MjQyNDMiLCJpZCI6NTc3MzMsImlhdCI6MTYyMjY0NDA3OX0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

    let viewer = null
    try {
      viewer = new Cesium.Viewer(mountRef.current, {
        imageryProvider: new Cesium.TileMapServiceImageryProvider({
          url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
        }),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        creditContainer: document.createElement('div'),
        skyBox: new Cesium.SkyBox({
          sources: {
            positiveX: 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg',
            negativeX: 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg',
            positiveY: 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg',
            negativeY: 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg',
            positiveZ: 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg',
            negativeZ: 'https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg',
          }
        }),
        contextOptions: { webgl: { alpha: false } }
      })

      // Layer 1: High-res Esri Satellite Imagery
      viewer.imageryLayers.removeAll()
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          credit: 'Esri World Imagery'
        })
      )

      // Layer 2: Boundaries and District/City Reference Labels
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
        })
      )

      // Enable 3D World Terrain Mesh
      try {
        Cesium.createWorldTerrainAsync({ requestWaterMask: true, requestVertexNormals: true })
          .then(terrainProvider => {
            if (viewer && !viewer.isDestroyed()) {
              viewer.terrainProvider = terrainProvider
            }
          })
          .catch(() => {})
      } catch (err) {
        console.warn('[CesiumGlobe] World terrain init fallback:', err)
      }

      // Add 3D OSM City Buildings Extrusions
      try {
        Cesium.createOsmBuildingsAsync()
          .then(buildingTileset => {
            if (viewer && !viewer.isDestroyed()) {
              buildingTileset.style = new Cesium.Cesium3DTileStyle({
                color: {
                  conditions: [
                    ["${feature['building']} === 'hospital'", "color('#3b82f6', 0.8)"],
                    ["${feature['building']} === 'government'", "color('#c8814a', 0.9)"],
                    ["true", "color('#1e293b', 0.7)"]
                  ]
                }
              })
              viewer.scene.primitives.add(buildingTileset)
            }
          })
          .catch(err => console.warn('[CesiumGlobe] 3D buildings fallback:', err))
      } catch (err) {
        console.warn('[CesiumGlobe] 3D buildings async exception:', err)
      }

      // Style scene atmosphere & lighting
      viewer.scene.globe.enableLighting = true
      viewer.scene.globe.showGroundAtmosphere = true
      viewer.scene.skyAtmosphere.hueShift = -0.1
      viewer.scene.backgroundColor = new Cesium.Color(0.016, 0.02, 0.047, 1.0)
      viewer.scene.globe.depthTestAgainstTerrain = true

      viewerRef.current = viewer

      // Fly camera to Karnataka / India high overview
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(76.0, 14.5, 1200000),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-48), roll: 0 },
        duration: 2.5,
      })

    } catch (e) {
      console.warn('[CesiumGlobe] Init error:', e)
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [cesiumReady])

  // Plot 3D Crime Pillars, Pulsing Rings & Pins
  useEffect(() => {
    if (!viewerRef.current || !cesiumReady) return
    const Cesium = window.Cesium
    const viewer = viewerRef.current

    viewer.entities.removeAll()

    const FALLBACK_POINTS = [
      { lat: 12.9716, lng: 77.5946, label: 'Bengaluru Urban HQ', severity: 'critical', count: 199, type: 'Theft & Cyber' },
      { lat: 15.3647, lng: 75.1240, label: 'Hubballi-Dharwad Sector', severity: 'medium', count: 73, type: 'Narcotics' },
      { lat: 15.1394, lng: 76.9214, label: 'Ballari Mining Belt', severity: 'critical', count: 114, type: 'Mining Crimes' },
      { lat: 15.8497, lng: 74.4977, label: 'Belagavi Sector', severity: 'medium', count: 82, type: 'Smuggling' },
      { lat: 12.2958, lng: 76.6394, label: 'Mysuru City', severity: 'high', count: 179, type: 'Cheating & Fraud' },
      { lat: 14.4426, lng: 75.7218, label: 'Davanagere Hub', severity: 'low', count: 47, type: 'Robbery' },
      { lat: 13.3409, lng: 77.1000, label: 'Tumakuru Sector', severity: 'high', count: 117, type: 'Theft' },
      { lat: 12.8438, lng: 77.6624, label: 'Electronic City Tech Hub', severity: 'critical', count: 245, type: 'Cyber Crime' },
      { lat: 14.2218, lng: 76.3978, label: 'Chitradurga Sector', severity: 'medium', count: 60, type: 'Robbery' },
      { lat: 13.9299, lng: 75.5681, label: 'Shivamogga Sector', severity: 'low', count: 85, type: 'Arms Smuggling' },
      { lat: 16.2076, lng: 77.3463, label: 'Raichur Thermal Zone', severity: 'medium', count: 48, type: 'Murder' },
      { lat: 12.9254, lng: 74.8237, label: 'Mangaluru Port', severity: 'high', count: 74, type: 'Drug Trafficking' },
      { lat: 13.3389, lng: 74.7451, label: 'Udupi Coastal Line', severity: 'medium', count: 95, type: 'Smuggling' },
      { lat: 17.3297, lng: 76.8343, label: 'Kalaburagi Belt', severity: 'high', count: 95, type: 'Cheating & Fraud' },
      { lat: 16.8302, lng: 75.7100, label: 'Vijayapura District', severity: 'medium', count: 115, type: 'Theft' },
    ]

    const displayPoints = (points && points.length > 0) ? points.slice(0, 250) : FALLBACK_POINTS

    displayPoints.forEach(pt => {
      const lat = parseFloat(pt.lat)
      const lng = parseFloat(pt.lng)
      if (isNaN(lat) || isNaN(lng)) return

      const isCritical = pt.severity === 'critical' || pt.count > 150
      const isHigh = pt.severity === 'high' || pt.count > 80
      const pinColor = isCritical
        ? Cesium.Color.fromCssColorString('#ef4444')
        : isHigh
          ? Cesium.Color.fromCssColorString('#f97316')
          : Cesium.Color.fromCssColorString('#c8814a')

      const pulseColor = pinColor.withAlpha(0.35)
      const count = pt.count || pt.incident_count || 1
      const pillarHeight = Math.max(12000, count * 350)
      const labelText = (pt.label || pt.district_name || 'Zone') + "\n" + count + " incidents";

      // 1. 3D Vertical Cylinder Pillar (Heat Density Beam)
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, pillarHeight / 2),
        cylinder: {
          length: pillarHeight,
          topRadius: isCritical ? 6000 : 4000,
          bottomRadius: isCritical ? 8000 : 5000,
          material: new Cesium.ColorMaterialProperty(pinColor.withAlpha(0.55)),
          outline: true,
          outlineColor: pinColor.withAlpha(0.9),
          outlineWidth: 2,
        }
      })

      // 2. Pulsing Ring on Terrain Surface
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat),
        ellipse: {
          semiMinorAxis: isCritical ? 24000 : isHigh ? 18000 : 12000,
          semiMajorAxis: isCritical ? 24000 : isHigh ? 18000 : 12000,
          height: 50,
          material: new Cesium.ColorMaterialProperty(pulseColor),
          outline: true,
          outlineColor: pinColor.withAlpha(0.8),
          outlineWidth: 2,
        }
      })

      // 3. Floating 3D Billboard Pin with Label
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, pillarHeight + 2000),
        billboard: {
          image: (() => {
            const canvas = document.createElement('canvas')
            canvas.width = 36
            canvas.height = 36
            const ctx = canvas.getContext('2d')
            const gradient = ctx.createRadialGradient(18, 18, 3, 18, 18, 16)
            const hex = isCritical ? '#ef4444' : isHigh ? '#f97316' : '#c8814a'
            gradient.addColorStop(0, hex)
            gradient.addColorStop(1, hex + '44')
            ctx.beginPath()
            ctx.arc(18, 18, 15, 0, Math.PI * 2)
            ctx.fillStyle = gradient
            ctx.fill()
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2.5
            ctx.stroke()
            return canvas
          })(),
          width: isCritical ? 30 : isHigh ? 24 : 18,
          height: isCritical ? 30 : isHigh ? 24 : 18,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          scaleByDistance: new Cesium.NearFarScalar(1e5, 1.5, 2e6, 0.5),
          translucencyByDistance: new Cesium.NearFarScalar(1e5, 1.0, 5e6, 0.3),
        },
        label: {
          text: labelText,
          font: 'bold 11px "Inter", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2.5,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -36),
          scaleByDistance: new Cesium.NearFarScalar(8e4, 1.0, 1.5e6, 0.0),
          translucencyByDistance: new Cesium.NearFarScalar(8e4, 1.0, 1.5e6, 0.0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: new Cesium.Color(0.04, 0.06, 0.14, 0.88),
          backgroundPadding: new Cesium.Cartesian2(8, 5),
        }
      })
    })

    // Plot Individual Case Pins
    casePins.forEach(cp => {
      const lat = parseFloat(cp.latitude)
      const lng = parseFloat(cp.longitude)
      if (isNaN(lat) || isNaN(lng)) return

      const caseNo = cp.FIRNo || cp.CaseMasterID || 'Case'
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, 4000),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#c8814a'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: "FIR #" + caseNo,
          font: '10px "Inter", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#e8a87c'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          scaleByDistance: new Cesium.NearFarScalar(5e4, 1.0, 5e5, 0.0),
        }
      })
    })
  }, [points, casePins, hotspots, cesiumReady])

  const focusKarnataka = () => {
    if (!viewerRef.current) return
    viewerRef.current.camera.flyTo({
      destination: window.Cesium.Cartesian3.fromDegrees(76.0, 14.5, 1200000),
      orientation: { heading: 0, pitch: window.Cesium.Math.toRadians(-50), roll: 0 },
      duration: 1.5,
    })
  }

  const zoomIn = () => {
    if (!viewerRef.current) return
    const cam = viewerRef.current.camera
    cam.zoomIn(cam.positionCartographic.height * 0.3)
  }

  const zoomOut = () => {
    if (!viewerRef.current) return
    const cam = viewerRef.current.camera
    cam.zoomOut(cam.positionCartographic.height * 0.4)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#04050c' }}>
      {/* Cesium container */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay */}
      {!cesiumReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: '#04050c',
          gap: 12, zIndex: 20
        }}>
          <div style={{ width: 40, height: 40, border: '3px solid #c8814a33', borderTop: '3px solid #c8814a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#c8814a', fontSize: 12, letterSpacing: '0.1em', fontWeight: 700 }}>LOADING CESIUM 3D GLOBE...</span>
        </div>
      )}

      {/* Controls toolbar */}
      {cesiumReady && (
        <div style={{
          position: 'absolute', right: 20, top: 20, display: 'flex', flexDirection: 'column', gap: 8,
          background: 'rgba(9,16,29,0.9)', border: '1px solid rgba(200,129,74,0.3)',
          padding: 8, borderRadius: 10, backdropFilter: 'blur(12px)', zIndex: 10
        }}>
          <button onClick={zoomIn} title="Zoom In" style={toolBtnStyle}>
            <Plus size={14} />
          </button>
          <button onClick={zoomOut} title="Zoom Out" style={toolBtnStyle}>
            <Minus size={14} />
          </button>
          <button onClick={focusKarnataka} title="Focus Karnataka" style={toolBtnStyle}>
            <Crosshair size={14} />
          </button>
        </div>
      )}

      {/* HUD */}
      {cesiumReady && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none', textAlign: 'center',
          background: 'rgba(9,16,29,0.88)', border: '1px solid rgba(200,129,74,0.3)',
          padding: '8px 20px', borderRadius: 8, backdropFilter: 'blur(8px)', zIndex: 10
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#c8814a', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={13} />
            <span>CESIUM 3D SATELLITE GLOBE - 3D BUILDINGS & TERRAIN ACTIVE</span>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
            Drag to rotate | Scroll to zoom | Right-drag to tilt
          </div>
        </div>
      )}
    </div>
  )
}

const toolBtnStyle = {
  width: 34, height: 34, borderRadius: 6, border: '1px solid rgba(200,129,74,0.3)',
  background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13,
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
    label: 'Dark Tactical',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: 'Satellite HD',
  },
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    label: 'Esri Topo',
  },
  street: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CartoDB',
    label: 'Street Vector',
  },
}


// ── Realistic Tactical Map Pointer Generator ──
const createTacticalPinIcon = (cp) => {
  const L = window.L
  if (!L) return null

  const isHeinous = cp.IsHeinous || cp.severity === 'critical' || (cp.ActSection && cp.ActSection.includes('302'))
  const isHigh = cp.severity === 'high' || (cp.ActSection && (cp.ActSection.includes('395') || cp.ActSection.includes('397')))

  const pinColor = isHeinous ? '#ef4444' : isHigh ? '#f97316' : '#c8814a'
  const glowColor = isHeinous ? 'rgba(239, 68, 68, 0.45)' : 'rgba(200, 129, 74, 0.35)'
  const labelText = cp.FIRNo ? 'FIR #' + cp.FIRNo : 'Case #' + (cp.CaseMasterID || '1')

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 46px; cursor: pointer;">
      ${isHeinous ? `<div style="position: absolute; top: -4px; width: 44px; height: 44px; border-radius: 50%; background: ${glowColor}; animation: pulse-ring 1.8s infinite ease-out;"></div>` : ''}
      <div style="
        position: relative;
        width: 32px;
        height: 38px;
        background: linear-gradient(145deg, ${pinColor}, #09101d);
        border: 2px solid #ffffff;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 14px rgba(0,0,0,0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
      ">
        <div style="
          transform: rotate(45deg);
          color: #ffffff;
          font-weight: 800;
          font-size: 10px;
          font-family: 'Inter', sans-serif;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          *
        </div>
      </div>
      <div style="
        position: absolute;
        bottom: -2px;
        width: 10px;
        height: 4px;
        background: rgba(0,0,0,0.5);
        border-radius: 50%;
        filter: blur(1px);
      "></div>
    </div>
  `

  return L.divIcon({
    className: 'tactical-map-pointer',
    html: html,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -42],
  })
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

  // Listen to demo mode auto-triggers
  useEffect(() => {
    const handleDemoGlobe = () => {
      setGlobeMode(true);
    };
    window.addEventListener('demo-trigger-globe-zoom', handleDemoGlobe);
    return () => window.removeEventListener('demo-trigger-globe-zoom', handleDemoGlobe);
  }, []);

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
            style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setGlobeMode(!globeMode)}
          >
            <Globe size={13} />
            <span>{globeMode ? 'Switch to 2D Map' : 'View 3D Cesium Globe'}</span>
          </button>
        </div>

        {!globeMode && (
          <>
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn btn-sm"
                style={{ width: '100%', justifyContent: 'center', borderColor: 'var(--copper-500)', background: 'transparent', color: 'var(--copper-200)', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={startTimelapse}
                disabled={predictionMode}
              >
                <Play size={13} />
                <span>Play Time-Lapse</span>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {predictionMode ? (
                  <>
                    <Zap size={12} />
                    <span>PREDICTIVE ACTIVE</span>
                  </>
                ) : (
                  <>
                    <Radio size={12} />
                    <span>Switch to Predictive</span>
                  </>
                )}
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
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
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
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <FileText size={12} />
          <span>{districtReportLoading ? 'Generating...' : 'District Report'}</span>
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
                marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Hexagon size={12} />
              <span>{dbscanLoading ? 'Clustering...' : showDbscan ? `${dbscanClusters.length} Clusters` : 'DBSCAN Clusters'}</span>
            </button>

            <button
              onClick={() => { setShowNextCrime(v => !v); if (!nextCrime) loadDbscan() }}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 6,
                border: '1px solid rgba(200,129,74,0.4)',
                background: showNextCrime ? 'rgba(200,129,74,0.1)' : 'transparent',
                color: 'var(--copper-300,#e8a87c)', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Sparkles size={12} />
              <span>Next Crime Prediction</span>
            </button>

            {/* CDR movement trail control panel */}
            <div style={{
              marginTop: 14,
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 10
            }}>
              <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700,
                           letterSpacing: '0.1em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={12} />
                <span>CDR MOVEMENT TRAIL</span>
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
                  <span style={{ fontSize: 10, color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={11} /> {cdrTrail.length} points plotted
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
            <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--copper-300,#e8a87c)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={13} />
              <span>Next Crime Prediction</span>
            </span>
            <button onClick={() => setShowNextCrime(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <X size={14} />
            </button>
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
                display: 'flex', alignItems: 'center', gap: 5
              }}>
                <Zap size={12} />
                <span>{nextCrime.recommended_action}</span>
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

      {/* Floating Top-Right Layer Switcher */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1000,
        display: 'flex', gap: 6, background: 'rgba(9, 16, 29, 0.94)',
        border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 4,
        backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(0,0,0,0.6)'
      }}>
        <button
          onClick={() => { setGlobeMode(false); setMapStyle('dark') }}
          style={{
            padding: '5px 11px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            background: (!globeMode && mapStyle === 'dark') ? 'var(--copper-500)' : 'transparent',
            color: (!globeMode && mapStyle === 'dark') ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={12} />
          <span>Dark Tactical</span>
        </button>
        <button
          onClick={() => { setGlobeMode(false); setMapStyle('satellite') }}
          style={{
            padding: '5px 11px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            background: (!globeMode && mapStyle === 'satellite') ? '#3b82f6' : 'transparent',
            color: (!globeMode && mapStyle === 'satellite') ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          <Satellite size={12} />
          <span>Satellite HD</span>
        </button>
        <button
          onClick={() => { setGlobeMode(false); setMapStyle('topo') }}
          style={{
            padding: '5px 11px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            background: (!globeMode && mapStyle === 'topo') ? 'var(--copper-500)' : 'transparent',
            color: (!globeMode && mapStyle === 'topo') ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          <Compass size={12} />
          <span>Topo Map</span>
        </button>
        <button
          onClick={() => setGlobeMode(true)}
          style={{
            padding: '5px 11px', fontSize: 11, fontWeight: 600,
            borderRadius: 6, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            background: globeMode ? '#8b5cf6' : 'transparent',
            color: globeMode ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease'
          }}
        >
          <Globe size={12} />
          <span>3D Globe</span>
        </button>
      </div>

      {/* Map Rendering Container */}
      <div style={{ width: '100%', height: '100%' }}>
        {loading ? (
          <LoadingPulse height={400} text="Mapping coordinates..." />
        ) : globeMode ? (
          <CesiumGlobe points={activePoints} casePins={casePins} hotspots={hotspots} />
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
            {mapStyle === 'satellite' && TILE_LAYERS.satellite.overlayUrl && (
              <TileLayer
                key="satellite-overlay"
                url={TILE_LAYERS.satellite.overlayUrl}
                attribution="&copy; Esri"
                opacity={0.85}
              />
            )}
            
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
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Details */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={12} color="var(--copper-400)" />
            <span>{selectedCasePin.DistrictName} District · Registered: {selectedCasePin.CrimeRegisteredDate}</span>
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
                style={{ minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {isTimelapsePlaying ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Play</>}
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setIsTimelapsePlaying(false)
                  setCurrentFrameIndex(0)
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <RotateCcw size={12} /> Reset
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


