import { useState, useEffect, useRef } from 'react'

const CESIUM_VERSION = '1.121'
const CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ4NS01NDI1OTM5MjQyNDMiLCJpZCI6NTc3MzMsImlhdCI6MTYyMjY0NDA3OX0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk'

const SEV_COLOR_HEX = {
  CRITICAL: '#ef4444',
  HIGH:     '#f59e0b',
  MEDIUM:   '#3b82f6',
  LOW:      '#22c55e',
}

export default function CesiumGlobe({
  points = [],
  liveEvent = null,
  buildings3D = true,
  cameraTarget = null,
}) {
  const mountRef = useRef(null)
  const viewerRef = useRef(null)
  const [cesiumReady, setCesiumReady] = useState(false)
  const [loading, setLoading] = useState(true)

  // 1. Inject Cesium CDN resources
  useEffect(() => {
    // Hide Cesium Ion notice banner
    const creditStyleId = 'cesium-hide-credits'
    if (!document.getElementById(creditStyleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = creditStyleId
      styleEl.innerHTML = '.cesium-widget-credits, .cesium-credit-textContainer, .cesium-credit-expand-link { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }'
      document.head.appendChild(styleEl)
    }

    const cssId = 'cesium-css'
    const jsId = 'cesium-js'

    if (!document.getElementById(cssId)) {
      const link = document.createElement('link')
      link.id = cssId
      link.rel = 'stylesheet'
      link.href = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Widgets/widgets.css`
      document.head.appendChild(link)
    }

    if (!document.getElementById(jsId)) {
      const script = document.createElement('script')
      script.id = jsId
      script.src = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js`
      script.async = true
      script.onload = () => setCesiumReady(true)
      document.head.appendChild(script)
    } else if (window.Cesium) {
      setCesiumReady(true)
    }
  }, [])

  // 2. Initialize Cesium Viewer
  useEffect(() => {
    if (!cesiumReady || !mountRef.current || viewerRef.current) return

    const Cesium = window.Cesium
    Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN

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
            positiveX: `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_px.jpg`,
            negativeX: `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mx.jpg`,
            positiveY: `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_py.jpg`,
            negativeY: `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_my.jpg`,
            positiveZ: `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_pz.jpg`,
            negativeZ: `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Assets/Textures/SkyBox/tycho2t3_80_mz.jpg`,
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
      if (buildings3D) {
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
      }

      // Style scene atmosphere & lighting
      viewer.scene.globe.enableLighting = true
      viewer.scene.globe.showGroundAtmosphere = true
      viewer.scene.skyAtmosphere.hueShift = -0.1
      viewer.scene.backgroundColor = new Cesium.Color(0.016, 0.02, 0.047, 1.0)
      viewer.scene.globe.depthTestAgainstTerrain = true

      viewerRef.current = viewer
      setLoading(false)

      // Initial camera fly-to Karnataka overview
      const targetLng = cameraTarget?.lng || 76.0
      const targetLat = cameraTarget?.lat || 14.5
      const altitude  = cameraTarget?.altitude || 1100000

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(targetLng, targetLat, altitude),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-45), roll: 0 },
        duration: 2.2,
      })

    } catch (e) {
      console.warn('[CesiumGlobe] Init error:', e)
      setLoading(false)
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [cesiumReady, buildings3D])

  // 3. Plot 3D Cylinders, Pillars & Crime Pins
  useEffect(() => {
    if (!viewerRef.current || !cesiumReady) return
    const Cesium = window.Cesium
    const viewer = viewerRef.current

    viewer.entities.removeAll()

    const dataset = points.length > 0 ? points : [
      { lat: 12.9716, lng: 77.5946, label: 'Bengaluru City HQ', severity: 'CRITICAL', count: 142, type: 'Cyber Fraud & Smurfing' },
      { lat: 12.2958, lng: 76.6394, label: 'Mysuru City Sector', severity: 'HIGH', count: 98, type: 'Land Grabbing & Cheating' },
      { lat: 15.8497, lng: 74.4977, label: 'Belagavi Sector', severity: 'HIGH', count: 84, type: 'Narcotics Smuggling' },
      { lat: 17.3297, lng: 76.8343, label: 'Kalaburagi Belt', severity: 'HIGH', count: 67, type: 'Extortion Ring' },
      { lat: 12.9254, lng: 74.8237, label: 'Mangaluru Port', severity: 'MEDIUM', count: 53, type: 'Hawala Transfers' },
      { lat: 13.3409, lng: 77.1000, label: 'Tumakuru Sector', severity: 'MEDIUM', count: 46, type: 'Vehicle Theft Gang' },
      { lat: 14.4426, lng: 75.7218, label: 'Davanagere Hub', severity: 'LOW', count: 38, type: 'Robbery Syndicate' },
      { lat: 15.1394, lng: 76.9214, label: 'Ballari Mining Belt', severity: 'MEDIUM', count: 31, type: 'Mining Fraud' },
      { lat: 16.8302, lng: 75.7100, label: 'Vijayapura District', severity: 'LOW', count: 25, type: 'Cattle Smuggling' },
      { lat: 13.9299, lng: 75.5681, label: 'Shivamogga Sector', severity: 'LOW', count: 22, type: 'Forest Mafia' },
    ]

    dataset.forEach(pt => {
      const lat = parseFloat(pt.lat)
      const lng = parseFloat(pt.lng)
      if (isNaN(lat) || isNaN(lng)) return

      const sev = (pt.severity || 'MEDIUM').toUpperCase()
      const hex = SEV_COLOR_HEX[sev] || '#3b82f6'
      const count = pt.count || 20
      const pillarHeight = Math.max(12000, Math.min(count * 800, 140000))

      // A) 3D Glowing Cylindrical Pillar
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, pillarHeight / 2),
        cylinder: {
          length: pillarHeight,
          topRadius: 3500.0,
          bottomRadius: 3500.0,
          material: Cesium.Color.fromCssColorString(hex).withAlpha(0.7),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(hex).withAlpha(0.95),
          outlineWidth: 2,
        },
      })

      // B) Top Pulsing Beacon Ring
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, pillarHeight + 2000),
        ellipse: {
          semiMinorAxis: 5000.0,
          semiMajorAxis: 5000.0,
          height: pillarHeight + 2000,
          material: Cesium.Color.fromCssColorString(hex).withAlpha(0.4),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString(hex),
          outlineWidth: 2,
        }
      })

      // C) Billboard / Label
      const labelText = pt.label || pt.type || pt.district || 'Incident'
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lng, lat, pillarHeight + 6000),
        label: {
          text: `${labelText}\n[${sev} · ${count} FIRs]`,
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }
      })
    })
  }, [points, cesiumReady])

  // 4. Camera Fly-To on live event arrival
  useEffect(() => {
    if (!viewerRef.current || !cesiumReady || !liveEvent?.lat || !liveEvent?.lng) return
    const Cesium = window.Cesium
    const viewer = viewerRef.current
    const lat = parseFloat(liveEvent.lat)
    const lng = parseFloat(liveEvent.lng)
    if (isNaN(lat) || isNaN(lng)) return

    // Flash a temporary critical alert sphere at live event
    const beacon = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 2000),
      ellipsoid: {
        radii: new Cesium.Cartesian3(8000.0, 8000.0, 8000.0),
        material: Cesium.Color.RED.withAlpha(0.8),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      }
    })

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat - 0.25, 45000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0
      },
      duration: 2.0,
      complete: () => {
        setTimeout(() => {
          if (viewer && !viewer.isDestroyed()) {
            viewer.entities.remove(beacon)
          }
        }, 5000)
      }
    })
  }, [liveEvent, cesiumReady])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#04060c' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading Overlay */}
      {loading && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(4,6,12,0.85)', zIndex: 10, gap: 10
        }}>
          <div style={{
            width: 28, height: 28, border: '2px solid rgba(245,158,11,0.2)',
            borderTop: '2px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'monospace', letterSpacing: 1 }}>
            INITIALIZING 3D CESIUM SATELLITE ENGINE...
          </span>
        </div>
      )}

      {/* 3D Badge Overlay */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10, zIndex: 5,
        background: 'rgba(6,8,16,0.85)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4, padding: '4px 8px', fontSize: 8, color: '#94a3b8',
        display: 'flex', gap: 6, alignItems: 'center', fontFamily: 'monospace'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
        <span>CESIUM 3D GLOBE · ESRI SATELLITE & 3D TERRAIN ACTIVE</span>
      </div>
    </div>
  )
}
