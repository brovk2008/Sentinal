/**
 * ConnectionsBoard.jsx — Sentinal v2 Investigation Canvas
 * Infinite ReactFlow canvas. Node types: person, case, location, phone,
 * vehicle, evidence, financial. AI Connect Dots + AI Analyze. Auto-save.
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
  Info, Paperclip, Check, FolderOpen
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { connectDots, analyzeBoard, queryIntelligence } from '../api'
import FileUploader from '../components/FileUploader'

// ── API helpers ─────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function loadCanvas(caseId) {
  const res = await fetch(`${BASE_URL}/api/v1/board/canvas/load/${caseId}`)
  if (!res.ok) return null
  return res.json()
}

async function saveCanvas(caseId, nodes, edges) {
  await fetch(`${BASE_URL}/api/v1/board/canvas/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case_id: caseId, nodes, edges }),
  })
}

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

  return (
    <div style={{
      background: 'rgba(12,12,24,0.95)',
      border: `2px solid ${selected ? '#fff' : c.border}`,
      borderRadius: 8, padding: '10px 14px',
      minWidth: 140, maxWidth: 200,
      fontFamily: 'var(--font-sans)',
      boxShadow: selected ? `0 0 16px ${c.border}` : '0 4px 16px rgba(0,0,0,0.5)',
      position: 'relative',
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

      <div style={{ fontSize: 10, color: c.border, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
        <NodeIcon type={data.type} size={11} />
        <span>{data.type}</span>
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
  const { t } = useTranslation()
  const [type, setType] = useState('person')
  const [label, setLabel] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [tags, setTags] = useState('')

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 16, padding: 28, width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18, color: '#fff' }}>
          {t('canvas.addNode')}
        </div>

        {/* Type picker */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {Object.entries(NODE_TYPES).map(([key, cfg]) => (
            <button key={key} onClick={() => setType(key)} style={{
              padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
              fontSize: 11, fontWeight: 600,
              background: type === key ? `${cfg.color}33` : 'transparent',
              border: `1px solid ${type === key ? cfg.color : 'rgba(255,255,255,0.15)'}`,
              color: type === key ? cfg.color : 'rgba(255,255,255,0.6)',
              outline: 'none', fontFamily: 'inherit',
            }}>{cfg.icon} {t(`canvas.nodeTypes.${key}`)}</button>
          ))}
        </div>

        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (name, case no., address...)"
          style={inputStyle}
        />
        <input
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional details)"
          style={{ ...inputStyle, marginTop: 8 }}
        />
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="Tags (comma-separated, optional)"
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
        <div style={{ fontWeight: 700, marginBottom: 12, color: '#fff' }}>Connection Label</div>
        <input
          autoFocus value={label} onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Financial link, Called on 12 Jan..."
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

// ── AI Analysis Panel ────────────────────────────────────────────────
function AIPanel({ content, loading, onClose }) {
  return (
    <div style={{
      position: 'absolute', right: 16, top: 16, width: 380, maxHeight: '80vh',
      background: 'rgba(12,12,24,0.96)',
      border: '1px solid rgba(200,129,74,0.4)',
      borderRadius: 14, padding: 20,
      backdropFilter: 'blur(16px)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
      zIndex: 100, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--copper-300,#e8a87c)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Brain size={14} />
          <span>AI Analysis</span>
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Analysing board...</div>
      ) : (
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}>{content}</div>
      )}
    </div>
  )
}

// ─── Shared inline styles ────────────────────────────────────────────
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

// ─── Main component ──────────────────────────────────────────────────
const CANVAS_CASE = 'canvas_global'

