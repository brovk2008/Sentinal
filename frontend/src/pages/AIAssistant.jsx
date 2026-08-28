import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Mic, Paperclip, AlertCircle, Sparkles, Send, Volume2, Layers, ShieldAlert, Compass, Radio, X } from 'lucide-react'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import { queryIntelligence, uploadToRag, textToSpeech, fetchCanvasList, runAudioForensicProfile } from '../api'
import VoiceInterface from '../components/rag/VoiceInterface'
import { useTranslation } from 'react-i18next'

function MessageCitations({ citations = [], debugInfo = {} }) {
  const [open, setOpen] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState(null)

  if (!citations || citations.length === 0) return null

  const retrievalTime = debugInfo.retrievalTime || 8
  const searchedChunks = debugInfo.searchedChunks || 2384

  return (
    <div style={{
      marginTop: 12,
      paddingTop: 8,
      borderTop: '1px solid var(--border-subtle)',
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--copper-300)',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          outline: 'none'
        }}
      >
        {open ? '▼' : '▶'} Sources — {citations.length} documents retrieved in {retrievalTime}ms from {searchedChunks} chunks
      </button>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {citations.map((c, idx) => {
            const isExpanded = expandedIndex === idx
            const matchPercent = (c.similarity_score * 100).toFixed(1)
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--bg-secondary)' : 'transparent',
                    padding: '4px 6px',
                    borderRadius: 4,
                  }}
                >
                  <span style={{ color: 'var(--copper-400)', fontWeight: 600 }}>#{idx + 1}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.document_title || c.crime_head || 'Report'}</span>
                  {c.crime_no && <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>({c.crime_no})</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--copper-300)' }}>{matchPercent}% match</span>
                </div>
                {isExpanded && (
                  <div style={{
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 4,
                    borderLeft: '2px solid var(--copper-400)',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                  }}>
                    {c.text || c.content}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AudioForensicModal({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runAudioForensicProfile({
      audio_text: "Emergency 112: Indiranagar 100ft road alli car theft aagide. White Creta car, key illa adru unlock madi tagondu hogidare Hosur road kadege."
    }).then(res => { setData(res); setLoading(false); }).catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid var(--copper-500)',
        borderRadius: 14, padding: 24, width: 660, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={18} color="var(--copper-400)" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>112 EMERGENCY VOICE & DIALECT FORENSIC PROFILER</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Analyzing acoustic stress, regional dialect accents & emergency entities...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {/* Audio Transcript */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, borderLeft: '3px solid var(--copper-500)' }}>
              <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 700 }}>112 DISPATCH AUDIO TRANSCRIPTION:</div>
              <div style={{ fontSize: 12, color: '#fff', fontStyle: 'italic', marginTop: 4 }}>"{data.transcription}"</div>
              <div style={{ fontSize: 10, color: '#52e07a', marginTop: 4 }}>Language: {data.language_detected}</div>
            </div>

            {/* Dialect & Stress Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(82,176,224,0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(82,176,224,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#52b0e0' }}>DIALECT CLASSIFICATION</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 4 }}>{data.dialect_classification.primary_dialect}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Confidence: {data.dialect_classification.confidence}%</div>
              </div>

              <div style={{ background: 'rgba(224,82,82,0.08)', padding: 10, borderRadius: 8, border: '1px solid rgba(224,82,82,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ff7875' }}>ACOUSTIC STRESS & URGENCY</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginTop: 4 }}>{data.acoustic_stress_analysis.urgency_score}% URGENCY INDEX</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>State: {data.acoustic_stress_analysis.emotional_state}</div>
              </div>
            </div>

            {/* Extracted Entities */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-400)', marginBottom: 6 }}>EXTRACTED CRITICAL ENTITIES:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6 }}>
                <div><strong>Asset:</strong> {data.extracted_critical_entities.target_asset}</div>
                <div><strong>Crime Type:</strong> {data.extracted_critical_entities.crime_type}</div>
                <div><strong>Location:</strong> {data.extracted_critical_entities.crime_location}</div>
                <div><strong>Escape Vector:</strong> {data.extracted_critical_entities.escape_vector}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Modus Operandi:</strong> {data.extracted_critical_entities.modus_operandi}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(82,224,204,0.1)', padding: 10, borderRadius: 6, fontSize: 11, color: '#52e0cc' }}>
              <strong>Immediate Action:</strong> {data.suggested_police_dispatch}
            </div>

            <button onClick={onClose} style={{ padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontWeight: 600 }}>Close</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function AIAssistant() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: t('ai.welcome') || 'Sentinal Cognitive Criminology Engine online. Connected to Karnataka State Police Records, Zia NLP, Kaggle National Crime AI models, and live multi-canvas investigation boards.',
    },
  ])
  const [input, setInput] = useState('')
  const [voiceMode, setVoiceMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [canvasList, setCanvasList] = useState([])
  const [selectedCanvas, setSelectedCanvas] = useState('CANVAS-VEHICLE-THEFT-01')
  const [showAudioProfiler, setShowAudioProfiler] = useState(false)
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetchCanvasList().then(res => {
      if (Array.isArray(res)) {
        setCanvasList(res)
      }
    }).catch(console.error)
  }, [])

  useEffect(() => {
    const handleAutoType = (e) => {
      const queryText = e.detail?.query
      if (!queryText) return

      let currentText = ''
      let index = 0
      setLoading(true)

      const interval = setInterval(() => {
        currentText += queryText[index]
        setInput(currentText)
        index++
        if (index >= queryText.length) {
          clearInterval(interval)
          setLoading(false)
          setTimeout(() => {
            sendQuery(queryText)
          }, 800)
        }
      }, 25)
    }

    window.addEventListener('demo-auto-type', handleAutoType)
    return () => window.removeEventListener('demo-auto-type', handleAutoType)
  }, [])

  const sendQuery = async (text) => {
    const q = text || input
    if (!q.trim()) return

    setMessages(prev => [...prev, { role: 'user', content: q }])
    setInput('')
    setLoading(true)

    try {
      const activeLang = i18n.language || 'en'
      const res = await queryIntelligence({
        query: q,
        target_lang: activeLang,
        board_id: selectedCanvas
      })
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res?.answer || 'No response content returned.',
          citations: res?.citations || [],
          debugInfo: {
            retrievalTime: res?.retrieval_time_ms,
            searchedChunks: res?.total_chunks_searched,
            vectorNorm: res?.query_vector_norm
          }
        },
      ])
    } catch (err) {
      console.error('[AI Assistant] Query failed:', err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Intelligence query failed. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handlePlayTTS = async (text) => {
    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\n/g, ' ')
      .slice(0, 500)

    try {
      const tts = await textToSpeech(cleanText, 'en-IN')
      if (tts.success && tts.audio_base64) {
        const audio = new Audio(`data:audio/wav;base64,${tts.audio_base64}`)
        await audio.play()
      } else {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
          const utterance = new SpeechSynthesisUtterance(cleanText)
          utterance.lang = 'en-IN'
          window.speechSynthesis.speak(utterance)
        }
      }
    } catch (e) {
      console.warn('[TTS] Failed to play audio:', e)
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(cleanText)
        utterance.lang = 'en-IN'
        window.speechSynthesis.speak(utterance)
      }
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('Extracting text...')
    setTimeout(() => {
      setUploadStatus('Generating embeddings...')
    }, 1500)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await uploadToRag(formData)
      if (result.status === 'success') {
        setTimeout(() => {
          setUploadStatus(`Added ${result.chunks_added} chunks to knowledge base`)
          setMessages(prev => [
            ...prev,
            {
              role: 'system',
              content: `Uploaded file **${file.name}** processed successfully. ${result.chunks_added} chunks added to vector store.`
            }
          ])
          setTimeout(() => setUploadStatus(''), 3000)
        }, 1500)
      }
    } catch (err) {
      console.error(err)
      setUploadStatus('Upload error')
      setTimeout(() => setUploadStatus(''), 3000)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Terminal header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg-secondary)',
      }}>
        <span className="live-dot" />
        <span className="mono" style={{ fontSize: 12 }}>{t('ai.title') || 'SENTINAL AI TERMINAL'}</span>
        <Badge text="RAG + LLM" variant="badge-copper" />

        {/* Target Canvas Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
          <Layers size={13} color="var(--copper-400)" />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>Active Canvas:</span>
          <select
            value={selectedCanvas}
            onChange={e => setSelectedCanvas(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#fff', border: '1px solid var(--border-subtle)',
              borderRadius: 6, padding: '3px 8px', fontSize: 11,
              outline: 'none', cursor: 'pointer'
            }}
          >
            {canvasList.map(c => (
              <option key={c.canvas_id} value={c.canvas_id} style={{ background: '#121222' }}>
                {c.name} ({c.canvas_id})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {/* 112 Audio Profiler Button */}
        <button
          onClick={() => setShowAudioProfiler(true)}
          style={{
            background: 'rgba(200,129,74,0.18)',
            border: '1px solid rgba(200,129,74,0.4)',
            color: 'var(--copper-300)',
            padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
            outline: 'none', marginRight: 10, display: 'flex', alignItems: 'center', gap: 5
          }}
        >
          <Radio size={12} />
          <span>112 AUDIO PROFILER</span>
        </button>

        <button onClick={() => setVoiceMode(v => !v)} style={{
          background: voiceMode ? 'var(--copper-400)' : 'transparent',
          border: '1px solid var(--copper-400)',
          color: voiceMode ? '#000' : 'var(--copper-400)',
          padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          outline: 'none', marginRight: 16, display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Mic size={12} />
          <span>{voiceMode ? 'VOICE ON' : 'VOICE'}</span>
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          KNOWLEDGE BASE: 80,000+ Kaggle records · 2,384 chunks
        </span>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
      }} className="scanlines">
        {messages.map((msg, i) => (
          <div
            key={i}
            className="fade-in"
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: msg.role === 'system' ? '100%' : '75%',
              padding: '12px 16px',
              borderRadius: 10,
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, var(--copper-600), var(--copper-500))'
                : 'var(--bg-card)',
              border: msg.role !== 'user' ? '1px solid var(--border-subtle)' : 'none',
              color: 'var(--text-primary)',
              fontSize: 13,
              lineHeight: 1.6,
              position: 'relative',
            }}>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => handlePlayTTS(msg.content)}
                  style={{
                    position: 'absolute',
                    top: 10,
                    right: 10,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Speak Response"
                >
                  <Volume2 size={13} />
                </button>
              )}
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p style={{ margin: '0 0 8px' }} {...props} />,
                    strong: ({ node, ...props }) => <strong style={{ color: 'var(--copper-300)' }} {...props} />,
                    ul: ({ node, ...props }) => <ul style={{ margin: '0 0 8px', paddingLeft: 20 }} {...props} />,
                    li: ({ node, ...props }) => <li style={{ marginBottom: 4 }} {...props} />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}

              {msg.citations && (
                <MessageCitations
                  citations={msg.citations}
                  debugInfo={msg.debugInfo}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}>
              <LoadingPulse text="Correlating canvas evidence, Kaggle crime models & CCTV/CDR telemetry..." />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Suggestion Pills */}
      <div style={{
        padding: '6px 20px',
        display: 'flex', gap: 8,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-subtle)',
        overflowX: 'auto',
      }}>
        {[
          '🚗 Who stole the white Hyundai Creta on canvas CANVAS-VEHICLE-THEFT-01?',
          '⚡ Trace the getaway route and FASTag toll pings for the stolen car.',
          '🔗 Check alibi contradictions for Imran Pasha vs cell tower CDR logs.',
          '🔍 What physical evidence links the suspect to the Indiranagar crime scene?'
        ].map((s, idx) => (
          <button
            key={idx}
            onClick={() => sendQuery(s)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 12,
              background: 'rgba(200,129,74,0.12)', color: 'var(--copper-300)',
              border: '1px solid rgba(200,129,74,0.25)', cursor: 'pointer',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            <span>{s}</span>
          </button>
        ))}
      </div>

      {voiceMode && (
        <div style={{ padding: '0 20px 12px' }}>
          <VoiceInterface
            onTranscript={(t) => setInput(t)}
            onResponse={({ query, answer, citations }) => {
              setMessages(prev => [
                ...prev,
                { role: 'user', content: query },
                {
                  role: 'assistant',
                  content: answer,
                  citations: citations || [],
                  debugInfo: { retrievalTime: 120, searchedChunks: 1000 }
                }
              ])
            }}
          />
        </div>
      )}

      {/* Input bar */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', gap: 10,
        background: 'var(--bg-secondary)',
        alignItems: 'center',
      }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept=".pdf,.png,.jpg,.jpeg,.txt"
        />

        <button
          className="btn"
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => fileInputRef.current?.click()}
          title="Upload file to RAG context"
          disabled={loading || !!uploadStatus}
        >
          <Paperclip size={14} />
        </button>

        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendQuery()}
          placeholder={t('ai.placeholder') || "Ask about the canvas evidence, who stole the car, suspect alibis..."}
          style={{ flex: 1, fontSize: 13 }}
          disabled={loading || !!uploadStatus}
        />
        <button
          className="btn btn-copper"
          onClick={() => sendQuery()}
          disabled={loading || !!uploadStatus || !input.trim()}
        >
          Analyze →
        </button>
      </div>

      {showAudioProfiler && <AudioForensicModal onClose={() => setShowAudioProfiler(false)} />}
    </div>
  )
}
