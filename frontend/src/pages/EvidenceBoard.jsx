import { useState, useEffect, useRef } from 'react'
import {
  fetchBoards,
  loadBoard,
  saveBoard,
  deleteBoard,
  uploadEvidence,
  matchSuspect,
  analyzeBoard,
  connectDots,
  generateSitrep,
  fetchCases,
  fetchRepeatOffenders,
  searchCases,
  searchPersons
} from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'

export default function EvidenceBoard() {
  // Main states
  const [boardId, setBoardId] = useState('board_shadow_net')
  const [boardName, setBoardName] = useState('Operation Shadow Net')
  const [nodes, setNodes] = useState([])
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 100, y: 80 })
  const [draggingNodeId, setDraggingNodeId] = useState(null)
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 })

  // Active Modes
  const [connectMode, setConnectMode] = useState(false)
  const [fromNodeId, setFromNodeId] = useState(null)
  const [tempLineEnd, setTempLineEnd] = useState(null)
  
  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  
  // Dialog / Sidebar states
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addType, setAddType] = useState(null) // 'photo' | 'document' | 'case' | 'person' | 'location'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  
  // AI Brain states
  const [aiSidebar, setAiSidebar] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiInsights, setAiInsights] = useState([])
  const [aiBrief, setAiBrief] = useState('')
  
  // Suspect matching
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchResults, setMatchResults] = useState(null)

  // SITREP states
  const [showSitrepModal, setShowSitrepModal] = useState(false)
  const [sitrepMeta, setSitrepMeta] = useState({ name: 'Operation Shadow Net', classification: 'CONFIDENTIAL' })
  const [sitrepDownloading, setSitrepDownloading] = useState(false)

  const canvasRef = useRef(null)

  // Load initial boards / or select default
  useEffect(() => {
    loadBoardData(boardId)
  }, [])

  // Auto-save every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      if (nodes.length > 0) {
        performSave(false)
      }
    }, 30000)
    return () => clearInterval(timer)
  }, [nodes, connections, boardName, boardId])

  const loadBoardData = async (id) => {
    setLoading(true)
    try {
      const b = await loadBoard(id)
      setNodes(b.nodes || [])
      setConnections(b.connections || [])
      setBoardName(b.name || 'Investigation Board')
    } catch (e) {
      // Fallback default board if not found
      console.log('No board found, loading default seed nodes.')
      setNodes([
        {
          id: 'node_1',
          type: 'case',
          x: 200, y: 150,
          title: 'Case #456 — UPI Cyber Fraud',
          subtitle: 'Bengaluru Urban · Under Investigation',
          imageUrl: null,
          content: 'Cyber crime cells reported 8 suspicious transactions from account 90812328.',
          caseId: 456,
          color: 'var(--copper-500)',
          tags: ['UPI Fraud', 'High Gravity'],
        },
        {
          id: 'node_2',
          type: 'person',
          x: 550, y: 220,
          title: 'Ashok Kumar',
          subtitle: 'Suspected Syndicate Coordinator',
          imageUrl: null,
          content: 'Priors listed under cheating & narcotics. Active location in Hebbal.',
          accusedId: 5,
          color: '#e05252',
          tags: ['Main Actor', 'Repeat Offender']
        }
      ])
      setConnections([
        {
          id: 'conn_1',
          fromNodeId: 'node_1',
          toNodeId: 'node_2',
          label: 'Primary Beneficiary',
          color: '#e05252',
          thickness: 2
        }
      ])
    }
    setLoading(false)
  }

  const performSave = async (showNotify = true) => {
    try {
      await saveBoard({
        board_id: boardId,
        name: boardName,
        nodes,
        connections
      })
      if (showNotify) alert('Evidence board saved successfully.')
    } catch (e) {
      console.error(e)
    }
  }

  // --- Add Nodes flow ---
  const handleOpenAdd = (type) => {
    setAddType(type)
    setSearchQuery('')
    setSearchResults([])
    setShowAddMenu(true)
  }

  const handleSearch = async () => {
    if (searchQuery.length < 2) return
    try {
      if (addType === 'case') {
        const res = await searchCases(searchQuery)
        setSearchResults(res || [])
      } else if (addType === 'person') {
        const res = await searchPersons(searchQuery)
        setSearchResults(res || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreateNode = (title, subtitle = '', content = '', imageUrl = null, extra = {}) => {
    const newNode = {
      id: `node_${Date.now()}`,
      type: addType,
      x: 100 - pan.x / zoom + Math.random() * 80,
      y: 120 - pan.y / zoom + Math.random() * 80,
      title,
      subtitle,
      content,
      imageUrl,
      color: addType === 'person' ? '#e05252' : addType === 'case' ? '#e0a832' : 'var(--copper-500)',
      tags: extra.tags || [addType.toUpperCase()],
      ...extra
    }
    setNodes(prev => [...prev, newNode])
    setShowAddMenu(false)
  }

  // --- Drag nodes & Pan canvas ---
  const handleNodeMouseDown = (e, id) => {
    if (connectMode) {
      handleConnectClick(id)
      return
    }
    setDraggingNodeId(id)
    setSelectedNodeId(id)
    const node = nodes.find(n => n.id === id)
    if (node) {
      const clientX = e.clientX
      const clientY = e.clientY
      setDragStartOffset({
        x: clientX - node.x * zoom,
        y: clientY - node.y * zoom
      })
    }
    e.stopPropagation()
  }

  const handleCanvasMouseMove = (e) => {
    if (draggingNodeId) {
      const clientX = e.clientX
      const clientY = e.clientY
      setNodes(prev => prev.map(n => {
        if (n.id === draggingNodeId) {
          return {
            ...n,
            x: (clientX - dragStartOffset.x) / zoom,
            y: (clientY - dragStartOffset.y) / zoom
          }
        }
        return n
      }))
    } else if (fromNodeId && tempLineEnd) {
      // Connect line cursor tracking
      const canvasBounds = canvasRef.current.getBoundingClientRect()
      setTempLineEnd({
        x: (e.clientX - canvasBounds.left - pan.x) / zoom,
        y: (e.clientY - canvasBounds.top - pan.y) / zoom
      })
    }
  }

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null)
  }

  const handleBgMouseDown = (e) => {
    if (e.target !== e.currentTarget && e.target.id !== 'canvas-grid') return
    const startX = e.clientX - pan.x
    const startY = e.clientY - pan.y
    const onMove = (ev) => {
      setPan({ x: ev.clientX - startX, y: ev.clientY - startY })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // --- Zoom wheel ---
  const handleWheel = (e) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(2.0, z - e.deltaY * 0.001)))
  }

  // --- Connect Mode ---
  const handleConnectClick = (id) => {
    if (!fromNodeId) {
      setFromNodeId(id)
      const fromNode = nodes.find(n => n.id === id)
      setTempLineEnd({ x: fromNode.x + 90, y: fromNode.y + 60 })
    } else {
      if (fromNodeId !== id) {
        const newConn = {
          id: `conn_${Date.now()}`,
          fromNodeId,
          toNodeId: id,
          label: 'Linked Intelligence',
          color: '#e05252',
          thickness: 2
        }
        setConnections(prev => [...prev, newConn])
      }
      setFromNodeId(null)
      setTempLineEnd(null)
      setConnectMode(false)
    }
  }

  const handleDeleteSelected = () => {
    if (!selectedNodeId) return
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId))
    setConnections(prev => prev.filter(c => c.fromNodeId !== selectedNodeId && c.toNodeId !== selectedNodeId))
    setSelectedNodeId(null)
  }

  // --- AI Brain integrations ---
  const handleAIAnalyze = async () => {
    setAiAnalyzing(true)
    setAiSidebar(true)
    const caseIds = nodes.filter(n => n.type === 'case' && n.caseId).map(n => n.caseId)
    try {
      const res = await analyzeBoard({
        board_id: boardId,
        nodes,
        connections,
        case_ids: caseIds
      })
      setAiInsights(res.key_insights || [])
      setAiBrief(res.investigation_brief || '')
      
      // Merge new AI connections
      if (res.new_connections && res.new_connections.length > 0) {
        setConnections(prev => {
          const existing = new Set(prev.map(c => `${c.fromNodeId}-${c.toNodeId}`))
          const toAdd = res.new_connections.filter(c => !existing.has(`${c.fromNodeId}-${c.toNodeId}`) && !existing.has(`${c.toNodeId}-${c.fromNodeId}`))
          return [...prev, ...toAdd.map((c, i) => ({
            id: `ai_conn_${Date.now()}_${i}`,
            fromNodeId: c.fromNodeId,
            toNodeId: c.toNodeId,
            label: c.label || 'AI Connection Correlation',
            color: '#c8814a',
            thickness: 1
          }))]
        })
      }
    } catch (e) {
      console.error(e)
    }
    setAiAnalyzing(false)
  }

  const handleConnectDots = async () => {
    setAiAnalyzing(true)
    setAiSidebar(true)
    const entityNames = nodes.filter(n => n.type === 'person').map(n => n.title)
    const caseIds = nodes.filter(n => n.type === 'case' && n.caseId).map(n => n.caseId)
    try {
      const res = await connectDots({
        entity_names: entityNames,
        case_ids: caseIds
      })
      if (res.connections && res.connections.length > 0) {
        setConnections(prev => {
          const updated = [...prev]
          res.connections.forEach((c, idx) => {
            const nodeA = nodes.find(n => n.title.toLowerCase().includes(c.entity_a.toLowerCase()))
            const nodeB = nodes.find(n => n.title.toLowerCase().includes(c.entity_b.toLowerCase()))
            if (nodeA && nodeB) {
              const exists = updated.some(conn => 
                (conn.fromNodeId === nodeA.id && conn.toNodeId === nodeB.id) ||
                (conn.fromNodeId === nodeB.id && conn.toNodeId === nodeA.id)
              )
              if (!exists) {
                updated.push({
                  id: `ai_dots_${Date.now()}_${idx}`,
                  fromNodeId: nodeA.id,
                  toNodeId: nodeB.id,
                  label: `${c.connection_type}: ${c.evidence}`,
                  color: '#e05252',
                  thickness: 2
                })
              }
            }
          })
          return updated
        })
      }
      setAiInsights([res.network_summary || "Connection analysis completed."])
      setAiBrief(res.key_actor ? `Primary suspect of interest identified as ${res.key_actor}.` : "Syndicate cells mapped successfully.")
    } catch (e) {
      console.error(e)
    }
    setAiAnalyzing(false)
  }

  // --- Photo Upload Zia Flow ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    
    // Add loader placeholder node
    const tempId = `node_loading_${Date.now()}`
    const tempNode = {
      id: tempId,
      type: 'photo',
      x: 150 - pan.x / zoom,
      y: 150 - pan.y / zoom,
      title: 'Zia scanning file...',
      subtitle: 'Analyzing image metadata',
      imageUrl: null,
      loading: true,
      color: 'var(--copper-400)',
      tags: ['ZIA UPLOAD']
    }
    setNodes(prev => [...prev, tempNode])

    try {
      const res = await uploadEvidence(formData)
      setNodes(prev => prev.map(n => {
        if (n.id === tempId) {
          return {
            ...n,
            title: file.name,
            subtitle: res.zia_analysis.text_found?.slice(0, 50) || 'Analyzed Frame',
            imageUrl: res.file_url,
            loading: false,
            tags: res.suggested_tags || ['Photo Evidence'],
            content: res.zia_analysis.text_found || 'Face detected by Catalyst Zia.'
          }
        }
        return n
      }))
    } catch (err) {
      console.error(err)
      setNodes(prev => prev.filter(n => n.id !== tempId))
    }
  }

  // --- Suspect Face Matching Modal ---
  const handleSuspectMatch = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setMatchLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await matchSuspect(formData)
      setMatchResults(res)
    } catch (err) {
      console.error(err)
    }
    setMatchLoading(false)
  }

  // --- Sitrep Generator ---
  const handleDownloadSitrep = async (e) => {
    e.preventDefault()
    setSitrepDownloading(true)
    const caseIds = nodes.filter(n => n.type === 'case' && n.caseId).map(n => n.caseId)
    try {
      const res = await generateSitrep({
        investigation_name: sitrepMeta.name,
        board_id: boardId,
        case_ids: caseIds,
        classification: sitrepMeta.classification
      })
      // Trigger download
      const blob = new Blob([res], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `SITREP_${sitrepMeta.name.replace(/\s+/g, '_')}.pdf`
      link.click()
      setShowSitrepModal(false)
    } catch (err) {
      console.error(err)
      alert('SITREP PDF compilation failed. Please confirm server ReportLab availability.')
    }
    setSitrepDownloading(false)
  }

  if (loading) {
    return <LoadingPulse height={400} text="Loading Evidence Corkboard..." />
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'calc(100vh - var(--topbar-height) - 32px)',
      overflow: 'hidden',
      background: '#07070a',
      fontFamily: 'var(--font-sans)',
      userSelect: 'none'
    }}>
      
      {/* ─── TOOLBAR CONTROLS ─── */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
        borderRadius: 30, padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-copper" onClick={() => handleOpenAdd('photo')}>+ Photo</button>
          <button className="btn btn-sm" style={{ border: '1px solid var(--border-default)' }} onClick={() => handleOpenAdd('document')}>+ Notes</button>
          <button className="btn btn-sm" style={{ border: '1px solid var(--border-default)' }} onClick={() => handleOpenAdd('case')}>+ Case</button>
          <button className="btn btn-sm" style={{ border: '1px solid var(--border-default)' }} onClick={() => handleOpenAdd('person')}>+ suspect</button>
        </div>

        <span style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="btn btn-sm"
            style={{
              background: connectMode ? 'var(--copper-500)' : 'transparent',
              color: connectMode ? 'white' : 'var(--copper-300)',
              border: '1px solid var(--copper-500)'
            }}
            onClick={() => {
              setConnectMode(!connectMode)
              setFromNodeId(null)
              setTempLineEnd(null)
            }}
          >
            🔗 {connectMode ? 'Click Card Target' : 'Connect'}
          </button>
          
          <button
            className="btn btn-sm"
            disabled={!selectedNodeId}
            style={{ borderColor: selectedNodeId ? '#e05252' : 'var(--border-subtle)', color: selectedNodeId ? '#e05252' : 'var(--text-muted)' }}
            onClick={handleDeleteSelected}
          >
            🗑 Delete
          </button>
        </div>

        <span style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-copper" onClick={handleAIAnalyze} disabled={aiAnalyzing}>
            🤖 AI Analyze
          </button>
          <button className="btn btn-sm" style={{ border: '1px solid var(--border-default)' }} onClick={handleConnectDots} disabled={aiAnalyzing}>
            🔗 Connect Dots
          </button>
          <button className="btn btn-sm" style={{ border: '1px solid var(--border-default)' }} onClick={() => setShowMatchModal(true)}>
            🔍 Zia Match
          </button>
          <button className="btn btn-sm" style={{ border: '1px solid var(--border-default)' }} onClick={() => setShowSitrepModal(true)}>
            📋 SITREP
          </button>
          <button className="btn btn-sm btn-copper" onClick={() => performSave(true)}>💾 Save</button>
        </div>
      </div>

      {/* ─── CORKBOARD CANVAS AREA ─── */}
      <div
        ref={canvasRef}
        id="canvas-grid"
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseDown={handleBgMouseDown}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'grab',
          position: 'relative',
          backgroundImage: 'radial-gradient(circle, rgba(200,129,74,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      >
        <div style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: '0 0',
          position: 'absolute',
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}>
          
          {/* CURVED STRING SVG LAYER */}
          <svg style={{
            position: 'absolute', top: 0, left: 0,
            width: 3000, height: 2000,
            pointerEvents: 'none', zIndex: 1
          }}>
            {connections.map((conn) => {
              const from = nodes.find(n => n.id === conn.fromNodeId)
              const to = nodes.find(n => n.id === conn.toNodeId)
              if (!from || !to) return null
              
              const fx = from.x + 95
              const fy = from.y + 70
              const tx = to.x + 95
              const ty = to.y + 70

              // Curve path
              const mx = (fx + tx) / 2
              const my = (fy + ty) / 2 + 25 // droop down

              return (
                <g key={conn.id}>
                  <path
                    d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
                    stroke={conn.color || '#e05252'}
                    strokeWidth={conn.thickness || 2}
                    fill="none"
                    opacity="0.8"
                    strokeDasharray={conn.thickness === 1 ? '4 4' : 'none'}
                  />
                  {conn.label && (
                    <text x={mx} y={my - 8} textAnchor="middle" fill={conn.color || '#e05252'} fontSize="9" fontWeight="600" opacity="0.9">
                      {conn.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Connecting line helper */}
            {fromNodeId && tempLineEnd && (
              <line
                x1={nodes.find(n => n.id === fromNodeId)?.x + 95}
                y1={nodes.find(n => n.id === fromNodeId)?.y + 70}
                x2={tempLineEnd.x}
                y2={tempLineEnd.y}
                stroke="#e05252"
                strokeWidth="2"
                strokeDasharray="5 5"
              />
            )}
          </svg>

          {/* ABSOLUTE CARDS GRID */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}>
            {nodes.map((node) => (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: 190,
                  cursor: 'grab',
                  transform: selectedNodeId === node.id ? 'scale(1.03)' : 'scale(1)',
                  border: selectedNodeId === node.id ? '2px solid var(--copper-400)' : '1px solid var(--border-default)',
                  borderRadius: 8,
                  background: 'var(--bg-card)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  zIndex: selectedNodeId === node.id ? 200 : 10,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                {/* Thumbtack pin */}
                <svg width="22" height="22" style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                  <circle cx="11" cy="11" r="7" fill={node.color} />
                  <circle cx="11" cy="11" r="3" fill="#1a110a" opacity="0.7" />
                </svg>

                {node.imageUrl && (
                  <img src={node.imageUrl} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 4 }} />
                )}
                
                {node.loading && (
                  <div style={{ height: 110, background: 'var(--bg-secondary)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                    Uploading to Zia...
                  </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {node.title}
                </div>

                {node.subtitle && (
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    {node.subtitle}
                  </div>
                )}

                {node.content && (
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 4, lineHeight: 1.3 }}>
                    {node.content}
                  </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {node.tags?.map((t, idx) => (
                    <span key={idx} style={{ padding: '1px 5px', borderRadius: 10, fontSize: 8, background: 'rgba(200,129,74,0.12)', color: 'var(--copper-400)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ─── ADD DIALOG MODAL ─── */}
      {showAddMenu && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 420, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--copper-400)' }}>
                Add Node — {addType}
              </div>
              <button className="btn btn-sm" onClick={() => setShowAddMenu(false)}>×</button>
            </div>

            {addType === 'case' || addType === 'person' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder={`Search ${addType}...`}
                    className="input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ fontSize: 11, padding: '6px 8px' }}
                  />
                  <button className="btn btn-sm btn-copper" onClick={handleSearch}>Search</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => handleCreateNode(
                        addType === 'case' ? `Case ${r.CrimeNo}` : r.name,
                        addType === 'case' ? r.CrimeGroupName : `Age ${r.age} · Repeat Offender`,
                        addType === 'case' ? r.BriefFacts : `Offences count: ${r.case_count}`,
                        null,
                        { caseId: r.CaseMasterID, accusedId: r.accused_id, tags: [addType.toUpperCase(), 'INVESTIGATION'] }
                      )}
                      style={{ padding: 6, borderRadius: 4, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: 11 }}
                    >
                      {addType === 'case' ? `${r.CrimeNo} - ${r.CrimeGroupName}` : `${r.name} (${r.case_count} cases)`}
                    </div>
                  ))}
                </div>
              </div>
            ) : addType === 'photo' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Upload image file (Zia will auto-analyze faces/text):
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handleFileUpload(e)
                    setShowAddMenu(false)
                  }}
                  style={{ fontSize: 11 }}
                />
              </div>
            ) : (
              // Location / Document custom entry
              <form onSubmit={(e) => {
                e.preventDefault()
                const data = new FormData(e.target)
                handleCreateNode(
                  data.get('title'),
                  addType.toUpperCase(),
                  data.get('content'),
                  null,
                  { tags: [addType.toUpperCase()] }
                )
              }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input required name="title" placeholder="Title" className="input" style={{ fontSize: 11, padding: '6px 8px' }} />
                <textarea name="content" placeholder="Details/Description" className="input" rows="3" style={{ fontSize: 11, padding: '6px 8px' }} />
                <button type="submit" className="btn btn-sm btn-copper">Create</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── SUSPECT MATCH MODAL ─── */}
      {showMatchModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 440, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)' }}>
                🔍 Zia Suspect Face Match
              </div>
              <button className="btn btn-sm" onClick={() => { setShowMatchModal(false); setMatchResults(null); }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Select suspect photo (demographics matching against repeat offenders):
              </label>
              <input type="file" accept="image/*" onChange={handleSuspectMatch} style={{ fontSize: 11 }} />
            </div>

            {matchLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Running Zia face detection...</div>}

            {matchResults && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 4, fontSize: 10 }}>
                  <strong>Zia Description:</strong> {matchResults.zia_analysis?.description}
                </div>
                
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>Top 3 Database Matches:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {matchResults.matches?.map((m, i) => (
                    <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: 8, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ fontWeight: 700 }}>{m.name}</span>
                        <span style={{ color: 'var(--copper-400)', fontWeight: 700 }}>{m.confidence} match</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.reasoning}</div>
                      <button
                        className="btn btn-xs btn-copper"
                        style={{ alignSelf: 'flex-start', fontSize: 8, padding: '2px 6px', marginTop: 2 }}
                        onClick={() => {
                          handleCreateNode(m.name, 'Suspect Profile', `Match confidence: ${m.confidence}`, null, { accusedId: m.accused_id, tags: ['Accused', 'ZIA MATCH'] })
                          setShowMatchModal(false)
                          setMatchResults(null)
                        }}
                      >
                        + Add suspect to corkboard
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
              ⚠️ AI matching is probabilistic. Always verify with official records.
            </div>
          </div>
        </div>
      )}

      {/* ─── SITREP GENERATION MODAL ─── */}
      {showSitrepModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 400, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)' }}>
                📋 Generate Situation Report (SITREP)
              </div>
              <button className="btn btn-sm" onClick={() => setShowSitrepModal(false)}>×</button>
            </div>

            <form onSubmit={handleDownloadSitrep} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Investigation Name</label>
                <input
                  required
                  type="text"
                  className="input"
                  value={sitrepMeta.name}
                  onChange={e => setSitrepMeta(prev => ({ ...prev, name: e.target.value }))}
                  style={{ fontSize: 11, padding: '6px 8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Security Classification</label>
                <select
                  className="input"
                  value={sitrepMeta.classification}
                  onChange={e => setSitrepMeta(prev => ({ ...prev, classification: e.target.value }))}
                  style={{ fontSize: 11, padding: '6px 8px', height: 'auto' }}
                >
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                  <option value="SECRET">SECRET</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={sitrepDownloading}
                className="btn btn-copper"
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                {sitrepDownloading ? 'Compiling PDF...' : 'Download SITREP PDF'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── AI BRAIN PANEL DRAWER ─── */}
      {aiSidebar && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 380,
          background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border-strong)',
          zIndex: 4000, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)', letterSpacing: '0.05em' }}>
              🤖 SENTINEL AI BRAIN
            </div>
            <button className="btn btn-sm" onClick={() => setAiSidebar(false)}>×</button>
          </div>
          
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Powered by Catalyst QuickML
          </div>

          {aiAnalyzing ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingPulse text="AI analyzing evidence linkages..." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {aiBrief && (
                <div className="card" style={{ padding: 10, background: 'rgba(200,129,74,0.04)' }}>
                  <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700, marginBottom: 4 }}>INVESTIGATION BRIEFING</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{aiBrief}</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>KEY ANOMALY INSIGHTS</div>
                {aiInsights.map((insight, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: 8, borderRadius: 4, fontSize: 11, color: 'var(--text-primary)' }}>
                    • {insight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
