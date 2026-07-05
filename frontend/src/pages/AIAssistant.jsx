import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import { queryIntelligence } from '../api'

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
                    userSelect: 'none'
                  }}
                >
                  <span style={{ fontSize: 9 }}>{isExpanded ? '▼' : '▶'}</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.source}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>({c.type})</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--status-success)' }}>
                    {matchPercent}% match
                  </span>
                </div>
                {isExpanded && (
                  <div style={{
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    borderLeft: '2px solid var(--copper-400)',
                    borderRadius: '0 4px 4px 0',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                    marginTop: 2,
                  }}>
                    {c.chunk_text}
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

const SUGGESTIONS = [
  'Show me the top crime syndicates operating in Karnataka',
  'Which districts have the highest crime rates?',
  'Give me a briefing on cyber crime trends',
  'Who are the most connected accused across cases?',
  'Summarize narcotics-related intelligence',
  'What suspicious financial patterns have been detected?',
]

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'system',
      content: `## Welcome to SENTINEL Intelligence Terminal

I am the AI Intelligence Analyst for Project Sentinel v2.

I can help you with:
- **Crime pattern analysis** across districts and time periods
- **Syndicate briefings** and organized crime intelligence
- **Financial intelligence** on suspicious transactions
- **Case correlation** and network analysis
- **CDR analysis** for communication patterns

Type your query below or select a suggestion to begin.`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleAutoType = (e) => {
      const queryText = e.detail?.query
      if (!queryText) return

      let currentText = ''
      let index = 0
      setLoading(true) // Disable while typing

      const interval = setInterval(() => {
        currentText += queryText[index]
        setInput(currentText)
        index++
        if (index >= queryText.length) {
          clearInterval(interval)
          setLoading(false)
          // Submit query after a small delay
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
      const res = await queryIntelligence(q)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.answer,
          citations: res.citations || [],
          debugInfo: {
            retrievalTime: res.retrieval_time_ms,
            searchedChunks: res.total_chunks_searched,
            vectorNorm: res.query_vector_norm
          }
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '⚠️ Intelligence query failed. Please try again.' },
      ])
    }
    setLoading(false)
  }

  // RAG File Upload handler (7G)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('Extracting text...')
    
    // Simulate pipeline status steps visually
    setTimeout(() => {
      setUploadStatus('Generating embeddings...')
    }, 1500)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/v1/intelligence/upload-to-rag', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      
      if (result.status === 'success') {
        setTimeout(() => {
          setUploadStatus(`Added ${result.chunks_added} chunks to knowledge base`)
          setMessages(prev => [
            ...prev,
            {
              role: 'system',
              content: `📎 **File Uploaded**: \`${result.filename}\`\n\n${result.message}`,
            }
          ])
          setTimeout(() => setUploadStatus(''), 3000)
        }, 3000)
      } else {
        setUploadStatus('Upload failed')
        setTimeout(() => setUploadStatus(''), 3000)
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
        <span className="mono" style={{ fontSize: 12 }}>SENTINEL AI TERMINAL</span>
        <Badge text="RAG + LLM" variant="badge-copper" />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          KNOWLEDGE BASE: 500 narratives · 2,384 chunks · 113K records · Last indexed: Jul 5, 2026
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
            }}>
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--copper-400)' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{children}</h3>,
                  strong: ({ children }) => <strong style={{ color: 'var(--copper-300)' }}>{children}</strong>,
                  code: ({ children }) => <code className="mono" style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 3 }}>{children}</code>,
                  li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                  p: ({ children }) => <p style={{ marginBottom: 8 }}>{children}</p>,
                }}
              >
                {msg.content}
              </ReactMarkdown>

              {/* Citations Expandable Drawer */}
              {msg.citations?.length > 0 && (
                <MessageCitations citations={msg.citations} debugInfo={msg.debugInfo} />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--copper-400)', animation: 'dot-pulse-anim 1.2s infinite' }} />
              <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--copper-400)', animation: 'dot-pulse-anim 1.2s infinite 0.2s' }} />
              <span className="dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--copper-400)', animation: 'dot-pulse-anim 1.2s infinite 0.4s' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analyzing intelligence...</span>
            <style>{`
              @keyframes dot-pulse-anim {
                0%, 100% { transform: scale(0.6); opacity: 0.4; }
                50% { transform: scale(1.2); opacity: 1; }
              }
            `}</style>
          </div>
        )}

        {/* Upload status indicator panel */}
        {uploadStatus && (
          <div style={{
            alignSelf: 'center',
            padding: '8px 16px', borderRadius: 6,
            background: 'var(--bg-overlay)', border: '1px solid var(--copper-500)',
            color: 'var(--copper-400)', fontSize: 11, fontWeight: 'bold',
            animation: 'pulse 1.5s infinite',
          }}>
            📎 {uploadStatus}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div style={{
          padding: '0 20px 12px',
          display: 'flex', flexWrap: 'wrap', gap: 6,
        }}>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="btn btn-sm"
              onClick={() => sendQuery(s)}
              style={{ fontSize: 11, color: 'var(--text-secondary)' }}
            >
              {s}
            </button>
          ))}
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
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept=".pdf,.png,.jpg,.jpeg,.txt"
        />

        <button
          className="btn"
          style={{ padding: '8px 12px', fontSize: 14 }}
          onClick={() => fileInputRef.current?.click()}
          title="Upload file to RAG context"
          disabled={loading || !!uploadStatus}
        >
          📎
        </button>

        <input
          className="input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendQuery()}
          placeholder="Ask the intelligence system..."
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
