/**
 * ConnectionsBoard.jsx — Sentinal v2 Investigation Canvas
 * Infinite ReactFlow canvas with Multi-Canvas management, Custom IDs,
 * AI Forensic Detective, BNS Chargesheet Generator, ANPR Convoy Tracker, Tactical Sting Planner,
 * Biometric Disguise Morph AI, and AI Interrogation Copilot.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  ShieldAlert, Compass, ChevronRight, X, Layers,
  FileText, Navigation, ShieldCheck, Printer, Radio,
  Smile, HelpCircle, Eye, EyeOff, MessageSquare
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  fetchCanvasList,
  loadCanvasById,
  saveCanvasById,
  deleteCanvasById,
  runCanvasDetective,
  autoGenerateCanvas,
  generateBNSChargesheet,
  runANPRConvoyAnalysis,
  planStingIntercept,
  runBiometricFaceMorph,
  runInterrogationCopilot
} from '../api'

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
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: c.border, width: 12, height: 12,
          border: '2px solid #0a0a0f', right: -6,
          cursor: 'crosshair', zIndex: 10
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#4a9eff', width: 12, height: 12,
          border: '2px solid #0a0a0f', left: -6,
          zIndex: 10
        }}
      />

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
        {isHighlighted && <span style={{ marginLeft: 'auto', color: '#ff4d4f', fontSize: 9 }}>TARGET</span>}
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

// ── BNS Chargesheet Generator Modal ─────────────────────────────────
function BNSChargesheetModal({ caseId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    generateBNSChargesheet({ case_id: caseId })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false))
  }, [caseId])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid var(--copper-500)',
        borderRadius: 14, padding: 24, width: 720, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--copper-400)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>FORM 5A: LEGAL DRAFT CHARGESHEET (BNS 2023 / BNSS)</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Compiling statutory sections, witness lists & Sec 65B hash certificates...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><strong>Chargesheet No:</strong> {data.chargesheet_number}</div>
              <div><strong>Generated At:</strong> {data.generated_at}</div>
              <div><strong>Police Station:</strong> {data.police_station}</div>
              <div><strong>Investigating Officer:</strong> {data.investigating_officer}</div>
              <div style={{ gridColumn: 'span 2' }}><strong>Sec 65B Cryptographic Proof Hash:</strong> <span className="mono" style={{ color: 'var(--copper-300)' }}>{data.sec65b_certificate_hash}</span></div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--copper-400)', marginBottom: 6 }}>STATUTORY CHARGES & OFFENSES (BNS 2023):</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.statutory_charges.map((c, i) => (
                  <div key={i} style={{ background: 'rgba(200,129,74,0.08)', borderLeft: '3px solid var(--copper-500)', padding: 8, borderRadius: 4, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{c.bns_section} <span style={{ color: '#888', fontWeight: 400 }}>({c.ipc_equivalent})</span> — {c.title}</div>
                    <div style={{ color: '#ccc', marginTop: 2 }}>{c.description}</div>
                    <div style={{ color: '#52e07a', fontSize: 10, marginTop: 2 }}>Penalty: {c.statutory_punishment}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--copper-400)', marginBottom: 4 }}>BRIEF OF CASE & EVIDENCE CHAIN:</div>
              <div style={{ fontSize: 11, lineHeight: 1.6, color: '#ddd', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                {data.brief_of_case}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ff7875', marginBottom: 4 }}>ACCUSED ROSTER:</div>
                {data.accused_persons.map((a, i) => (
                  <div key={i} style={{ fontSize: 10, background: 'rgba(224,82,82,0.08)', padding: 6, borderRadius: 4, marginBottom: 4 }}>
                    <strong>{a.accused_no}:</strong> {a.name} ({a.age} yrs) - <em>{a.role}</em>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#52e07a', marginBottom: 4 }}>PROSECUTION WITNESSES (PW):</div>
                {data.prosecution_witnesses.slice(0, 3).map((w, i) => (
                  <div key={i} style={{ fontSize: 10, background: 'rgba(82,224,122,0.08)', padding: 6, borderRadius: 4, marginBottom: 4 }}>
                    <strong>{w.cw_no}:</strong> {w.name} ({w.type})
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button onClick={() => window.print()} style={btnPrimary}>
                <Printer size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Print / Export Court PDF
              </button>
              <button onClick={onClose} style={btnSecondary}>Close</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── ANPR Convoy Tracker Modal ───────────────────────────────────────
function ANPRConvoyModal({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runANPRConvoyAnalysis({ target_vehicle: "KA-04-MB-1234" })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid #52b0e0',
        borderRadius: 14, padding: 24, width: 680, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Car size={18} color="#52b0e0" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>ANPR & FASTag CONVOY TRAJECTORY TRACKER</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Scanning toll plaza cameras & detecting trailing escort vehicles...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div style={{ background: 'rgba(224,82,82,0.15)', border: '1px solid rgba(224,82,82,0.4)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#ff7875', fontWeight: 700 }}>CONVOY ESCORT DETECTED ({data.convoy_confidence}% MATCH)</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                Target: {data.target_vehicle} <span style={{ color: '#aaa' }}>← Trailed by →</span> {data.convoy_vehicle.plate_number} ({data.convoy_vehicle.model})
              </div>
              <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>
                Owner: <strong>{data.convoy_vehicle.registered_owner}</strong> | Role: {data.convoy_vehicle.role}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#52b0e0', marginBottom: 6 }}>CONSECUTIVE TOLL PLAZA PASSES:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.trajectory_path.map((t, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #52b0e0', padding: 10, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>#{i+1} {t.name} (Lane {t.target_lane})</div>
                    <div style={{ color: '#aaa', marginTop: 2 }}>
                      Target Time: <span style={{ color: '#fff' }}>{t.target_time}</span> ({t.target_speed_kmh} km/h) | Convoy Time: <span style={{ color: '#ff7875' }}>{t.convoy_timestamp}</span> (Gap: {t.time_delta_seconds}s)
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(82,224,204,0.1)', padding: 10, borderRadius: 6, fontSize: 11, color: '#52e0cc' }}>
              <strong>Recommended Intercept Point:</strong> {data.recommended_interception_point}
            </div>

            <button onClick={onClose} style={btnSecondary}>Close</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Tactical Sting Intercept Planner Modal ──────────────────────────
function TacticalStingModal({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    planStingIntercept({ incident_location: "Indiranagar 100ft Road", elapsed_minutes: 35 })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid #ff4d4f',
        borderRadius: 14, padding: 24, width: 680, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={18} color="#ff4d4f" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>TACTICAL HIGHWAY STING & INTERCEPT PLANNER</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Computing highway escape reachability & matching patrol unit ETAs...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div style={{ background: 'rgba(224,82,82,0.18)', border: '1px solid rgba(224,82,82,0.5)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ff4d4f' }}>{data.tactical_alert}</div>
              <div style={{ fontSize: 11, color: '#eee', marginTop: 4 }}>
                Escape Radius: {data.escape_reachability_radius_km} km | Window Before Border Exit: <strong>{data.window_before_state_border_exit_minutes} mins</strong>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 6 }}>RECOMMENDED ROADBLOCK CHOKE POINTS:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.active_choke_points.map((p, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #ff4d4f', padding: 10, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{p.name} ({p.highway})</div>
                    <div style={{ color: '#52e07a', marginTop: 2 }}>
                      Assigned Unit: <strong>{p.assigned_unit}</strong> (ETA: {p.unit_eta_minutes}m) vs Suspect ETA: {p.suspect_eta_minutes}m | Success: {p.intercept_probability}%
                    </div>
                    <div style={{ color: '#ccc', marginTop: 2 }}>Action: {p.recommended_action}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={onClose} style={btnSecondary}>Close</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Biometric Face Morph & Disguise Simulator Modal ──────────────────
function BiometricMorphModal({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runBiometricFaceMorph({ suspect_name: "Imran Pasha" })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid #b452e0',
        borderRadius: 14, padding: 24, width: 720, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smile size={18} color="#b452e0" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>BIOMETRIC FACE MORPH & DISGUISE SIMULATOR</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Reconstructing 3D biometric landmarks & simulating disguise evasion profiles...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div style={{ background: 'rgba(180,82,224,0.12)', border: '1px solid rgba(180,82,224,0.35)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#d482ff', fontWeight: 700 }}>BIOMETRIC LANDMARK RECONSTRUCTION ({data.facial_landmarks.biometric_confidence}% CONFIDENCE)</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 2 }}>Target: {data.suspect_name}</div>
              <div style={{ fontSize: 11, color: '#ccc', marginTop: 4 }}>
                Interpupillary Distance: {data.facial_landmarks.interpupillary_distance_px}px | Jawline Angularity: {data.facial_landmarks.jawline_angularity_deg}°
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#b452e0', marginBottom: 6 }}>SIMULATED FORENSIC DISGUISES:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {data.disguise_simulations.map((d, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #b452e0', padding: 10, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{d.disguise_type}</div>
                    <div style={{ color: '#aaa', marginTop: 2 }}>{d.altered_features}</div>
                    <div style={{ color: '#ff7875', fontSize: 10, marginTop: 2 }}>Evasion Risk: {d.facial_recognition_evasion_risk}</div>
                    <div style={{ color: '#52e0cc', fontSize: 10, marginTop: 2 }}>Note: {d.tactical_alert_note}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', padding: 10, borderRadius: 6, fontSize: 11, color: '#ff7875' }}>
              <strong>Border Bulletin:</strong> {data.border_control_bulletin}
            </div>

            <button onClick={onClose} style={btnSecondary}>Close</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── AI Interrogation Copilot Modal ──────────────────────────────────
function InterrogationCopilotModal({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runInterrogationCopilot({ suspect_name: "Imran Pasha" })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid #52e07a',
        borderRadius: 14, padding: 24, width: 720, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} color="#52e07a" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>AI INTERROGATION COPILOT & CROSS-EXAMINATION STRATEGIST</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Auditing suspect statement against digital CDR & CCTV footprints...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <div style={{ background: 'rgba(224,82,82,0.15)', border: '1px solid rgba(224,82,82,0.4)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#ff7875', fontWeight: 700 }}>STATEMENT CREDIBILITY: {data.statement_credibility_score}% (EXTREME DECEPTION DETECTED)</div>
              <div style={{ fontSize: 11, color: '#eee', marginTop: 4 }}>
                Target Suspect: <strong>{data.suspect_name}</strong> | Tactic: {data.recommended_interrogation_tactic}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#ff7875', marginBottom: 6 }}>FALSIFIED ALIBIS & DIRECT CONTRADICTIONS:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.detected_contradictions.map((c, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid #ff4d4f', padding: 8, borderRadius: 6, fontSize: 11 }}>
                    <div>Claim: <strong style={{ color: '#fff' }}>"{c.claim}"</strong></div>
                    <div style={{ color: '#52e0cc', marginTop: 2 }}>Evidence: {c.refuting_evidence} ({c.falsification_strength})</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#52e07a', marginBottom: 6 }}>5 PRECISION CROSS-EXAMINATION QUESTIONS:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.precision_cross_examination_questions.map((q, i) => (
                  <div key={i} style={{ background: 'rgba(82,224,122,0.08)', borderLeft: '3px solid #52e07a', padding: 8, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>Q{q.question_no} [{q.target_contradiction}]: {q.question_text}</div>
                    <div style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>Intended Legal Outcome: {q.intended_legal_outcome}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={onClose} style={btnSecondary}>Close</button>
          </div>
        ) : null}
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
  const [searchParams] = useSearchParams()
  const urlCanvasId = searchParams.get('canvasId')

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNewCanvasModal, setShowNewCanvasModal] = useState(false)
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false)
  const [showChargesheetModal, setShowChargesheetModal] = useState(false)
  const [showANPRModal, setShowANPRModal] = useState(false)
  const [showStingModal, setShowStingModal] = useState(false)
  const [showMorphModal, setShowMorphModal] = useState(false)
  const [showInterrogationModal, setShowInterrogationModal] = useState(false)
  const [pendingEdge, setPendingEdge] = useState(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [canvases, setCanvases] = useState([])
  const [currentCanvasId, setCurrentCanvasId] = useState(urlCanvasId || 'CANVAS-VEHICLE-THEFT-01')

  // Auto-generation state
  const [autoGenTitle, setAutoGenTitle] = useState('')
  const [autoGenText, setAutoGenText] = useState('')
  const [autoGenFileId, setAutoGenFileId] = useState('')
  const [autoGenLoading, setAutoGenLoading] = useState(false)
  const [uploadedFilesList, setUploadedFilesList] = useState([])

  // AI Detective state
  const [showDetectiveDrawer, setShowDetectiveDrawer] = useState(false)
  const [detectiveQuery, setDetectiveQuery] = useState('')
  const [detectiveLoading, setDetectiveLoading] = useState(false)
  const [detectiveVerdict, setDetectiveVerdict] = useState(null)

  const nodeIdRef = useRef(10)
  const saveTimer = useRef(null)

  const loadUploadedFiles = useCallback(async () => {
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const res = await fetch(`${BASE}/api/v1/uploads/list`)
      const data = await res.json()
      if (Array.isArray(data?.files)) {
        setUploadedFilesList(data.files)
      }
    } catch (e) {
      console.warn('Could not load uploaded files list:', e)
    }
  }, [])

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

  useEffect(() => {
    loadCanvasList()
    const targetId = urlCanvasId || 'CANVAS-VEHICLE-THEFT-01'
    switchCanvas(targetId)
  }, [loadCanvasList, switchCanvas, urlCanvasId])

  const handleAutoGenerate = async () => {
    setAutoGenLoading(true)
    try {
      const res = await autoGenerateCanvas({
        title: autoGenTitle || 'AI Extracted Investigation Canvas',
        text: autoGenText,
        file_id: autoGenFileId || undefined
      })
      if (res?.status === 'success' && res.nodes) {
        setNodes(res.nodes)
        setEdges(res.edges || [])
        setCurrentCanvasId(res.canvas_id)
        setShowAutoGenerateModal(false)
        setAutoGenText('')
        setAutoGenTitle('')
        setAutoGenFileId('')
        loadCanvasList()
      }
    } catch (err) {
      console.error('Auto generate canvas failed:', err)
    } finally {
      setAutoGenLoading(false)
    }
  }

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
            outline: 'none', cursor: 'pointer', maxWidth: 240
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
          <span>New Canvas</span>
        </button>

        <button
          onClick={() => { setShowAutoGenerateModal(true); loadUploadedFiles(); }}
          style={{
            background: 'linear-gradient(135deg, rgba(200,129,74,0.35), rgba(245,158,11,0.25))',
            color: '#fbbf24',
            border: '1px solid rgba(245,158,11,0.5)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 0 12px rgba(245,158,11,0.2)'
          }}
        >
          <Sparkles size={13} color="#fbbf24" />
          <span>AI Auto-Generate</span>
        </button>

        {saveStatus && (
          <span style={{ fontSize: 11, color: '#52e07a', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Check size={12} /> {saveStatus}
          </span>
        )}
      </div>

      {/* ── Tactical Action Toolbar (Right) ────────────────────────── */}
      <div style={{
        position: 'absolute', top: 12, right: 16, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 7,
      }}>
        <button
          onClick={() => setShowMorphModal(true)}
          style={{
            background: 'rgba(180,82,224,0.18)', color: '#d482ff',
            border: '1px solid rgba(180,82,224,0.4)', borderRadius: 8,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(8px)'
          }}
        >
          <Smile size={13} />
          <span>Disguise Morph</span>
        </button>

        <button
          onClick={() => setShowInterrogationModal(true)}
          style={{
            background: 'rgba(82,224,122,0.18)', color: '#52e07a',
            border: '1px solid rgba(82,224,122,0.4)', borderRadius: 8,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(8px)'
          }}
        >
          <MessageSquare size={13} />
          <span>Interrogation</span>
        </button>

        <button
          onClick={() => setShowChargesheetModal(true)}
          style={{
            background: 'rgba(200,129,74,0.18)', color: 'var(--copper-300)',
            border: '1px solid rgba(200,129,74,0.4)', borderRadius: 8,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(8px)'
          }}
        >
          <FileText size={13} />
          <span>BNS Chargesheet</span>
        </button>

        <button
          onClick={() => setShowANPRModal(true)}
          style={{
            background: 'rgba(82,176,224,0.18)', color: '#52b0e0',
            border: '1px solid rgba(82,176,224,0.4)', borderRadius: 8,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(8px)'
          }}
        >
          <Car size={13} />
          <span>ANPR Convoy</span>
        </button>

        <button
          onClick={() => setShowStingModal(true)}
          style={{
            background: 'rgba(224,82,82,0.18)', color: '#ff7875',
            border: '1px solid rgba(224,82,82,0.4)', borderRadius: 8,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(8px)'
          }}
        >
          <Radio size={13} />
          <span>Sting</span>
        </button>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
            padding: '7px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(8px)'
          }}
        >
          <Plus size={13} />
          <span>Add Node</span>
        </button>

        <button
          onClick={() => handleRunDetective()}
          style={{
            background: 'linear-gradient(135deg, rgba(200,129,74,0.95), rgba(224,82,82,0.85))',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '7px 13px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 0 16px rgba(200,129,74,0.5)'
          }}
        >
          <ShieldAlert size={14} />
          <span>AI Detective</span>
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { label: 'Who stole the car?', q: 'Who stole the white Hyundai Creta and how did they execute the theft?' },
              { label: 'Trace Escape Route', q: 'Trace the vehicle getaway path from Indiranagar to the toll checkpoint.' },
              { label: 'Check Alibis', q: 'Assess suspect alibis and point out contradictions with cell tower CDR logs.' },
              { label: 'Action Plan', q: 'What immediate police warrants and search actions should be executed?' }
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

          {detectiveLoading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              <Brain size={28} color="var(--copper-400)" style={{ animation: 'spin 2s linear infinite', marginBottom: 8 }} />
              <div>Correlating canvas graph, CCTV timestamps, CDR pings, and Kaggle crime patterns...</div>
            </div>
          ) : detectiveVerdict ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(224,82,82,0.15), rgba(200,129,74,0.1))',
                border: '1px solid rgba(224,82,82,0.4)', borderRadius: 10, padding: 12
              }}>
                <div style={{ fontSize: 10, color: '#ff7875', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  IDENTIFIED PRIME SUSPECT
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

              {detectiveVerdict.modus_operandi_match && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700 }}>MODUS OPERANDI MATCH</div>
                  <div style={{ fontSize: 11, color: '#ddd', marginTop: 4 }}>{detectiveVerdict.modus_operandi_match}</div>
                </div>
              )}

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

              {detectiveVerdict.alibi_falsification && (
                <div style={{ background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.25)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: '#ff7875', fontWeight: 700 }}>ALIBI FALSIFICATION</div>
                  <div style={{ fontSize: 11, color: '#eee', marginTop: 4 }}>{detectiveVerdict.alibi_falsification}</div>
                </div>
              )}

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
      {showAutoGenerateModal && (
        <AutoGenerateCanvasModal
          files={uploadedFilesList}
          loading={autoGenLoading}
          onGenerate={handleAutoGenerate}
          onClose={() => setShowAutoGenerateModal(false)}
          title={autoGenTitle}
          setTitle={setAutoGenTitle}
          text={autoGenText}
          setText={setAutoGenText}
          fileId={autoGenFileId}
          setFileId={setAutoGenFileId}
        />
      )}
      {showChargesheetModal && <BNSChargesheetModal caseId={currentCanvasId} onClose={() => setShowChargesheetModal(false)} />}
      {showANPRModal && <ANPRConvoyModal onClose={() => setShowANPRModal(false)} />}
      {showStingModal && <TacticalStingModal onClose={() => setShowStingModal(false)} />}
      {showMorphModal && <BiometricMorphModal onClose={() => setShowMorphModal(false)} />}
      {showInterrogationModal && <InterrogationCopilotModal onClose={() => setShowInterrogationModal(false)} />}
    </div>
  )
}

