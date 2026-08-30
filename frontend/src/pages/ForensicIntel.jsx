import { Link, Crosshair, Scale, Dna, Box, ShieldAlert, Building2, Search, FileText, CheckCircle2, MapPin, Award, Activity, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { request } from '../api'

const TABS = [
  { id: 'crypto',     label: 'Crypto Tracer',      desc: 'Blockchain & wallet forensic unmixer' },
  { id: 'ballistics', label: 'Ballistics AI',       desc: 'Weapon classification & arms trafficking' },
  { id: 'bail',       label: 'Bail Risk Assessor',  desc: 'Flight risk score & prosecutor affidavit' },
  { id: 'coldcase',   label: 'Cold Case Linker',    desc: 'Serial MO fingerprint across districts' },
  { id: 'panchnama',  label: 'Panchnama Vault',     desc: 'Section 65B cryptographic custody chain' },
]

const st = {
  page: { padding: 24, background: 'var(--bg-primary)', minHeight: '100%', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, color: '#f59e0b', letterSpacing: 0.5, margin: 0 },
  sub: { color: '#64748b', fontSize: 13, marginTop: 4 },
  tabs: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  tab: (active) => ({
    padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    border: active ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? '#f59e0b' : '#94a3b8', transition: 'all 0.2s',
  }),
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 },
  label: { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, display: 'block' },
  input: { width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 },
  select: { width: '100%', background: '#0f1826', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, marginBottom: 12 },
  btn: (clr = '#f59e0b') => ({ background: `linear-gradient(135deg, ${clr}, ${clr}cc)`, border: 'none', borderRadius: 8, padding: '10px 20px', color: '#000', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 4 }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  badge: (c) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c === 'red' ? 'rgba(239,68,68,0.2)' : c === 'green' ? 'rgba(34,197,94,0.2)' : c === 'yellow' ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.2)', color: c === 'red' ? '#f87171' : c === 'green' ? '#4ade80' : c === 'yellow' ? '#fbbf24' : '#94a3b8', border: `1px solid ${c === 'red' ? '#f87171' : c === 'green' ? '#4ade80' : c === 'yellow' ? '#fbbf24' : '#475569'}33` }),
  pre: { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16, fontSize: 11, color: '#94a3b8', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 520, overflowY: 'auto' },
  row: { display: 'flex', gap: 12, alignItems: 'flex-end' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 8, marginTop: 16 },
  statBlock: { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  statVal: { fontSize: 24, fontWeight: 800, color: '#f59e0b' },
  statLbl: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 },
  divider: { borderColor: 'rgba(255,255,255,0.07)', margin: '16px 0' },
}

