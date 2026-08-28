/**
 * ConnectionsBoard.jsx — Sentinal v2 Investigation Canvas
 * Infinite ReactFlow canvas with Multi-Canvas management, Custom IDs,
 * and AI Forensic Detective for complex case & vehicle theft reasoning.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType, Panel,
  Handle, Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  User, Folder, MapPin, Smartphone, Car,
  FileSearch, Coins, Sparkles, Brain, Plus,
  Trash2, ArrowRight, Link2, Download, Save,
  Info, Paperclip, Check, FolderOpen, Search,
  ShieldAlert, Compass, ChevronRight, X, Layers
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  fetchCanvasList,
  loadCanvasById,
  saveCanvasById,
  deleteCanvasById,
  runCanvasDetective,
  connectDots,
  analyzeBoard
} from '../api'
import FileUploader from '../components/FileUploader'

function NodeIcon({ type, size = 12 }) {
  switch (type) {
    case 'person':    return <User size={size} />
    case 'case':      return <Folder size={size} />
    case 'location':  return <MapPin size={size} />
    case 'phone':     return <Smartphone size={size} />
    case 'vehicle':   return <Car size={size} />
    case 'evidence':  return <FileSearch size={size} />
    case 'financial': return <Coins size={size} />
    default:          return <FileSearch size={size} />
  }
}

// ── Node type colours ───────────────────────────────────────────────
const NODE_TYPES = {
  person:    { color: '#e05252', label: 'Person' },
  case:      { color: 'var(--copper-500,#c8814a)', label: 'Case' },
  location:  { color: '#52b0e0', label: 'Location' },
  phone:     { color: '#52e07a', label: 'Phone' },
  vehicle:   { color: '#b452e0', label: 'Vehicle' },
  evidence:  { color: '#e0c852', label: 'Evidence' },
  financial: { color: '#52e0cc', label: 'Financial' },
}

// ── Custom Node renderer ─────────────────────────────────────────────
function SentinalNode({ data, selected }) {
  const colors = {
    person:    { border: '#e05252', bg: 'rgba(224,82,82,0.08)' },
    case:      { border: 'var(--copper-500,#c8814a)', bg: 'rgba(200,129,74,0.08)' },
    location:  { border: '#52b0e0', bg: 'rgba(82,176,224,0.08)' },
    phone:     { border: '#52e07a', bg: 'rgba(82,224,122,0.08)' },
    vehicle:   { border: '#b452e0', bg: 'rgba(180,82,224,0.08)' },
    evidence:  { border: '#e0c852', bg: 'rgba(224,200,82,0.08)' },
    financial: { border: '#52e0cc', bg: 'rgba(82,224,204,0.08)' },
  };
  const c = colors[data.type] || colors.evidence;
  const isHighlighted = data.isHighlighted;

  return (
    <div style={{
      background: isHighlighted ? 'rgba(25, 10, 10, 0.98)' : 'rgba(12,12,24,0.95)',
      border: `2px solid ${isHighlighted ? '#ff4d4f' : (selected ? '#fff' : c.border)}`,
      borderRadius: 8, padding: '10px 14px',
      minWidth: 140, maxWidth: 220,
      fontFamily: 'var(--font-sans)',
      boxShadow: isHighlighted
        ? '0 0 24px rgba(255, 77, 79, 0.8), inset 0 0 12px rgba(255, 77, 79, 0.3)'
        : (selected ? `0 0 16px ${c.border}` : '0 4px 16px rgba(0,0,0,0.5)'),
      position: 'relative',
      transition: 'all 0.3s ease',
    }}>
      {/* SOURCE handle — right center — drag FROM here */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: c.border, width: 12, height: 12,
          border: '2px solid #0a0a0f', right: -6,
          cursor: 'crosshair', zIndex: 10
        }}
      />

      {/* TARGET handle — left center — edges connect TO here */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#4a9eff', width: 12, height: 12,
          border: '2px solid #0a0a0f', left: -6,
          zIndex: 10
        }}
      />

      {/* Image preview if photo node */}
      {data.imageUrl && (
        <img src={data.imageUrl} alt={data.label}
          style={{ width: '100%', maxHeight: 90, objectFit: 'cover',
                   borderRadius: 4, marginBottom: 6,
                   border: '1px solid var(--border-subtle)' }} />
      )}

      <div style={{ fontSize: 10, color: isHighlighted ? '#ff7875' : c.border, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
        <NodeIcon type={data.type} size={11} />
        <span>{data.type}</span>
        {isHighlighted && <span style={{ marginLeft: 'auto', color: '#ff4d4f', fontSize: 9 }}>★ TARGET</span>}
      </div>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {data.label}
      </div>
      {data.subtitle && (
        <div style={{ fontSize: 10, color: '#888', marginTop: 2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.subtitle}
        </div>
      )}
      {data.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
          {data.tags.slice(0, 2).map(tag => (
            <span key={tag} style={{
              fontSize: 8, padding: '1px 4px', borderRadius: 3,
              background: `${c.border}22`, color: c.border,
              border: `1px solid ${c.border}44`
            }}>{tag}</span>
          ))}
        </div>
      )}
      {data.risk && (
        <div style={{ fontSize: 9, marginTop: 6, padding: '2px 6px',
                      borderRadius: 3, display: 'inline-block', fontWeight: 700,
                      background: data.risk === 'HIGH' ? 'rgba(224,82,82,0.2)'
                                                       : 'rgba(224,168,50,0.2)',
                      color: data.risk === 'HIGH' ? '#e05252' : '#e0a832' }}>
          {data.risk} RISK
        </div>
      )}
    </div>
  );
}