function AutoGenerateCanvasModal({ files, loading, onGenerate, onClose, title, setTitle, text, setText, fileId, setFileId }) {
  const presets = [
    { label: 'OBD Keyless Vehicle Theft', t: 'Luxury SUV Theft in Koramangala', text: 'Investigation into luxury SUV thefts in Koramangala & Indiranagar. Prime suspect Imran Pasha operating with accomplice Ashok Kumar. Stolen Hyundai Creta KA-04-MB-8821 detected crossing Attibele Toll Plaza at 02:48 AM trailing Swift KA-51-Z-9988. Keyless ECM cloning hardware seized.' },
    { label: 'UPI Mule Smurfing Ring', t: 'Transnational UPI Smurfing Ring', text: 'Transnational cyber investment fraud case registered at Cyber Crime PS. Victim siphoned of ₹8.4L via 14 rapid UPI transactions under ₹50,000 to primary mule handle drain99@okaxis held by Dinesh Gupta. Fund layering detected through Karnataka Bank A/c 401009182744 and crypto P2P off-ramp.' },
    { label: 'Interstate NDPS Contraband Hub', t: 'Belagavi Checkpoint NDPS Intercept', text: 'Checkpoint interdiction near Belagavi-Maharashtra border. Seized 14.5 kg commercial MDPS contraband from transport vehicle KA-22-T-4910. Accused Shankar Hosamani detained with 3 burner phones and Hawala payment ledger.' },
  ]

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
    padding: '8px 10px', color: '#fff', fontSize: 12, outline: 'none'
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid var(--copper-500)',
        borderRadius: 14, padding: 24, width: 620, maxHeight: '90vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#fbbf24" />
            <span style={{ fontWeight: 800, fontSize: 16 }}>AI AUTO-GENERATE INVESTIGATION CANVAS</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ fontSize: 12, color: '#aaa', marginTop: 12, lineHeight: 1.5 }}>
          Auto-extracts criminal entities (suspects, vehicles, bank accounts, cell towers, evidence) from uploaded FIR reports or case descriptions and auto-lays them out on an interactive graph canvas.
        </div>

        {/* Preset quick buttons */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', marginBottom: 6, textTransform: 'uppercase' }}>Quick Presets:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { setTitle(p.t); setText(p.text); setFileId(''); }}
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
        </div>

        {/* Uploaded File Selector */}
        {files && files.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#38bdf8', marginBottom: 4, textTransform: 'uppercase' }}>Or Select Uploaded Case Document / PDF:</div>
            <select
              value={fileId}
              onChange={e => {
                setFileId(e.target.value)
                const f = files.find(x => x.id === e.target.value)
                if (f) {
                  setTitle(f.label || f.filename)
                  setText(f.ai_summary || '')
                }
              }}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6,
                padding: '8px 10px', color: '#fff', fontSize: 12
              }}
            >
              <option value="">-- Choose an uploaded case file --</option>
              {files.map(f => (
                <option key={f.id} value={f.id} style={{ background: '#121222' }}>
                  {f.filename} ({f.label || f.file_type})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#ccc', display: 'block', marginBottom: 4 }}>Canvas Title:</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Koramangala Luxury Car Theft Syndicate"
            style={inputStyle}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#ccc', display: 'block', marginBottom: 4 }}>Case Intel / Narrative to Extract Graph From:</label>
          <textarea
            rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste case facts, FIR summary, suspect names, vehicle numbers, phone numbers, bank accounts..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
              padding: '10px', color: '#fff', fontSize: 12, resize: 'vertical'
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', color: '#aaa', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #c8814a, #f59e0b)',
              color: '#000', border: 'none', borderRadius: 8,
              padding: '8px 20px', fontWeight: 800, fontSize: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Sparkles size={14} />
            <span>{loading ? 'Extracting & Laying Out Canvas...' : 'Generate Live Canvas'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
