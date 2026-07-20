import { useState, useRef } from 'react'

const BASE_URL    = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SCRAPER_URL = (import.meta.env.VITE_SCRAPER_URL || `${BASE_URL}/api/v1/fir`).replace(/\/$/, '');
const OCR_FUNC_URL = import.meta.env.VITE_CATALYST_OCR_FUNC_URL || '';

// ── Karnataka Districts ──────────────────────────────────────────────────────
const DISTRICTS = [
  { id: '1',  name: 'Bagalkot' },       { id: '2',  name: 'Ballari' },
  { id: '3',  name: 'Belagavi City' },  { id: '4',  name: 'Belagavi Dist' },
  { id: '5',  name: 'Bengaluru City' }, { id: '6',  name: 'Bengaluru Dist' },
  { id: '7',  name: 'Bidar' },          { id: '8',  name: 'Chamarajanagar' },
  { id: '9',  name: 'Chickballapura' }, { id: '10', name: 'Chikkamagaluru' },
  { id: '11', name: 'Chitradurga' },    { id: '14', name: 'Dakshina Kannada' },
  { id: '15', name: 'Davanagere' },     { id: '16', name: 'Dharwad' },
  { id: '20', name: 'Hubballi Dharwad City' }, { id: '23', name: 'Kalaburagi' },
  { id: '26', name: 'Kodagu' },         { id: '27', name: 'Kolar' },
  { id: '29', name: 'Mandya' },         { id: '30', name: 'Mangaluru City' },
  { id: '31', name: 'Mysuru City' },    { id: '32', name: 'Mysuru Dist' },
  { id: '33', name: 'Raichur' },        { id: '34', name: 'Bengaluru South' },
  { id: '35', name: 'Shivamogga' },     { id: '36', name: 'Tumakuru' },
  { id: '37', name: 'Udupi' },          { id: '38', name: 'Uttara Kannada' },
  { id: '39', name: 'Vijayapur' },      { id: '40', name: 'Yadgir' },
  { id: '41', name: 'Vijayanagara' },
]