const nodeTypes = { sentinalNode: SentinalNode }

// ── Add Node Modal ───────────────────────────────────────────────────
function AddNodeModal({ onAdd, onClose }) {
  const [type, setType] = useState('person')
  const [label, setLabel] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [tags, setTags] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card,#1a1a2e)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 14, padding: 24, width: 360,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 16, color: '#fff' }}>Add Evidence Node</div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {Object.entries(NODE_TYPES).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              style={{
                fontSize: 11, padding: '4px 8px', borderRadius: 6,
                border: `1px solid ${type === k ? v.color : 'rgba(255,255,255,0.15)'}`,
                background: type === k ? `${v.color}22` : 'transparent',
                color: type === k ? v.color : '#aaa',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <NodeIcon type={k} size={10} />
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (name, car model, license plate, location...)"
          style={inputStyle}
        />
        <input
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          placeholder="Subtitle (e.g. Stolen 02:30 AM, OBD Keyless bypass)"
          style={{ ...inputStyle, marginTop: 8 }}
        />
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="Tags (comma-separated, e.g. Target Asset, IPC 379)"
          style={{ ...inputStyle, marginTop: 8 }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={() => {
              if (!label.trim()) return
              onAdd({
                type, label: label.trim(), subtitle: subtitle.trim(),
                tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
              })
            }}
            style={btnPrimary}
          >Add Node</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Custom Canvas ID Creator Modal ───────────────────────────────────
function NewCanvasModal({ onCreate, onClose }) {
  const [customId, setCustomId] = useState('')
  const [canvasTitle, setCanvasTitle] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card,#1a1a2e)',
        border: '1px solid rgba(200,129,74,0.4)',
        borderRadius: 14, padding: 24, width: 380,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} color="var(--copper-400)" />
          <span>Create New Canvas with Custom ID</span>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>
          Assign a distinct identifier so the AI Detective can recognise and reason over this specific board.
        </div>

        <label style={{ fontSize: 11, color: 'var(--copper-300)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
          CUSTOM CANVAS ID
        </label>
        <input
          autoFocus
          value={customId}
          onChange={e => setCustomId(e.target.value.toUpperCase().replace(/\s+/g, '-'))}
          placeholder="e.g. CANVAS-CAR-THEFT-2024"
          style={inputStyle}
        />

        <label style={{ fontSize: 11, color: 'var(--copper-300)', fontWeight: 600, display: 'block', marginTop: 12, marginBottom: 4 }}>
          CASE / CANVAS TITLE
        </label>
        <input
          value={canvasTitle}
          onChange={e => setCanvasTitle(e.target.value)}
          placeholder="e.g. Vehicle Theft — White Creta Heist"
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={() => {
              if (!customId.trim()) return
              onCreate(customId.trim(), canvasTitle.trim() || customId.trim())
            }}
            style={btnPrimary}
          >Create Canvas</button>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Edge label dialog ────────────────────────────────────────────────
function EdgeLabelModal({ onSave, onClose }) {
  const [label, setLabel] = useState('')
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card,#1a1a2e)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 14, padding: 24, width: 340,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#fff' }}>Connection Relationship</div>
        <input
          autoFocus value={label} onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Stole Vehicle, Called at 03:15 AM, Spotted on CCTV..."
          style={inputStyle}
          onKeyDown={e => e.key === 'Enter' && onSave(label)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => onSave(label)} style={btnPrimary}>Confirm</button>
          <button onClick={onClose} style={btnSecondary}>Skip</button>
        </div>
      </div>
    </div>
  )
}

// ── Shared inline styles ────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: 12, outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
}
const btnPrimary = {
  flex: 1, padding: '8px 0', borderRadius: 8,
  background: 'rgba(200,129,74,0.85)', color: '#fff',
  border: 'none', fontWeight: 700, fontSize: 12,
  cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary = {
  flex: 1, padding: '8px 0', borderRadius: 8,
  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.15)',
  fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
}

// ─── Main Component ──────────────────────────────────────────────────
export default function ConnectionsBoard() {
  const { t } = useTranslation()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewCanvasModal, setShowNewCanvasModal] = useState(false)
  const [pendingEdge, setPendingEdge] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [canvases, setCanvases] = useState([])
  const [currentCanvasId, setCurrentCanvasId] = useState('CANVAS-VEHICLE-THEFT-01')

  // AI Detective state
  const [showDetectiveDrawer, setShowDetectiveDrawer] = useState(false)
  const [detectiveQuery, setDetectiveQuery] = useState('')
  const [detectiveLoading, setDetectiveLoading] = useState(false)
  const [detectiveVerdict, setDetectiveVerdict] = useState(null)

  const nodeIdRef = useRef(10)
  const saveTimer = useRef(null)

  // Fetch all available canvases
  const loadCanvasList = useCallback(async () => {
    try {
      const res = await fetchCanvasList()
      if (Array.isArray(res)) {
        setCanvases(res)
      }
    } catch (err) {
      console.error('Failed to load canvas list:', err)
    }
  }, [])

  // Load a canvas by ID
  const switchCanvas = useCallback(async (canvasId) => {
    setCurrentCanvasId(canvasId)
    setDetectiveVerdict(null)
    try {
      const res = await loadCanvasById(canvasId)
      if (res?.nodes?.length) {
        setNodes(res.nodes)
        setEdges(res.edges || [])
        const maxId = Math.max(0, ...res.nodes.map(n => parseInt((n.id || '').replace(/[^0-9]/g, '')) || 0))
        nodeIdRef.current = maxId + 1
      } else {
        setNodes([])
        setEdges([])
      }
    } catch (err) {
      console.error('Failed to switch canvas:', err)
    }
  }, [setNodes, setEdges])

  // Initial load
  useEffect(() => {
    loadCanvasList()
    switchCanvas('CANVAS-VEHICLE-THEFT-01')
  }, [loadCanvasList, switchCanvas])

  // Auto-save on change (debounced 2s)
  useEffect(() => {
    if (nodes.length === 0) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveCanvasById(currentCanvasId, nodes, edges)
        setSaveStatus('Saved')
        setTimeout(() => setSaveStatus(''), 2000)
        loadCanvasList()
      } catch { setSaveStatus('Save failed') }
    }, 2000)
    return () => clearTimeout(saveTimer.current)
  }, [nodes, edges, currentCanvasId, loadCanvasList])

  const onConnect = useCallback((params) => {
    setPendingEdge(params)
  }, [])

  const handleEdgeLabel = (label) => {
    if (!pendingEdge) return
    setEdges(eds => addEdge({
      ...pendingEdge,
      id: `e_${Date.now()}`,
      label: label || '',
      animated: true,
      style: { stroke: 'rgba(200,129,74,0.8)', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: '#fff', fontWeight: 600 },
      labelBgStyle: { fill: 'rgba(12,12,24,0.85)', rx: 4 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(200,129,74,0.8)' },
    }, eds))
    setPendingEdge(null)
  }

  const addNode = (nodeData) => {
    const id = `sn_${nodeIdRef.current++}`
    const cfg = NODE_TYPES[nodeData.type] || NODE_TYPES.evidence
    const newNode = {
      id,
      type: 'sentinalNode',
      position: { x: 200 + Math.random() * 300, y: 150 + Math.random() * 200 },
      data: { ...nodeData, color: cfg.color },
    }
    setNodes(nds => [...nds, newNode])
    setShowAddModal(false)
  }

  // Create new canvas with custom ID
  const handleCreateCanvas = (customId, title) => {
    setShowNewCanvasModal(false)
    setCurrentCanvasId(customId)
    setNodes([])
    setEdges([])
    setDetectiveVerdict(null)
    saveCanvasById(customId, [], []).then(() => {
      loadCanvasList()
    })
  }

  // Run AI Forensic Detective
  const handleRunDetective = async (customPrompt = null) => {
    const queryToRun = customPrompt || detectiveQuery || 'Who stole the car and what is the primary chain of evidence?'
    setDetectiveLoading(true)
    setShowDetectiveDrawer(true)
    try {
      const res = await runCanvasDetective({
        canvas_id: currentCanvasId,
        query: queryToRun,
        nodes,
        edges
      })
      if (res?.verdict) {
        setDetectiveVerdict(res.verdict)

        // Graph illumination: highlight suspect node & critical edges
        const targetIds = new Set(res.verdict.highlight_node_ids || [])
        if (res.verdict.prime_suspect_node_id) {
          targetIds.add(res.verdict.prime_suspect_node_id)
        }

        setNodes(nds => nds.map(n => ({
          ...n,
          data: {
            ...n.data,
            isHighlighted: targetIds.has(n.id)
          }
        })))

        const edgeIds = new Set(res.verdict.highlight_edge_ids || [])
        setEdges(eds => eds.map(e => ({
          ...e,
          animated: true,
          style: {
            ...e.style,
            stroke: edgeIds.has(e.id) ? '#ff4d4f' : (e.style?.stroke || 'rgba(200,129,74,0.8)'),
            strokeWidth: edgeIds.has(e.id) ? 3.5 : (e.style?.strokeWidth || 2)
          }
        })))
      }
    } catch (err) {
      console.error('Detective error:', err)
    } finally {
      setDetectiveLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)', position: 'relative', background: '#0a0a14' }}>
      {/* ── Top Bar / Canvas Selector ─────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, left: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(12, 12, 24, 0.92)',
        padding: '6px 12px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--copper-400)', fontWeight: 700, fontSize: 12 }}>
          <Layers size={15} />
          <span>CANVAS:</span>
        </div>

        <select
          value={currentCanvasId}
          onChange={e => switchCanvas(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6, padding: '4px 8px', fontSize: 12,
            outline: 'none', cursor: 'pointer', maxWidth: 260
          }}
        >
          {canvases.map(c => (
            <option key={c.canvas_id} value={c.canvas_id} style={{ background: '#121222' }}>
              {c.name} ({c.node_count} nodes)
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowNewCanvasModal(true)}
          style={{
            background: 'rgba(200,129,74,0.2)',
            color: 'var(--copper-300)',
            border: '1px solid rgba(200,129,74,0.4)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4
          }}
        >
          <Plus size={13} />
          <span>New Canvas (Custom ID)</span>
        </button>

        {saveStatus && (
          <span style={{ fontSize: 11, color: '#52e07a', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} /> {saveStatus}
          </span>
        )}
      </div>

      {/* ── Action Toolbar (Right) ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            padding: '7px 12px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            backdropFilter: 'blur(8px)'
          }}
        >
          <Plus size={14} />
          <span>Add Node</span>
        </button>

        <button
          onClick={() => handleRunDetective()}
          style={{
            background: 'linear-gradient(135deg, rgba(200,129,74,0.95), rgba(224,82,82,0.85))',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 14px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 0 16px rgba(200,129,74,0.5)'
          }}
        >
          <ShieldAlert size={14} />
          <span>🤖 AI Forensic Detective</span>
        </button>
      </div>

      {/* ── ReactFlow Canvas ──────────────────────────────────────── */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="rgba(255,255,255,0.04)" gap={20} size={1} />
        <Controls style={{ background: 'rgba(12,12,24,0.9)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8 }} />
        <MiniMap
          style={{ background: 'rgba(12,12,24,0.9)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8 }}
          nodeColor={n => NODE_TYPES[n.data?.type]?.color || '#c8814a'}
        />
      </ReactFlow>

      {/* ── AI Forensic Detective Drawer ───────────────────────────── */}
      {showDetectiveDrawer && (
        <div style={{
          position: 'absolute', top: 60, right: 16, width: 440, maxHeight: 'calc(100vh - 140px)',
          background: 'rgba(10, 10, 20, 0.97)',
          border: '1px solid rgba(200,129,74,0.5)',
          borderRadius: 14, padding: 18,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.85)',
          zIndex: 100, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 14
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} color="#ff4d4f" />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>AI Forensic Evidence Solver</span>
            </div>
            <button onClick={() => setShowDetectiveDrawer(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>

          {/* Quick Query Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { label: '🚗 Who stole the car?', q: 'Who stole the white Hyundai Creta and how did they execute the theft?' },
              { label: '⚡ Trace Escape Route', q: 'Trace the vehicle getaway path from Indiranagar to the toll checkpoint.' },
              { label: '🔗 Check Alibis', q: 'Assess suspect alibis and point out contradictions with cell tower CDR logs.' },
              { label: '📋 Action Plan', q: 'What immediate police warrants and search actions should be executed?' }
            ].map(p => (
              <button
                key={p.label}
                onClick={() => handleRunDetective(p.q)}
                style={{
                  fontSize: 10, padding: '4px 8px', borderRadius: 6,
                  background: 'rgba(200,129,74,0.15)', color: 'var(--copper-300)',
                  border: '1px solid rgba(200,129,74,0.3)', cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={detectiveQuery}
              onChange={e => setDetectiveQuery(e.target.value)}
              placeholder="Ask custom question about this canvas..."
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleRunDetective()}
            />
            <button
              onClick={() => handleRunDetective()}
              disabled={detectiveLoading}
              style={{
                background: 'var(--copper-500)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '0 14px', fontWeight: 700, cursor: 'pointer'
              }}
            >
              {detectiveLoading ? '...' : 'Ask'}
            </button>
          </div>

          {/* Verdict Body */}
          {detectiveLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              <Brain size={28} color="var(--copper-400)" style={{ animation: 'spin 2s linear infinite', marginBottom: 8 }} />
              <div>Correlating canvas graph, CCTV timestamps, CDR pings, and Kaggle crime patterns...</div>
            </div>
          ) : detectiveVerdict ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Prime Suspect Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(224,82,82,0.15), rgba(200,129,74,0.1))',
                border: '1px solid rgba(224,82,82,0.4)', borderRadius: 10, padding: 12
              }}>
                <div style={{ fontSize: 10, color: '#ff7875', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ★ IDENTIFIED PRIME SUSPECT
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                  {detectiveVerdict.prime_suspect}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: '#52e07a', fontWeight: 700, background: 'rgba(82,224,122,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                    {detectiveVerdict.confidence_score}% CONFIDENCE
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--copper-300)' }}>
                    {detectiveVerdict.crime_type}
                  </div>
                </div>
              </div>

              {/* Modus Operandi */}
              {detectiveVerdict.modus_operandi_match && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700 }}>MODUS OPERANDI MATCH</div>
                  <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>{detectiveVerdict.modus_operandi_match}</div>
                </div>
              )}

              {/* Chain of Evidence */}
              {detectiveVerdict.evidence_chain?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, marginBottom: 6 }}>CHAIN OF EVIDENCE LINKAGE:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {detectiveVerdict.evidence_chain.map((item, idx) => (
                      <div key={idx} style={{
                        fontSize: 11, color: '#ccc', background: 'rgba(255,255,255,0.03)',
                        padding: '6px 8px', borderRadius: 6, borderLeft: '3px solid var(--copper-500)'
                      }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alibi Falsification */}
              {detectiveVerdict.alibi_falsification && (
                <div style={{ background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: '#ff7875', fontWeight: 700 }}>ALIBI FALSIFICATION</div>
                  <div style={{ fontSize: 11, color: '#eee', marginTop: 4 }}>{detectiveVerdict.alibi_falsification}</div>
                </div>
              )}

              {/* Recommended Actions */}
              {detectiveVerdict.recommended_police_actions?.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#aaa', fontWeight: 700, marginBottom: 6 }}>RECOMMENDED POLICE ACTIONS:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {detectiveVerdict.recommended_police_actions.map((act, idx) => (
                      <div key={idx} style={{ fontSize: 11, color: '#52e0cc', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span>→</span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddNodeModal onAdd={addNode} onClose={() => setShowAddModal(false)} />}
      {showNewCanvasModal && <NewCanvasModal onCreate={handleCreateCanvas} onClose={() => setShowNewCanvasModal(false)} />}
      {pendingEdge && <EdgeLabelModal onSave={handleEdgeLabel} onClose={() => setPendingEdge(null)} />}
    </div>
  )
}
