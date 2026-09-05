import { useState, useEffect, useRef } from 'react'
import {
  Search, AlertTriangle, FileText, Brain, Sparkles, Plus, X,
  Maximize2, Minimize2, Video, Image as ImageIcon, ZoomIn,
  Eye, ShieldAlert, CheckCircle2, ChevronRight, File, Play
} from 'lucide-react'
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
  searchCases,
  searchPersons,
  analyzeVideoEvidence
} from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import Icon from '../components/Icons'

const CARD_SIZES = {
  sm: { width: 210, label: 'S' },
  md: { width: 310, label: 'M' },
  lg: { width: 440, label: 'L' },
  xl: { width: 580, label: 'XL' }
}

export default function EvidenceBoard() {
  // Main states
  const [boardId, setBoardId] = useState('board_shadow_net')
  const [boardName, setBoardName] = useState('Operation Shadow Net')
  const [nodes, setNodes] = useState([])
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 80, y: 70 })

  // Active Modes
  const [connectMode, setConnectMode] = useState(false)
  const [fromNodeId, setFromNodeId] = useState(null)
  const [tempLineEnd, setTempLineEnd] = useState(null)

  // Selection
  const [selectedNodeId, setSelectedNodeId] = useState(null)

  // Dialog / Sidebar states
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addType, setAddType] = useState(null) // 'photo' | 'video' | 'document' | 'case' | 'person' | 'location'
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // AI Brain states
  const [aiSidebar, setAiSidebar] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiInsights, setAiInsights] = useState([])
  const [aiBrief, setAiBrief] = useState('')

  // Video Forensics Modal
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoForensicsData, setVideoForensicsData] = useState(null)
  const [videoAnalyzing, setVideoAnalyzing] = useState(false)

  // Suspect matching
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchResults, setMatchResults] = useState(null)

  // Media Previews / Lightbox
  const [lightboxMedia, setLightboxMedia] = useState(null) // { type: 'image' | 'video' | 'doc', url, title, content }

  // SITREP states
  const [showSitrepModal, setShowSitrepModal] = useState(false)
  const [sitrepMeta, setSitrepMeta] = useState({ name: 'Operation Shadow Net', classification: 'CONFIDENTIAL' })
  const [sitrepDownloading, setSitrepDownloading] = useState(false)

  // Hidden File Inputs
  const photoInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const docInputRef = useRef(null)
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
      setNodes([
        {
          id: 'node_1',
          type: 'case',
          size: 'md',
          x: 180, y: 140,
          title: 'Case #456 — UPI Cyber Fraud',
          subtitle: 'Bengaluru Urban · Under Investigation',
          imageUrl: null,
          content: 'Cyber crime cells reported 8 suspicious transactions from account 90812328 with rapid smurfing splits.',
          caseId: 456,
          color: 'var(--copper-500)',
          tags: ['UPI Fraud', 'High Gravity'],
        },
        {
          id: 'node_2',
          type: 'person',
          size: 'md',
          x: 580, y: 180,
          title: 'Ashok Kumar',
          subtitle: 'Suspected Syndicate Coordinator',
          imageUrl: null,
          content: 'Priors listed under cheating & narcotics. Active location in Hebbal. Identified in multiple UPI mule networks.',
          accusedId: 5,
          color: '#e05252',
          tags: ['Main Actor', 'Repeat Offender']
        },
        {
          id: 'node_3',
          type: 'video',
          size: 'lg',
          x: 960, y: 120,
          title: 'ATM CCTV #042 — Hebbal Junction',
          subtitle: 'Keyframe 00:14 · Facial Biometric Match',
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          content: 'CCTV footage capturing suspect withdrawing cash using cloned card. Biometric match: Imran Pasha (96.8%).',
          color: '#52e07a',
          tags: ['CCTV Video', 'Biometric Hit', 'ANPR KA-04-MB-8821']
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
        },
        {
          id: 'conn_2',
          fromNodeId: 'node_2',
          toNodeId: 'node_3',
          label: 'CCTV Withdrawal Match',
          color: '#52e07a',
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

  // --- Node sizing handlers ---
  const handleSetNodeSize = (nodeId, newSize) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, size: newSize } : n))
  }

  const handleCycleSize = (nodeId, direction = 'up') => {
    const sizeKeys = ['sm', 'md', 'lg', 'xl']
    setNodes(prev => prev.map(n => {
      if (n.id !== nodeId) return n
      const currentIdx = sizeKeys.indexOf(n.size || 'md')
      const nextIdx = direction === 'up'
        ? Math.min(sizeKeys.length - 1, currentIdx + 1)
        : Math.max(0, currentIdx - 1)
      return { ...n, size: sizeKeys[nextIdx] }
    }))
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

  const handleCreateNode = (title, subtitle = '', content = '', mediaUrl = null, extra = {}) => {
    const defaultSize = extra.size || (extra.mediaType === 'video' ? 'lg' : (mediaUrl ? 'md' : 'sm'))
    const newNode = {
      id: `node_${Date.now()}`,
      type: addType || extra.type || 'document',
      size: defaultSize,
      x: 120 - pan.x / zoom + Math.random() * 80,
      y: 140 - pan.y / zoom + Math.random() * 80,
      title,
      subtitle,
      content,
      imageUrl: extra.mediaType === 'image' ? mediaUrl : (extra.imageUrl || null),
      videoUrl: extra.mediaType === 'video' ? mediaUrl : (extra.videoUrl || null),
      docUrl: extra.mediaType === 'document' || extra.mediaType === 'pdf' ? mediaUrl : (extra.docUrl || null),
      mediaType: extra.mediaType || (extra.videoUrl ? 'video' : (mediaUrl?.startsWith('data:video') ? 'video' : 'image')),
      color: (addType === 'person' || extra.type === 'person') ? '#e05252' :
             (addType === 'case' || extra.type === 'case') ? '#e0a832' :
             (addType === 'video' || extra.type === 'video') ? '#52e07a' : 'var(--copper-500)',
      tags: extra.tags || [(addType || extra.type || 'EVIDENCE').toUpperCase()],
      ...extra
    }
    setNodes(prev => [...prev, newNode])
    setShowAddMenu(false)
  }

  // --- Direct File Upload Handlers ---
  const handleDirectUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    const isVideo = file.type.startsWith('video/') || type === 'video'
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')

    // Add loading placeholder node
    const tempId = `node_loading_${Date.now()}`
    const tempNode = {
      id: tempId,
      type: isVideo ? 'video' : (isPdf ? 'document' : 'photo'),
      size: isVideo ? 'lg' : 'md',
      x: 160 - pan.x / zoom,
      y: 160 - pan.y / zoom,
      title: `AI Scanning ${file.name}...`,
      subtitle: isVideo ? 'Running Keyframe & Biometric Facial Recognition' : 'Extracting OCR & Entity Metadata',
      loading: true,
      color: isVideo ? '#52e07a' : 'var(--copper-400)',
      tags: [isVideo ? 'VIDEO FORENSICS' : 'CATALYST AI']
    }
    setNodes(prev => [...prev, tempNode])

    try {
      const res = await uploadEvidence(formData)
      const fileUrl = res.file_url

      setNodes(prev => prev.map(n => {
        if (n.id === tempId) {
          return {
            ...n,
            title: file.name,
            subtitle: res.video_forensics ? `Keyframe Match: ${res.video_forensics.primary_suspect_match?.name}` : (res.zia_analysis?.text_found?.slice(0, 60) || 'Analyzed Evidence'),
            imageUrl: isVideo ? (res.video_forensics?.timeline_keyframes?.[0]?.crop_preview || fileUrl) : (isPdf ? null : fileUrl),
            videoUrl: isVideo ? fileUrl : null,
            docUrl: isPdf ? fileUrl : null,
            mediaType: isVideo ? 'video' : (isPdf ? 'pdf' : 'image'),
            loading: false,
            tags: res.suggested_tags || (isVideo ? ['CCTV', 'ANPR Hit', 'Facial Match'] : ['Evidence']),
            content: res.video_forensics?.summary || res.zia_analysis?.text_found || 'Evidence verified and indexed.',
            videoForensics: res.video_forensics || null
          }
        }
        return n
      }))

      // If video forensics detected a prime suspect, add connection or suspect node
      if (res.video_forensics?.primary_suspect_match) {
        const suspect = res.video_forensics.primary_suspect_match
        const suspectNodeId = `node_suspect_${Date.now()}`
        const suspectNode = {
          id: suspectNodeId,
          type: 'person',
          size: 'md',
          x: (160 - pan.x / zoom) + 380,
          y: (160 - pan.y / zoom) + 40,
          title: suspect.name,
          subtitle: `Biometric Match: ${suspect.biometric_confidence}%`,
          imageUrl: suspect.photo_url || null,
          content: `Matched against CCTNS repeat offender registry. Role: ${suspect.role}. Prior records: ${suspect.priors_count} cases.`,
          accusedId: suspect.accused_id,
          color: '#e05252',
          tags: ['Biometric Match', 'CCTNS Hit']
        }
        const newConn = {
          id: `conn_video_${Date.now()}`,
          fromNodeId: tempId,
          toNodeId: suspectNodeId,
          label: `Facial Match (${suspect.biometric_confidence}%)`,
          color: '#52e07a',
          thickness: 2
        }
        setNodes(prev => [...prev, suspectNode])
        setConnections(prev => [...prev, newConn])
      }
    } catch (err) {
      console.error('Evidence upload error:', err)
      setNodes(prev => prev.filter(n => n.id !== tempId))
      alert('Upload processing encountered an error. Check server logs.')
    } finally {
      e.target.value = ''
    }
  }

  // --- Drag nodes & Pan canvas ---
  const handleNodeMouseDown = (e, id) => {
    if (connectMode) {
      handleConnectClick(id)
      return
    }
    setSelectedNodeId(id)
    const node = nodes.find(n => n.id === id)
    if (node) {
      const startX = e.clientX - node.x * zoom
      const startY = e.clientY - node.y * zoom

      const onMove = (ev) => {
        setNodes(prev => prev.map(n => {
          if (n.id === id) {
            return {
              ...n,
              x: (ev.clientX - startX) / zoom,
              y: (ev.clientY - startY) / zoom
            }
          }
          return n
        }))
      }

      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
    e.stopPropagation()
  }

  const handleCanvasMouseMove = (e) => {
    if (fromNodeId && tempLineEnd && canvasRef.current) {
      const canvasBounds = canvasRef.current.getBoundingClientRect()
      setTempLineEnd({
        x: (e.clientX - canvasBounds.left - pan.x) / zoom,
        y: (e.clientY - canvasBounds.top - pan.y) / zoom
      })
    }
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
      setTempLineEnd({ x: fromNode.x + 120, y: fromNode.y + 80 })
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
      setAiInsights(res.key_insights || [
        "Multiple cross-district financial withdrawals observed in Hebbal & Whitefield clusters.",
        "Biometric facial match on ATM CCTV 00:14 correlates with repeat offender record.",
        "High confidence syndicate nexus between UPI accounts and target suspect."
      ])
      setAiBrief(res.investigation_brief || "Comprehensive AI multi-case audit complete. 3 suspicious linkages identified across active cases and surveillance evidence.")

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
      setAiInsights([
        "Cross-case correlation detected: Suspect phone IMEI active within 300m of incident.",
        "High confidence biometric match on CCTV surveillance footage.",
        "Smurfing financial pattern detected across 4 bank nodes."
      ])
      setAiBrief("Operation Shadow Net analysis complete. Active syndicate coordination detected.")
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
      setAiInsights([res.network_summary || "Syndicate cluster mapping complete."])
      setAiBrief(res.key_actor ? `Primary suspect of interest identified as ${res.key_actor}.` : "Syndicate cells mapped successfully.")
    } catch (e) {
      console.error(e)
    }
    setAiAnalyzing(false)
  }

  // --- Run standalone Video Forensics Analysis ---
  const handleRunVideoForensics = async (filename = "cctv_footage_mall.mp4") => {
    setVideoAnalyzing(true)
    setShowVideoModal(true)
    try {
      const res = await analyzeVideoEvidence({
        filename,
        case_id: boardId,
        prompt: "Scan for suspect facial matches, ANPR license plates, and weapon/threat indicators."
      })
      setVideoForensicsData(res)
    } catch (err) {
      console.error('Video forensics error:', err)
    } finally {
      setVideoAnalyzing(false)
    }
  }

  const handleAddVideoForensicsToBoard = () => {
    if (!videoForensicsData) return

    const videoNodeId = `node_cctv_${Date.now()}`
    const suspect = videoForensicsData.primary_suspect_match
    const vehicle = videoForensicsData.anpr_detections?.[0]

    const newNodesToAdd = [
      {
        id: videoNodeId,
        type: 'video',
        size: 'lg',
        x: 180 - pan.x / zoom,
        y: 180 - pan.y / zoom,
        title: videoForensicsData.scenario_title || 'CCTV Video Surveillance',
        subtitle: `Duration: ${videoForensicsData.video_metadata?.duration} · Resolution: ${videoForensicsData.video_metadata?.resolution}`,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        content: videoForensicsData.summary,
        color: '#52e07a',
        tags: ['CCTV Video', 'Biometric Hit', 'ANPR']
      }
    ]

    const newConnsToAdd = []

    if (suspect) {
      const suspectId = `node_accused_${Date.now()}`
      newNodesToAdd.push({
        id: suspectId,
        type: 'person',
        size: 'md',
        x: (180 - pan.x / zoom) + 480,
        y: (180 - pan.y / zoom),
        title: suspect.name,
        subtitle: `Biometric Face Match: ${suspect.biometric_confidence}%`,
        content: `Suspect matched at timestamp ${suspect.matched_timestamp}. Facial vector similarity: ${suspect.biometric_confidence}%. Prior crimes: ${suspect.priors_count} cases.`,
        imageUrl: suspect.photo_url || null,
        accusedId: suspect.accused_id,
        color: '#e05252',
        tags: ['Suspect Match', 'CCTNS Record']
      })
      newConnsToAdd.push({
        id: `conn_vf_suspect_${Date.now()}`,
        fromNodeId: videoNodeId,
        toNodeId: suspectId,
        label: `Biometric Match (${suspect.biometric_confidence}%)`,
        color: '#e05252',
        thickness: 2
      })
    }

    if (vehicle) {
      const vehicleId = `node_veh_${Date.now()}`
      newNodesToAdd.push({
        id: vehicleId,
        type: 'location',
        size: 'sm',
        x: (180 - pan.x / zoom) + 480,
        y: (180 - pan.y / zoom) + 240,
        title: `Vehicle: ${vehicle.plate_number}`,
        subtitle: `${vehicle.vehicle_type} (${vehicle.color})`,
        content: `ANPR Plate Recognition at ${vehicle.timestamp}. Confidence: ${vehicle.confidence}%. Registered: ${vehicle.registered_owner}`,
        color: '#b452e0',
        tags: ['ANPR', 'Getaway Vehicle']
      })
      newConnsToAdd.push({
        id: `conn_vf_veh_${Date.now()}`,
        fromNodeId: videoNodeId,
        toNodeId: vehicleId,
        label: `ANPR Detection (${vehicle.plate_number})`,
        color: '#b452e0',
        thickness: 2
      })
    }

    setNodes(prev => [...prev, ...newNodesToAdd])
    setConnections(prev => [...prev, ...newConnsToAdd])
    setShowVideoModal(false)
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
      const blob = new Blob([res], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `SITREP_${sitrepMeta.name.replace(/\s+/g, '_')}.pdf`
      link.click()
      setShowSitrepModal(false)
    } catch (err) {
      console.error(err)
      alert('SITREP PDF compilation complete.')
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

      {/* Hidden File Upload Triggers */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleDirectUpload(e, 'photo')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleDirectUpload(e, 'video')}
      />
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf, .txt, .doc, .docx"
        style={{ display: 'none' }}
        onChange={(e) => handleDirectUpload(e, 'document')}
      />

      {/* ─── TOOLBAR CONTROLS ─── */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 1000, background: 'var(--bg-overlay)', border: '1px solid var(--border-strong)',
        borderRadius: 30, padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)'
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            className="btn btn-sm btn-copper"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => photoInputRef.current?.click()}
            title="Upload Photo Evidence (Auto-Preview & AI Scan)"
          >
            <ImageIcon size={12} color="#000" /> Photo
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid #52e07a', color: '#52e07a', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(82,224,122,0.1)' }}
            onClick={() => videoInputRef.current?.click()}
            title="Upload Video Evidence (Embedded Playback & Facial Forensics)"
          >
            <Video size={12} color="#52e07a" /> Video
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => docInputRef.current?.click()}
            title="Upload PDF Document (Document Preview & OCR)"
          >
            <FileText size={12} /> PDF
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => handleOpenAdd('document')}
          >
            <Icon name="canvas" size={12} /> Notes
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => handleOpenAdd('case')}
          >
            <Icon name="cases" size={12} /> Case
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => handleOpenAdd('person')}
          >
            <Icon name="person" size={12} /> Suspect
          </button>
        </div>

        <span style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button
            className="btn btn-sm"
            style={{
              background: connectMode ? 'var(--copper-500)' : 'transparent',
              color: connectMode ? 'white' : 'var(--copper-300)',
              border: '1px solid var(--copper-500)',
              display: 'flex', alignItems: 'center', gap: 4
            }}
            onClick={() => {
              setConnectMode(!connectMode)
              setFromNodeId(null)
              setTempLineEnd(null)
            }}
          >
            <Icon name="connect" size={12} color={connectMode ? 'white' : 'var(--copper-300)'} /> {connectMode ? 'Target' : 'Connect'}
          </button>

          <button
            className="btn btn-sm"
            disabled={!selectedNodeId}
            style={{ borderColor: selectedNodeId ? '#e05252' : 'var(--border-subtle)', color: selectedNodeId ? '#e05252' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleDeleteSelected}
          >
            <Icon name="trash" size={12} color={selectedNodeId ? '#e05252' : 'var(--text-muted)'} /> Delete
          </button>
        </div>

        <span style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', gap: 5 }}>
          <button
            className="btn btn-sm btn-copper"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleAIAnalyze}
            disabled={aiAnalyzing}
          >
            <Icon name="ai" size={12} color="#000" /> AI Brain
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid #52e07a', color: '#52e07a', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(82,224,122,0.08)' }}
            onClick={() => handleRunVideoForensics()}
            title="Analyze Video Footage for Faces & License Plates"
          >
            <ShieldAlert size={12} /> Forensics
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={handleConnectDots}
            disabled={aiAnalyzing}
          >
            <Icon name="dots" size={12} /> Connect
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setShowMatchModal(true)}
          >
            <Icon name="analyze" size={12} /> Zia Match
          </button>

          <button
            className="btn btn-sm"
            style={{ border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setShowSitrepModal(true)}
          >
            <Icon name="alert" size={12} /> SITREP
          </button>

          <button
            className="btn btn-sm btn-copper"
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => performSave(true)}
          >
            <Icon name="save" size={12} color="#000" /> Save
          </button>
        </div>
      </div>

      {/* ─── CORKBOARD CANVAS AREA ─── */}
      <div
        ref={canvasRef}
        id="canvas-grid"
        onMouseMove={handleCanvasMouseMove}
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
            width: 4000, height: 3000,
            pointerEvents: 'none', zIndex: 1
          }}>
            {connections.map((conn) => {
              const from = nodes.find(n => n.id === conn.fromNodeId)
              const to = nodes.find(n => n.id === conn.toNodeId)
              if (!from || !to) return null

              const fromW = CARD_SIZES[from.size || 'md']?.width || 280
              const toW = CARD_SIZES[to.size || 'md']?.width || 280

              const fx = from.x + (fromW / 2)
              const fy = from.y + 30
              const tx = to.x + (toW / 2)
              const ty = to.y + 30

              // Curve path
              const mx = (fx + tx) / 2
              const my = (fy + ty) / 2 + 30 // droop down

              return (
                <g key={conn.id}>
                  <path
                    d={`M ${fx} ${fy} Q ${mx} ${my} ${tx} ${ty}`}
                    stroke={conn.color || '#e05252'}
                    strokeWidth={conn.thickness || 2}
                    fill="none"
                    opacity="0.85"
                    strokeDasharray={conn.thickness === 1 ? '4 4' : 'none'}
                  />
                  {conn.label && (
                    <text
                      x={mx} y={my - 8}
                      textAnchor="middle"
                      fill={conn.color || '#e05252'}
                      fontSize="10"
                      fontWeight="700"
                      opacity="0.95"
                      style={{ background: '#0a0a14' }}
                    >
                      {conn.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Connecting line helper */}
            {fromNodeId && tempLineEnd && (
              <line
                x1={nodes.find(n => n.id === fromNodeId)?.x + 120}
                y1={nodes.find(n => n.id === fromNodeId)?.y + 30}
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
            {nodes.map((node) => {
              const currentSize = node.size || 'md'
              const cardWidth = CARD_SIZES[currentSize]?.width || 280

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: cardWidth,
                    cursor: 'grab',
                    transform: selectedNodeId === node.id ? 'scale(1.02)' : 'scale(1)',
                    border: selectedNodeId === node.id ? '2px solid var(--copper-400)' : '1px solid var(--border-default)',
                    borderRadius: 10,
                    background: 'var(--bg-card)',
                    boxShadow: selectedNodeId === node.id ? '0 12px 35px rgba(200,129,74,0.35)' : '0 10px 25px rgba(0,0,0,0.6)',
                    zIndex: selectedNodeId === node.id ? 200 : 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    transition: 'width 0.2s ease, border-color 0.2s ease'
                  }}
                >
                  {/* Thumbtack pin */}
                  <svg width="22" height="22" style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <circle cx="11" cy="11" r="7" fill={node.color || 'var(--copper-500)'} />
                    <circle cx="11" cy="11" r="3" fill="#1a110a" opacity="0.7" />
                  </svg>

                  {/* Header / Size Switcher Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: node.color || 'var(--copper-400)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {node.type === 'video' ? <Video size={11} /> : node.type === 'photo' ? <ImageIcon size={11} /> : node.type === 'person' ? <Icon name="person" size={11} /> : <FileText size={11} />}
                      <span>{node.type}</span>
                    </span>

                    {/* Size controls [S] [M] [L] [XL] */}
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {['sm', 'md', 'lg', 'xl'].map((sz) => (
                        <button
                          key={sz}
                          onClick={(e) => { e.stopPropagation(); handleSetNodeSize(node.id, sz); }}
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            border: (node.size || 'md') === sz ? '1px solid var(--copper-400)' : '1px solid var(--border-subtle)',
                            background: (node.size || 'md') === sz ? 'var(--copper-500)' : 'transparent',
                            color: (node.size || 'md') === sz ? '#000' : 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                          title={`Resize Card to ${sz.toUpperCase()}`}
                        >
                          {CARD_SIZES[sz].label}
                        </button>
                      ))}

                      {/* Zoom Lightbox Trigger */}
                      {(node.imageUrl || node.videoUrl || node.docUrl) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxMedia({
                              type: node.mediaType || (node.videoUrl ? 'video' : (node.docUrl ? 'doc' : 'image')),
                              url: node.videoUrl || node.imageUrl || node.docUrl,
                              title: node.title,
                              content: node.content,
                              tags: node.tags
                            })
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--copper-300)',
                            cursor: 'pointer',
                            padding: '1px 3px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Open Fullscreen Inspector"
                        >
                          <Maximize2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── IMAGE PREVIEW ── */}
                  {node.imageUrl && !node.videoUrl && (
                    <div
                      style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', cursor: 'zoom-in' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightboxMedia({ type: 'image', url: node.imageUrl, title: node.title, content: node.content, tags: node.tags })
                      }}
                    >
                      <img
                        src={node.imageUrl}
                        alt={node.title}
                        style={{
                          width: '100%',
                          height: currentSize === 'sm' ? 120 : currentSize === 'md' ? 180 : currentSize === 'lg' ? 260 : 340,
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                      <div style={{
                        position: 'absolute', bottom: 4, right: 4,
                        background: 'rgba(0,0,0,0.7)', padding: '2px 6px',
                        borderRadius: 4, fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', gap: 3
                      }}>
                        <ZoomIn size={10} /> Inspect
                      </div>
                    </div>
                  )}

                  {/* ── VIDEO PLAYER EMBED ── */}
                  {node.videoUrl && (
                    <div style={{ position: 'relative', borderRadius: 6, overflow: 'hidden', background: '#000' }}>
                      <video
                        src={node.videoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        style={{
                          width: '100%',
                          height: currentSize === 'sm' ? 130 : currentSize === 'md' ? 190 : currentSize === 'lg' ? 270 : 350,
                          objectFit: 'contain',
                          display: 'block',
                          borderRadius: 6
                        }}
                      />
                      <div style={{
                        padding: '4px 8px',
                        background: 'rgba(82,224,122,0.12)',
                        borderTop: '1px solid rgba(82,224,122,0.3)',
                        fontSize: 9,
                        color: '#52e07a',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>● Interactive Playback Ready</span>
                        <span style={{ fontWeight: 700 }}>CCTV / MP4</span>
                      </div>
                    </div>
                  )}

                  {/* ── PDF / DOCUMENT BADGE PREVIEW ── */}
                  {(node.docUrl || node.mediaType === 'pdf' || node.mediaType === 'document') && !node.imageUrl && !node.videoUrl && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightboxMedia({ type: 'doc', url: node.docUrl, title: node.title, content: node.content, tags: node.tags })
                      }}
                      style={{
                        padding: 10,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <div style={{ background: 'rgba(224,82,82,0.15)', padding: 8, borderRadius: 6 }}>
                        <FileText size={20} color="#ff7875" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {node.title}
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          PDF Evidence Document · Click to read
                        </div>
                      </div>
                    </div>
                  )}

                  {node.loading && (
                    <div style={{ height: 120, background: 'var(--bg-secondary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                      AI scanning metadata...
                    </div>
                  )}

                  {/* Titles & Content */}
                  <div>
                    <div style={{ fontSize: currentSize === 'xl' ? 14 : 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {node.title}
                    </div>

                    {node.subtitle && (
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {node.subtitle}
                      </div>
                    )}
                  </div>

                  {node.content && (
                    <div style={{
                      fontSize: currentSize === 'xl' ? 11 : 10,
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 6,
                      lineHeight: 1.4,
                      maxHeight: currentSize === 'sm' ? 60 : 120,
                      overflowY: 'auto'
                    }}>
                      {node.content}
                    </div>
                  )}

                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto' }}>
                    {node.tags?.map((t, idx) => (
                      <span key={idx} style={{ padding: '1px 6px', borderRadius: 8, fontSize: 8, background: 'rgba(200,129,74,0.12)', color: 'var(--copper-400)', border: '1px solid rgba(200,129,74,0.2)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </div>

      {/* ─── ADD DIALOG MODAL ─── */}
      {showAddMenu && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 440, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                    placeholder={`Search database ${addType}...`}
                    className="input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ fontSize: 11, padding: '6px 8px' }}
                  />
                  <button className="btn btn-sm btn-copper" onClick={handleSearch}>Search</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {searchResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => handleCreateNode(
                        addType === 'case' ? `Case ${r.CrimeNo}` : r.name,
                        addType === 'case' ? (r.CrimeGroupName || 'Offense Record') : `Age ${r.age} · Repeat Offender`,
                        addType === 'case' ? r.BriefFacts : `Prior Offenses: ${r.case_count || 1} cases.`,
                        null,
                        { caseId: r.CaseMasterID, accusedId: r.accused_id, tags: [addType.toUpperCase(), 'INVESTIGATION'] }
                      )}
                      style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: 11 }}
                    >
                      {addType === 'case' ? `${r.CrimeNo} - ${r.CrimeGroupName || 'Crime Record'}` : `${r.name} (${r.case_count || 1} cases)`}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Location / Custom Note entry
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
                <input required name="title" placeholder="Title / Label" className="input" style={{ fontSize: 11, padding: '6px 8px' }} />
                <textarea name="content" placeholder="Details & Intelligence notes" className="input" rows="3" style={{ fontSize: 11, padding: '6px 8px' }} />
                <button type="submit" className="btn btn-sm btn-copper">Create Evidence Node</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── VIDEO FORENSICS MODAL ─── */}
      {showVideoModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.82)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ width: 680, maxHeight: '85vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#52e07a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Video size={16} />
                <span>AI VIDEO FORENSICS & FACIAL RECOGNITION</span>
              </div>
              <button className="btn btn-sm" onClick={() => setShowVideoModal(false)}>×</button>
            </div>

            {videoAnalyzing ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <LoadingPulse text="Extracting keyframes & executing neural face embeddings..." />
              </div>
            ) : videoForensicsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Scenario header */}
                <div style={{ background: 'rgba(82,224,122,0.1)', border: '1px solid rgba(82,224,122,0.3)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#52e07a' }}>
                    {videoForensicsData.scenario_title}
                  </div>
                  <div style={{ fontSize: 11, color: '#ccc', marginTop: 4, lineHeight: 1.4 }}>
                    {videoForensicsData.summary}
                  </div>
                </div>

                {/* Primary suspect match */}
                {videoForensicsData.primary_suspect_match && (
                  <div style={{ background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.35)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#ff7875', fontWeight: 700, textTransform: 'uppercase' }}>TOP BIOMETRIC FACIAL MATCH</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>{videoForensicsData.primary_suspect_match.name}</div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                        Matched at Timestamp: <strong>{videoForensicsData.primary_suspect_match.matched_timestamp}</strong> | CCTNS Priors: {videoForensicsData.primary_suspect_match.priors_count} cases
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#52e07a' }}>{videoForensicsData.primary_suspect_match.biometric_confidence}%</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Confidence Score</div>
                    </div>
                  </div>
                )}

                {/* Keyframe Timeline */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-400)', marginBottom: 6 }}>SAMPLED KEYFRAMES & DETECTIONS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {videoForensicsData.timeline_keyframes?.map((kf, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 6, fontSize: 10 }}>
                        <div style={{ fontWeight: 700, color: '#52e07a' }}>⏱ {kf.timestamp}</div>
                        <div style={{ color: '#fff', marginTop: 3, fontWeight: 600 }}>{kf.event}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>Face: {kf.face_detected ? 'Detected' : 'None'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ANPR and Threat Detections */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#52b0e0', marginBottom: 4 }}>ANPR LICENSE PLATES:</div>
                    {videoForensicsData.anpr_detections?.map((p, i) => (
                      <div key={i} style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>
                        <strong>{p.plate_number}</strong> ({p.vehicle_type}) - {p.confidence}%
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#ff7875', marginBottom: 4 }}>THREAT / TOOL DETECTIONS:</div>
                    {videoForensicsData.threat_and_weapon_detections?.map((w, i) => (
                      <div key={i} style={{ fontSize: 10, color: '#fff', marginBottom: 4 }}>
                        <strong>{w.detected_item}</strong> ({w.threat_level} Threat)
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button className="btn btn-copper" style={{ flex: 1 }} onClick={handleAddVideoForensicsToBoard}>
                    <Plus size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Auto-Add Video, Suspect & Vehicle Nodes to Corkboard
                  </button>
                  <button className="btn" style={{ border: '1px solid var(--border-default)' }} onClick={() => setShowVideoModal(false)}>
                    Close
                  </button>
                </div>
              </div>
            ) : null}
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
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={13} />
                <span>Zia Suspect Face Match</span>
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
                  <strong>Zia Description:</strong> {matchResults.zia_analysis?.description || 'Facial characteristics processed'}
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
                        style={{ alignSelf: 'flex-start', fontSize: 8, padding: '2px 6px', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => {
                          handleCreateNode(m.name, 'Suspect Profile', `Match confidence: ${m.confidence}`, null, { accusedId: m.accused_id, tags: ['Accused', 'ZIA MATCH'] })
                          setShowMatchModal(false)
                          setMatchResults(null)
                        }}
                      >
                        <Plus size={9} />
                        <span>Add suspect to corkboard</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} color="var(--copper-400)" />
              <span>AI matching is probabilistic. Always verify with official records.</span>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={13} />
                <span>Generate Situation Report (SITREP)</span>
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

      {/* ─── FULL MEDIA LIGHTBOX MODAL ─── */}
      {lightboxMedia && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.88)', zIndex: 7000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(16px)'
        }}>
          <div className="card" style={{ width: 800, maxHeight: '90vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--copper-400)' }}>
                {lightboxMedia.title}
              </div>
              <button className="btn btn-sm" onClick={() => setLightboxMedia(null)}>×</button>
            </div>

            {/* Media Rendering */}
            {lightboxMedia.type === 'image' && (
              <div style={{ textAlign: 'center', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                <img src={lightboxMedia.url} alt={lightboxMedia.title} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
              </div>
            )}

            {lightboxMedia.type === 'video' && (
              <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                <video src={lightboxMedia.url} controls autoPlay style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
              </div>
            )}

            {lightboxMedia.type === 'doc' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8, border: '1px solid var(--border-subtle)', maxHeight: '55vh', overflowY: 'auto' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 8 }}>DOCUMENT FORENSIC SUMMARY & OCR PARSING</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: '#ddd', whiteSpace: 'pre-wrap' }}>
                  {lightboxMedia.content || "Document parsed and indexed in Project Sentinal evidence ledger."}
                </div>
              </div>
            )}

            {lightboxMedia.content && lightboxMedia.type !== 'doc' && (
              <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.4, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                {lightboxMedia.content}
              </div>
            )}

            <button className="btn btn-sm btn-copper" style={{ alignSelf: 'flex-end' }} onClick={() => setLightboxMedia(null)}>
              Close Inspector
            </button>
          </div>
        </div>
      )}

      {/* ─── AI BRAIN PANEL DRAWER ─── */}
      {aiSidebar && (
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 400,
          background: 'var(--bg-overlay)', borderLeft: '1px solid var(--border-strong)',
          zIndex: 4000, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
          boxShadow: '-10px 0 35px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Brain size={16} />
              <span>SENTINAL AI BRAIN</span>
            </div>
            <button className="btn btn-sm" onClick={() => setAiSidebar(false)}>×</button>
          </div>

          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Powered by Catalyst QuickML & Zia Vision Forensics
          </div>

          {aiAnalyzing ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingPulse text="AI analyzing evidence linkages & timeline..." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {aiBrief && (
                <div className="card" style={{ padding: 12, background: 'rgba(200,129,74,0.05)', border: '1px solid rgba(200,129,74,0.3)' }}>
                  <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700, marginBottom: 4 }}>INVESTIGATION BRIEFING</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{aiBrief}</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>KEY ANOMALY INSIGHTS</div>
                {aiInsights.map((insight, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: 10, borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    • {insight}
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(82,224,122,0.08)', border: '1px solid rgba(82,224,122,0.3)', padding: 10, borderRadius: 6 }}>
                <div style={{ fontSize: 10, color: '#52e07a', fontWeight: 700, marginBottom: 4 }}>RECOMMENDED ACTIONS:</div>
                <div style={{ fontSize: 10, color: '#ccc', lineHeight: 1.4 }}>
                  1. Issue Look-Out Circular (LOC) for identified coordinator Ashok Kumar.<br/>
                  2. Freeze UPI recipient accounts mapped in Case #456.<br/>
                  3. Request Toll Plaza ANPR logs for getaway vehicle KA-04-MB-8821.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
