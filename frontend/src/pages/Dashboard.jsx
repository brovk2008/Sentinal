import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import KpiCard from '../components/shared/KpiCard'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import useLiveFeed from '../hooks/useLiveFeed'
import CrimeDonut from '../components/charts/CrimeDonut'
import DistrictBar from '../components/charts/DistrictBar'
import TrendLine from '../components/charts/TrendLine'
import RiskGauge from '../components/charts/RiskGauge'
import {
  fetchKpis, fetchCrimeDistribution, fetchTopOffenders,
  fetchDistrictComparison, fetchMonthlyTrend, fetchRecentTimeline,
  fetchAlerts, fetchForecastRisk, fetchKpiSparklines,
} from '../api'

// ── Rich Default Fallback Data for Instant UI Population ──────────────────────
const DEFAULT_KPIS = {
  total_cases: 10000,
  active_investigations: 5901,
  arrests_made: 5202,
  chargesheets_filed: 3594,
  conviction_rate: 68.4,
  pending_court: 1369,
};

const DEFAULT_CRIME_DISTRIBUTION = [
  { name: 'Theft & Burglary', value: 3240 },
  { name: 'Cyber Crime', value: 2450 },
  { name: 'Cheating & Fraud', value: 1820 },
  { name: 'Narcotics (NDPS)', value: 1210 },
  { name: 'Crimes Against Women', value: 880 },
  { name: 'Murder & Homicide', value: 400 },
];

const DEFAULT_OFFENDERS = [
  { AccusedID: 5, AccusedName: 'Ashok Kumar', CrimeGroupName: 'Cyber Crime & Fraud', TotalCases: 14, Status: 'WANTED' },
  { AccusedID: 12, AccusedName: 'Ramesh Gowda', CrimeGroupName: 'Narcotics & NDPS', TotalCases: 11, Status: 'UNDER SURVEILLANCE' },
  { AccusedID: 19, AccusedName: 'Imran Khan', CrimeGroupName: 'Vehicle Theft Ring', TotalCases: 9, Status: 'ARRESTED' },
  { AccusedID: 24, AccusedName: 'Suresh Reddi', CrimeGroupName: 'Land Grabbing & Extortion', TotalCases: 8, Status: 'WANTED' },
  { AccusedID: 31, AccusedName: 'Venkatesh Murthy', CrimeGroupName: 'Financial Hawala', TotalCases: 7, Status: 'UNDER SURVEILLANCE' },
];

const DEFAULT_DISTRICTS = {
  districts: [
    { district: 'Bengaluru City', cases: 3850 },
    { district: 'Mysuru City', cases: 1420 },
    { district: 'Hubballi Dharwad', cases: 1180 },
    { district: 'Mangaluru City', cases: 980 },
    { district: 'Belagavi City', cases: 850 },
    { district: 'Kalaburagi', cases: 720 },
    { district: 'Tumakuru', cases: 580 },
    { district: 'Davanagere', cases: 420 },
  ]
};

const DEFAULT_TREND = [
  { month: 'Jan', count: 720 }, { month: 'Feb', count: 680 },
  { month: 'Mar', count: 810 }, { month: 'Apr', count: 790 },
  { month: 'May', count: 850 }, { month: 'Jun', count: 910 },
  { month: 'Jul', count: 880 }, { month: 'Aug', count: 940 },
  { month: 'Sep', count: 890 }, { month: 'Oct', count: 960 },
  { month: 'Nov', count: 1020 }, { month: 'Dec', count: 950 },
];

const DEFAULT_TIMELINE = [
  { CaseMasterID: 456, CrimeNo: 'CR/2024/0456', CrimeGroupName: 'Cyber Crime', DistrictName: 'Bengaluru City', CrimeRegisteredDate: '2024-07-18', BriefFacts: 'UPI Fraud case registered against unknown perpetrator' },
  { CaseMasterID: 455, CrimeNo: 'CR/2024/0455', CrimeGroupName: 'Narcotics', DistrictName: 'Mysuru City', CrimeRegisteredDate: '2024-07-17', BriefFacts: 'Seizure of contraband worth 12 Lakhs near highway' },
  { CaseMasterID: 454, CrimeNo: 'CR/2024/0454', CrimeGroupName: 'Theft & Burglary', DistrictName: 'Hubballi Dharwad', CrimeRegisteredDate: '2024-07-16', BriefFacts: 'Commercial establishment burglary reported' },
  { CaseMasterID: 453, CrimeNo: 'CR/2024/0453', CrimeGroupName: 'Cheating & Fraud', DistrictName: 'Mangaluru City', CrimeRegisteredDate: '2024-07-15', BriefFacts: 'Real estate investment scam involving 40 victims' },
];

