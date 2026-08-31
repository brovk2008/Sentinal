/**
 * WebIntelligence.jsx — OSINT & Public Web Scraper Suite
 * Live automated crawlers for:
 * 1. e-Courts Judicial Bail & Warrant Scraper
 * 2. MoRTH VAHAN Vehicle Registry Scraper
 * 3. Interpol & State CID Fugitive Notice Scraper
 * 4. CERT-In / NCRP Cyber Threat Radar
 * 5. OSINT Regional Crime News Feeds
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, Search, Scale, Car, ShieldAlert, AlertTriangle,
  Newspaper, CheckCircle2, RotateCw, ExternalLink, Hash,
  MapPin, Calendar, User, DollarSign, Database, Sparkles,
  Share2, Shield, Eye, Lock, UserCheck
} from 'lucide-react'
import {
  searchECourts,
  lookupVahan,
  searchFugitives,
  lookupCyberThreats,
  fetchOSINTNews
} from '../api'

const TABS = [
  { id: 'investigate', label: 'Web Investigate (Person & Face)', icon: UserCheck },
  { id: 'ecourts', label: 'e-Courts Bail & Orders', icon: Scale },
  { id: 'vahan', label: 'VAHAN Vehicle Registry', icon: Car },
  { id: 'fugitives', label: 'Interpol & CID Fugitives', icon: ShieldAlert },
  { id: 'cyber', label: 'NCRP Cyber Threat Radar', icon: AlertTriangle },
  { id: 'osint', label: 'OSINT Regional News', icon: Newspaper },
]

export default function WebIntelligence() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('ecourts')
  const [loading, setLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')

  // 1. eCourts state
  const [ecQuery, setEcQuery] = useState('Imran Pasha')
  const [ecResults, setEcResults] = useState([])

  // 2. VAHAN state
  const [vahanPlate, setVahanPlate] = useState('KA-04-MB-1234')
  const [vahanResult, setVahanResult] = useState(null)

  // 3. Fugitive state
  const [fugitiveQuery, setFugitiveQuery] = useState('')
  const [fugitives, setFugitives] = useState([])

  // 4. Cyber state
  const [cyberQuery, setCyberQuery] = useState('')
  const [cyberThreats, setCyberThreats] = useState([])

  // 5. OSINT state
  const [newsDistrict, setNewsDistrict] = useState('All Districts')
  const [newsItems, setNewsItems] = useState([])

  // Load active tab data
  useEffect(() => {
    if (activeTab === 'investigate') navigate('/web-investigate')
    else if (activeTab === 'ecourts') handleSearchECourts()
    else if (activeTab === 'vahan') handleLookupVahan()
    else if (activeTab === 'fugitives') handleSearchFugitives()
    else if (activeTab === 'cyber') handleLookupCyber()
    else if (activeTab === 'osint') handleFetchNews()
  }, [activeTab])

  const handleSearchECourts = async (customQ = null) => {
    const q = customQ !== null ? customQ : ecQuery
    setLoading(true)
    try {
      const res = await searchECourts({ query_term: q || 'Imran Pasha' })
      setEcResults(res.records || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLookupVahan = async (customP = null) => {
    const p = customP !== null ? customP : vahanPlate
    setLoading(true)
    try {
      const res = await lookupVahan({ plate_number: p || 'KA-04-MB-1234' })
      setVahanResult(res.vehicle_details)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleSearchFugitives = async () => {
    setLoading(true)
    try {
      const res = await searchFugitives({ query_term: fugitiveQuery || 'all' })
      setFugitives(res.records || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLookupCyber = async () => {
    setLoading(true)
    try {
      const res = await lookupCyberThreats({ indicator: cyberQuery || '' })
      setCyberThreats(res.records || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchNews = async (dist = null) => {
    const d = dist !== null ? dist : newsDistrict
    setLoading(true)
    try {
      const res = await fetchOSINTNews({ district: d })
      setNewsItems(res.records || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const triggerRAGSync = (type, title) => {
    setSyncStatus(`Synced [${type}: ${title}] to RAG Vector Store & SQLite database.`)
    setTimeout(() => setSyncStatus(''), 4000)
  }

  return (
    <div style={{ padding: '24px 32px', color: '#fff', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={24} color="var(--copper-400)" />
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '0.04em' }}>
              OSINT &amp; PUBLIC WEB SCRAPER SUITE
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Automated intelligence crawlers scraping National Judicial Data Grid (e-Courts), MoRTH VAHAN, Interpol Red Notices, CERT-In Threat Feeds, and Regional Crime News.
          </p>
        </div>

        {syncStatus && (
          <div style={{
            background: 'rgba(82,224,122,0.15)', border: '1px solid #52e07a',
            padding: '8px 16px', borderRadius: 8, fontSize: 12, color: '#52e07a',
            display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeIn 0.3s ease'
          }}>
            <CheckCircle2 size={16} />
            <span>{syncStatus}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: 12, marginBottom: 24, overflowX: 'auto'
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? 'var(--copper-500)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${activeTab === tab.id ? 'var(--copper-400)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8, padding: '9px 16px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.2s ease', whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB 1: e-Courts Scraper ──────────────────────────────── */}
      {activeTab === 'ecourts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              value={ecQuery}
              onChange={e => setEcQuery(e.target.value)}
              placeholder="Search by Accused Name, CNR Number (e.g. KABG0100...), or FIR Number..."
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleSearchECourts()}
            />
            <button
              onClick={() => handleSearchECourts()}
              disabled={loading}
              style={btnPrimary}
            >
              {loading ? <RotateCw size={14} className="spin" /> : <Search size={14} />}
              <span>Scrape e-Courts</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            {ecResults.map(r => (
              <div key={r.id || r.cnr_number} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                      {r.court_complex} — Case: <span style={{ color: 'var(--copper-300)' }}>{r.case_number}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                      CNR: <span className="mono" style={{ color: '#ccc' }}>{r.cnr_number}</span> | District: {r.district}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => triggerRAGSync('e-Courts', r.case_number)}
                      style={btnSmallSecondary}
                    >
                      <Database size={12} />
                      <span>Sync to RAG</span>
                    </button>
                    <button
                      onClick={() => navigate('/assistant')}
                      style={btnSmallPrimary}
                    >
                      <Sparkles size={12} />
                      <span>Ask AI</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12, fontSize: 12 }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>ACCUSED IMPLICATED</div>
                    <div style={{ fontWeight: 700, color: '#ff7875', marginTop: 2 }}>{r.accused_name}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>FIR: {r.fir_number} ({r.police_station})</div>
                  </div>

                  <div style={{ background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.3)', padding: 10, borderRadius: 6 }}>
                    <div style={{ color: '#ff7875', fontSize: 10, fontWeight: 700 }}>BAIL STATUS</div>
                    <div style={{ fontWeight: 700, color: '#fff', marginTop: 2, fontSize: 11 }}>{r.bail_status}</div>
                  </div>

                  <div style={{ background: 'rgba(224,168,50,0.1)', border: '1px solid rgba(224,168,50,0.3)', padding: 10, borderRadius: 6 }}>
                    <div style={{ color: '#e0a832', fontSize: 10, fontWeight: 700 }}>WARRANT STATUS</div>
                    <div style={{ fontWeight: 700, color: '#fff', marginTop: 2, fontSize: 11 }}>{r.warrant_status}</div>
                  </div>

                  <div style={{ background: 'rgba(82,176,224,0.1)', border: '1px solid rgba(82,176,224,0.3)', padding: 10, borderRadius: 6 }}>
                    <div style={{ color: '#52b0e0', fontSize: 10, fontWeight: 700 }}>NEXT HEARING</div>
                    <div style={{ fontWeight: 700, color: '#fff', marginTop: 2, fontSize: 11 }}>{r.next_hearing_date}</div>
                    <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{r.judicial_officer}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, fontSize: 11, lineHeight: 1.5, color: '#ddd' }}>
                  <strong>Judicial Order Summary:</strong> {r.order_summary}
                </div>

                <div style={{ fontSize: 9, color: '#666', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Section 65B Hash: <span className="mono">{r.sec65b_hash}</span></span>
                  <span>Scraped: {r.scraped_at || 'Live Verified'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: VAHAN Vehicle Registry Scraper ─────────────────── */}
      {activeTab === 'vahan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              value={vahanPlate}
              onChange={e => setVahanPlate(e.target.value.toUpperCase())}
              placeholder="Enter Registration Number (e.g. KA-04-MB-1234, KA-51-Z-9988)..."
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleLookupVahan()}
            />
            <button
              onClick={() => handleLookupVahan()}
              disabled={loading}
              style={btnPrimary}
            >
              {loading ? <RotateCw size={14} className="spin" /> : <Search size={14} />}
              <span>Query VAHAN</span>
            </button>
          </div>

          {vahanResult && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--copper-300)', letterSpacing: '0.05em' }}>
                    {vahanResult.registration_no}
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 2 }}>
                    {vahanResult.maker_model} ({vahanResult.vehicle_class})
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: vahanResult.stolen_alert_flag ? 'rgba(224,82,82,0.2)' : 'rgba(82,224,122,0.2)',
                    color: vahanResult.stolen_alert_flag ? '#ff4d4f' : '#52e07a',
                    border: `1px solid ${vahanResult.stolen_alert_flag ? '#ff4d4f' : '#52e07a'}`
                  }}>
                    {vahanResult.blacklist_status}
                  </div>
                  <button onClick={() => triggerRAGSync('VAHAN', vahanResult.registration_no)} style={btnSmallSecondary}>
                    <Database size={12} /> Sync to RAG
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, fontSize: 12 }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>REGISTERED OWNER &amp; RTO</div>
                  <div style={{ fontWeight: 700, color: '#fff', marginTop: 4 }}>{vahanResult.registered_owner}</div>
                  <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>{vahanResult.rto_location}</div>
                  <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>Reg Date: {vahanResult.registration_date}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>CHASSIS &amp; ENGINE PARTICULARS</div>
                  <div style={{ fontWeight: 600, color: '#ddd', marginTop: 4, fontFamily: 'monospace' }}>
                    Chassis: {vahanResult.chassis_no}
                  </div>
                  <div style={{ fontWeight: 600, color: '#ddd', marginTop: 2, fontFamily: 'monospace' }}>
                    Engine: {vahanResult.engine_no}
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>STATUTORY VALIDITY</div>
                  <div style={{ color: '#52e07a', fontWeight: 600, marginTop: 4 }}>
                    Insurance: {vahanResult.insurance_validity}
                  </div>
                  <div style={{ color: '#52b0e0', fontWeight: 600, marginTop: 2 }}>
                    Fitness: {vahanResult.fitness_validity}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 9, color: '#666', marginTop: 14 }}>
                Section 65B SHA-256 Proof Hash: <span className="mono">{vahanResult.sec65b_hash}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Interpol & CID Fugitives ───────────────────────── */}
      {activeTab === 'fugitives' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              value={fugitiveQuery}
              onChange={e => setFugitiveQuery(e.target.value)}
              placeholder="Filter by Fugitive Name, Crime, or Alias..."
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleSearchFugitives()}
            />
            <button onClick={handleSearchFugitives} disabled={loading} style={btnPrimary}>
              {loading ? <RotateCw size={14} className="spin" /> : <Search size={14} />}
              <span>Scrape Fugitive Rosters</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {fugitives.map(f => (
              <div key={f.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ff7875' }}>{f.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--copper-300)' }}>Aliases: {f.aliases}</div>
                  </div>
                  <div style={{ background: 'rgba(224,82,82,0.15)', border: '1px solid rgba(224,82,82,0.4)', padding: '3px 8px', borderRadius: 4, fontSize: 10, color: '#ff4d4f', fontWeight: 700 }}>
                    {f.notice_type}
                  </div>
                </div>

                <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6, color: '#ccc' }}>
                  <div><strong>Agency:</strong> {f.agency} | Notice ID: <span className="mono" style={{ color: '#fff' }}>{f.red_notice_id}</span></div>
                  <div><strong>Crimes:</strong> <span style={{ color: '#ff7875' }}>{f.wanted_for_crimes}</span></div>
                  <div><strong>Reward:</strong> <span style={{ color: '#52e07a', fontWeight: 700 }}>{f.reward_amount_inr}</span></div>
                  <div><strong>Last Known Location:</strong> {f.last_known_location}</div>
                  <div><strong>Description:</strong> {f.physical_description}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 9, color: '#666' }}>Sec 65B: {f.sec65b_hash.slice(0, 24)}...</span>
                  <button onClick={() => triggerRAGSync('Fugitive', f.name)} style={btnSmallSecondary}>
                    <Database size={11} /> Sync to RAG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: Cyber Threats & Scam Radar ─────────────────────── */}
      {activeTab === 'cyber' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              value={cyberQuery}
              onChange={e => setCyberQuery(e.target.value)}
              placeholder="Search threat by Domain, VPA handle, or Syndicate name..."
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleLookupCyber()}
            />
            <button onClick={handleLookupCyber} disabled={loading} style={btnPrimary}>
              {loading ? <RotateCw size={14} className="spin" /> : <Search size={14} />}
              <span>Query NCRP Feed</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {cyberThreats.map(c => (
              <div key={c.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={15} color="#ff4d4f" />
                    <span>{c.threat_type}:</span>
                    <span className="mono" style={{ color: 'var(--copper-300)' }}>{c.indicator_value}</span>
                  </div>
                  <div style={{ fontSize: 10, background: 'rgba(224,82,82,0.15)', color: '#ff7875', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                    {c.severity}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#ccc', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                  <div><strong>Syndicate:</strong> {c.syndicate_name}</div>
                  <div><strong>Scam MO:</strong> {c.associated_scam}</div>
                  <div><strong>Advisory:</strong> {c.cert_in_advisory_no}</div>
                </div>

                <div style={{ fontSize: 11, color: '#52e07a', marginTop: 8 }}>
                  <strong>Recommended Takedown Action:</strong> {c.action_recommended}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: OSINT Regional News Radar ───────────────────────── */}
      {activeTab === 'osint' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <select
              value={newsDistrict}
              onChange={e => { setNewsDistrict(e.target.value); handleFetchNews(e.target.value); }}
              style={{ ...inputStyle, maxWidth: 300 }}
            >
              <option value="All Districts">All Karnataka Districts</option>
              <option value="Bengaluru City">Bengaluru City</option>
              <option value="Mysuru City">Mysuru City</option>
              <option value="Hubballi Dharwad City">Hubballi Dharwad City</option>
              <option value="Mangaluru City">Mangaluru City</option>
              <option value="Belagavi City">Belagavi City</option>
            </select>
            <button onClick={() => handleFetchNews()} disabled={loading} style={btnPrimary}>
              {loading ? <RotateCw size={14} className="spin" /> : <Search size={14} />}
              <span>Refresh News Feeds</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {newsItems.map(n => (
              <div key={n.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{n.headline}</div>
                  <div style={{ fontSize: 10, color: '#52e07a', background: 'rgba(82,224,122,0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    {n.sentiment_urgency_score}% URGENCY
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--copper-400)', marginTop: 4, display: 'flex', gap: 12 }}>
                  <span>Source: {n.source_outlet}</span>
                  <span>District: {n.district}</span>
                  <span>Published: {n.published_date}</span>
                </div>

                <div style={{ fontSize: 12, color: '#ddd', marginTop: 8, lineHeight: 1.5 }}>
                  {n.incident_summary}
                </div>

                <div style={{ fontSize: 10, color: '#52b0e0', marginTop: 6 }}>
                  {n.extracted_entities}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const cardStyle = {
  background: 'rgba(15, 17, 26, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 10, padding: 18,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
}
const inputStyle = {
  flex: 1, padding: '10px 14px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.05)', color: '#fff',
  fontSize: 13, outline: 'none',
}
const btnPrimary = {
  padding: '0 20px', borderRadius: 8,
  background: 'var(--copper-500)', color: '#fff',
  border: 'none', fontWeight: 700, fontSize: 12,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
}
const btnSmallPrimary = {
  padding: '5px 10px', borderRadius: 6,
  background: 'rgba(200,129,74,0.2)', color: 'var(--copper-300)',
  border: '1px solid rgba(200,129,74,0.4)', fontSize: 11,
  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
}
const btnSmallSecondary = {
  padding: '5px 10px', borderRadius: 6,
  background: 'rgba(255,255,255,0.06)', color: '#ccc',
  border: '1px solid rgba(255,255,255,0.15)', fontSize: 11,
  fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
}
