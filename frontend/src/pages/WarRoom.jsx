import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { request, fetchLiveRiskScore, fetchSyndicates, fetchCases } from '../api'
import useLiveFeed from '../hooks/useLiveFeed'
import CesiumGlobe from '../components/map/CesiumGlobe'
import { CreditCard, FileText, Smartphone, Lock, Globe, ShieldAlert, Zap, Radio, MapPin, X, Layers, Satellite, AlertTriangle, Activity } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// ─── Constants & Helpers ──────────────────────────────────────────────────────
const SEV_COLOR = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#3b82f6', LOW: '#22c55e' }
const SEV_BG    = { CRITICAL: 'rgba(239,68,68,0.15)', HIGH: 'rgba(245,158,11,0.12)', MEDIUM: 'rgba(59,130,246,0.12)', LOW: 'rgba(34,197,94,0.12)' }
const renderTypeIcon = (type) => {
  switch (type) {
    case 'UPI_VELOCITY':    return <CreditCard size={11} color="#ef4444" />
    case 'NCRP_COMPLAINT':   return <FileText size={11} color="#3b82f6" />
    case 'TELEGRAM_SCAM':    return <Smartphone size={11} color="#8b5cf6" />
    case 'MULE_FREEZE':      return <Lock size={11} color="#f59e0b" />
    case 'PHISHING_DOMAIN':  return <Globe size={11} color="#f59e0b" />
    case 'DIGITAL_ARREST':   return <ShieldAlert size={11} color="#ef4444" />
    case 'OTP_DRAIN':        return <Smartphone size={11} color="#8b5cf6" />
    default:                 return <Activity size={11} color="#22c55e" />
  }
}
const fmt = (n) => n >= 1e7 ? `₹${(n/1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(1)}L` : `₹${(n/1000).toFixed(0)}K`
const fmtNum = (n) => n?.toLocaleString('en-IN') || '0'

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ value, label, color = '#f59e0b', pulse }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderTop: `2px solid ${color}`,
      borderRadius: 6,
      padding: '8px 12px',
      minWidth: 115,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {pulse && (
        <span style={{
          position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}`, animation: 'pulse 1.4s infinite',
        }} />
      )}
      <div style={{ fontSize: 17, fontWeight: 900, color, fontFamily: 'monospace', letterSpacing: 0.5 }}>{value}</div>
      <div style={{ fontSize: 8.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 2, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

// ─── Severity Badge ────────────────────────────────────────────────────────────
function SevBadge({ sev, size = 9 }) {
  return (
    <span style={{
      fontSize: size, fontWeight: 800, padding: '1px 6px', borderRadius: 10,
      background: SEV_BG[sev] || SEV_BG.LOW,
      color: SEV_COLOR[sev] || SEV_COLOR.LOW,
      border: `1px solid ${SEV_COLOR[sev] || SEV_COLOR.LOW}44`,
      whiteSpace: 'nowrap',
    }}>{sev}</span>
  )
}

// ─── Panel Header ──────────────────────────────────────────────────────────────
function PanelHeader({ title, badge, color = '#f59e0b', live }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, color, letterSpacing: 1.2,
      textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.07)',
      paddingBottom: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>{title}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {badge && <span style={{ fontSize: 8, color: '#64748b' }}>{badge}</span>}
        {live && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: '#22c55e',
              boxShadow: '0 0 6px #22c55e', display: 'inline-block',
              animation: 'pulse 1.2s infinite',
            }} />
            <span style={{ fontSize: 8, color: '#22c55e' }}>LIVE</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── UPI Velocity Panel ────────────────────────────────────────────────────────
function UPIVelocityPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    const load = () => request('/api/v1/fraud/upi-velocity').then(setData).catch(() => {})
    load()
    const id = setInterval(load, 90000)
    return () => clearInterval(id)
  }, [])

  if (!data) return <div style={{ fontSize: 9, color: '#475569' }}>Loading UPI feed...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10} /> {data.critical_alerts} CRITICAL</span>
        <span style={{ fontSize: 9, color: '#64748b' }}>Total at risk: <b style={{ color: '#f59e0b' }}>{fmt(data.total_amount_at_risk_inr)}</b></span>
      </div>
      {data.alerts?.slice(0, 6).map((a, i) => (
        <div key={i} style={{
          padding: '5px 7px', background: SEV_BG[a.severity], borderLeft: `2px solid ${SEV_COLOR[a.severity]}`,
          borderRadius: 4, fontSize: 9,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: SEV_COLOR[a.severity], fontWeight: 700 }}>{a.fraud_type}</span>
            <SevBadge sev={a.severity} />
          </div>
          <div style={{ color: '#94a3b8' }}>{a.bank} · {a.district} · <b style={{ color: '#e2e8f0' }}>{fmt(a.total_amount_inr)}</b> · {a.transaction_count} txns</div>
          <div style={{ color: '#475569', marginTop: 1 }}>{a.upi_handle} · {a.status}</div>
        </div>
      ))}
    </div>
  )
}

// ─── NCRP Stream Panel ─────────────────────────────────────────────────────────
function NCRPStreamPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    const load = () => request('/api/v1/fraud/ncrp-stream?limit=12').then(setData).catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

  if (!data) return <div style={{ fontSize: 9, color: '#475569' }}>Loading NCRP feed...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={10} color="#3b82f6" /> <b style={{ color: '#3b82f6' }}>{data.total_complaints}</b> complaints · <b style={{ color: '#ef4444' }}>{fmt(data.total_loss_inr)}</b> lost</span>
      </div>
      {data.complaints?.slice(0, 8).map((c, i) => (
        <div key={i} style={{
          padding: '5px 7px', background: 'rgba(255,255,255,0.02)',
          borderLeft: `2px solid ${SEV_COLOR[c.severity] || '#475569'}`,
          borderRadius: 4, fontSize: 9,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{c.category}</span>
            <span style={{ color: '#f59e0b' }}>{fmt(c.loss_amount_inr)}</span>
          </div>
          <div style={{ color: '#64748b', marginTop: 1 }}>
            {c.district} · {c.platform_used} · {c.victim_age_group} · <span style={{ color: c.bank_hold_placed ? '#22c55e' : '#ef4444' }}>{c.bank_hold_placed ? 'HOLD PLACED' : 'NO HOLD'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Telegram Scam Monitor Panel ───────────────────────────────────────────────
function TelegramScamPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    const load = () => request('/api/v1/fraud/telegram-scam-monitor').then(setData).catch(() => {})
    load()
    const id = setInterval(load, 120000)
    return () => clearInterval(id)
  }, [])

  if (!data) return <div style={{ fontSize: 9, color: '#475569' }}>Loading scam intel...</div>

  const sig = data.intelligence_signals || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Smartphone size={10} color="#8b5cf6" /> <b style={{ color: '#8b5cf6' }}>{fmtNum(sig.telegram_channels_monitored)}</b> channels</span>
        <span style={{ fontSize: 9, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Globe size={10} color="#ef4444" /> <b style={{ color: '#ef4444' }}>{sig.phishing_domains_detected}</b> live domains</span>
        <span style={{ fontSize: 9, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={10} color="#f59e0b" /> <b style={{ color: '#f59e0b' }}>{sig.new_scam_scripts_detected_24h}</b> new scripts/24h</span>
      </div>
      {data.active_scam_scripts?.map((s, i) => (
        <div key={i} style={{
          padding: '5px 7px',
          background: s.threat_level === 'CRITICAL' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
          borderLeft: `2px solid ${SEV_COLOR[s.threat_level] || '#475569'}`,
          borderRadius: 4, fontSize: 9,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: SEV_COLOR[s.threat_level], fontWeight: 700 }}>{s.scam_type}</span>
            <span style={{ color: '#64748b' }}>{s.platform}</span>
          </div>
          <div style={{ color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.4 }}>"{s.script_excerpt.slice(0, 90)}..."</div>
          <div style={{ color: '#475569', marginTop: 2 }}>{s.channel?.slice(0, 36)}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Mule Alert Panel ──────────────────────────────────────────────────────────
function MuleAlertPanel() {
  const [data, setData] = useState(null)
  useEffect(() => {
    const load = () => request('/api/v1/fraud/mule-alert-feed').then(setData).catch(() => {})
    load()
    const id = setInterval(load, 75000)
    return () => clearInterval(id)
  }, [])

  if (!data) return <div style={{ fontSize: 9, color: '#475569' }}>Loading mule alerts...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={10} color="#ef4444" /> <b style={{ color: '#ef4444' }}>{data.total_mule_accounts_flagged}</b> accounts · Frozen: <b style={{ color: '#f59e0b' }}>{fmt(data.total_frozen_amount_inr)}</b> · Recoverable: <b style={{ color: '#22c55e' }}>{fmt(data.recoverable_amount_inr)}</b></span>
      </div>
      {data.mule_alerts?.slice(0, 7).map((a, i) => (
        <div key={i} style={{
          padding: '5px 7px', background: 'rgba(255,255,255,0.02)',
          borderLeft: '2px solid #ef4444', borderRadius: 4, fontSize: 9,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444', fontWeight: 700 }}>{a.freeze_status}</span>
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>{fmt(a.frozen_amount_inr)}</span>
          </div>
          <div style={{ color: '#94a3b8', marginTop: 1 }}>{a.bank} · {a.district} · {a.fund_origin}</div>
          <div style={{ color: '#475569', marginTop: 1 }}>{a.linked_fir} · {a.freeze_reason.slice(0, 40)}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Live Fraud Alert Ticker ──────────────────────────────────────────────────
function FraudAlertTicker({ alerts }) {
  if (!alerts.length) return (
    <div style={{ fontSize: 9, color: '#475569', padding: '4px 0' }}>Connecting to live fraud stream...</div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto', flex: 1 }}>
      {alerts.slice(0, 20).map((a, i) => (
        <div key={i} style={{
          display: 'flex', gap: 6, alignItems: 'flex-start',
          padding: '4px 6px',
          background: i === 0 ? SEV_BG[a.severity] : 'rgba(255,255,255,0.01)',
          borderRadius: 4, borderLeft: `2px solid ${SEV_COLOR[a.severity] || '#475569'}`,
          animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, marginTop: 1 }}>{renderTypeIcon(a.type)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: '#e2e8f0', lineHeight: 1.4 }}>{a.message}</div>
            <div style={{ fontSize: 8, color: '#475569', marginTop: 1 }}>{a.timestamp} · {a.district}</div>
          </div>
          <SevBadge sev={a.severity} />
        </div>
      ))}
    </div>
  )
}

// ─── Main WarRoom Component ───────────────────────────────────────────────────
export default function WarRoom() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState(null)
  const [operations, setOperations] = useState([])
  const [lastLiveEvent, setLastLiveEvent] = useState(null)
  const [firMarkers, setFirMarkers] = useState([])
  const [fraudAlerts, setFraudAlerts] = useState([])
  const [prediction, setPrediction] = useState(null)
  const [countdown, setCountdown] = useState('--:--:--')
  const [activeTab, setActiveTab] = useState('upi')
  const [mapMode, setMapMode] = useState('dark') // 'dark' | 'satellite' | 'cesium3d'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fraudCounts, setFraudCounts] = useState({ critical: 0, total: 0 })
  const esRef = useRef(null)

  // ── SSE: live FIR feed ─────────────────────────────────────────────────────
  useLiveFeed({
    onNewEvent: (event) => {
      setLastLiveEvent(event)
      if (event.lat && event.lng) {
        setFirMarkers(prev => [{
          lat: event.lat, lng: event.lng,
          type: event.crime_type, severity: event.severity,
          district: event.district, ts: event.timestamp,
        }, ...prev].slice(0, 60))
      }
    }
  })

  // ── SSE: live fraud alert stream ───────────────────────────────────────────
  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const es = new EventSource(`${BASE}/api/v1/fraud/stream`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const alert = JSON.parse(e.data)
        setFraudAlerts(prev => [alert, ...prev].slice(0, 30))
        setFraudCounts(prev => ({
          total: prev.total + 1,
          critical: alert.severity === 'CRITICAL' ? prev.critical + 1 : prev.critical,
        }))
      } catch {}
    }
    return () => { es.close() }
  }, [])

  // ── Load KPI dashboard ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadKpis = () => request('/api/v1/fraud/dashboard').then(setKpis).catch(() => {})
    loadKpis()
    const id = setInterval(loadKpis, 180000)
    return () => clearInterval(id)
  }, [])

  // ── Load operations from syndicates ───────────────────────────────────────
  useEffect(() => {
    const CODENAMES = [
      'SHADOW NET', 'CYBER SIEGE', 'EAGLE EYE', 'HAWALA FRACTURE',
      'VIPER HUNT', 'GHOST MULE', 'IRON GRID', 'SILENT COBRA'
    ]
    fetchSyndicates().then(data => {
      const list = (data?.length ? data : [
        { syndicate_id: 1, syndicate_name: 'Bengaluru Cyber Fraud Collective', total_cases: 142 },
        { syndicate_id: 2, syndicate_name: 'Mysuru Land Grabbing Syndicate', total_cases: 98 },
        { syndicate_id: 3, syndicate_name: 'Belagavi Drug Trafficking Network', total_cases: 84 },
        { syndicate_id: 4, syndicate_name: 'Kalaburagi Extortion Ring', total_cases: 67 },
        { syndicate_id: 5, syndicate_name: 'Mangaluru Hawala Network', total_cases: 53 },
        { syndicate_id: 6, syndicate_name: 'Tumakuru Vehicle Theft Gang', total_cases: 46 },
        { syndicate_id: 7, syndicate_name: 'Davanagere Robbery Syndicate', total_cases: 38 },
      ])
      
      // Take top 7 operations and assign nuanced operational status
      setOperations(list.slice(0, 7).map((s, idx) => {
        let status = 'SURVEILLANCE'
        let color = '#10b981'
        if (s.total_cases >= 90) {
          status = 'PURSUING'
          color = '#ef4444'
        } else if (s.total_cases >= 60) {
          status = 'INTERCEPT'
          color = '#f59e0b'
        } else if (s.total_cases >= 40) {
          status = 'MONITORING'
          color = '#3b82f6'
        }
        return {
          id: s.syndicate_id,
          name: `OP ${CODENAMES[idx % CODENAMES.length]}`,
          syndicate: s.syndicate_name,
          cases: s.total_cases,
          status,
          color,
        }
      }))
    }).catch(() => {})

    fetchCases({ limit: 50 }).then(data => {
      const markers = (data?.cases || [])
        .filter(c => c.Latitude && c.Longitude)
        .map(c => ({
          lat: c.Latitude, lng: c.Longitude,
          type: c.CrimeGroupName || 'General Offense',
          district: c.DistrictName || '',
          severity: c.CrimeGroupName?.toLowerCase().includes('murder') || c.CrimeGroupName?.toLowerCase().includes('narcotics') ? 'CRITICAL' : 'HIGH',
          ts: c.CrimeRegisteredDate,
        }))
      setFirMarkers(markers)
    }).catch(() => {})

    fetchLiveRiskScore().then(data => {
      const top = data?.top_hotspots?.[0]
      const target = new Date(Date.now() + (Math.random() * 3 + 1) * 3600000)
      setPrediction({
        district: top?.district_name || 'Bengaluru City',
        station: top?.station_name || 'Hebbal PS',
        confidence: top ? Math.round(top.hotspot_prob * 100) : 86,
        target_time: target,
      })
    }).catch(() => {
      setPrediction({ district: 'Bengaluru City', station: 'Hebbal PS', confidence: 86, target_time: new Date(Date.now() + 7653000) })
    })
  }, [])

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!prediction) return
    const tick = () => {
      const diff = prediction.target_time - Date.now()
      if (diff <= 0) { setCountdown('THREAT WINDOW ACTIVE'); return }
      const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [prediction])

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
        else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
      }
      if (e.key === 'Escape') navigate('/dashboard')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [navigate])

  const kpi = kpis?.kpis || {}
  const TABS = [
    { id: 'upi',      label: 'UPI Velocity',    color: '#ef4444', Icon: CreditCard },
    { id: 'ncrp',     label: '1930 NCRP',       color: '#3b82f6', Icon: FileText },
    { id: 'telegram', label: 'Telegram / WA',   color: '#8b5cf6', Icon: Smartphone },
    { id: 'mule',     label: 'Mule Freezes',    color: '#f59e0b', Icon: Lock },
    { id: 'stream',   label: 'Live Stream',     color: '#22c55e', Icon: Radio },
  ]
  const activeTab_ = TABS.find(t => t.id === activeTab)

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(8px);opacity:0} to{transform:translateX(0);opacity:1} }
        .warroom-scrollbar::-webkit-scrollbar{width:3px}
        .warroom-scrollbar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
      `}</style>
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: '#060810', zIndex: 9999, display: 'flex', flexDirection: 'column',
        fontFamily: "'JetBrains Mono', 'Consolas', monospace", color: '#94a3b8',
        padding: 10, boxSizing: 'border-box', gap: 8, overflow: 'hidden',
      }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.6)', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 900, color: '#e2e8f0', letterSpacing: 2 }}>
              PROJECT SENTINAL · REAL-TIME FRAUD COMMAND CENTER · KSP CYBER CRIME
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: '#475569' }}>{new Date().toLocaleString('en-IN')}</span>
            <span style={{ fontSize: 9, color: '#475569' }}>[F] Fullscreen · [ESC] Exit</span>
            <button onClick={() => navigate('/dashboard')} style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 4, color: '#f87171', padding: '3px 10px', fontSize: 9, cursor: 'pointer', fontWeight: 700,
            }}>EXIT</button>
          </div>
        </div>

        {/* ── TOP KPI STRIP ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          <KpiCard value={fmtNum(kpi.calls_to_1930 || 0)}               label="1930 Calls Today"        color="#f59e0b" pulse />
          <KpiCard value={fmtNum(kpi.complaints_last_24h || 0)}          label="NCRP Complaints/24h"     color="#3b82f6" />
          <KpiCard value={fmt(kpi.loss_last_24h_inr || 0)}               label="Loss Last 24h"           color="#ef4444" pulse />
          <KpiCard value={fmt(kpi.amounts_recovered_inr || 0)}           label="Recovered"               color="#22c55e" />
          <KpiCard value={fmtNum(kpi.mule_accounts_frozen || 0)}         label="Mule Accts Frozen"       color="#ef4444" />
          <KpiCard value={fmtNum(kpi.digital_arrest_cases_24h || 0)}     label="Digital Arrest/24h"      color="#f59e0b" pulse />
          <KpiCard value={fmtNum(kpi.otp_fraud_cases_24h || 0)}          label="OTP Fraud/24h"           color="#8b5cf6" />
          <KpiCard value={fmtNum(kpi.firs_registered_cyber || 0)}        label="Cyber FIRs/24h"          color="#22c55e" />
          <KpiCard value={fmtNum(kpi.upi_alerts_active || 0)}            label="Active UPI Alerts"       color="#ef4444" pulse />
          <KpiCard value={fmtNum(kpi.phishing_domains_active || 0)}      label="Live Phishing Domains"   color="#f59e0b" />
          <KpiCard value={fmtNum(fraudCounts.total)}                      label="Stream Events"           color="#22c55e" pulse />
          <KpiCard value={fmtNum(fraudCounts.critical)}                   label="Critical Alerts"         color="#ef4444" pulse />
        </div>

        {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 8, minHeight: 0 }}>

          {/* LEFT: Operations + Countdown ───────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Countdown */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '2px solid #f59e0b',
              borderRadius: 6, padding: 10, textAlign: 'center',
            }}>
              <div style={{ fontSize: 8, color: '#64748b', letterSpacing: 1, marginBottom: 4 }}>PREDICTED THREAT WINDOW</div>
              <div style={{
                fontSize: countdown.includes('ACTIVE') ? 14 : 28, fontWeight: 900,
                color: countdown.includes('ACTIVE') ? '#ef4444' : '#f59e0b', letterSpacing: 2,
              }}>{countdown}</div>
              {prediction && (
                <div style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>
                  {prediction.district} · {prediction.station}<br />
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>{prediction.confidence}%</span> confidence
                </div>
              )}
            </div>

            {/* Active Operations */}
            <div className="warroom-scrollbar" style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, padding: 10, flex: 1, overflowY: 'auto',
            }}>
              <PanelHeader title="Active Operations" live />
              {(() => {
                const maxCases = Math.max(...operations.map(o => o.cases || 0), 1)
                return operations.map((op, i) => {
                  const pct = Math.round((op.cases / maxCases) * 100)
                  return (
                    <div key={i} style={{
                      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#e2e8f0', letterSpacing: 0.5 }}>{op.name}</span>
                        <span style={{
                          fontSize: 7, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
                          background: `${op.color}22`, color: op.color, border: `1px solid ${op.color}55`,
                        }}>{op.status}</span>
                      </div>
                      <div style={{ fontSize: 7.5, color: '#475569', marginBottom: 1 }}>
                        {op.syndicate}
                      </div>
                      {/* Progress bar — width relative to top operation */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${op.color}aa, ${op.color})`,
                            borderRadius: 2,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 7, color: op.color, fontWeight: 700, minWidth: 22, textAlign: 'right' }}>
                          {op.cases || 0}
                        </span>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* CENTER: Tactical Map ────────────────────────────────────────── */}
          <div style={{
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
            overflow: 'hidden', position: 'relative',
            background: '#04060c', display: 'flex', flexDirection: 'column'
          }}>
            {/* Map Mode Switcher & Legend Overlay */}
            <div style={{
              position: 'absolute', top: 8, left: 8, zIndex: 1000,
              background: 'rgba(6,8,16,0.92)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4, padding: '6px 10px', fontSize: 8, display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#f59e0b', fontWeight: 700, letterSpacing: 1 }}>SURVEILLANCE FEED</span>
                {/* Layer switch buttons */}
                <div style={{ display: 'flex', gap: 3 }}>
                  <button
                    onClick={() => setMapMode('dark')}
                    style={{
                      background: mapMode === 'dark' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                      border: mapMode === 'dark' ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
                      color: mapMode === 'dark' ? '#f59e0b' : '#64748b',
                      borderRadius: 3, padding: '2px 5px', fontSize: 7.5, cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    DARK
                  </button>
                  <button
                    onClick={() => setMapMode('satellite')}
                    style={{
                      background: mapMode === 'satellite' ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.05)',
                      border: mapMode === 'satellite' ? '1px solid #0ea5e9' : '1px solid rgba(255,255,255,0.1)',
                      color: mapMode === 'satellite' ? '#0ea5e9' : '#64748b',
                      borderRadius: 3, padding: '2px 5px', fontSize: 7.5, cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    SATELLITE
                  </button>
                  <button
                    onClick={() => setMapMode('cesium3d')}
                    style={{
                      background: mapMode === 'cesium3d' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                      border: mapMode === 'cesium3d' ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                      color: mapMode === 'cesium3d' ? '#22c55e' : '#64748b',
                      borderRadius: 3, padding: '2px 5px', fontSize: 7.5, cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    3D GLOBE
                  </button>
                </div>
              </div>

              {mapMode !== 'cesium3d' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  {[['CRITICAL', '#ef4444'], ['HIGH', '#f59e0b'], ['MEDIUM', '#3b82f6'], ['LOW', '#22c55e']].map(([s, c]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block', opacity: 0.8 }} />
                      <span style={{ color: '#64748b', fontSize: 7.5 }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live event flash */}
            {lastLiveEvent && (
              <div style={{
                position: 'absolute', top: 8, right: 8, zIndex: 1000,
                background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
                borderRadius: 4, padding: '4px 8px', fontSize: 8, color: '#ef4444',
                animation: 'slideIn 0.3s ease', maxWidth: 180,
              }}>
                {lastLiveEvent.crime_type} · {lastLiveEvent.district}
              </div>
            )}

            {/* Conditional Rendering: 3D Cesium vs 2D Leaflet (Dark or Satellite) */}
            {mapMode === 'cesium3d' ? (
              <div style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }}>
                <CesiumGlobe points={firMarkers} liveEvent={lastLiveEvent} buildings3D={true} />
              </div>
            ) : (
              <MapContainer center={[14.5, 75.7]} zoom={7} zoomControl={false} style={{ height: '100%', width: '100%', background: '#04060c' }}>
                {mapMode === 'satellite' ? (
                  <>
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="&copy; Esri World Imagery"
                    />
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                    />
                  </>
                ) : (
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB" />
                )}
                {firMarkers.map((m, i) => (
                  <CircleMarker
                    key={i}
                    center={[m.lat, m.lng]}
                    radius={m.severity === 'CRITICAL' ? 9 : m.severity === 'HIGH' ? 7 : 5}
                    fillColor={SEV_COLOR[m.severity] || '#3b82f6'}
                    fillOpacity={mapMode === 'satellite' ? 0.9 : 0.7}
                    stroke={true}
                    color={mapMode === 'satellite' ? '#ffffff' : (SEV_COLOR[m.severity] || '#3b82f6')}
                    weight={mapMode === 'satellite' ? 1.5 : 1}
                  >
                    <Popup>
                      <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                        <b>{m.type}</b><br />{m.district}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </div>

          {/* RIGHT: Fraud Intel Panels ───────────────────────────────────── */}
          <div className="warroom-scrollbar" style={{
            display: 'flex', flexDirection: 'column', gap: 0,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6, overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: '6px 2px', border: 'none', cursor: 'pointer', fontSize: 8, fontWeight: 700,
                  background: activeTab === tab.id ? `${tab.color}18` : 'transparent',
                  color: activeTab === tab.id ? tab.color : '#475569',
                  borderBottom: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <tab.Icon size={10} />
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
            {/* Panel content */}
            <div className="warroom-scrollbar" style={{ flex: 1, padding: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <PanelHeader
                title={activeTab_?.label || ''}
                color={activeTab_?.color || '#f59e0b'}
                live={activeTab === 'stream'}
              />
              {activeTab === 'upi'      && <UPIVelocityPanel />}
              {activeTab === 'ncrp'     && <NCRPStreamPanel />}
              {activeTab === 'telegram' && <TelegramScamPanel />}
              {activeTab === 'mule'     && <MuleAlertPanel />}
              {activeTab === 'stream'   && <FraudAlertTicker alerts={fraudAlerts} />}
            </div>
          </div>
        </div>

        {/* ── BOTTOM RESOURCE BAR ───────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
          flexShrink: 0, height: 60,
        }}>
          {[
            {
              label: 'CID CYBER CRIME UNITS',
              items: [
                { name: 'Economic Offenses Wing', status: 'ACTIVE', n: 12 },
                { name: 'Crypto Cell (Bengaluru)', status: 'ON CALL', n: 4 },
                { name: 'TEMS Surveillance', status: 'DEPLOYED', n: 6 },
              ]
            },
            {
              label: 'COMMAND LIAISONS',
              items: [
                { name: 'NPCI Fraud Desk', status: 'CONNECTED' },
                { name: 'CERT-In Incident Resp.', status: 'ACTIVE' },
                { name: 'I4C / MHA 1930 HQ', status: 'ACTIVE' },
              ]
            },
            {
              label: 'DISTRICT DEPLOYMENT',
              items: [
                { name: 'Bengaluru City CP', status: '18 units' },
                { name: 'Mysuru SP Office', status: '9 units' },
                { name: 'Hubballi-Dharwad SP', status: '7 units' },
              ]
            },
          ].map((col, ci) => (
            <div key={ci} style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6, padding: '6px 10px',
            }}>
              <div style={{ fontSize: 8, color: '#475569', letterSpacing: 0.8, marginBottom: 4 }}>{col.label}</div>
              {col.items.map((item, ii) => (
                <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, paddingBottom: 1 }}>
                  <span style={{ color: '#64748b' }}>{item.name}</span>
                  <span style={{ color: item.status === 'ACTIVE' || item.status === 'CONNECTED' || item.status === 'DEPLOYED' ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>{item.status}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    </>
  )
}
