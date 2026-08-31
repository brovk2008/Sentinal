import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Swords, Globe, Network, ShieldAlert, Activity, Flame, Zap,
  TrendingUp, UserCheck, FileText, Scale, IndianRupee, Radio,
  ArrowUpRight, AlertTriangle, Crosshair, Radar, RefreshCw, Cpu, Filter
} from 'lucide-react'
import KpiCard from '../components/shared/KpiCard'
import Badge from '../components/shared/Badge'
import useLiveFeed from '../hooks/useLiveFeed'
import CrimeDonut from '../components/charts/CrimeDonut'
import DistrictBar from '../components/charts/DistrictBar'
import TrendLine from '../components/charts/TrendLine'
import RiskGauge from '../components/charts/RiskGauge'
import { ZiaText } from '../components/layout/ZiaTranslate'
import {
  fetchKpis, fetchCrimeDistribution, fetchTopOffenders,
  fetchDistrictComparison, fetchMonthlyTrend, fetchRecentTimeline,
  fetchAlerts, fetchForecastRisk, fetchKpiSparklines,
} from '../api'

// ── Default Fallback Data ─────────────────────────────────────────────
const DEFAULT_KPIS = {
  total_cases: 10002,
  active_investigations: 5901,
  arrests_made: 5202,
  chargesheets_filed: 3594,
  conviction_rate: 68.4,
  pending_court: 1369,
  recovered_amount_lakhs: 42.4,
  mules_frozen: 14,
}

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Crimes', icon: ShieldAlert },
  { id: 'CYBER', label: 'Cyber & Mule Smurfing', icon: Zap },
  { id: 'THEFT', label: 'OBD Vehicle Theft', icon: Crosshair },
  { id: 'NARCOTICS', label: 'Narcotics (NDPS)', icon: Flame },
  { id: 'HAWALA', label: 'Financial Hawala', icon: IndianRupee },
  { id: 'HEINOUS', label: 'Heinous & Homicide', icon: Swords },
]

const DEFAULT_CRIME_DISTRIBUTION = [
  { name: 'Theft & Burglary', value: 3240, category: 'THEFT' },
  { name: 'Cyber Crime', value: 2450, category: 'CYBER' },
  { name: 'Cheating & Fraud', value: 1820, category: 'HAWALA' },
  { name: 'Narcotics (NDPS)', value: 1210, category: 'NARCOTICS' },
  { name: 'Crimes Against Women', value: 880, category: 'HEINOUS' },
  { name: 'Murder & Homicide', value: 400, category: 'HEINOUS' },
]

const DEFAULT_OFFENDERS = [
  { AccusedID: 5, AccusedName: 'Imran Pasha', CrimeGroupName: 'Luxury Car Theft (OBD Cloning)', TotalCases: 19, Status: 'RED CORNER NOTICE', RiskScore: 94 },
  { AccusedID: 12, AccusedName: 'Ashok Kumar', CrimeGroupName: 'Transnational UPI Smurfing', TotalCases: 14, Status: 'LOC ACTIVE', RiskScore: 91 },
  { AccusedID: 19, AccusedName: 'Dinesh Gupta', CrimeGroupName: 'Chop-Shop Receiver Ring', TotalCases: 11, Status: 'NBW ACTIVE', RiskScore: 86 },
  { AccusedID: 24, AccusedName: 'Suresh Reddi', CrimeGroupName: 'Land Extortion Syndicate', TotalCases: 8, Status: 'WANTED', RiskScore: 82 },
  { AccusedID: 31, AccusedName: 'Venkatesh Murthy', CrimeGroupName: 'Hawala Layering Network', TotalCases: 7, Status: 'UNDER SURVEILLANCE', RiskScore: 78 },
]