export default function ConnectionsBoard() {
  const { t } = useTranslation()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [pendingEdge, setPendingEdge] = useState(null)
  const [aiPanel, setAiPanel] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')
  const nodeIdRef = useRef(1)
  const saveTimer = useRef(null)

  // Load saved canvas on mount
  useEffect(() => {
    loadCanvas(CANVAS_CASE).then(data => {
      if (data?.nodes?.length) {
        setNodes(data.nodes)
        setEdges(data.edges || [])
        const maxId = Math.max(0, ...data.nodes.map(n => parseInt(n.id.replace('sn_', '')) || 0))
        nodeIdRef.current = maxId + 1
      }
    }).catch(console.error)
  }, [])

  // Listen to demo mode auto-triggers
  useEffect(() => {
    const handleDemoCanvas = () => {
      setTimeout(() => {
        handleAIAnalyze();
      }, 1000);
    };
    const handleDemoPopulate = () => {
      const demoNodes = [
        {
          id: 'sn_1',
          type: 'sentinalNode',
          position: { x: 120, y: 150 },
          data: { type: 'case', label: 'Case #456 — UPI Cyber Fraud', subtitle: 'Bengaluru Urban · Under Investigation', tags: ['UPI Fraud', 'High Gravity'] }
        },
        {
          id: 'sn_2',
          type: 'sentinalNode',
          position: { x: 450, y: 120 },
          data: { type: 'person', label: 'Ashok Kumar', subtitle: 'Suspected Syndicate Coordinator', tags: ['Main Actor', 'Repeat Offender'], risk: 'HIGH' }
        },
        {
          id: 'sn_3',
          type: 'sentinalNode',
          position: { x: 450, y: 350 },
          data: { type: 'financial', label: 'Mule Account #90812328', subtitle: 'Canara Bank · Hebbal Branch', tags: ['Suspicious Activity'] }
        },
        {
          id: 'sn_4',
          type: 'sentinalNode',
          position: { x: 120, y: 380 },
          data: { type: 'phone', label: '+91 94808-12345', subtitle: 'SIM registered in Bidar', tags: ['Burner SIM'] }
        }
      ];
      const demoEdges = [
        {
          id: 'e_1',
          source: 'sn_1',
          target: 'sn_2',
          label: 'Primary Beneficiary',
          animated: true,
          style: { stroke: 'rgba(200,129,74,0.8)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(200,129,74,0.8)' }
        },
        {
          id: 'e_2',
          source: 'sn_2',
          target: 'sn_3',
          label: 'Account Signatory',
          animated: true,
          style: { stroke: 'rgba(200,129,74,0.8)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(200,129,74,0.8)' }
        }
      ];
      setNodes(demoNodes);
      setEdges(demoEdges);
      nodeIdRef.current = 5;
    };
    window.addEventListener('demo-trigger-canvas-ai', handleDemoCanvas);
    window.addEventListener('demo-trigger-canvas-populate', handleDemoPopulate);
    return () => {
      window.removeEventListener('demo-trigger-canvas-ai', handleDemoCanvas);
      window.removeEventListener('demo-trigger-canvas-populate', handleDemoPopulate);
    };
  }, [nodes, edges]);

  // Auto-save on change (debounced 2s)
  useEffect(() => {
    if (nodes.length === 0) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        await saveCanvas(CANVAS_CASE, nodes, edges)
        setSaveStatus('Saved')
        setTimeout(() => setSaveStatus(''), 2000)
      } catch { setSaveStatus('Save failed') }
    }, 2000)
    return () => clearTimeout(saveTimer.current)
  }, [nodes, edges])

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
    const cfg = NODE_TYPES[nodeData.type]
    const newNode = {
      id,
      type: 'sentinalNode',
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: { ...nodeData, color: cfg.color },
    }
    setNodes(ns => [...ns, newNode])
    setShowAddModal(false)
  }

  const handleAIConnect = async () => {
    if (nodes.length < 2) return
    setAiLoading(true)
    setAiPanel('loading')
    try {
      const boardPayload = {
        nodes: nodes.map(n => ({
          id: n.id, type: n.data.type, label: n.data.label,
          subtitle: n.data.subtitle, tags: n.data.tags,
        })),
        connections: edges.map(e => ({
          from: e.source, to: e.target, label: e.label || '',
        })),
      }
      const res = await connectDots(boardPayload)
      const suggestions = res.suggested_connections || []
      if (suggestions.length) {
        const newEdges = suggestions.map((s, i) => ({
          id: `ai_e_${Date.now()}_${i}`,
          source: s.from_node_id, target: s.to_node_id,
          label: s.link_label || s.relationship_type || 'AI Link',
          animated: true,
          style: { stroke: '#52e07a', strokeWidth: 2, strokeDasharray: '5,3' },
          labelStyle: { fontSize: 10, fill: '#52e07a', fontWeight: 600 },
          labelBgStyle: { fill: 'rgba(12,12,24,0.85)', rx: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#52e07a' },
        })).filter(e => e.source && e.target)
        if (newEdges.length) setEdges(eds => [...eds, ...newEdges])
        setAiPanel(`AI found ${newEdges.length} connection(s):\n\n` +
          suggestions.map(s => `• ${s.link_label || s.relationship_type}: ${s.reasoning || ''}`).join('\n'))
      } else {
        setAiPanel('AI found no additional connections to suggest based on the current board.')
      }
    } catch (e) {
      setAiPanel(`Connect Dots failed: ${e.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleAIAnalyze = async () => {
    setAiLoading(true)
    setAiPanel('loading')
    try {
      const boardPayload = {
        nodes: nodes.map(n => ({ ...n.data, id: n.id })),
        connections: edges.map(e => ({ from: e.source, to: e.target, label: e.label })),
      }
      const res = await analyzeBoard(boardPayload)
      setAiPanel(res.analysis || res.answer || JSON.stringify(res, null, 2))
    } catch (e) {
      setAiPanel(`Analysis failed: ${e.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSaveNow = async () => {
    clearTimeout(saveTimer.current)
    try {
      await saveCanvas(CANVAS_CASE, nodes, edges)
      setSaveStatus('Saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch { setSaveStatus('Save failed') }
  }

  const handleClear = () => {
    if (!window.confirm('Clear entire canvas? This cannot be undone.')) return
    setNodes([])
    setEdges([])
    saveCanvas(CANVAS_CASE, [], [])
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a16' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginRight: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link2 size={15} color="var(--copper-400)" />
          <span>{t('canvas.title')}</span>
        </div>
        <div style={{ flex: 1 }} />

        <button
          onClick={async () => {
            try {
              const res = await fetch(`${BASE_URL}/api/v1/board/demo`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              setNodes(data.nodes || []);
              setEdges(data.edges || []);
            } catch (e) {
              setSaveStatus(`Load failed: ${e.message}`);
              setTimeout(() => setSaveStatus(''), 3000);
            }
          }}
          style={{
            ...btnSecondary, flex: 'none', padding: '7px 14px', fontSize: 11,
            background: 'rgba(74,158,255,0.1)',
            borderColor: 'rgba(74,158,255,0.4)',
            color: '#4a9eff', display: 'flex', alignItems: 'center', gap: 5
          }}
        >
          <FolderOpen size={12} />
          <span>Load Demo Case</span>
        </button>

        <button onClick={() => setShowAddModal(true)} style={{
          ...btnPrimary, flex: 'none', padding: '7px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5
        }}>
          <Plus size={12} />
          <span>{t('canvas.addNode')}</span>
        </button>

        <button onClick={handleAIConnect} style={{
          ...btnSecondary, flex: 'none', padding: '7px 14px', fontSize: 11,
          borderColor: '#52e07a44', color: '#52e07a', display: 'flex', alignItems: 'center', gap: 5
        }}>
          <Sparkles size={12} />
          <span>{t('canvas.connectDots')}</span>
        </button>

        <button onClick={handleAIAnalyze} style={{
          ...btnSecondary, flex: 'none', padding: '7px 14px', fontSize: 11,
          borderColor: 'rgba(200,129,74,0.4)', color: 'var(--copper-300,#e8a87c)', display: 'flex', alignItems: 'center', gap: 5
        }}>
          <Brain size={12} />
          <span>{t('canvas.analyzeBoard')}</span>
        </button>

        <button onClick={handleSaveNow} style={{
          ...btnSecondary, flex: 'none', padding: '7px 14px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5
        }}>
          <Save size={12} />
          <span>{t('canvas.saveBoard')}</span>
        </button>

        <button onClick={handleClear} style={{
          ...btnSecondary, flex: 'none', padding: '7px 14px', fontSize: 11,
          borderColor: '#e0525244', color: '#e05252', display: 'flex', alignItems: 'center', gap: 5
        }}>
          <Trash2 size={12} />
          <span>{t('canvas.clearBoard')}</span>
        </button>

        {saveStatus && (
          <span style={{ fontSize: 10, color: '#52e07a', marginLeft: 4 }}>{saveStatus}</span>
        )}

        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>

      <div style={{
        padding: '6px 16px', background: 'rgba(74,158,255,0.06)',
        borderBottom: '1px solid rgba(74,158,255,0.15)',
        fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6
      }}>
        <Info size={13} color="#4a9eff" />
        <span>
          Drag from the <span style={{ color: '#e05252' }}>red/orange dot</span> (right side of node)
          to the <span style={{ color: '#4a9eff' }}>blue dot</span> (left side) to connect two nodes.
          Press Backspace or Delete to remove a selected node/edge.
        </span>
      </div>

      {/* Attach Evidence Files Collapsible */}
      <details style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
        <summary style={{
          padding: '8px 16px', cursor: 'pointer', fontSize: 11,
          color: 'rgba(255,255,255,0.6)',
          userSelect: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Paperclip size={12} />
          <span>Attach Evidence Files to Investigation</span>
        </summary>
        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
          <FileUploader
            caseId={CANVAS_CASE}
            onUploadComplete={(file) => {
              // Auto-add uploaded image as a node on the canvas
              if (file.file_type === 'image') {
                setNodes(ns => [...ns, {
                  id: `file-${file.file_id || Date.now()}`,
                  type: 'sentinalNode',
                  position: { x: 150 + Math.random() * 300, y: 150 + Math.random() * 200 },
                  data: {
                    type: 'evidence',
                    label: file.label || 'Uploaded Image',
                    subtitle: file.ai_summary ? (file.ai_summary.slice(0, 60) + '...') : 'AI Evidence Analysis',
                    tags: file.ai_tags || [],
                    // Use imageUrl (includes localPreviewUrl fallback) so image shows immediately
                    imageUrl: file.imageUrl || file.stratus_url || file.localPreviewUrl || null,
                  },
                }]);
              } else if (file.ai_summary) {
                // Add non-image files as evidence nodes too
                setNodes(ns => [...ns, {
                  id: `file-${file.file_id || Date.now()}`,
                  type: 'sentinalNode',
                  position: { x: 150 + Math.random() * 300, y: 150 + Math.random() * 200 },
                  data: {
                    type: 'evidence',
                    label: file.label || file.file_type || 'Uploaded File',
                    subtitle: file.ai_summary ? file.ai_summary.slice(0, 60) + '...' : '',
                    tags: file.ai_tags || [],
                    imageUrl: null,
                  },
                }]);
              }
            }}
          />
        </div>
      </details>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          connectionMode="loose"
          minZoom={0.1}
          maxZoom={4}
          deleteKeyCode={['Backspace', 'Delete']}
          style={{ background: 'transparent' }}
        >
          <Background color="rgba(255,255,255,0.04)" gap={28} />
          <Controls style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
          }} />
          <MiniMap
            style={{ background: 'rgba(10,10,22,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            nodeColor={n => NODE_TYPES[n.data?.type]?.color || '#888'}
          />

          {/* AI Panel */}
          {aiPanel && (
            <Panel position="top-right">
              <AIPanel
                content={aiPanel === 'loading' ? '' : aiPanel}
                loading={aiPanel === 'loading' || aiLoading}
                onClose={() => setAiPanel(null)}
              />
            </Panel>
          )}
        </ReactFlow>

        {/* Empty state hint */}
        {nodes.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <Link2 size={40} style={{ marginBottom: 12, opacity: 0.2 }} color="var(--copper-400)" />
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
              Click <strong style={{ color: 'rgba(200,129,74,0.6)' }}>+ Add Node</strong> to start the investigation canvas.<br/>
              Connect nodes by dragging between their handles.
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddNodeModal onAdd={addNode} onClose={() => setShowAddModal(false)} />}
      {pendingEdge && <EdgeLabelModal onSave={handleEdgeLabel} onClose={() => setPendingEdge(null)} />}
    </div>
  )
}
