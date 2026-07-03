import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import LiveFeed from './components/layout/LiveFeed'
import Dashboard from './pages/Dashboard'
import GeospatialMap from './pages/GeospatialMap'
import ConnectionsBoard from './pages/ConnectionsBoard'
import TimelineExplorer from './pages/TimelineExplorer'
import Persons from './pages/Persons'
import AIAssistant from './pages/AIAssistant'
import FinancialIntel from './pages/FinancialIntel'
import CDRAnalytics from './pages/CDRAnalytics'

export default function App() {
  return (
    <BrowserRouter>
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
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map" element={<GeospatialMap />} />
            <Route path="/connections" element={<ConnectionsBoard />} />
            <Route path="/timeline/:caseId?" element={<TimelineExplorer />} />
            <Route path="/persons" element={<Persons />} />
            <Route path="/assistant" element={<AIAssistant />} />
            <Route path="/financial" element={<FinancialIntel />} />
            <Route path="/cdr" element={<CDRAnalytics />} />
          </Routes>
        </main>
        <LiveFeed />
      </div>
    </BrowserRouter>
  )
}
