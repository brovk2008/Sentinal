import { useState, useRef, useCallback, useEffect } from 'react'
import { queryIntelligence, speechToText, textToSpeech, fetchNlpStatus } from '../../api'

export default function VoiceInterface({ onTranscript, onResponse }) {
  const [state, setState] = useState('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [useCatalystNlp, setUseCatalystNlp] = useState(false)

  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const onTranscriptRef = useRef(onTranscript)
  const onResponseRef = useRef(onResponse)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onResponseRef.current = onResponse
  }, [onTranscript, onResponse])

  useEffect(() => {
    fetchNlpStatus()
      .then(res => setUseCatalystNlp(res.configured))
      .catch(() => setUseCatalystNlp(false))
  }, [])

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const browserSupported = !!SpeechRecognition || !!navigator.mediaDevices

  const processQuery = async (text) => {
    setState('processing')
    try {
      const result = await queryIntelligence({ query: text, conversation_history: [] })
      const answer = result.answer || 'No response generated.'
      setResponse(answer)
      if (onResponseRef.current) onResponseRef.current({ query: text, answer, citations: result.citations })

      if (!isMuted) {
        await speakResponse(answer)
      } else {
        setState('idle')
      }
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  const speakResponse = async (text) => {
    setState('speaking')
    const cleanText = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\n/g, ' ')
      .slice(0, 500)

    if (useCatalystNlp) {
      try {
        const tts = await textToSpeech(cleanText, 'en-IN')
        if (tts.success && tts.audio_base64) {
          const audio = new Audio(`data:audio/wav;base64,${tts.audio_base64}`)
          audio.onended = () => setState('idle')
          audio.onerror = () => setState('idle')
          await audio.play()
          return
        }
      } catch (e) {
        console.warn('[Voice] Catalyst TTS failed, falling back to browser:', e)
      }
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'en-IN'
      utterance.onend = () => setState('idle')
      utterance.onerror = () => setState('idle')
      window.speechSynthesis.speak(utterance)
    } else {
      setState('idle')
    }
  }

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel()
    setState('idle')
  }

  const startBrowserListening = useCallback(() => {
    if (!SpeechRecognition) return
    setState('listening')
    setTranscript('')
    setResponse('')

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition

    let finalText = ''
    recognition.onresult = (event) => {
      finalText = Array.from(event.results).map(r => r[0].transcript).join('')
      setTranscript(finalText)
    }

    recognition.onend = async () => {
      if (!finalText.trim()) { setState('idle'); return }
      if (onTranscriptRef.current) onTranscriptRef.current(finalText)
      await processQuery(finalText)
    }

    recognition.onerror = () => {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }

    recognition.start()
  }, [SpeechRecognition])

  const startCatalystListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setState('listening')
      setTranscript('')
      setResponse('')
      audioChunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setState('processing')
        try {
          const stt = await speechToText(blob, 'en-IN')
          const text = stt.transcript || ''
          setTranscript(text)
          if (!text.trim()) { setState('idle'); return }
          if (onTranscriptRef.current) onTranscriptRef.current(text)
          await processQuery(text)
        } catch {
          setState('error')
          setTimeout(() => setState('idle'), 3000)
        }
      }
      recorder.start()
    } catch {
      startBrowserListening()
    }
  }, [startBrowserListening])

  const startListening = useCallback(() => {
    if (useCatalystNlp && navigator.mediaDevices) {
      startCatalystListening()
    } else {
      startBrowserListening()
    }
  }, [useCatalystNlp, startCatalystListening, startBrowserListening])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    recognitionRef.current?.stop()
  }, [])

  const stateConfig = {
    idle:       { icon: '🎙️', label: useCatalystNlp ? 'Hold to Speak (Catalyst)' : 'Hold to Speak', color: 'var(--copper-400)', pulse: false },
    listening:  { icon: '👂', label: 'Listening...', color: 'var(--status-danger)', pulse: true },
    processing: { icon: '⚡', label: 'Processing...', color: 'var(--status-info)', pulse: true },
    speaking:   { icon: '🔊', label: 'Speaking...', color: 'var(--status-success)', pulse: true },
    error:      { icon: '⚠️', label: 'Error — try again', color: 'var(--status-warning)', pulse: false },
  }
  const cfg = stateConfig[state]

  if (!browserSupported) {
    return (
      <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
        Voice not supported in this browser. Use Chrome or Edge.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onMouseDown={startListening}
          onMouseUp={state === 'listening' ? stopListening : undefined}
          onClick={state === 'speaking' ? stopSpeaking : undefined}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: cfg.color, color: '#1a110a', border: 'none', cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: cfg.pulse ? `0 0 0 8px ${cfg.color}33, 0 0 0 16px ${cfg.color}11` : 'none',
            transition: 'box-shadow 0.3s, transform 0.15s',
            transform: state === 'listening' ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {cfg.icon}
        </button>

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{cfg.label}</div>
          {transcript && (
            <div style={{ fontSize: 11, color: 'var(--copper-400)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              "{transcript}"
            </div>
          )}
        </div>

        <button
          onClick={() => setIsMuted(m => !m)}
          style={{
            marginLeft: 'auto', background: 'transparent',
            border: `1px solid ${isMuted ? 'var(--status-warning)' : 'var(--border-default)'}`,
            borderRadius: 6, padding: '4px 10px',
            color: isMuted ? 'var(--status-warning)' : 'var(--text-muted)',
            fontSize: 11, cursor: 'pointer',
          }}
        >
          {isMuted ? '🔇 Muted' : '🔊 Audio On'}
        </button>
      </div>

      {response && (
        <div style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: 12, fontSize: 12, color: 'var(--text-primary)',
          lineHeight: 1.6, maxHeight: 200, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, color: 'var(--copper-400)', fontWeight: 600, marginBottom: 6 }}>AI RESPONSE</div>
          {response.slice(0, 400)}{response.length > 400 ? '...' : ''}
        </div>
      )}
    </div>
  )
}
