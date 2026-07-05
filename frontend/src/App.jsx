import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import LiveFeed from './components/layout/LiveFeed'
import DemoOverlay from './components/layout/DemoOverlay'
import Dashboard from './pages/Dashboard'
import GeospatialMap from './pages/GeospatialMap'
import ConnectionsBoard from './pages/ConnectionsBoard'
import TimelineExplorer from './pages/TimelineExplorer'
import Persons from './pages/Persons'
import AIAssistant from './pages/AIAssistant'
import FinancialIntel from './pages/FinancialIntel'
import CDRAnalytics from './pages/CDRAnalytics'
import Login from './pages/Login'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('sentinel_token')
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function Layout() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'var(--sidebar-width) 1fr',
      gridTemplateRows: 'var(--topbar-height) 1fr 32px',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <Sidebar />
      <Topbar />
      <main style={{
        overflow: 'auto',
        background: 'var(--bg-primary)',
        gridColumn: '2',
        gridRow: '2',
      }}>
        <Outlet />
      </main>
      <LiveFeed />
      <DemoOverlay />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Toggle demo mode via Ctrl+D
      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('toggle-demo-mode'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Guarded Routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map" element={<GeospatialMap />} />
          <Route path="/connections" element={<ConnectionsBoard />} />
          <Route path="/timeline/:caseId?" element={<TimelineExplorer />} />
          <Route path="/persons" element={<Persons />} />
          <Route path="/assistant" element={<AIAssistant />} />
          <Route path="/financial" element={<FinancialIntel />} />
          <Route path="/cdr" element={<CDRAnalytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