// ─── CryptoTracer Tab ──────────────────────────────────────────────────────
function CryptoTracer() {
  const [wallet, setWallet] = useState('0xd4A5f9E3C7b2A1082BC6019d3F77e4c8b09E2A00')
  const [chain, setChain] = useState('ETH')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  async function run() {
    setLoading(true); setErr(null); setData(null)
    try {
      const res = await request('/api/v1/financial/crypto-trace-unmixer', {
        method: 'POST', body: JSON.stringify({ wallet_address: wallet, blockchain: chain, max_hops: 5 })
      })
      setData(res)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={st.card}>
        <div style={st.grid2}>
          <div>
            <span style={st.label}>Target Wallet / Address</span>
            <input style={st.input} value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x... or BTC address" />
          </div>
          <div>
            <span style={st.label}>Blockchain</span>
            <select style={st.select} value={chain} onChange={e => setChain(e.target.value)}>
              <option value="ETH">Ethereum (ETH)</option>
              <option value="BTC">Bitcoin (BTC)</option>
              <option value="TRC20">Tron USDT (TRC-20)</option>
            </select>
          </div>
        </div>
        <button style={st.btn()} onClick={run} disabled={loading}>{loading ? 'Tracing...' : 'Trace & Unmix Blockchain'}</button>
      </div>
      {err && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>{err}</div>}
      {data && (
        <div>
          <div style={{ ...st.grid2, gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { v: data.total_hops_traced, l: 'Hops Traced' },
              { v: data.mixer_hops_detected, l: 'Mixer Hops' },
              { v: data.exchange_exits_detected, l: 'Exchange Exits' },
              { v: `${data.money_laundering_confidence}%`, l: 'ML Confidence' },
            ].map(s => (
              <div key={s.l} style={st.statBlock}><span style={st.statVal}>{s.v}</span><span style={st.statLbl}>{s.l}</span></div>
            ))}
          </div>
          <div style={st.card}>
            <div style={st.sectionTitle}>Blockchain Hop Chain</div>
            {data.hop_chain?.map((hop, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: hop.mixer_flag ? 'rgba(239,68,68,0.2)' : hop.exchange_flag ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: hop.mixer_flag ? '#f87171' : hop.exchange_flag ? '#4ade80' : '#f59e0b' }}>{hop.hop}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{hop.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, wordBreak: 'break-all' }}>{hop.wallet}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={st.badge('yellow')}>{hop.blockchain || chain}</span>
                    {hop.mixer_flag && <span style={st.badge('red')}>MIXER: {hop.mixer_name}</span>}
                    {hop.exchange_flag && <span style={st.badge('green')}>Exchange Exit</span>}
                    {hop.amount_inr && <span style={st.badge('yellow')}>₹{(hop.amount_inr/100000).toFixed(1)}L</span>}
                    {hop.amount_usdt && <span style={st.badge('yellow')}>USDT {hop.amount_usdt.toLocaleString()}</span>}
                  </div>
                  {hop.kyc_demand && <div style={{ marginTop: 4, fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.1)', padding: '4px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={11} /> {hop.kyc_demand}</div>}
                </div>
              </div>
            ))}
          </div>
          {data.statutory_subpoena && (
            <div style={{ ...st.card, borderColor: 'rgba(239,68,68,0.3)' }}>
              <div style={st.sectionTitle}>Section 94 BNSS Statutory Subpoena</div>
              <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.7 }}>{data.statutory_subpoena.certification_text || data.statutory_subpoena.directive}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                <b>Exchanges Served:</b> {data.statutory_subpoena.exchanges_served?.join(' | ')} &nbsp;·&nbsp;
                <b>Order #:</b> {data.statutory_subpoena.order_number}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Ballistics Tab ────────────────────────────────────────────────────────
function BallisticsClassifier() {
  const [desc, setDesc] = useState('9mm semi-automatic pistol with 2 spent casings')
  const [location, setLocation] = useState('Shivajinagar, Bengaluru')
  const [caseRef, setCaseRef] = useState('FIR/2026/BLR/0091')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  async function run() {
    setLoading(true); setErr(null); setData(null)
    try {
      const res = await request('/api/v1/criminology/weapon-ballistics-classify', {
        method: 'POST', body: JSON.stringify({ description: desc, crime_scene_location: location, case_reference: caseRef })
      })
      setData(res)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const dangerColor = data?.danger_level === 'CRITICAL' ? 'red' : data?.danger_level === 'HIGH' ? 'yellow' : 'green'

  return (
    <div>
      <div style={st.card}>
        <span style={st.label}>Weapon / Evidence Description</span>
        <input style={st.input} value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Desi katta, 9mm pistol, machete..." />
        <div style={st.grid2}>
          <div>
            <span style={st.label}>Crime Scene Location</span>
            <input style={st.input} value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div>
            <span style={st.label}>Case FIR Reference</span>
            <input style={st.input} value={caseRef} onChange={e => setCaseRef(e.target.value)} />
          </div>
        </div>
        <button style={st.btn('#ef4444')} onClick={run} disabled={loading}>{loading ? 'Classifying...' : 'Classify Weapon & Trace Arms'}</button>
      </div>
      {err && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>{err}</div>}
      {data && (
        <div>
          <div style={{ ...st.card, borderColor: data.danger_level === 'CRITICAL' ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{data.weapon_classification}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Caliber: <b style={{ color: '#e2e8f0' }}>{data.estimated_caliber}</b> | Origin: <b style={{ color: '#fbbf24' }}>{data.trafficking_origin}</b></div>
              </div>
              <span style={{ ...st.badge(dangerColor), fontSize: 13, padding: '4px 14px' }}>{data.danger_level}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 6 }}>
              <b>Legal Section:</b> {data.applicable_legal_section}
            </div>
          </div>
          {data.ballistic_analysis && (
            <div style={st.card}>
              <div style={st.sectionTitle}>Ballistic Analysis</div>
              {Object.entries(data.ballistic_analysis).map(([k, v]) => (
                <div key={k} style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <b style={{ color: '#cbd5e1', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</b> {v}
                </div>
              ))}
            </div>
          )}
          {data.cross_reference_past_seizures?.length > 0 && (
            <div style={st.card}>
              <div style={st.sectionTitle}>Cross-Referenced Past Seizures (Ballistic Database)</div>
              {data.cross_reference_past_seizures.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12 }}>
                  <span style={st.badge('yellow')}>{s.match_confidence}% Match</span>
                  <span style={{ color: '#e2e8f0' }}>{s.fir}</span>
                  <span style={{ color: '#64748b' }}>{s.station}</span>
                  <span style={{ color: '#64748b' }}>by {s.seized_by}</span>
                </div>
              ))}
            </div>
          )}
          {data.arms_trafficking_lead && (
            <div style={{ ...st.card, borderColor: 'rgba(245,158,11,0.3)' }}>
              <div style={st.sectionTitle}>Arms Trafficking Intelligence Lead</div>
              <div style={{ fontSize: 12, color: '#fbbf24' }}><b>Network:</b> {data.arms_trafficking_lead.trafficking_network}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}><b>Known Dealers:</b> {data.arms_trafficking_lead.known_dealers?.join(', ')}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{data.arms_trafficking_lead.recommended_action}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Bail Risk Tab ─────────────────────────────────────────────────────────
function BailRiskAssessor() {
  const [form, setForm] = useState({
    accused_name: 'Imran Pasha', passport_status: 'Active', interstate_assets: true,
    prior_bail_violations: 2, gang_connectivity_score: 78.5, criminal_gravity_index: 8.2,
    chargesheet_filed: false, fir_count: 5
  })
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setErr(null); setData(null)
    try {
      const res = await request('/api/v1/criminology/bail-flight-risk-assessor', {
        method: 'POST', body: JSON.stringify(form)
      })
      setData(res)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const riskScore = data?.flight_risk_score || 0
  const riskColor = riskScore >= 75 ? '#ef4444' : riskScore >= 50 ? '#f59e0b' : '#22c55e'

  return (
    <div>
      <div style={st.card}>
        <div style={st.grid2}>
          <div>
            <span style={st.label}>Accused Name</span>
            <input style={st.input} value={form.accused_name} onChange={e => upd('accused_name', e.target.value)} />
          </div>
          <div>
            <span style={st.label}>Passport Status</span>
            <select style={st.select} value={form.passport_status} onChange={e => upd('passport_status', e.target.value)}>
              <option value="Active">Active Passport</option>
              <option value="Revoked">Revoked</option>
              <option value="None">No Passport</option>
            </select>
          </div>
          <div>
            <span style={st.label}>Prior Bail Violations</span>
            <input style={st.input} type="number" value={form.prior_bail_violations} onChange={e => upd('prior_bail_violations', parseInt(e.target.value))} />
          </div>
          <div>
            <span style={st.label}>FIR Count (Across Stations)</span>
            <input style={st.input} type="number" value={form.fir_count} onChange={e => upd('fir_count', parseInt(e.target.value))} />
          </div>
          <div>
            <span style={st.label}>Gang Connectivity Score (%)</span>
            <input style={st.input} type="number" step="0.1" value={form.gang_connectivity_score} onChange={e => upd('gang_connectivity_score', parseFloat(e.target.value))} />
          </div>
          <div>
            <span style={st.label}>Criminal Gravity Index (0-10)</span>
            <input style={st.input} type="number" step="0.1" value={form.criminal_gravity_index} onChange={e => upd('criminal_gravity_index', parseFloat(e.target.value))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.interstate_assets} onChange={e => upd('interstate_assets', e.target.checked)} />
            Interstate Property / Assets
          </label>
          <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.chargesheet_filed} onChange={e => upd('chargesheet_filed', e.target.checked)} />
            Chargesheet Filed
          </label>
        </div>
        <button style={st.btn('#8b5cf6')} onClick={run} disabled={loading}>{loading ? 'Calculating...' : 'Compute Flight Risk Score'}</button>
      </div>
      {err && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>{err}</div>}
      {data && (
        <div>
          <div style={{ ...st.card, borderColor: `${riskColor}44` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Flight Risk Score for <b style={{ color: '#e2e8f0' }}>{data.accused_name}</b></div>
                <div style={{ fontSize: 48, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{riskScore}<span style={{ fontSize: 20 }}>%</span></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: riskColor }}>{data.risk_level}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, maxWidth: 280 }}>{data.prosecution_recommendation}</div>
              </div>
            </div>
            {/* Risk bar */}
            <div style={{ marginTop: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{ width: `${riskScore}%`, height: '100%', background: `linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)`, borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>
          {data.prosecutor_bail_objection_affidavit && (
            <div style={{ ...st.card, borderColor: 'rgba(139,92,246,0.3)' }}>
              <div style={st.sectionTitle}>Prosecutor Bail Objection Affidavit (Auto-Generated)</div>
              <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}><b>{data.prosecutor_bail_objection_affidavit.document_title}</b></div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>Under: {data.prosecutor_bail_objection_affidavit.court_section}</div>
              {data.prosecutor_bail_objection_affidavit.grounds?.map((g, i) => (
                <div key={i} style={{ fontSize: 11, color: '#cbd5e1', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', lineHeight: 1.6 }}>{g}</div>
              ))}
              <div style={{ marginTop: 12, fontSize: 11, color: '#8b5cf6', fontStyle: 'italic' }}>{data.prosecutor_bail_objection_affidavit.prayer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Cold Case Linker Tab ──────────────────────────────────────────────────
function ColdCaseLinker() {
  const [query, setQuery] = useState('gas torch cutting shutters jewelry shop')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  async function run() {
    setLoading(true); setErr(null); setData(null)
    try {
      const res = await request('/api/v1/criminology/cold-case-mo-linker', {
        method: 'POST', body: JSON.stringify({ modus_operandi_query: query })
      })
      setData(res)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const QUICK = [
    'gas torch cutting shutters jewelry shop',
    'OBD key clone car theft Fortuner',
    'chain snatch motorcycle gold',
  ]

  return (
    <div>
      <div style={st.card}>
        <span style={st.label}>Modus Operandi Description (Natural Language)</span>
        <input style={st.input} value={query} onChange={e => setQuery(e.target.value)} placeholder="Describe the MO pattern to search across all FIRs..." />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => setQuery(q)} style={{ ...st.btn('#1e293b'), color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, padding: '5px 10px' }}>{q.slice(0, 32)}…</button>
          ))}
        </div>
        <button style={st.btn('#22c55e')} onClick={run} disabled={loading}>{loading ? 'Scanning 10,000 FIRs...' : 'Find MO Matches & Link Cold Cases'}</button>
      </div>
      {err && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>{err}</div>}
      {data && (
        <div>
          <div style={st.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>{data.mo_signature_detected}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{data.mo_description}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={st.statBlock}><span style={{ ...st.statVal, color: '#22c55e' }}>{data.total_matches}</span><span style={st.statLbl}>Linked Cases</span></div>
              <div style={st.statBlock}><span style={{ ...st.statVal, fontSize: 16 }}>₹{(data.total_loss_inr / 100000).toFixed(1)}L</span><span style={st.statLbl}>Total Loss</span></div>
              <div style={st.statBlock}><span style={{ ...st.statVal, fontSize: 20 }}>{data.avg_mo_match_confidence}%</span><span style={st.statLbl}>Avg Match</span></div>
            </div>
          </div>
          <div style={st.card}>
            <div style={st.sectionTitle}>Linked Cold Cases by District</div>
            {data.linked_cold_cases?.map((c, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={st.badge(c.status === 'Unsolved' ? 'red' : 'green')}>{c.status}</span>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>{c.fir}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{c.ps} · {c.date}</span>
                <span style={st.badge('yellow')}>{c.mo_match}% MO Match</span>
                {c.loss_inr && <span style={{ fontSize: 11, color: '#94a3b8' }}>₹{(c.loss_inr/100000).toFixed(1)}L loss</span>}
                {c.arrested_accused && <span style={{ fontSize: 11, color: '#4ade80' }}>Arrested: {c.arrested_accused}</span>}
              </div>
            ))}
          </div>
          <div style={{ ...st.card, borderColor: 'rgba(34,197,94,0.3)' }}>
            <div style={st.sectionTitle}>Investigative Lead</div>
            <div style={{ fontSize: 12, color: '#fbbf24' }}><b>Gang Profile:</b> {data.gang_profile}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{data.investigative_lead}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>{data.recommended_action}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Digital Panchnama Tab ─────────────────────────────────────────────────
function DigitalPanchnama() {
  const [form, setForm] = useState({
    case_reference: 'FIR/2026/BLR/0091',
    seizing_officer: 'PSI Rakesh Nair, Shivajinagar PS',
    evidence_type: 'Mobile Phone',
    evidence_description: 'iPhone 13 Pro Max (IMEI: 864920049182741) Black colour',
    seizure_lat: 12.9846,
    seizure_lng: 77.6010,
  })
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function run() {
    setLoading(true); setErr(null); setData(null)
    try {
      const res = await request('/api/v1/criminology/digital-panchnama-custody', {
        method: 'POST', body: JSON.stringify(form)
      })
      setData(res)
    } catch(e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={st.card}>
        <div style={st.grid2}>
          <div>
            <span style={st.label}>Case FIR Reference</span>
            <input style={st.input} value={form.case_reference} onChange={e => upd('case_reference', e.target.value)} />
          </div>
          <div>
            <span style={st.label}>Seizing Officer</span>
            <input style={st.input} value={form.seizing_officer} onChange={e => upd('seizing_officer', e.target.value)} />
          </div>
          <div>
            <span style={st.label}>Evidence Type</span>
            <select style={st.select} value={form.evidence_type} onChange={e => upd('evidence_type', e.target.value)}>
              <option>Mobile Phone</option>
              <option>Hard Drive</option>
              <option>Pen Drive / USB</option>
              <option>CCTV DVR / NVR</option>
              <option>Laptop / Computer</option>
              <option>Documents</option>
            </select>
          </div>
          <div>
            <span style={st.label}>Evidence Description</span>
            <input style={st.input} value={form.evidence_description} onChange={e => upd('evidence_description', e.target.value)} />
          </div>
          <div>
            <span style={st.label}>Seizure Latitude</span>
            <input style={st.input} type="number" step="0.0001" value={form.seizure_lat} onChange={e => upd('seizure_lat', parseFloat(e.target.value))} />
          </div>
          <div>
            <span style={st.label}>Seizure Longitude</span>
            <input style={st.input} type="number" step="0.0001" value={form.seizure_lng} onChange={e => upd('seizure_lng', parseFloat(e.target.value))} />
          </div>
        </div>
        <button style={st.btn('#0ea5e9')} onClick={run} disabled={loading}>{loading ? 'Generating...' : 'Generate Section 65B Panchnama & Custody Chain'}</button>
      </div>
      {err && <div style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 8 }}>{err}</div>}
      {data && (
        <div>
          <div style={{ ...st.card, borderColor: 'rgba(14,165,233,0.4)', background: 'rgba(14,165,233,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Evidence Tag ID</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0ea5e9', letterSpacing: 1 }}>{data.evidence_tag_id}</div>
              </div>
              <span style={st.badge('green')}>{data.cryptographic_proof?.tamper_status}</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
              <b>SHA-256:</b> <span style={{ fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all' }}>{data.cryptographic_proof?.sha256_hash}</span>
            </div>
          </div>
          <div style={st.card}>
            <div style={st.sectionTitle}>Chain of Custody Audit Trail</div>
            {data.chain_of_custody?.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: step.status?.includes('COMPLETE') || step.status?.includes('REGISTERED') ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 800, color: step.status?.includes('COMPLETE') || step.status?.includes('REGISTERED') ? '#4ade80' : '#64748b' }}>{step.step}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{step.action}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{step.officer || step.lab} · {step.timestamp}</div>
                  {step.gps_location && <div style={{ fontSize: 11, color: '#64748b' }}>{step.gps_location}</div>}
                  <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace', marginTop: 2 }}>Hash: {step.hash_checkpoint}</div>
                </div>
                <span style={{ ...st.badge(step.status?.includes('PENDING') ? 'yellow' : 'green'), alignSelf: 'flex-start' }}>{step.status}</span>
              </div>
            ))}
          </div>
          {data.section_65b_certificate && (
            <div style={{ ...st.card, borderColor: 'rgba(14,165,233,0.3)' }}>
              <div style={st.sectionTitle}>{data.section_65b_certificate.certificate_title}</div>
              <div style={{ fontSize: 11, color: '#fbbf24', marginBottom: 8 }}>Under: {data.section_65b_certificate.applicable_law}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, fontStyle: 'italic' }}>{data.section_65b_certificate.certification_text}</div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>Precedent: {data.section_65b_certificate.precedent}</div>
              <div style={{ marginTop: 8 }}><span style={st.badge('green')}>Court Submission Ready</span></div>
            </div>
          )}
          {data.qr_code_data && (
            <div style={{ ...st.card, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>QR Code Evidence Link (for physical tag)</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#0ea5e9', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: 6, display: 'inline-block' }}>{data.qr_code_data}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ForensicIntel() {
  const [activeTab, setActiveTab] = useState('crypto')

  const PANELS = {
    crypto:     <CryptoTracer />,
    ballistics: <BallisticsClassifier />,
    bail:       <BailRiskAssessor />,
    coldcase:   <ColdCaseLinker />,
    panchnama:  <DigitalPanchnama />,
  }

  const activeTabInfo = TABS.find(t => t.id === activeTab)

  return (
    <div style={st.page}>
      <div style={st.header}>
        <h1 style={st.title}>Forensic Intelligence Suite</h1>
        <p style={st.sub}>Advanced Criminology Engines — Crypto Forensics · Ballistics AI · Bail Risk · Cold Case Linker · Section 65B Vault</p>
      </div>

      <div style={st.tabs}>
        {TABS.map(tab => (
          <button key={tab.id} style={st.tab(activeTab === tab.id)} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16, fontSize: 12, color: '#64748b' }}>
        {activeTabInfo?.desc}
      </div>

      {PANELS[activeTab]}
    </div>
  )
}