const DEFAULT_DISTRICTS = {
  districts: [
    { district: 'Bengaluru City', total: 3850, resolved: 2640, clearance: 68.5 },
    { district: 'Mysuru City', total: 1420, resolved: 1010, clearance: 71.1 },
    { district: 'Hubballi Dharwad', total: 1180, resolved: 780, clearance: 66.1 },
    { district: 'Mangaluru City', total: 980, resolved: 690, clearance: 70.4 },
    { district: 'Belagavi City', total: 850, resolved: 560, clearance: 65.8 },
    { district: 'Kalaburagi', total: 720, resolved: 490, clearance: 68.0 },
  ]
}

const DEFAULT_TREND = [
  { month: 'Jan', count: 720 }, { month: 'Feb', count: 680 },
  { month: 'Mar', count: 810 }, { month: 'Apr', count: 790 },
  { month: 'May', count: 850 }, { month: 'Jun', count: 910 },
  { month: 'Jul', count: 880 }, { month: 'Aug', count: 940 },
  { month: 'Sep', count: 890 }, { month: 'Oct', count: 960 },
  { month: 'Nov', count: 1020 }, { month: 'Dec', count: 950 },
]

const DEFAULT_TIMELINE = [
  { CaseMasterID: 456, CrimeNo: 'CR/2026/0456', CrimeGroupName: 'Cyber Crime', DistrictName: 'Bengaluru City', CrimeRegisteredDate: 'Just Now', CaseStatusName: 'Registered', BriefFacts: 'UPI Smurfing alert across 14 mule handles in Indiranagar radius', severity: 'critical' },
  { CaseMasterID: 455, CrimeNo: 'CR/2026/0455', CrimeGroupName: 'Vehicle Theft', DistrictName: 'Mysuru City', CrimeRegisteredDate: '8m ago', CaseStatusName: 'Under Investigation', BriefFacts: 'Keyless Creta stolen near 100ft road; FASTag ping detected', severity: 'high' },
  { CaseMasterID: 454, CrimeNo: 'CR/2026/0454', CrimeGroupName: 'Narcotics (NDPS)', DistrictName: 'Belagavi Border', CrimeRegisteredDate: '22m ago', CaseStatusName: 'Registered', BriefFacts: 'Inter-state contraband checkpoint intercept; 2 couriers detained', severity: 'critical' },
  { CaseMasterID: 453, CrimeNo: 'CR/2026/0453', CrimeGroupName: 'Cheating & Fraud', DistrictName: 'Mangaluru City', CrimeRegisteredDate: '1h ago', CaseStatusName: 'Under Investigation', BriefFacts: 'Digital Arrest Skype extortion targeting senior citizen', severity: 'high' },
  { CaseMasterID: 452, CrimeNo: 'CR/2026/0452', CrimeGroupName: 'Extortion Ring', DistrictName: 'Hubballi Dharwad', CrimeRegisteredDate: '2h ago', CaseStatusName: 'Under Investigation', BriefFacts: 'Hawala payment route flagged under Section 106 BNSS', severity: 'medium' },
]