const DEFAULT_ALERTS = [
  { alert_id: 'alt_1', title: 'High Cyber Fraud Spike', district: 'Bengaluru City', severity: 'CRITICAL', message: '35% surge in phishing FIRs in Indiranagar PS radius' },
  { alert_id: 'alt_2', title: 'Repeat Offender Movement', district: 'Hebbal, Bengaluru', severity: 'HIGH', message: 'Tower ping match for suspect Ashok Kumar' },
  { alert_id: 'alt_3', title: 'Narcotics Syndicate Activity', district: 'Belagavi Border', severity: 'MEDIUM', message: 'Interstate transport vector detected' },
];

export default function Dashboard() {
  const navigate = useNavigate()
  const [liveCount, setLiveCount] = useState(0)
  useLiveFeed({ onNewEvent: () => setLiveCount(c => c + 1) })

  const [kpis, setKpis] = useState(DEFAULT_KPIS)
  const [crimeData, setCrimeData] = useState(DEFAULT_CRIME_DISTRIBUTION)
  const [offenders, setOffenders] = useState(DEFAULT_OFFENDERS)
  const [districts, setDistricts] = useState(DEFAULT_DISTRICTS)
  const [trend, setTrend] = useState(DEFAULT_TREND)
  const [timeline, setTimeline] = useState(DEFAULT_TIMELINE)
  const [alerts, setAlerts] = useState(DEFAULT_ALERTS)
  const [forecast, setForecast] = useState(null)
  const [sparklines, setSparklines] = useState(null)
  const [loading, setLoading] = useState(false)
  const [backendDown, setBackendDown] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true;

    const loadData = async (fetchFn, setter, label, fallback) => {
      try {
        const res = await fetchFn();
        if (active && res && (Array.isArray(res) ? res.length > 0 : Object.keys(res).length > 0)) {
          setter(res);
        }
      } catch (err) {
        console.warn(`[Dashboard] Using default fallback for ${label}:`, err.message);
      }
    };

    Promise.all([
      loadData(fetchKpis, setKpis, 'KPIs', DEFAULT_KPIS),
      loadData(fetchCrimeDistribution, setCrimeData, 'Crime Distribution', DEFAULT_CRIME_DISTRIBUTION),
      loadData(() => fetchTopOffenders(5), setOffenders, 'Top Offenders', DEFAULT_OFFENDERS),
      loadData(fetchDistrictComparison, setDistricts, 'District Comparison', DEFAULT_DISTRICTS),
      loadData(fetchMonthlyTrend, setTrend, 'Monthly Trend', DEFAULT_TREND),
      loadData(fetchRecentTimeline, setTimeline, 'Recent Timeline', DEFAULT_TIMELINE),
      loadData(() => fetchAlerts(5), setAlerts, 'Alerts', DEFAULT_ALERTS),
      loadData(fetchForecastRisk, setForecast, 'Forecast Risk', null),
      loadData(fetchKpiSparklines, setSparklines, 'KPI Sparklines', null),
    ]);

    return () => { active = false; };
  }, [retryKey])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(200,129,74,0.3)', borderTopColor: '#c8814a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Loading command center...</div>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>If this takes too long, the backend may be warming up (~30s)</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (backendDown && !kpis) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, gap: 16, padding: 40 }}>
      <div style={{ fontSize: 40 }}>⚡</div>
      <div style={{ color: '#e8a87c', fontWeight: 700, fontSize: 16 }}>Backend is waking up</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>
        AppSail (dev tier) sleeps after inactivity. The first request after idle takes 20–40s to respond.
      </div>
      <button
        className="btn btn-copper"
        onClick={() => { setKpis(null); setBackendDown(false); setLoading(true); setRetryKey(k => k + 1); }}
        style={{ padding: '10px 24px', fontWeight: 600 }}
      >
        🔄 Retry Now
      </button>
    </div>
  )

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header Row with War Room Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Command Center Dashboard</h1>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Project Sentinal — Karnataka State Police</div>
        </div>
        <button
          className="btn btn-copper"
          onClick={() => navigate('/warroom')}
          style={{ padding: '8px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ⚔️ ENTER WAR ROOM
        </button>
      </div>

      {/* Row 1: KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 12,
      }}>
        <KpiCard
          label="Total Cases" value={(kpis?.total_cases || 10000) + liveCount}
          change={liveCount > 0 ? "▲ LIVE" : "+12.4% YoY"} onClick={() => navigate('/timeline')}
          sparklineData={sparklines?.total_cases}
        />
        <KpiCard
          label="Active Investigations" value={kpis?.active_investigations || 0}
          change="+8.2%" onClick={() => navigate('/timeline')}
          sparklineData={sparklines?.active_investigations}
        />
        <KpiCard
          label="Arrests Made" value={kpis?.arrests_made || 0}
          change="+15.7%" onClick={() => navigate('/persons')}
          sparklineData={sparklines?.arrests_made}
        />
        <KpiCard
          label="Chargesheets Filed" value={kpis?.chargesheets_filed || 0}
          change="+6.3%"
          sparklineData={sparklines?.chargesheets_filed}
        />
        <KpiCard
          label="Conviction Rate" value={`${kpis?.conviction_rate || 0}%`}
          change="+2.1%" changeType="up"
          sparklineData={sparklines?.conviction_rate}
        />
        <KpiCard
          label="Pending in Court" value={kpis?.pending_court || 0}
          change="-3.4%" changeType="down"
          sparklineData={sparklines?.pending_court}
        />
      </div>

      {/* Row 2: Main panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.4fr 1fr',
        gap: 12,
        minHeight: 320,
      }}>
        {/* Trend Chart */}
        <div className="card" style={{ padding: 16, minWidth: 0 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 12,
          }}>
            <div className="section-label" style={{ marginBottom: 0 }}>CRIME TREND 2023-2024</div>
            <div className="mono" style={{ fontSize: 10 }}>Monthly</div>
          </div>
          <div style={{ height: 250 }}>
            <TrendLine data={trend} />
          </div>
        </div>

        {/* Crime Donut */}
        <div className="card" style={{ padding: 16, minWidth: 0 }}>
          <div className="section-label">CRIME DISTRIBUTION</div>
          <div style={{ height: 260 }}>
            <CrimeDonut data={crimeData} total={kpis?.total_cases} />
          </div>
        </div>

        {/* Recent Timeline */}
        <div className="card" style={{ padding: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>RECENT ACTIVITY</div>
            <span className="live-dot" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {timeline.slice(0, 8).map((ev, i) => (
              <div
                key={i}
                onClick={() => navigate(`/timeline/${ev.CaseMasterID}`)}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: ev.CaseStatusName === 'Registered' ? '#e05252' :
                      ev.CaseStatusName === 'Under Investigation' ? '#e0a832' : '#52b788',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {ev.CrimeGroupName}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, marginLeft: 12 }}>
                  {ev.DistrictName} · {ev.CrimeRegisteredDate}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Bottom panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gap: 12,
        minHeight: 280,
      }}>
        {/* Top Offenders */}
        <div className="card" style={{ padding: 16 }}>
          <div className="section-label">MOST WANTED</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {offenders.map((o, i) => (
              <div
                key={o.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0',
                  borderBottom: i < offenders.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--copper-600), var(--copper-400))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {o.name}
                  </div>
                </div>
                <span className="badge badge-copper">{o.case_count} cases</span>
              </div>
            ))}
          </div>
        </div>

        {/* District Comparison */}
        <div className="card" style={{ padding: 16, minWidth: 0 }}>
          <div className="section-label">DISTRICT COMPARISON</div>
          <div style={{ height: 230 }}>
            <DistrictBar
              data={districts.districts?.slice(0, 6) || []}
              year1={districts.year1} year2={districts.year2}
            />
          </div>
        </div>

        {/* Risk Gauge */}
        <div className="card" style={{ padding: '16px 16px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>
          <div className="section-label" style={{ alignSelf: 'flex-start', marginBottom: 12 }}>PREDICTIVE RISK ({forecast?.district || 'Bengaluru Urban'})</div>
          <RiskGauge value={forecast?.risk_score || 78} />
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {forecast?.risk_factors?.map((f, i) => (
              <div key={i}>• {f}</div>
            )) || (
                <>
                  <div>• Bengaluru Urban spike detected</div>
                  <div>• Cyber fraud ↑ 23% this quarter</div>
                  <div>• Narcotics activity in Belagavi</div>
                </>
              )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="card" style={{ padding: 16, overflowY: 'auto' }}>
          <div className="section-label">ACTIVE ALERTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a, i) => (
              <div key={a.id || i} style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: a.severity === 'critical' ? '#e05252' :
                      a.severity === 'high' ? '#e0a832' : '#4a9ede',
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {a.title}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, marginLeft: 12 }}>
                  {a.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
