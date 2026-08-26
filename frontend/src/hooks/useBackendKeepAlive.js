/**
 * useBackendKeepAlive.js
 * Pings the backend every 2 minutes to prevent AppSail dev-tier cold-starts.
 * Also triggers an instant wake-up ping whenever the browser tab becomes active.
 */
import { useEffect } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const PING_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes (keeps AppSail alive)

export default function useBackendKeepAlive() {
  useEffect(() => {
    const ping = () => {
      fetch(`${BASE_URL}/health`, { method: 'GET', mode: 'cors' })
        .then(() => console.log('[KeepAlive] Backend health ping OK'))
        .catch(() => console.log('[KeepAlive] Backend ping cold-starting...'))
    }

    // Ping on mount
    ping()

    // Ping whenever user returns to tab
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ping()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    const interval = setInterval(ping, PING_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}
