import { useState, useRef, useCallback, useEffect } from 'react'
import { queryIntelligence } from '../../api'

export default function VoiceInterface({ onTranscript, onResponse }) {
  const [state, setState] = useState('idle')
  // states: idle | listening | processing | speaking | error

  const [transcript, setTranscript]   = useState('')
  const [response, setResponse]       = useState('')
  const [isMuted, setIsMuted]         = useState(false)
  const recognitionRef = useRef(null)

  // Keep callback refs updated to avoid dependency loops
  const onTranscriptRef = useRef(onTranscript)
  const onResponseRef = useRef(onResponse)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onResponseRef.current = onResponse
  }, [onTranscript, onResponse])

  // ─── Check browser support ─────────────────────────────────────
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition

  const isSupported = !!SpeechRecognition && !!window.speechSynthesis

  // ─── Start listening ───────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SpeechRecognition) return
    setState('listening')
    setTranscript('')
    setResponse('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'   // Indian English accent
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    recognition.onresult = (event) => {
      const interim = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(interim)
    }

    recognition.onend = async () => {
      const finalTranscript = transcript
      if (!finalTranscript.trim()) {
        setState('idle')
        return
      }
      if (onTranscriptRef.current) onTranscriptRef.current(finalTranscript)
      await processQuery(finalTranscript)
    }

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error)
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }

    recognition.start()
  }, [transcript, SpeechRecognition])

  // ─── Stop listening ────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  // ─── Process query through RAG ─────────────────────────────────
  const processQuery = async (text) => {
    setState('processing')
    try {
      const result = await queryIntelligence({ query: text, conversation_history: [] })
      const answer = result.answer || 'No response generated.'
      setResponse(answer)
      if (onResponseRef.current) onResponseRef.current({ query: text, answer, citations: result.citations })

      if (!isMuted) {
        speakResponse(answer)
      } else {
        setState('idle')
      }
    } catch (err) {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  // ─── Text to speech ────────────────────────────────────────────
  const speakResponse = (text) => {
    setState('speaking')
    window.speechSynthesis.cancel()

    // Clean markdown from text before speaking
    const cleanText = text
      .replace(/#{1,6}\s/g, '')          // headers
      .replace(/\*\*(.*?)\*\*/g, '$1')   // bold
      .replace(/\*(.*?)\*/g, '$1')       // italic
      .replace(/`(.*?)`/g, '$1')         // code
      .replace(/\[.*?\]\(.*?\)/g, '')    // links
      .replace(/\n/g, ' ')
      .slice(0, 500)                     // max 500 chars spoken

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'en-IN'
    utterance.rate = 0.95
    utterance.pitch = 1.0

    // Prefer a female Indian English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.lang.includes('en-IN') || v.name.includes('Google')
    )
    if (preferred) utterance.voice = preferred

    utterance.onend = () => setState('idle')
    utterance.onerror = () => setState('idle')
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = () => {
    window.speechSynthesis.cancel()
    setState('idle')
  }

  // ─── Visual states ─────────────────────────────────────────────
  const stateConfig = {
    idle:       { icon: '🎙️', label: 'Hold to Speak',    color: 'var(--copper-400)', pulse: false },
    listening:  { icon: '👂', label: 'Listening...',      color: 'var(--status-danger)',  pulse: true  },
    processing: { icon: '⚡', label: 'Processing...',     color: 'var(--status-info)',    pulse: true  },
    speaking:   { icon: '🔊', label: 'Speaking...',       color: 'var(--status-success)', pulse: true  },
    error:      { icon: '⚠️', label: 'Error — try again', color: 'var(--status-warning)', pulse: false }
  }
  const cfg = stateConfig[state]

  if (!isSupported) {
    return (
      <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)',
        border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        Voice not supported in this browser. Use Chrome or Edge.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
      {/* Main mic button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onMouseDown={startListening}
          onMouseUp={state === 'listening' ? stopListening : undefined}
          onClick={state === 'speaking' ? stopSpeaking : undefined}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: cfg.color,
            color: '#1a110a',
            border: 'none', cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: cfg.pulse
              ? `0 0 0 8px ${cfg.color}33, 0 0 0 16px ${cfg.color}11`
              : 'none',
            transition: 'box-shadow 0.3s, transform 0.15s',
            transform: state === 'listening' ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {cfg.icon}
        </button>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {cfg.label}
          </div>
          {transcript && (
            <div style={{ fontSize: 11, color: 'var(--copper-400)',
              fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              "{transcript}"
            </div>
          )}
        </div>

        {/* Mute toggle */}
        <button
          onClick={() => setIsMuted(m => !m)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: `1px solid ${isMuted ? 'var(--status-warning)' : 'var(--border-default)'}`,
            borderRadius: 6, padding: '4px 10px',
            color: isMuted ? 'var(--status-warning)' : 'var(--text-muted)',
            fontSize: 11, cursor: 'pointer'
          }}
        >
          {isMuted ? '🔇 Muted' : '🔊 Audio On'}
        </button>
      </div>

      {/* Response display */}
      {response && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: 12,
          fontSize: 12, color: 'var(--text-primary)',
          lineHeight: 1.6, maxHeight: 200, overflowY: 'auto'
        }}>
          <div style={{ fontSize: 10, color: 'var(--copper-400)',
            fontWeight: 600, marginBottom: 6 }}>
            AI RESPONSE
          </div>
          {response.slice(0, 400)}{response.length > 400 ? '...' : ''}
        </div>
      )}
    </div>
  )
}
