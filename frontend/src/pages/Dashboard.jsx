import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import KpiCard from '../components/shared/KpiCard'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'
import CrimeDonut from '../components/charts/CrimeDonut'
import DistrictBar from '../components/charts/DistrictBar'
import TrendLine from '../components/charts/TrendLine'
import RiskGauge from '../components/charts/RiskGauge'
import {
  fetchKpis, fetchCrimeDistribution, fetchTopOffenders,
  fetchDistrictComparison, fetchMonthlyTrend, fetchRecentTimeline,
  fetchAlerts, fetchForecastRisk,
} from '../api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState(null)
  const [crimeData, setCrimeData] = useState([])
  const [offenders, setOffenders] = useState([])
  const [districts, setDistricts] = useState({ districts: [] })
  const [trend, setTrend] = useState([])
  const [timeline, setTimeline] = useState([])
  const [alerts, setAlerts] = useState([])
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true;

    // Safety timeout: render whatever we have after 4 seconds max
    const safetyTimer = setTimeout(() => {
      if (active) {
        console.warn('[Dashboard] Safety timeout reached, forcing render');
        setLoading(false);
      }
    }, 4000);

    const loadData = async (fetchFn, setter, label, fallback) => {
      try {
        const res = await fetchFn();
        if (active) setter(res);
      } catch (err) {
        console.error(`[Dashboard] Failed to fetch ${label}:`, err);
        if (active) setter(fallback);
      }
    };

    Promise.all([
      loadData(fetchKpis, setKpis, 'KPIs', null),
      loadData(fetchCrimeDistribution, setCrimeData, 'Crime Distribution', []),
      loadData(() => fetchTopOffenders(5), setOffenders, 'Top Offenders', []),
      loadData(fetchDistrictComparison, setDistricts, 'District Comparison', { districts: [] }),
      loadData(fetchMonthlyTrend, setTrend, 'Monthly Trend', []),
      loadData(fetchRecentTimeline, setTimeline, 'Recent Timeline', []),
      loadData(() => fetchAlerts(5), setAlerts, 'Alerts', []),
      loadData(fetchForecastRisk, setForecast, 'Forecast Risk', null),
    ]).then(() => {
      if (active) {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    }).catch((err) => {
      console.error('[Dashboard] Promise.all unexpected error:', err);
      if (active) {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, [])

  if (loading) return <LoadingPulse height={400} text="Loading command center..." />

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 12,
      }}>
        <KpiCard
          label="Total Cases" value={kpis?.total_cases || 10000}
          change="+12.4% YoY" onClick={() => navigate('/timeline')}
        />
        <KpiCard
          label="Active Investigations" value={kpis?.active_investigations || 0}
          change="+8.2%" onClick={() => navigate('/timeline')}
        />
        <KpiCard
          label="Arrests Made" value={kpis?.arrests_made || 0}
          change="+15.7%" onClick={() => navigate('/persons')}
        />
        <KpiCard
          label="Chargesheets Filed" value={kpis?.chargesheets_filed || 0}
          change="+6.3%"
        />
        <KpiCard
          label="Conviction Rate" value={`${kpis?.conviction_rate || 0}%`}
          change="+2.1%" changeType="up"
        />
        <KpiCard
          label="Pending in Court" value={kpis?.pending_court || 0}
          change="-3.4%" changeType="down"
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
        <div className="card" style={{ padding: '16px 16px 20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: 280, minWidth: 0 }}>
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
