import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
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
import DataIngestion from './pages/DataIngestion'
import PatternIntel from './pages/PatternIntel'
import Profile from './pages/Profile'
import DataUploadIntel from './pages/DataUploadIntel'
import OCRRecords from './pages/OCRRecords'
import AuthGuard from './components/AuthGuard'
import BackendWakeup from './components/layout/BackendWakeup'
import ErrorBoundary from './components/ErrorBoundary'
import useBackendKeepAlive from './hooks/useBackendKeepAlive'

// ─── Routing strategy ────────────────────────────────────────────────────────
// We use HashRouter (#/dashboard, #/map, etc.) because:
//
//  • On catalystserverless.in the web client is served at /app/ — sub-paths
//    like /app/dashboard are NOT served by Catalyst (INVALID_URL_PATTERN).
//    With HashRouter the actual server URL is always /app/index.html#/dashboard
//    which Catalyst serves correctly.
//
//  • On onslate.in (Catalyst Slate) the SPA fallback serves index.html for any
//    path, so BrowserRouter would also work, but HashRouter is safe here too.
//
//  • Auth redirects (?redirect_back, ?auth_user, ?logout) are read from
//    window.location.search (NOT from the hash), so they survive the
//    /__catalyst/auth/login → service_url → index.html round-trip correctly.

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
        display: 'flex',
        flexDirection: 'column',
      }}>
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <LiveFeed />
      <DemoOverlay />
      <BackendWakeup />
    </div>
  )
}

export default function App() {
  useBackendKeepAlive() // Keep AppSail warm — ping every 4 minutes

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
    <HashRouter>
      <Routes>
        <Route path="/login"   element={<Login />} />
        <Route path="/signup"  element={<SignupPage />} />

        {/* Guarded Routes */}
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/"                   element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"          element={<Dashboard />} />
          <Route path="/map"                element={<GeospatialMap />} />
          <Route path="/connections"        element={<ConnectionsBoard />} />
          <Route path="/timeline/:caseId?"  element={<TimelineExplorer />} />
          <Route path="/persons"            element={<Persons />} />
          <Route path="/assistant"          element={<AIAssistant />} />
          <Route path="/financial"          element={<FinancialIntel />} />
          <Route path="/cdr"                element={<CDRAnalytics />} />
          <Route path="/predict"            element={<PredictiveIntelligence />} />
          <Route path="/board"              element={<EvidenceBoard />} />
          <Route path="/network-3d"         element={<NetworkGraph3D />} />
          <Route path="/accused/:accusedId" element={<AccusedProfile />} />
          <Route path="/darkweb"            element={<DarkWebIntel />} />
          <Route path="/warroom"            element={<WarRoom />} />
          <Route path="/fir-search"         element={<FIRSearch />} />
          <Route path="/ingestion"          element={<DataIngestion />} />
          <Route path="/patterns"           element={<PatternIntel />} />
          <Route path="/profile"            element={<Profile />} />
          <Route path="/upload"             element={<DataUploadIntel />} />
          <Route path="/ocr-records"        element={<OCRRecords />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
