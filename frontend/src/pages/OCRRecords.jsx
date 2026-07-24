import { useState, useEffect } from 'react'
import Icon from '../components/Icons'

const BASE_URL    = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SCRAPER_URL = (import.meta.env.VITE_SCRAPER_URL || `${BASE_URL}/api/v1/fir`).replace(/\/$/, '');

export default function OCRRecords() {
  const [records, setRecords]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)

  const [translating, setTranslating]     = useState(false)
  const [targetLang, setTargetLang]       = useState('en')
  const [translatedText, setTranslatedText] = useState('')

  const LANGS = [
    { code: 'en', name: 'English' },
    { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
    { code: 'hi', name: 'Hindi (हिंदी)' },
    { code: 'ta', name: 'Tamil (தமிழ்)' },
    { code: 'te', name: 'Telugu (తెలుగు)' },
    { code: 'ur', name: 'Urdu (اردو)' },
  ]

  const loadRecords = async () => {
    setLoading(true)
    try {
      const qStr = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
      const res = await fetch(`${SCRAPER_URL}/ocr/records${qStr}`)
      const data = await res.json()
      if (data && data.records) {
        setRecords(data.records)
      }
    } catch (err) {
      console.error('Failed to load OCR records:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRecords()
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadRecords()
  }

  const handleTranslateRecord = async (rec, langCode) => {
    setTranslating(true)
    setTargetLang(langCode)
    const textToTranslate = rec.extracted_text || JSON.stringify(rec.parsed_data || {}, null, 2)
    
    try {
      const res = await fetch(`${SCRAPER_URL}/ocr/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, target_lang: langCode }),
      })
      const data = await res.json()
      if (data && data.translated_text) {
        setTranslatedText(data.translated_text)
      } else {
        setTranslatedText(`[${langCode.toUpperCase()}] ${textToTranslate}`)
      }
    } catch {
      setTranslatedText(`[${langCode.toUpperCase()}] ${textToTranslate}`)
    }
    setTranslating(false)
  }

  return (
    <div style={{
      padding: 24, height: '100%', overflowY: 'auto',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 20
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              📄 Stored OCR Intelligence Records
            </h2>
            <span className="badge badge-warning" style={{ fontSize: 10 }}>
              ACCOUNT STORE
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Account-wide repository of extracted FIR OCR data, suspect lists, legal sections, and Catalyst NLP translations.
          </p>
        </div>

        <button
          onClick={loadRecords}
          className="btn btn-outline"
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          🔄 Refresh Records
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          className="input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by FIR Number, Station, District, Accused Name, or IPC Section..."
          style={{ flex: 1, fontSize: 13, padding: '8px 14px' }}
        />
        <button type="submit" className="btn btn-copper" style={{ padding: '8px 16px', fontSize: 12 }}>
          Search Records
        </button>
      </form>

      {/* Records Table / List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading stored OCR records...
        </div>
      ) : records.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)', borderRadius: 8, color: 'var(--text-muted)'
        }}>
          No OCR records found in the account repository. Go to <b>Live FIR Search</b> to run OCR on any FIR PDF.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {records.map(rec => {
            const pData = rec.parsed_data || {}
            const accusedList = pData.accused || []
            
            return (
              <div
                key={rec.id}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
                  borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column',
                  gap: 10, position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--copper-400)' }}>
                      FIR No. {rec.fir_number}/{rec.year}
                    </span>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {rec.station_name || 'Police Station'} · {rec.district_name || 'District'}
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: 9 }}>
                    STORED
                  </span>
                </div>

                {rec.act_section && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 4 }}>
                    <b style={{ color: 'var(--copper-300)' }}>Act / Sections:</b> {rec.act_section}
                  </div>
                )}

                {accusedList.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <b style={{ color: 'var(--text-primary)' }}>Accused Suspects ({accusedList.length}):</b>{' '}
                    {accusedList.map(a => a.name || a.AccusedName).join(', ')}
                  </div>
                )}

                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)',
                  padding: 8, borderRadius: 4, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {rec.extracted_text || 'No raw text stored.'}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      setSelectedRecord(rec)
                      setTranslatedText('')
                    }}
                    className="btn btn-outline"
                    style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  >
                    🔍 View Full Details
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRecord(rec)
                      handleTranslateRecord(rec, 'en')
                    }}
                    className="btn btn-copper"
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    🌐 Translate
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Record Inspection & Translation Modal */}
      {selectedRecord && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
            borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '85vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--copper-400)' }}>
                  FIR {selectedRecord.fir_number}/{selectedRecord.year} — {selectedRecord.station_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  District: {selectedRecord.district_name} · Saved Record ID: {selectedRecord.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Language Selector for Dynamic Translation */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-secondary)', padding: 12, borderRadius: 6,
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--copper-300)' }}>
                  🌐 Catalyst NLP Dynamic Translation Engine
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {LANGS.map(l => (
                    <button
                      key={l.code}
                      onClick={() => handleTranslateRecord(selectedRecord, l.code)}
                      style={{
                        padding: '4px 8px', fontSize: 10, fontWeight: 600,
                        borderRadius: 4, border: '1px solid var(--border-default)',
                        background: targetLang === l.code ? 'var(--copper-400)' : 'transparent',
                        color: targetLang === l.code ? '#000' : 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {l.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Translation Output if active */}
              {translating ? (
                <div style={{ padding: 12, color: 'var(--copper-400)', fontSize: 12 }}>
                  Translating document content via Catalyst NLP...
                </div>
              ) : translatedText ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-success)', marginBottom: 6 }}>
                    Translated Content ({targetLang.toUpperCase()}):
                  </div>
                  <div style={{
                    whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: 12,
                    background: 'rgba(72,199,142,0.05)', border: '1px solid var(--status-success)',
                    padding: 12, borderRadius: 6, color: 'var(--text-primary)', maxHeight: 200, overflowY: 'auto'
                  }}>
                    {translatedText}
                  </div>
                </div>
              ) : null}

              {/* Raw Extracted Text */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Extracted Raw Text / OCR Document Stream:
                </div>
                <div style={{
                  whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-subtle)',
                  padding: 12, borderRadius: 6, color: 'var(--text-secondary)', maxHeight: 180, overflowY: 'auto'
                }}>
                  {selectedRecord.extracted_text || 'No text extracted.'}
                </div>
              </div>

              {/* Parsed JSON metadata */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Structured Extracted Fields (JSON):
                </div>
                <pre style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(0,0,0,0.4)',
                  padding: 12, borderRadius: 6, border: '1px solid var(--border-subtle)',
                  color: 'var(--copper-200)', overflowX: 'auto', maxHeight: 180
                }}>
                  {JSON.stringify(selectedRecord.parsed_data || {}, null, 2)}
                </pre>
              </div>

            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setSelectedRecord(null)}
                className="btn btn-outline"
                style={{ fontSize: 11 }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
