import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
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
import AuthGuard from './components/AuthGuard'

// ─── Router base path ────────────────────────────────────────────────────────
// The Catalyst Web Client deployment serves the app under /app/ on the
// catalystserverless.in domain. We set the BrowserRouter basename so that
// React Router generates / resolves URLs with the correct /app/ prefix there.
// On onslate.in (Slate), the app is served at root /, so basename stays "/".
const IS_SERVERLESS_DOMAIN = window.location.hostname.includes('catalystserverless.in')
const ROUTER_BASE = IS_SERVERLESS_DOMAIN ? '/app' : '/'

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

// On the serverless domain, the SSO bridge lands the user on /app/index.html
// (with optional ?redirect_back / ?auth_user query params).
// With basename="/app" the router sees path "/index.html" — redirect to /dashboard
// so that AuthGuard / getCurrentUser() can run with the query params intact.
function IndexHtmlRedirect() {
  const location = useLocation()
  return <Navigate to={`/dashboard${location.search}${location.hash}`} replace />
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
    <BrowserRouter basename={ROUTER_BASE}>
      <Routes>
        <Route path="/login"      element={<Login />} />
        <Route path="/signup"     element={<SignupPage />} />

        {/*
          Handles the SSO bridge entry point: /app/index.html?redirect_back=...
          basename="/app" makes the router see this as /index.html
          Preserve query string so getCurrentUser() can read redirect_back / auth_user.
        */}
        <Route path="/index.html" element={<IndexHtmlRedirect />} />

        {/* Guarded Routes */}
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/"                     element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"            element={<Dashboard />} />
          <Route path="/map"                  element={<GeospatialMap />} />
          <Route path="/connections"          element={<ConnectionsBoard />} />
          <Route path="/timeline/:caseId?"    element={<TimelineExplorer />} />
          <Route path="/persons"              element={<Persons />} />
          <Route path="/assistant"            element={<AIAssistant />} />
          <Route path="/financial"            element={<FinancialIntel />} />
          <Route path="/cdr"                  element={<CDRAnalytics />} />
          <Route path="/predict"              element={<PredictiveIntelligence />} />
          <Route path="/board"                element={<EvidenceBoard />} />
          <Route path="/network-3d"           element={<NetworkGraph3D />} />
          <Route path="/accused/:accusedId"   element={<AccusedProfile />} />
          <Route path="/darkweb"              element={<DarkWebIntel />} />
          <Route path="/warroom"              element={<WarRoom />} />
          <Route path="/fir-search"           element={<FIRSearch />} />
          <Route path="/ingestion"            element={<DataIngestion />} />
          <Route path="/patterns"             element={<PatternIntel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
