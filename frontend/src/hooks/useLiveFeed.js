/**
 * useLiveFeed — connects to SSE stream and maintains event state.
 * Used by Dashboard, Map, LiveFeed ticker, and AlertsPanel.
 */
import { useState, useEffect, useRef, useCallback } from 'react'

export default function useLiveFeed({ onNewEvent } = {}) {
  const [events, setEvents]       = useState([])
  const [connected, setConnected] = useState(false)
  const [stats, setStats]         = useState({ total: 0, critical: 0 })
  const esRef = useRef(null)
  const onNewEventRef = useRef(onNewEvent)

  // Keep ref updated to avoid re-triggering connection on onNewEvent changes
  useEffect(() => {
    onNewEventRef.current = onNewEvent
  }, [onNewEvent])

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()

    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const es = new EventSource(`${BASE}/api/v1/livefeed/stream`)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      const event = JSON.parse(e.data)
      setEvents(prev => [event, ...prev].slice(0, 50))
      setStats(prev => ({
        total:    prev.total + 1,
        critical: prev.critical + (event.severity === 'CRITICAL' ? 1 : 0)
      }))
      if (onNewEventRef.current) onNewEventRef.current(event)
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Reconnect after 5 seconds
      setTimeout(connect, 5000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => esRef.current?.close()
  }, [connect])

  return { events, connected, stats }
}