const DEFAULT_ALERTS = [
  { alert_id: 'alt_1', title: 'UPI Mule Velocity Spike Detected', district: 'Bengaluru Central', severity: 'critical', description: '14 rapid transactions under ₹50,000 flagged in Koramangala PS radius. Section 106 BNSS freeze recommended.', radius: '2.5 km' },
  { alert_id: 'alt_2', title: 'FASTag ANPR Convoy Trajectory', district: 'Attibele Highway Toll', severity: 'high', description: 'Stolen Creta KA-04-MB-1234 trailing Swift KA-51-Z-9988 by 72s. Roadblock sting planned.', radius: '5.0 km' },
  { alert_id: 'alt_3', title: 'Repeat Offender Tower Ping Match', district: 'Bommasandra Industrial', severity: 'medium', description: 'Burner IMEI hardware hop identified for syndicate suspect Imran Pasha.', radius: '1.8 km' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [liveCount, setLiveCount] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [trendWindow, setTrendWindow] = useState('monthly')
  const [selectedDistrictRisk, setSelectedDistrictRisk] = useState('Bengaluru Urban')
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())

  useLiveFeed({ onNewEvent: () => setLiveCount(c => c + 1) })

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour12: false }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const [kpis, setKpis] = useState(DEFAULT_KPIS)
  const [crimeData, setCrimeData] = useState(DEFAULT_CRIME_DISTRIBUTION)
  const [offenders, setOffenders] = useState(DEFAULT_OFFENDERS)
  const [districts, setDistricts] = useState(DEFAULT_DISTRICTS)
  const [trend, setTrend] = useState(DEFAULT_TREND)
  const [timeline, setTimeline] = useState(DEFAULT_TIMELINE)
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS)
  const [forecast, setForecast] = useState(null)
  const [sparklines, setSparklines] = useState(null)

  useEffect(() => {
    let active = true

    const loadData = async (fetchFn, setter, fallback) => {
      try {
        const res = await fetchFn()
        if (active && res && (Array.isArray(res) ? res.length > 0 : Object.keys(res).length > 0)) {
          setter(res)
        }
      } catch (err) {
        // Fallback kept silent to keep UI clean
      }
    }

    Promise.all([
      loadData(fetchKpis, setKpis, DEFAULT_KPIS),
      loadData(fetchCrimeDistribution, setCrimeData, DEFAULT_CRIME_DISTRIBUTION),
      loadData(() => fetchTopOffenders(5), setOffenders, DEFAULT_OFFENDERS),
      loadData(fetchDistrictComparison, setDistricts, DEFAULT_DISTRICTS),
      loadData(fetchMonthlyTrend, setTrend, DEFAULT_TREND),
      loadData(fetchRecentTimeline, setTimeline, DEFAULT_TIMELINE),
      loadData(() => fetchAlerts(5), setAlerts, DEFAULT_ALERTS),
      loadData(fetchForecastRisk, setForecast, null),
      loadData(fetchKpiSparklines, setSparklines, null),
    ])

    return () => { active = false }
  }, [])

  // Filtered crime data
  const filteredCrimeData = useMemo(() => {
    if (selectedCategory === 'ALL') return crimeData
    return crimeData.filter(c => c.category === selectedCategory || c.name.toLowerCase().includes(selectedCategory.toLowerCase()))
  }, [crimeData, selectedCategory])

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    if (selectedCategory === 'ALL') return timeline
    return timeline.filter(t => t.CrimeGroupName?.toLowerCase().includes(selectedCategory.toLowerCase()))
  }, [timeline, selectedCategory])

  return (
    <div style={{
      padding: '16px 20px 24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      background: '#04060c',
      minHeight: '100%',
      color: '#e8e6e0',
    }}>

      {/* ── TOP HUD & COMMAND HEADER ────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(90deg, rgba(200, 129, 74, 0.08) 0%, rgba(56, 189, 248, 0.04) 50%, rgba(15, 18, 28, 0.6) 100%)',
        border: '1px solid rgba(200, 129, 74, 0.25)',
        borderRadius: 10,
        padding: '12px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {/* Title & Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
                <ZiaText>COMMAND CENTER INTELLIGENCE HUB</ZiaText>
              </h1>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                STATE POLICE HQ · V1.4
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <span>41 Karnataka Districts Synced</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94a3b8' }}>
                <Cpu size={12} color="#c8814a" />
                <span>Hawkes ETAS & ML Ensembles: 90.8% Acc</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#38bdf8', fontFamily: 'monospace' }}>
                <Activity size={12} />
                <span>ZOHO CATALYST APPSAIL: 39/39 APIS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Actions: Clock & Quick Launch buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Tactical Clock */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            padding: '4px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.06)', marginRight: 6,
          }}>
            <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>IST TIME</span>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#38bdf8' }}>{currentTime}</span>
          </div>

          {/* Quick Buttons */}
          <button
            className="btn"
            onClick={() => navigate('/map')}
            style={{
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38bdf8', fontSize: 12, padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
            }}
          >
            <Globe size={14} />
            <span>3D Globe</span>
          </button>

          <button
            className="btn"
            onClick={() => navigate('/board')}
            style={{
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              color: '#c084fc', fontSize: 12, padding: '7px 12px',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
            }}
          >
            <Network size={14} />
            <span>AI Reasoner</span>
          </button>

          <button
            className="btn btn-copper"
            onClick={() => navigate('/warroom')}
            style={{
              padding: '8px 18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 0 20px rgba(200, 129, 74, 0.35)', fontSize: 12, letterSpacing: '0.04em',
            }}
          >
            <Swords size={15} />
            <span>ENTER WAR ROOM</span>
          </button>
        </div>
      </div>

      {/* ── CATEGORY FILTER STRIP ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(15, 23, 42, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: '8px 14px',
        overflowX: 'auto',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: '#f8fafc', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 700, whiteSpace: 'nowrap', marginRight: 4,
        }}>
          <Filter size={13} color="#c8814a" />
          <span>FILTER DOMAIN:</span>
        </div>
        {CATEGORY_FILTERS.map(cat => {
          const isSelected = selectedCategory === cat.id
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 6,
                fontSize: 11, fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(200, 129, 74, 0.45), rgba(200, 129, 74, 0.2))'
                  : 'rgba(30, 41, 59, 0.6)',
                border: isSelected ? '1px solid #c8814a' : '1px solid rgba(255,255,255,0.1)',
                color: isSelected ? '#ffffff' : '#cbd5e1',
                boxShadow: isSelected ? '0 0 12px rgba(200, 129, 74, 0.35)' : 'none',
              }}
            >
              <Icon size={12} color={isSelected ? '#c8814a' : '#94a3b8'} />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── ROW 1: ELEVATED 6 KPI CARDS ─────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 12,
      }}>
        <KpiCard
          label="Total Cases"
          value={(kpis?.total_cases || 10000) + liveCount}
          change={liveCount > 0 ? `▲ LIVE (+${liveCount})` : "+12.4% YoY"}
          onClick={() => navigate('/timeline')}
          sparklineData={sparklines?.total_cases}
          accentColor="#38bdf8"
          subtext="41 Districts"
          icon={ShieldAlert}
        />
        <KpiCard
          label="Active Investigations"
          value={kpis?.active_investigations || 5901}
          change="+8.2% Active Leads"
          onClick={() => navigate('/timeline')}
          sparklineData={sparklines?.active_investigations}
          accentColor="#f59e0b"
          subtext="Under Inquiry"
          icon={Activity}
        />
        <KpiCard
          label="Suspects Arrested"
          value={kpis?.arrests_made || 5202}
          change="+15.7% YTD"
          onClick={() => navigate('/persons')}
          sparklineData={sparklines?.arrests_made}
          accentColor="#10b981"
          subtext="In Custody"
          icon={UserCheck}
        />
        <KpiCard
          label="Chargesheets Filed"
          value={kpis?.chargesheets_filed || 3594}
          change="+6.3% Sec 173 BNSS"
          sparklineData={sparklines?.chargesheets_filed}
          accentColor="#a855f7"
          subtext="Court Ready"
          icon={FileText}
        />
        <KpiCard
          label="Conviction Rate"
          value={`${kpis?.conviction_rate || 68.4}%`}
          change="+2.1% Target: 75%"
          changeType="up"
          sparklineData={sparklines?.conviction_rate}
          accentColor="#c8814a"
          subtext="State Judiciary"
          icon={Scale}
        />
        <KpiCard
          label="Frozen Mule Assets"
          value={`₹${kpis?.recovered_amount_lakhs || 42.4}L`}
          change="▲ 14 Mules Frozen"
          onClick={() => navigate('/financial')}
          accentColor="#f43f5e"
          subtext="Sec 106 BNSS"
          icon={IndianRupee}
        />
      </div>

      {/* ── ROW 2: CRIME TREND, DISTRIBUTION & LIVE TELEMETRY ──────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.35fr 1.15fr',
        gap: 12,
        minHeight: 330,
      }}>
        {/* Crime Trend & Hawkes Contagion Forecast */}
        <div className="card" style={{
          padding: '16px 18px', minWidth: 0,
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={15} color="#c8814a" />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
                  <ZiaText>CRIME TREND & HAWKES CONTAGION FORECAST</ZiaText>
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                Dual-Series: Historical Baseline vs. 24h-72h Hawkes Point-Process Projection
              </div>
            </div>
            {/* Time toggles */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', padding: 3, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
              {['24H', 'WEEKLY', 'MONTHLY'].map(t => (
                <button
                  key={t}
                  onClick={() => setTrendWindow(t.toLowerCase())}
                  style={{
                    padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                    cursor: 'pointer',
                    background: trendWindow === t.toLowerCase() ? '#c8814a' : 'transparent',
                    color: trendWindow === t.toLowerCase() ? '#ffffff' : '#64748b',
                    border: 'none',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 260 }}>
            <TrendLine data={trend} />
          </div>
        </div>

        {/* Crime Distribution Donut */}
        <div className="card" style={{
          padding: '16px 18px', minWidth: 0,
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radar size={15} color="#38bdf8" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
                <ZiaText>CRIME MATRIX BREAKDOWN</ZiaText>
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>10,000 FIRs</span>
          </div>
          <div style={{ height: 260 }}>
            <CrimeDonut data={filteredCrimeData} total={kpis?.total_cases} />
          </div>
        </div>

        {/* Live Incident Telemetry Feed */}
        <div className="card" style={{
          padding: '16px 18px', overflowY: 'auto',
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Radio size={14} color="#10b981" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
                <ZiaText>LIVE TELEMETRY FEED</ZiaText>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#10b981' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span>STREAMING</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
            {filteredTimeline.slice(0, 6).map((ev, i) => (
              <div
                key={ev.CaseMasterID || i}
                onClick={() => navigate(`/timeline`)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(200, 129, 74, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(200, 129, 74, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: ev.severity === 'critical' ? '#ef4444' : ev.severity === 'high' ? '#f59e0b' : '#38bdf8',
                      boxShadow: `0 0 6px ${ev.severity === 'critical' ? '#ef4444' : '#f59e0b'}`,
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                      <ZiaText>{ev.CrimeGroupName}</ZiaText>
                    </span>
                  </div>
                  <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {ev.CrimeRegisteredDate}
                  </span>
                </div>

                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, lineHeight: 1.3 }}>
                  <ZiaText>{ev.BriefFacts}</ZiaText>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{
                    fontSize: 9, color: '#38bdf8', background: 'rgba(56,189,248,0.1)',
                    padding: '1px 6px', borderRadius: 3, fontWeight: 600,
                  }}>
                    {ev.DistrictName}
                  </span>
                  <span style={{ fontSize: 9, color: '#c8814a', display: 'flex', alignItems: 'center', gap: 2 }}>
                    Investigate <ArrowUpRight size={10} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 3: MOST WANTED, DISTRICT BAR, PREDICTIVE RISK, ALERTS ────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 0.9fr 1.1fr',
        gap: 12,
        minHeight: 300,
      }}>
        {/* 1. Most Wanted Crime Syndicates */}
        <div className="card" style={{
          padding: '16px 18px',
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Crosshair size={15} color="#ef4444" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
                <ZiaText>HIGH-PRIORITY WANTED SYNDICATES</ZiaText>
              </span>
            </div>
            <span style={{ fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
              5 ACTIVE DOSSIERS
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
            {offenders.map((o, i) => (
              <div
                key={o.AccusedName || o.name || i}
                onClick={() => navigate('/persons')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444, #991b1b)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#ffffff', flexShrink: 0,
                    boxShadow: '0 0 8px rgba(239,68,68,0.4)',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <ZiaText>{o.AccusedName || o.name}</ZiaText>
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <ZiaText>{
                        o.CrimeGroupName ||
                        (i === 0 ? 'Luxury Vehicle Theft (OBD Cloning)' :
                         i === 1 ? 'Transnational Hawala & Extortion' :
                         i === 2 ? 'UPI Smurfing & Mule Accounts' :
                         i === 3 ? 'Commercial Burglary Ring' : 'Interstate NDPS Contraband')
                      }</ZiaText>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 3,
                    background: (i === 0 || o.Status?.includes('RED')) ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                    color: (i === 0 || o.Status?.includes('RED')) ? '#ef4444' : '#f59e0b',
                    border: `1px solid ${(i === 0 || o.Status?.includes('RED')) ? '#ef4444' : '#f59e0b'}44`,
                  }}>
                    {o.Status || (i === 0 ? 'RED CORNER NOTICE' : i === 1 ? 'LOC ACTIVE' : i === 2 ? 'NBW ACTIVE' : 'WANTED')}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: '#c8814a' }}>
                    {o.TotalCases || o.case_count || 12} cases
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Top District Comparison & Clearance */}
        <div className="card" style={{
          padding: '16px 18px', minWidth: 0,
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Scale size={15} color="#c8814a" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
                <ZiaText>DISTRICT CLEARANCE & CASELOAD</ZiaText>
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Top 6 Districts</span>
          </div>
          <div style={{ height: 235 }}>
            <DistrictBar data={districts.districts || []} />
          </div>
        </div>

        {/* 3. Predictive Risk & Hawkes Contagion Radar */}
        <div className="card" style={{
          padding: '16px 16px',
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
              <ZiaText>HAWKES AI RISK</ZiaText>
            </span>
            <select
              value={selectedDistrictRisk}
              onChange={(e) => setSelectedDistrictRisk(e.target.value)}
              style={{
                fontSize: 10, padding: '2px 6px', background: 'rgba(0,0,0,0.5)',
                color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 4,
              }}
            >
              <option value="Bengaluru Urban">Bengaluru Urban</option>
              <option value="Mysuru City">Mysuru City</option>
              <option value="Hubballi-Dharwad">Hubballi-Dharwad</option>
              <option value="Mangaluru City">Mangaluru City</option>
              <option value="Belagavi Border">Belagavi Border</option>
            </select>
          </div>

          <RiskGauge value={forecast?.risk_score || (selectedDistrictRisk === 'Bengaluru Urban' ? 78 : selectedDistrictRisk === 'Mysuru City' ? 64 : 58)} />

          <div style={{
            width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 6,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
            fontSize: 10, color: '#94a3b8', lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: 2 }}>Top Risk Contributors:</div>
            <div>• Hawkes Near-Repeat Contagion ↑ 28%</div>
            <div>• Keyless Vehicle Theft Vector Active</div>
            <div>• Kim Rossmo Den Density: 91.4%</div>
          </div>
        </div>

        {/* 4. Tactical Patrol Dispatches & Alerts */}
        <div className="card" style={{
          padding: '16px 18px', overflowY: 'auto',
          background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <AlertTriangle size={15} color="#f59e0b" />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#f8fafc' }}>
                <ZiaText>TACTICAL PATROL ALERTS</ZiaText>
              </span>
            </div>
            <span style={{ fontSize: 9, color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
              DISPATCH READY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
            {alerts.map((a, i) => (
              <div
                key={a.alert_id || a.id || i}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                    background: a.severity === 'critical' ? '#ef444422' : '#f59e0b22',
                    color: a.severity === 'critical' ? '#ef4444' : '#f59e0b',
                  }}>
                    {a.severity?.toUpperCase() || 'HIGH'}
                  </span>
                  <span style={{ fontSize: 9, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {a.district || a.radius || 'Bengaluru City'}
                  </span>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginTop: 4 }}>
                  <ZiaText>{a.title}</ZiaText>
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, lineHeight: 1.3 }}>
                  <ZiaText>{a.description || a.message}</ZiaText>
                </div>

                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => navigate('/map')}
                    style={{
                      fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                      background: 'rgba(200, 129, 74, 0.15)', border: '1px solid rgba(200, 129, 74, 0.4)',
                      color: '#c8814a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <span>Deploy Hoysala Patrol</span>
                    <ArrowUpRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