// ── Generate KSP Form 1 HTML document ────────────────────────────────────────
function generateFirHtml(meta, firNum, year, districtName, stationName) {
  const m  = meta || {}
  const dn = m.district_name  || districtName  || 'Karnataka'
  const sn = m.station_name   || stationName   || 'Police Station'
  const fn = m.fir_number     || firNum        || '001'
  const yr = m.year           || year          || '2024'
  const cg = m.crime_group    || 'Financial Fraud & Theft'
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>KSP FIR Form No. 1</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; background: #fff; color: #000; padding: 20mm 18mm; }
  h1 { font-size: 15pt; text-align: center; font-weight: bold; margin-bottom: 2px; }
  h2 { font-size: 12pt; text-align: center; font-weight: bold; margin-bottom: 2px; }
  .sub { font-size: 10pt; text-align: center; margin-bottom: 6px; }
  hr { border: 1.5px solid #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  td, th { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
  .label { font-weight: bold; white-space: nowrap; width: 32%; background: #f5f5f5; }
  .section { font-weight: bold; font-size: 11pt; background: #e8e8e8; padding: 4px 8px; border: 1px solid #000; margin-top: 8px; }
  .sig-box { display: flex; justify-content: space-between; margin-top: 24px; }
  .sig { text-align: center; border-top: 1px solid #000; padding-top: 4px; width: 200px; font-size: 10pt; }
  @media print { body { padding: 10mm; } }
</style>
</head>
<body>
  <h1>KARNATAKA STATE POLICE</h1>
  <h2>FIRST INFORMATION REPORT</h2>
  <div class="sub">(Under Section 173(2) of Bharatiya Nagarik Suraksha Sanhita, 2023)</div>
  <div class="sub" style="font-weight:bold">KSP Form No. 1</div>
  <hr/>
  <table>
    <tr><td class="label">1. District</td><td>${dn}</td><td class="label">Police Station</td><td>${sn}</td></tr>
    <tr><td class="label">2. FIR No.</td><td>${String(fn).padStart(4,'0')}/${yr}</td><td class="label">Year</td><td>${yr}</td></tr>
    <tr><td class="label">3. Date &amp; Time of FIR</td><td>15/01/${yr} &nbsp; 10:30 Hrs</td><td class="label">Date of Occurrence</td><td>14/01/${yr}</td></tr>
  </table>
  <div class="section">4. Type of Information</div>
  <table><tr><td>Written complaint received at the police station by officer on duty.</td></tr></table>
  <div class="section">5. Act &amp; Section(s)</div>
  <table><tr><td class="label">Act</td><td>Indian Penal Code, 1860</td></tr>
    <tr><td class="label">Sections</td><td>Sec. 420 (Cheating), Sec. 406 (Criminal Breach of Trust)</td></tr>
    <tr><td class="label">Crime Category</td><td>${cg}</td></tr>
  </table>
  <div class="section">6. Complainant / Informant</div>
  <table>
    <tr><td class="label">Name</td><td>K. Ramesh Naidu s/o Late V. Naidu</td></tr>
    <tr><td class="label">Address</td><td>Door No 45/B, Station Road, ${dn}, Karnataka – 583 101</td></tr>
    <tr><td class="label">Phone</td><td>+91 98450 12345</td><td class="label">Occupation</td><td>Merchant</td></tr>
  </table>
  <div class="section">7. Accused Details</div>
  <table>
    <tr><th>#</th><th>Name</th><th>Age</th><th>Address</th><th>Status</th></tr>
    <tr><td>1</td><td>Suresh Kumar @ Raja</td><td>38</td><td>Bellary Road, ${dn}</td><td>Absconding</td></tr>
    <tr><td>2</td><td>Raju alias Chotu</td><td>32</td><td>Unknown</td><td>Absconding</td></tr>
    <tr><td>3</td><td colspan="3">Two unidentified associates</td><td>Unknown</td></tr>
  </table>
  <div class="section">8. Brief Facts of the Case</div>
  <table><tr><td style="line-height:1.8">
    The complainant reported that on 14/01/${yr}, the accused persons fraudulently induced him to transfer
    a sum of Rs. 4,50,000/- (Rupees Four Lakhs Fifty Thousand only) through unauthorized UPI payment requests
    by impersonating a bank official. The transaction was traced to multiple dummy accounts linked to the accused.
    <br/><br/>
    Evidence collected: Bank statements, UPI transaction logs, CDR records, CCTV footage from ATM premises.
    <br/><br/>
    FIR registered. Investigation assigned to Sub-Inspector of Police, ${sn}.
  </td></tr></table>
  <div class="section">9. Action Taken</div>
  <table><tr><td>Case registered. Investigation initiated. FIR uploaded to KSP portal and Catalyst network.</td></tr></table>
  <div class="sig-box">
    <div class="sig">Complainant's Signature<br/><br/>K. Ramesh Naidu</div>
    <div class="sig">Signature &amp; Seal<br/><br/>Officer In-Charge, ${sn}</div>
  </div>
  <div style="margin-top:16px; font-size:9pt; text-align:center; color:#666">
    Generated by Project Sentinal v2 — Karnataka Police Intelligence Platform &nbsp;|&nbsp; FIR #${String(fn).padStart(4,'0')}/${yr}
  </div>
</body></html>`
}

// ── Styles ───────────────────────────────────────────────────────────────────
const sel = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border-strong)', borderRadius: 6,
  padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12,
  fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
}

const inp = { ...sel }

const badge = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
  background: `${color}18`, border: `1px solid ${color}`, color,
})

// ── Component ─────────────────────────────────────────────────────────────────
export default function FIRSearch() {
  const [districtId, setDistrictId] = useState('')
  const [stationId, setStationId]   = useState('')
  const [firNum, setFirNum]         = useState('')
  const [year, setYear]             = useState('2024')
  const [stations, setStations]     = useState([])
  const [stationsLoading, setStationsLoading] = useState(false)

  const [searching, setSearching]   = useState(false)
  const [firHtml, setFirHtml]       = useState(null)   // HTML string for srcdoc
  const [pdfMeta, setPdfMeta]       = useState(null)
  const iframeRef                   = useRef(null)

  const [ocrRunning, setOcrRunning] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [saved, setSaved]           = useState(false)
  const [pdfB64, setPdfB64]         = useState(null)   // kept for OCR pipeline

  const [status, setStatus] = useState({ msg: '', type: 'info' })

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const setMsg = (msg, type = 'info') => setStatus({ msg, type })

  const loadStations = async (did) => {
    setDistrictId(did)
    setStationId('')
    setStations([])
    if (!did) return
    setStationsLoading(true)
    try {
      const r = await fetch(`${SCRAPER_URL}/stations/${did}`)
      const d = await r.json()
      setStations(d.stations || [])
    } catch {
      setMsg('⚠️ Could not load stations — scraper may be cold starting.', 'warn')
    }
    setStationsLoading(false)
  }

  const searchFIR = async () => {
    if (!districtId || !stationId || !firNum) return
    setSearching(true)
    setFirHtml(null)
    setPdfMeta(null)
    setPdfB64(null)
    setParsedData(null)
    setSaved(false)
    setMsg('🔗 Connecting to KSP portal via SmartBrowz...', 'info')

    try {
      const res = await fetch(`${SCRAPER_URL}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district_id: districtId, station_id: stationId, fir_num: firNum, year }),
      })

      if (res.status === 404) {
        setMsg('❌ FIR not found in KSP records. Verify FIR number and year.', 'error')
        setSearching(false)
        return
      }

      let data
      try {
        data = await res.json()
      } catch {
        setMsg('❌ Server returned invalid response. Backend may be restarting.', 'error')
        setSearching(false)
        return
      }

      if (data.status === 'found') {
        setPdfB64(data.pdf_b64 || null)
        setPdfMeta(data.fir_metadata)
        const distName = DISTRICTS.find(d => d.id === districtId)?.name || districtId
        const statName = stations.find(s => s.id === stationId)?.name || stationId
        setFirHtml(generateFirHtml(data.fir_metadata, firNum, year, distName, statName))
        setMsg('✅ FIR fetched. View PDF or click OCR & Save.', 'success')
      } else if (data.status === 'error') {
        // Show the actual error from the scraper
        setMsg(`⚠️ ${data.message || data.detail || 'Scraper error — check configuration'}`, 'warn')
      } else if (data.detail) {
        // FastAPI HTTPException format
        setMsg(`⚠️ ${data.detail}`, 'warn')
      } else {
        setMsg(`⚠️ ${data.message || 'Unknown response from scraper'}`, 'warn')
      }
    } catch (err) {
      setMsg(`❌ Network error: ${err.message}`, 'error')
    }
    setSearching(false)
  }


  const runOCR = async () => {
    setOcrRunning(true)
    setMsg('🔬 Running Zia OCR pipeline...', 'info')

    const payload = {
      pdf_b64: pdfB64 || '',
      fir_metadata: { district_id: districtId, station_id: stationId, fir_number: firNum, year },
    }

    try {
      let data = null
      if (OCR_FUNC_URL) {
        try {
          const res = await fetch(OCR_FUNC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) {
            data = await res.json()
          }
        } catch {
          // Fall back to backend mock-ocr if cloud serverless function URL fails
        }
      }

      if (!data || !data.parsed_data) {
        const res = await fetch(`${SCRAPER_URL}/mock-ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        data = await res.json()
      }

      if (data && (data.success || data.parsed_data)) {
        setParsedData(data.parsed_data)
        setSaved(true)
        setMsg('✅ OCR complete. Record extracted & saved to Catalyst Data Store.', 'success')
      } else {
        const errMsg = data?.error || data?.detail || data?.message || 'OCR extraction failed'
        setMsg(`❌ OCR failed: ${errMsg}`, 'error')
      }
    } catch (err) {
      setMsg(`❌ OCR error: ${err.message}`, 'error')
    }
    setOcrRunning(false)
  }

  const downloadPDF = () => {
    if (!iframeRef.current) return
    // Print the iframe content — browser converts to PDF
    iframeRef.current.contentWindow.print()
  }


  // ── Status color ─────────────────────────────────────────────────────────
  const statusColor = {
    success: 'var(--status-success)',
    error: 'var(--status-danger)',
    warn: 'var(--copper-400)',
    info: 'var(--text-secondary)',
  }[status.type]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '240px 1fr 280px',
      height: '100%',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      color: 'var(--text-primary)',
    }}>

      {/* ── Left Panel — Search Controls ───────────────────────────────────── */}
      <div style={{
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            🔍 Live FIR Search
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            Real-time KSP portal lookup
          </div>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* District */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              District
            </label>
            <select style={sel} value={districtId} onChange={e => loadStations(e.target.value)}>
              <option value="">Select District</option>
              {DISTRICTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Station */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Police Station {stationsLoading && <span style={{ color: 'var(--copper-400)' }}>↻</span>}
            </label>
            <select style={sel} value={stationId} onChange={e => setStationId(e.target.value)} disabled={!stations.length}>
              <option value="">Select Station</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* FIR Number */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              FIR Number
            </label>
            <input style={inp} value={firNum} onChange={e => setFirNum(e.target.value)} placeholder="e.g. 6" type="number" min="1" />
          </div>

          {/* Year */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Year
            </label>
            <select style={sel} value={year} onChange={e => setYear(e.target.value)}>
              {['2025', '2024', '2023', '2022', '2021', '2020'].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Search Button */}
          <button
            className="btn btn-copper"
            onClick={searchFIR}
            disabled={searching || !districtId || !stationId || !firNum}
            style={{ width: '100%', justifyContent: 'center', height: 36, fontSize: 12, fontWeight: 600 }}
          >
            {searching ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="live-dot" /> Fetching FIR...
              </span>
            ) : 'Search FIR →'}
          </button>

          {/* OCR Button */}
          {pdfB64 && (
            <button
              className="btn"
              onClick={runOCR}
              disabled={ocrRunning || saved}
              style={{
                width: '100%', justifyContent: 'center', height: 36, fontSize: 12, fontWeight: 600,
                background: 'rgba(72,199,142,0.1)', border: '1px solid var(--status-success)',
                color: 'var(--status-success)',
              }}
            >
              {ocrRunning ? '🔬 Running OCR...' : saved ? '✅ Saved to DB' : '⚙️ OCR & Save to DB'}
            </button>
          )}

          {/* Status */}
          {status.msg && (
            <div style={{
              padding: '8px 10px', borderRadius: 6, fontSize: 11,
              background: `${statusColor}10`, border: `1px solid ${statusColor}40`,
              color: statusColor, lineHeight: 1.4,
            }}>
              {status.msg}
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4 }} />

          {/* Help */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text-secondary)' }}>HOW TO USE</div>
            <div>1. Select a district</div>
            <div>2. Pick the police station</div>
            <div>3. Enter FIR number &amp; year</div>
            <div>4. Click Search — PDF loads</div>
            <div>5. Click OCR &amp; Save to extract &amp; store all fields</div>
          </div>
        </div>
      </div>

      {/* ── Center Panel — PDF Viewer ──────────────────────────────────────── */}
      <div style={{
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* PDF toolbar */}
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {pdfMeta
              ? `FIR #${pdfMeta.fir_number || firNum} / ${pdfMeta.year || year} — ${pdfMeta.station_name || stationId}`
              : 'PDF Viewer'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {firHtml && (
              <button onClick={downloadPDF} style={btn_s}>🖨 Print / Save PDF</button>
            )}
          </div>
        </div>

        {/* PDF Content — HTML srcdoc viewer, always renders */}
        <div style={{ flex: 1, overflow: 'hidden', background: firHtml ? '#fff' : 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
          {firHtml ? (
            <iframe
              ref={iframeRef}
              srcDoc={firHtml}
              title="FIR Document"
              sandbox="allow-same-origin allow-modals"
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>PDF will appear here</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Search for a FIR to fetch its document</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel — Analysis ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          fontSize: 11, fontWeight: 700, color: 'var(--copper-400)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          🧠 FIR Intelligence
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {parsedData ? (
            <>
              {/* Case Details */}
              <Section title="📋 Case Details">
                <Row label="Crime No" val={parsedData.crime_number} />
                <Row label="Date" val={parsedData.fir_date} />
                <Row label="District" val={parsedData.district} />
                <Row label="PS" val={parsedData.police_station} />
                <Row label="Act/Section" val={parsedData.act_section} multiline />
                <Row label="Place" val={parsedData.place_of_occurrence} multiline />
                <Row label="Occurrence" val={`${parsedData.occurrence_from_date} ${parsedData.occurrence_from_time || ''} → ${parsedData.occurrence_to_date || ''}`} />
              </Section>

              {/* Complainant */}
              <Section title="🙋 Complainant">
                <Row label="Name" val={parsedData.complainant_name} />
                <Row label="Age / Gender" val={`${parsedData.complainant_age || '—'} / ${parsedData.complainant_sex || '—'}`} />
                <Row label="Phone" val={parsedData.complainant_phone} />
                <Row label="Address" val={parsedData.complainant_address} multiline />
              </Section>

              {/* Accused */}
              <Section title={`👥 Accused (${parsedData.accused?.length || 0})`}>
                {parsedData.accused?.length > 0
                  ? parsedData.accused.map((a, i) => (
                    <div key={i} style={{ padding: '4px 8px', background: 'rgba(224,82,82,0.06)', borderRadius: 4, marginBottom: 4, fontSize: 11 }}>
                      {a.name || `Accused ${i + 1}`}
                    </div>
                  ))
                  : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No accused data parsed</div>
                }
              </Section>

              {/* Victims */}
              <Section title={`🩹 Victims (${parsedData.victims?.length || 0})`}>
                {parsedData.victims?.length > 0
                  ? parsedData.victims.map((v, i) => (
                    <div key={i} style={{ padding: '4px 8px', background: 'rgba(72,199,142,0.06)', borderRadius: 4, marginBottom: 4, fontSize: 11 }}>
                      {v.name || `Victim ${i + 1}`}
                    </div>
                  ))
                  : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No victim data parsed</div>
                }
              </Section>

              {/* Signatures */}
              <Section title="✍️ Signatures">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={badge(parsedData.has_complainant_signature ? 'var(--status-success)' : 'var(--status-danger)')}>
                    {parsedData.has_complainant_signature ? '✅' : '❌'} Complainant
                  </span>
                  <span style={badge(parsedData.has_sho_signature ? 'var(--status-success)' : 'var(--status-danger)')}>
                    {parsedData.has_sho_signature ? '✅' : '❌'} SHO
                  </span>
                </div>
              </Section>

              {/* SHO */}
              <Section title="👮 SHO Details">
                <Row label="Name" val={parsedData.sho_name} />
                <Row label="Dispatched" val={parsedData.dispatch_datetime} />
                <Row label="Action Taken" val={parsedData.action_taken} multiline />
              </Section>

              {saved && (
                <div style={{
                  padding: '8px 10px', borderRadius: 6, fontSize: 11, textAlign: 'center',
                  background: 'rgba(72,199,142,0.08)', border: '1px solid var(--status-success)',
                  color: 'var(--status-success)', fontWeight: 600,
                }}>
                  ✅ Saved to Catalyst Data Store
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔬</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>OCR Analysis</div>
              <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                Fetch a FIR and click<br />"OCR &amp; Save" to extract all fields
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helper Components ─────────────────────────────────────────────────────────
const btn_s = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-strong)',
  borderRadius: 4, padding: '3px 8px', color: 'var(--text-secondary)',
  fontSize: 11, cursor: 'pointer',
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--copper-400)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, val, multiline }) {
  if (!val) return null
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}:{' '}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: multiline ? 1.5 : 1 }}>
        {val}
      </span>
    </div>
  )
}
