/**
 * useBackendKeepAlive.js
 * Pings the backend every 4 minutes to prevent AppSail dev-tier cold-starts.
 * Should be called once in the root App component.
 */
import { useEffect } from 'react'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const PING_INTERVAL_MS = 4 * 60 * 1000 // 4 minutes (AppSail sleeps after 5-10min idle)

export default function useBackendKeepAlive() {
  useEffect(() => {
    // Initial ping to warm up immediately
    const ping = () => {
      fetch(`${BASE_URL}/api/v1/auth/ping`, { method: 'GET' })
        .then(() => console.log('[KeepAlive] Backend ping OK'))
        .catch(() => console.log('[KeepAlive] Backend ping failed (may be cold-starting)'))
    }

    ping() // ping on mount

    const interval = setInterval(ping, PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
}
