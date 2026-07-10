import { useEffect, useState } from 'react'
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
import PredictiveIntelligence from './pages/PredictiveIntelligence'
import EvidenceBoard from './pages/EvidenceBoard'
import NetworkGraph3D from './pages/NetworkGraph3D'
import AccusedProfile from './pages/AccusedProfile'
import DarkWebIntel from './pages/DarkWebIntel'
import WarRoom from './pages/WarRoom'
import Login from './pages/Login'
import SignupPage from './pages/SignupPage'
import FIRSearch from './pages/FIRSearch'

function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // Fast path: check localStorage first (works for mock auth)
    const token = localStorage.getItem('sentinal_token')
    if (token) {
      setAuthed(true)
      setChecking(false)
      return
    }
    setAuthed(false)
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: 'var(--copper-400)', fontFamily: 'var(--font-mono)',
        fontSize: 13, letterSpacing: '0.1em'
      }}>
        AUTHENTICATING...
      </div>
    )
  }
  if (!authed) return <Navigate to="/login" replace />
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
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<SignupPage />} />

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
          <Route path="/predict" element={<PredictiveIntelligence />} />
          <Route path="/board" element={<EvidenceBoard />} />
          <Route path="/network-3d" element={<NetworkGraph3D />} />
          <Route path="/accused/:accusedId" element={<AccusedProfile />} />
          <Route path="/darkweb" element={<DarkWebIntel />} />
          <Route path="/warroom" element={<WarRoom />} />
          <Route path="/fir-search" element={<FIRSearch />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
