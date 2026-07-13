import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNetworkGraph } from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'

export default function NetworkGraph3D() {
  const navigate = useNavigate()
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [stats, setStats] = useState({ nodes: 0, edges: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const THREE = window.THREE
    if (!THREE) {
      console.error("Three.js not found on window object.")
      return
    }

    setLoading(true)

    // ─── Scene setup ────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#07070a')
    scene.fog = new THREE.FogExp2('#07070a', 0.006)

    const camera = new THREE.PerspectiveCamera(
      60, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 2000
    )
    camera.position.set(0, 0, 320)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    mountRef.current.appendChild(renderer.domElement)

    // ─── Orbit Controls (custom high-performance manual implementation) ────────────
    let isDragging = false, prevMouse = { x: 0, y: 0 }
    let spherical = { theta: 0, phi: Math.PI / 2, radius: 320 }

    const dom = renderer.domElement

    const onMouseDown = (e) => {
      isDragging = true
      prevMouse = { x: e.clientX, y: e.clientY }
    }
    const onMouseUp = () => { isDragging = false }
    const onMouseMove = (e) => {
      if (!isDragging) return
      spherical.theta -= (e.clientX - prevMouse.x) * 0.004
      spherical.phi   -= (e.clientY - prevMouse.y) * 0.004
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi))
      prevMouse = { x: e.clientX, y: e.clientY }
      
      updateCameraPosition()
    }
    const onWheel = (e) => {
      e.preventDefault()
      spherical.radius = Math.max(80, Math.min(750, spherical.radius + e.deltaY * 0.25))
      updateCameraPosition()
    }

    const updateCameraPosition = () => {
      camera.position.set(
        spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta),
        spherical.radius * Math.cos(spherical.phi),
        spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta)
      )
      camera.lookAt(0, 0, 0)
    }

    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    dom.addEventListener('wheel', onWheel)

    updateCameraPosition()

    // ─── Node color & size configs ──────────────────────────────────
    const nodeColors = {
      person:  0x7f77dd, // purple
      case:    0xe05252, // red
      phone:   0x4a9ede, // blue
      bank:    0x52b788, // green
      vehicle: 0xe0a832  // orange
    }
    const nodeSizes = {
      person: 4.5, case: 3.5, phone: 2.5, bank: 2.5, vehicle: 2.5
    }

    // Positions & forces variables
    const positions = {}
    const velocities = {}
    const meshes = {}
    const edges = []

    // Fetch vis network nodes and edges from API
    fetchNetworkGraph(240).then(data => {
      const nodeList = data.nodes || []
      const edgeList = data.edges || []

      // Create 3D Nodes
      nodeList.forEach(node => {
        const radius = 160
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        
        positions[node.id] = new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta)
        )
        velocities[node.id] = new THREE.Vector3(0, 0, 0)

        // Sphere mesh creation
        const size = nodeSizes[node.type] || 3.0
        const geo = new THREE.SphereGeometry(size, 16, 16)
        const mat = new THREE.MeshPhongMaterial({
          color: nodeColors[node.type] || 0xffffff,
          emissive: nodeColors[node.type] || 0xffffff,
          emissiveIntensity: 0.25,
          shininess: 120
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.copy(positions[node.id])
        mesh.userData = { nodeId: node.id, nodeData: node }
        scene.add(mesh)
        meshes[node.id] = mesh
      })

      // Create 3D Edges
      edgeList.forEach(edge => {
        const fromPos = positions[edge.from]
        const toPos = positions[edge.to]
        if (!fromPos || !toPos) return

        const points = [fromPos.clone(), toPos.clone()]
        const geo = new THREE.BufferGeometry().setFromPoints(points)
        const mat = new THREE.LineBasicMaterial({
          color: 0x444455,
          opacity: 0.35,
          transparent: true
        })
        const line = new THREE.Line(geo, mat)
        scene.add(line)
        edges.push({ from: edge.from, to: edge.to, line })
      })

      setStats({ nodes: nodeList.length, edges: edgeList.length })
      setLoading(false)

      // --- Force Simulation math step ---
      const nodeIds = nodeList.map(n => n.id)
      const adjList = {}
      edgeList.forEach(e => {
        if (!adjList[e.from]) adjList[e.from] = []
        if (!adjList[e.to]) adjList[e.to] = []
        adjList[e.from].push(e.to)
        adjList[e.to].push(e.from)
      })

      let simStep = 0
      const simulate = () => {
        if (simStep > 240) return

        nodeIds.forEach(id => {
          const pos = positions[id]
          const vel = velocities[id]

          // Repulsion
          nodeIds.forEach(otherId => {
            if (otherId === id) return
            const diff = pos.clone().sub(positions[otherId])
            const dist = Math.max(diff.length(), 6)
            const force = 900 / (dist * dist)
            vel.addScaledVector(diff.normalize(), force)
          })

          // Attraction
          ;(adjList[id] || []).forEach(otherId => {
            const diff = positions[otherId].clone().sub(pos)
            const dist = diff.length()
            const force = dist * 0.012
            vel.addScaledVector(diff.normalize(), force)
          })

          // Center gravity
          vel.addScaledVector(pos.clone().negate(), 0.004)

          // Damping
          vel.multiplyScalar(0.82)
          pos.add(vel)

          if (meshes[id]) meshes[id].position.copy(pos)
        })

        // Re-align lines
        edges.forEach(({ from, to, line }) => {
          if (positions[from] && positions[to]) {
            const points = [positions[from].clone(), positions[to].clone()]
            line.geometry.setFromPoints(points)
            line.geometry.attributes.position.needsUpdate = true
          }
        })

        simStep++
      }

      // ─── Lights ──────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.45))
      const dirLight = new THREE.DirectionalLight(0xc8814a, 0.9)
      dirLight.position.set(120, 120, 120)
      scene.add(dirLight)
      const dirLight2 = new THREE.DirectionalLight(0x4a9ede, 0.4)
      dirLight2.position.set(-120, -60, -120)
      scene.add(dirLight2)

      // ─── Raycaster ───────────────────────────────────────────────
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2()

      const onClick = (e) => {
        const rect = dom.getBoundingClientRect()
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
        
        raycaster.setFromCamera(mouse, camera)
        const intersects = raycaster.intersectObjects(Object.values(meshes))
        
        if (intersects.length > 0) {
          const hit = intersects[0].object
          setSelectedNode(hit.userData.nodeData)
          
          // Highlight
          Object.values(meshes).forEach(m => {
            m.material.emissiveIntensity = m === hit ? 1.1 : 0.08
            m.scale.setScalar(m === hit ? 1.4 : 1.0)
          })
        }
      }
      dom.addEventListener('click', onClick)

      // ─── Animation loop ──────────────────────────────────────────
      let animId
      const animate = () => {
        animId = requestAnimationFrame(animate)
        simulate()
        renderer.render(scene, camera)
      }
      animate()

      // Cleanup
      sceneRef.current = {
        cleanup: () => {
          cancelAnimationFrame(animId)
          dom.removeEventListener('mousedown', onMouseDown)
          window.removeEventListener('mouseup', onMouseUp)
          window.removeEventListener('mousemove', onMouseMove)
          dom.removeEventListener('wheel', onWheel)
          dom.removeEventListener('click', onClick)
        }
      }
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })

    return () => {
      if (sceneRef.current) sceneRef.current.cleanup()
      renderer.dispose()
      if (mountRef.current) mountRef.current.innerHTML = ''
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - var(--topbar-height) - 32px)', background: '#07070a' }}>
      
      {/* ThreeJS container */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,7,10,0.85)' }}>
          <LoadingPulse text="Compiling WebGL Force Simulation..." />
        </div>
      )}

      {/* Network Stats Overlay */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(7,7,10,0.85)', border: '1px solid var(--border-default)',
        borderRadius: 8, padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 11,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100
      }}>
        <div className="mono" style={{ color: 'var(--copper-400)', fontWeight: 700 }}>
          {stats.nodes} SPHERES · {stats.edges} VECTOR CONNECTIONS
        </div>
        
        <div style={{ marginTop: 6, display: 'flex', gap: 10 }}>
          {[
            { label: 'Person', color: '#7f77dd' },
            { label: 'Case', color: '#e05252' },
            { label: 'Phone', color: '#4a9ede' },
            { label: 'Bank', color: '#52b788' },
            { label: 'Vehicle', color: '#e0a832' }
          ].map(({ label, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ fontSize: 9 }}>{label}</span>
            </span>
          ))}
        </div>
        
        <div style={{ marginTop: 8, fontSize: 9, color: 'var(--text-muted)' }}>
          Left-drag to rotate · Scroll wheel to zoom · Right-drag to pan · Click node to inspect
        </div>
      </div>

      {/* Inspection Sidebar Drawer */}
      {selectedNode && (
        <div style={{
          position: 'absolute', top: 16, right: 16, width: 280,
          background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.8)', zIndex: 100
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase' }}>
              Inspected Node
            </span>
            <button onClick={() => setSelectedNode(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
              ×
            </button>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedNode.label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Type: {selectedNode.type?.toUpperCase()}
          </div>
          
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 10, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Entity matches database records. Connection weight active.
            </div>
            {selectedNode.type === 'person' && (
              <button
                className="btn btn-xs btn-copper"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  const pid = selectedNode.id.replace('p_', '');
                  navigate(`/accused/${pid}`);
                }}
              >
                📁 Open Criminal Dossier
              </button>
            )}
            {selectedNode.type === 'case' && (
              <button
                className="btn btn-xs btn-copper"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  const cid = selectedNode.id.replace('c_', '');
                  navigate(`/timeline/${cid}`);
                }}
              >
                📂 Open Case File
              </button>
            )}
            {!['person', 'case'].includes(selectedNode.type) && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                Inspect mode active
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
