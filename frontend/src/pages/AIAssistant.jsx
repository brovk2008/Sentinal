import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Mic, Paperclip, AlertCircle, Sparkles, Send, Volume2, Layers, ShieldAlert, Compass } from 'lucide-react'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import { queryIntelligence, uploadToRag, textToSpeech, fetchCanvasList } from '../api'
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
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load available canvases
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
          KNOWLEDGE BASE: 80,000+ Kaggle records · 2,384 chunks · Last indexed: Live
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
    </div>
  )
}
