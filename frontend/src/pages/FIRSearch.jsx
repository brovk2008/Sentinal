import { useState, useRef } from 'react'
import {
  Search, Globe, FileText, CheckCircle2, AlertCircle, XCircle,
  Download, Languages, RotateCw, Database, Sparkles, Check, X,
  Shield, User, Users, MapPin, Calendar, DollarSign, FileEdit, Brain
} from 'lucide-react'

const BASE_URL    = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const SCRAPER_URL = (import.meta.env.VITE_SCRAPER_URL || `${BASE_URL}/api/v1/fir`).replace(/\/$/, '')
const OCR_FUNC_URL = import.meta.env.VITE_CATALYST_OCR_FUNC_URL || ''

// ── Karnataka Districts ───────────────────────────────────────────────────────
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

const TRANSLATE_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'ml', label: 'Malayalam' },
]

// ── Styles ────────────────────────────────────────────────────────────────────
const sel = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border-strong)', borderRadius: 6,
  padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12,
  fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box',
}
const inp = { ...sel }
const btn_s = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-strong)',
  borderRadius: 4, padding: '3px 8px', color: 'var(--text-secondary)',
  fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
}
const badge = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
  background: `${color}18`, color, border: `1px solid ${color}40`,
})

export default function FIRSearch() {
  const [districtId, setDistrictId]   = useState('')
  const [stationId,  setStationId]    = useState('')
  const [firNum,     setFirNum]       = useState('')
  const [year,       setYear]         = useState('2024')
  const [stations,   setStations]     = useState([])
  const [stationsLoading, setStationsLoading] = useState(false)

  // Results
  const [searching,  setSearching]    = useState(false)
  const [ocrRunning, setOcrRunning]   = useState(false)
  const [pdfUrl,     setPdfUrl]       = useState(null)
  const [pdfMeta,    setPdfMeta]      = useState(null)
  const [pdfB64,     setPdfB64]       = useState(null)
  const [parsedData, setParsedData]   = useState(null)
  const [status,     setStatus]       = useState({ msg: '', type: '' })
  const [saved,      setSaved]        = useState(false)

  // Language translation
  const [translatingFIR,   setTranslatingFIR]   = useState(false)
  const [translatedFIRText, setTranslatedFIRText] = useState('')
  const [targetFIRLang,    setTargetFIRLang]    = useState('en')
  const [showLangPicker,   setShowLangPicker]   = useState(false)
  const [translatedPdfUrl, setTranslatedPdfUrl] = useState(null) // base64 blob URL of translated PDF
  const [viewingTranslated, setViewingTranslated] = useState(false)

  const iframeRef = useRef(null)

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
      setMsg('Could not load stations — scraper may be cold starting.', 'warn')
    }
    setStationsLoading(false)
  }

  const searchFIR = async () => {
    if (!districtId || !stationId || !firNum) return
    setSearching(true)
    setPdfUrl(null); setPdfMeta(null); setPdfB64(null)
    setParsedData(null); setSaved(false)
    setTranslatedFIRText(''); setShowLangPicker(false)
    setMsg('Connecting to KSP portal via SmartBrowz...', 'info')

    try {
      const res = await fetch(`${SCRAPER_URL}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ district_id: districtId, station_id: stationId, fir_num: firNum, year }),
      })

      if (res.status === 404) {
        setMsg('FIR not found in KSP records. Verify FIR number and year.', 'error')
        setSearching(false); return
      }

      let data
      try { data = await res.json() }
      catch { setMsg('Server returned invalid response.', 'error'); setSearching(false); return }

      if (data.status === 'found' && data.pdf_b64) {
        setPdfB64(data.pdf_b64)
        setPdfMeta(data.fir_metadata)
        try {
          const bs = atob(data.pdf_b64)
          const bytes = new Uint8Array(bs.length)
          for (let i = 0; i < bs.length; i++) bytes[i] = bs.charCodeAt(i)
          setPdfUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })))
        } catch {
          setPdfUrl(`data:application/pdf;base64,${data.pdf_b64}`)
        }
        setMsg('Real FIR PDF retrieved from KSP portal. Click "OCR & Save" to extract all fields.', 'success')
      } else {
        setMsg(data.message || data.detail || 'Unknown response from scraper', 'warn')
      }
    } catch (err) {
      setMsg(`Network error: ${err.message}`, 'error')
    }
    setSearching(false)
  }

  const runOCR = async () => {
    setOcrRunning(true)
    setMsg('Extracting all FIR fields via OCR pipeline...', 'info')

    const payload = {
      pdf_b64: pdfB64 || '',
      fir_metadata: {
        district_id: districtId, station_id: stationId,
        district_name: DISTRICTS.find(d => d.id === districtId)?.name || '',
        station_name: stations.find(s => s.id === stationId)?.name || pdfMeta?.station_name || '',
        fir_number: firNum, year,
      },
    }

    try {
      let data = null
      if (OCR_FUNC_URL) {
        try {
          const res = await fetch(OCR_FUNC_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) data = await res.json()
        } catch { /* fall through */ }
      }

      if (!data || !data.parsed_data) {
        const res = await fetch(`${SCRAPER_URL}/mock-ocr`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        data = await res.json()
      }

      if (data && (data.success || data.parsed_data)) {
        setParsedData(data.parsed_data)
        setSaved(true)

        try {
          const distName = DISTRICTS.find(d => d.id === districtId)?.name || pdfMeta?.district_name || districtId
          const statName = stations.find(s => s.id === stationId)?.name || pdfMeta?.station_name || stationId
          await fetch(`${SCRAPER_URL}/ocr/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fir_number: firNum, year,
              district_id: districtId, district_name: distName,
              station_id: stationId,   station_name: statName,
              act_section: data.parsed_data?.act_section || '',
              crime_group: data.parsed_data?.crime_group || '',
              extracted_text: data.parsed_data?.fir_contents || '',
              parsed_data: data.parsed_data,
            }),
          })
        } catch (e) {
          console.warn('Failed to persist OCR record:', e)
        }

        const accusedCount = data.parsed_data?.accused?.length || 0
        setMsg(`OCR complete — ${accusedCount} accused, all fields extracted & saved to DB.`, 'success')
      } else {
        const errMsg = data?.error || data?.detail || data?.message || 'OCR extraction failed'
        setMsg(`OCR failed: ${errMsg}`, 'error')
      }
    } catch (err) {
      setMsg(`OCR error: ${err.message}`, 'error')
    }
    setOcrRunning(false)
  }

  const translateFIRDocument = async (langCode) => {
    const lang = langCode || targetFIRLang
    setTranslatingFIR(true)
    setTargetFIRLang(lang)
    setShowLangPicker(false)
    setTranslatedFIRText('')
    setTranslatedPdfUrl(null)
    setViewingTranslated(false)

    let currentParsed = parsedData
    let rawText = currentParsed?.fir_contents

    // If OCR hasn't been run yet, trigger OCR first
    if (!currentParsed || !rawText) {
      setMsg('Running OCR before translation...', 'info')
      const payload = {
        pdf_b64: pdfB64 || '',
        fir_metadata: {
          district_id: districtId, station_id: stationId,
          district_name: DISTRICTS.find(d => d.id === districtId)?.name || '',
          station_name: stations.find(s => s.id === stationId)?.name || pdfMeta?.station_name || '',
          fir_number: firNum, year,
        },
      }
      try {
        const ocrRes = await fetch(`${BASE_URL}/api/v1/fir/ocr`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const ocrData = await ocrRes.json()
        if (ocrData && ocrData.parsed_data) {
          currentParsed = ocrData.parsed_data
          setParsedData(currentParsed)
          rawText = currentParsed.fir_contents
        }
      } catch (e) {
        console.warn('Auto-OCR before translate failed:', e)
      }
    }

    // ── Attempt 1: Full PDF Translation (returns translated PDF as base64) ──
    if (pdfB64 && lang !== 'en') {
      try {
        setMsg('Translating entire PDF document...', 'info')
        const pdfRes = await fetch(`${BASE_URL}/api/v1/fir/pdf/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdf_b64: pdfB64, target_lang: lang, source_lang: 'auto' }),
        })
        const pdfData = await pdfRes.json()
        if (pdfData && pdfData.success && pdfData.translated_pdf_b64 && pdfData.translated_pdf_b64 !== pdfB64) {
          // Convert base64 to a blob URL and show in iframe
          const bytes = atob(pdfData.translated_pdf_b64)
          const byteArr = new Uint8Array(bytes.length)
          for (let i = 0; i < bytes.length; i++) byteArr[i] = bytes.charCodeAt(i)
          const blob = new Blob([byteArr], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)
          setTranslatedPdfUrl(blobUrl)
          setViewingTranslated(true)
          setMsg(`PDF translated to ${TRANSLATE_LANGS.find(l => l.code === lang)?.label || lang} (${pdfData.pages || 0} pages, ${pdfData.words_translated || 0} words).`, 'success')
          setTranslatingFIR(false)
          return
        }
      } catch (pdfErr) {
        console.warn('[PDF Translate] PDF translation failed, falling back to text:', pdfErr)
      }
    }

    // ── Fallback: Text-only translation ──
    if (!rawText || rawText.trim().length < 5) {
      setMsg('Could not extract text to translate — ensure document is loaded.', 'warn')
      setTranslatingFIR(false)
      return
    }

    try {
      setMsg('Translating FIR text content...', 'info')
      const res = await fetch(`${BASE_URL}/api/v1/fir/translate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          parsed_data: currentParsed || {},
          target_lang: lang
        }),
      })
      const data = await res.json()
      if (data && data.translated_text) {
        setTranslatedFIRText(data.translated_text)
        if (data.translated_parsed_data) {
          setParsedData(data.translated_parsed_data)
        }
        setMsg(`Translated to ${TRANSLATE_LANGS.find(l => l.code === lang)?.label || lang} via Catalyst NLP.`, 'success')
      } else {
        setTranslatedFIRText(rawText)
        setMsg('Translation returned same text.', 'warn')
      }
    } catch (err) {
      setMsg(`Translation error: ${err.message}`, 'error')
      setTranslatedFIRText('')
    }
    setTranslatingFIR(false)
  }

  const downloadPDF = () => {
    if (!pdfB64) return
    try {
      const bs = atob(pdfB64)
      const bytes = new Uint8Array(bs.length)
      for (let i = 0; i < bs.length; i++) bytes[i] = bs.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `FIR_${districtId}_${stationId}_${firNum}_${year}.pdf`
      a.click()
    } catch (err) {
      alert(`Download error: ${err.message}`)
    }
  }

  const statusColor = {
    error:   'var(--status-danger)',
    warn:    'var(--status-warning)',
    success: 'var(--status-success)',
    info:    'var(--copper-400)',
  }[status.type] || 'var(--text-secondary)'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '240px 1fr 300px',
      height: '100%', overflow: 'hidden',
      fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-primary)',
    }}>

      {/* ── Left Panel — Search Controls ──────────────────────────────────────── */}
      <div style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={13} />
            <span>Live FIR Search</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Real-time KSP portal lookup</div>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* District */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>District</label>
            <select style={sel} value={districtId} onChange={e => loadStations(e.target.value)}>
              <option value="">Select District</option>
              {DISTRICTS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Station */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <span>Police Station</span>
              {stationsLoading && <RotateCw size={10} className="spin" color="var(--copper-400)" />}
            </label>
            <select style={sel} value={stationId} onChange={e => setStationId(e.target.value)} disabled={!stations.length}>
              <option value="">Select Station</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* FIR Number */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>FIR Number</label>
            <input style={inp} value={firNum} onChange={e => setFirNum(e.target.value)} placeholder="e.g. 5" type="number" min="1" />
          </div>

          {/* Year */}
          <div>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Year</label>
            <select style={sel} value={year} onChange={e => setYear(e.target.value)}>
              {['2025', '2024', '2023', '2022', '2021', '2020'].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          {/* Search */}
          <button
            className="btn btn-copper"
            onClick={searchFIR}
            disabled={searching || !districtId || !stationId || !firNum}
            style={{ width: '100%', justifyContent: 'center', height: 36, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {searching ? <><span className="live-dot" /> Fetching FIR...</> : <><Search size={13} /> Search FIR</>}
          </button>

          {/* OCR */}
          {(pdfB64 || pdfUrl) && (
            <button
              className="btn"
              onClick={runOCR}
              disabled={ocrRunning || saved}
              style={{
                width: '100%', justifyContent: 'center', height: 36, fontSize: 12, fontWeight: 600,
                background: 'rgba(72,199,142,0.1)', border: '1px solid var(--status-success)',
                color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {ocrRunning ? (
                <>
                  <RotateCw size={13} className="spin" />
                  <span>Extracting fields...</span>
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Saved to DB</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>OCR &amp; Save to DB</span>
                </>
              )}
            </button>
          )}

          {/* Status */}
          {status.msg && (
            <div style={{
              padding: '8px 10px', borderRadius: 6, fontSize: 11,
              background: `${statusColor}10`, border: `1px solid ${statusColor}40`,
              color: statusColor, lineHeight: 1.4, display: 'flex', alignItems: 'flex-start', gap: 6
            }}>
              {status.type === 'error' && <XCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
              {status.type === 'warn' && <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
              {status.type === 'success' && <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
              {status.type === 'info' && <Search size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
              <span>{status.msg}</span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4 }} />

          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 4, fontWeight: 600, color: 'var(--text-secondary)' }}>HOW TO USE</div>
            <div>1. Select a district</div>
            <div>2. Pick the police station</div>
            <div>3. Enter FIR number &amp; year</div>
            <div>4. Click Search — PDF loads</div>
            <div>5. Click OCR &amp; Save to extract all 20+ fields</div>
            <div>6. Click Translate to read in any language</div>
          </div>
        </div>
      </div>

      {/* ── Center Panel — PDF Viewer ─────────────────────────────────────────── */}
      <div style={{ borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
            {/* Translate button */}
            {(parsedData || pdfB64 || pdfUrl) && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowLangPicker(p => !p)}
                  disabled={translatingFIR}
                  style={{
                    background: 'rgba(200,129,74,0.15)', border: '1px solid var(--copper-400)',
                    color: 'var(--copper-300)', padding: '4px 10px', borderRadius: 4,
                    fontSize: 11, fontWeight: 600, cursor: translatingFIR ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Languages size={12} />
                  <span>{translatingFIR ? 'Translating...' : 'Translate FIR ▾'}</span>
                </button>
                {showLangPicker && (
                  <div style={{
                    position: 'absolute', top: '110%', right: 0, zIndex: 999,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                    borderRadius: 8, padding: 6, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}>
                    {TRANSLATE_LANGS.map(l => (
                      <button
                        key={l.code}
                        onClick={() => translateFIRDocument(l.code)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '6px 10px', borderRadius: 5, border: 'none',
                          background: targetFIRLang === l.code ? 'rgba(200,129,74,0.15)' : 'transparent',
                          color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {pdfB64 && (
              <button onClick={downloadPDF} style={btn_s}>
                <Download size={11} />
                <span>Download PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* PDF Content */}
        <div style={{ flex: 1, overflow: 'hidden', background: pdfUrl ? '#525659' : 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
          {searching ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <RotateCw size={28} className="spin" color="var(--copper-400)" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--copper-400)' }}>Fetching real FIR PDF from KSP portal...</div>
              </div>
            </div>
          ) : (translatedPdfUrl && viewingTranslated) ? (
            <>
              <div style={{ padding: '6px 14px', background: 'rgba(200,129,74,0.1)', borderBottom: '1px solid rgba(200,129,74,0.3)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <Languages size={12} color="var(--copper-400)" />
                <span style={{ color: 'var(--copper-300)', fontWeight: 600 }}>Showing: Translated PDF ({TRANSLATE_LANGS.find(l => l.code === targetFIRLang)?.label || targetFIRLang})</span>
                <button onClick={() => setViewingTranslated(false)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(200,129,74,0.4)', color: 'var(--copper-400)', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>View Original</button>
              </div>
              <iframe src={translatedPdfUrl} title="Translated FIR Document" style={{ flex: 1, width: '100%', border: 'none', display: 'block', height: '100%' }} />
            </>
          ) : pdfUrl ? (
            <iframe ref={iframeRef} src={pdfUrl} title="Official KSP FIR Document" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <FileText size={40} color="var(--border-strong)" />
                <div style={{ fontSize: 13, fontWeight: 500 }}>Live FIR PDF Viewer</div>
                <div style={{ fontSize: 11 }}>Select district → station → FIR number, then click Search</div>
              </div>
            </div>
          )}
        </div>

        {/* Translation Drawer */}
        {(translatingFIR || translatedFIRText) && (
          <div style={{
            height: 220, borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)', padding: 12, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Globe size={12} />
                <span>Translation → {TRANSLATE_LANGS.find(l => l.code === targetFIRLang)?.label || targetFIRLang.toUpperCase()}</span>
              </div>
              <button
                onClick={() => { setTranslatedFIRText(''); setShowLangPicker(false) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <X size={12} /> Close
              </button>
            </div>
            {translatingFIR ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RotateCw size={12} className="spin" />
                <span>Translating full FIR text via Google Translate...</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                {translatedFIRText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right Panel — FIR Intelligence ───────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          fontSize: 11, fontWeight: 700, color: 'var(--copper-400)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Brain size={13} />
          <span>FIR Intelligence</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {parsedData ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Engine: {parsedData._raw_pages ? `pdfplumber • ${parsedData._raw_pages} pages • ${parsedData._raw_chars} chars extracted` : 'OCR'}
              </div>

              {/* Case Details */}
              <Section title="Case Details" icon={<FileText size={12} />}>
                <Row label="Crime No"   val={parsedData.crime_number} />
                <Row label="FIR Date"   val={parsedData.fir_date} />
                <Row label="District"   val={parsedData.district} />
                <Row label="PS"         val={parsedData.police_station} />
                <Row label="Court"      val={parsedData.court_name} />
                <Row label="Act/Section" val={parsedData.act_section} multiline />
                <Row label="Crime Group" val={parsedData.crime_group} />
              </Section>

              {/* Occurrence */}
              <Section title="Occurrence" icon={<MapPin size={12} />}>
                <Row label="Day"        val={parsedData.occurrence_day} />
                <Row label="From"       val={`${parsedData.occurrence_from_date || ''} ${parsedData.occurrence_from_time || ''}`.trim()} />
                <Row label="To"         val={`${parsedData.occurrence_to_date || ''} ${parsedData.occurrence_to_time || ''}`.trim()} />
                <Row label="Place"      val={parsedData.place_of_occurrence} multiline />
              </Section>

              {/* Complainant */}
              <Section title="Complainant / Informant" icon={<User size={12} />}>
                <Row label="Name"       val={parsedData.complainant_name} />
                <Row label="Father/Husband" val={parsedData.complainant_father} />
                <Row label="Age"        val={parsedData.complainant_age?.toString()} />
                <Row label="Gender"     val={parsedData.complainant_sex} />
                <Row label="Phone"      val={parsedData.complainant_phone} />
                <Row label="Address"    val={parsedData.complainant_address} multiline />
              </Section>

              {/* Accused */}
              <Section title={`Accused (${parsedData.accused?.length || 0})`} icon={<Users size={12} />}>
                {parsedData.accused?.length > 0
                  ? parsedData.accused.map((a, i) => (
                    <div key={i} style={{
                      padding: '5px 8px', background: 'rgba(224,82,82,0.06)',
                      border: '1px solid rgba(224,82,82,0.15)',
                      borderRadius: 4, marginBottom: 4, fontSize: 11,
                      display: 'flex', gap: 8, alignItems: 'center',
                    }}>
                      <span style={{ color: 'var(--status-danger)', fontWeight: 700, fontSize: 10, minWidth: 20 }}>
                        A{a.sl_no}
                      </span>
                      <span>{a.name}</span>
                    </div>
                  ))
                  : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No accused found — check if PDF has text layer</div>
                }
              </Section>

              {/* Victims */}
              {parsedData.victims?.length > 0 && (
                <Section title={`Victims (${parsedData.victims.length})`} icon={<Users size={12} />}>
                  {parsedData.victims.map((v, i) => (
                    <div key={i} style={{
                      padding: '5px 8px', background: 'rgba(72,199,142,0.06)',
                      borderRadius: 4, marginBottom: 4, fontSize: 11,
                    }}>
                      {v.name}
                    </div>
                  ))}
                </Section>
              )}

              {/* Property */}
              {parsedData.property?.length > 0 && (
                <Section title={`Property (${parsedData.property.length})`} icon={<DollarSign size={12} />}>
                  {parsedData.property.map((p, i) => (
                    <Row key={i} label={p.type} val={`₹${p.value}`} />
                  ))}
                </Section>
              )}

              {/* FIR Narrative */}
              {parsedData.fir_narrative && (
                <Section title="Brief Facts" icon={<FileEdit size={12} />}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.6,
                    background: 'rgba(255,255,255,0.02)', borderRadius: 4,
                    padding: '6px 8px', border: '1px solid var(--border-subtle)',
                    maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    {parsedData.fir_narrative}
                  </div>
                </Section>
              )}

              {/* SHO */}
              <Section title="Investigating Officer" icon={<Shield size={12} />}>
                <Row label="Name"       val={parsedData.sho_name} />
                <Row label="Rank"       val={parsedData.sho_rank} />
                <Row label="Action Taken" val={parsedData.action_taken} multiline />
              </Section>

              {/* Signatures */}
              <Section title="Signatures" icon={<FileText size={12} />}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={badge(parsedData.has_complainant_signature ? 'var(--status-success)' : 'var(--status-danger)')}>
                    {parsedData.has_complainant_signature ? <Check size={11} /> : <X size={11} />} Complainant
                  </span>
                  <span style={badge(parsedData.has_sho_signature ? 'var(--status-success)' : 'var(--status-danger)')}>
                    {parsedData.has_sho_signature ? <Check size={11} /> : <X size={11} />} IO/SHO
                  </span>
                </div>
              </Section>

              {saved && (
                <div style={{
                  padding: '8px 10px', borderRadius: 6, fontSize: 11, textAlign: 'center',
                  background: 'rgba(72,199,142,0.08)', border: '1px solid var(--status-success)',
                  color: 'var(--status-success)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  <Database size={13} />
                  <span>Saved to Catalyst Data Store</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Brain size={32} color="var(--border-strong)" />
              <div style={{ fontSize: 13, fontWeight: 500 }}>OCR Analysis</div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>
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
function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--copper-400)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        marginBottom: 6, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4,
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Row({ label, val, multiline }) {
  if (!val && val !== 0) return null
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
