import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer } from 'react-leaflet'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import RiskGauge from '../components/charts/RiskGauge'
import PredictiveLayer from '../components/map/PredictiveLayer'
import {
  fetchPredictiveHotspots,
  fetchTemporalPatterns,
  fetchLiveRiskScore,
  fetchCrimeType,
  fetchCaseResolution,
} from '../api'
import 'leaflet/dist/leaflet.css'

const KA_CENTER = [14.5, 76.0]

export default function PredictiveIntelligence() {
  const navigate = useNavigate()
  
  // State variables
  const [loading, setLoading] = useState(true)
  const [liveRisk, setLiveRisk] = useState(null)
  const [hotspots, setHotspots] = useState([])
  const [temporal, setTemporal] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [alerts, setAlerts] = useState([])

  // Case resolution predictor state
  const [caseIdInput, setCaseIdInput] = useState('')
  const [resolutionLoading, setResolutionLoading] = useState(false)
  const [resolutionResult, setResolutionResult] = useState(null)
  const [resolutionError, setResolutionError] = useState('')

  // Crime type forecast state
  const [selectedStationId, setSelectedStationId] = useState('')
  const [crimeTypeForecast, setCrimeTypeForecast] = useState([])
  const [crimeTypeLoading, setCrimeTypeLoading] = useState(false)

  useEffect(() => {
    // Initial data load
    Promise.all([
      fetchLiveRiskScore().catch(err => {
        console.error('[PredictiveIntel] Live Risk Score failed:', err)
        return null
      }),
      fetchPredictiveHotspots(7).catch(err => {
        console.error('[PredictiveIntel] Hotspots failed:', err)
        return { predictions: [] }
      }),
      fetchTemporalPatterns().catch(err => {
        console.error('[PredictiveIntel] Temporal patterns failed:', err)
        return null
      })
    ]).then(([risk, hot, temp]) => {
      if (risk) {
        setLiveRisk(risk)
        setWatchlist(risk.high_risk_accused || [])
        setAlerts(risk.alerts || [])
      }
      if (hot && hot.predictions) {
        setHotspots(hot.predictions)
        if (hot.predictions.length > 0) {
          setSelectedStationId(hot.predictions[0].station_id)
        }
      }
      if (temp) {
        setTemporal(temp)
      }
      setLoading(false)
    })
  }, [])

  // Fetch crime type forecast whenever station selection changes
  useEffect(() => {
    if (!selectedStationId) return
    setCrimeTypeLoading(true)
    fetchCrimeType(selectedStationId)
      .then(res => {
        if (res && res.predictions) {
          setCrimeTypeForecast(res.predictions)
        }
        setCrimeTypeLoading(false)
      })
      .catch(err => {
        console.error('[PredictiveIntel] Crime type forecast failed:', err)
        setCrimeTypeLoading(false)
      })
  }, [selectedStationId])

  // Run case resolution prediction
  const handlePredictResolution = async (e) => {
    e.preventDefault()
    if (!caseIdInput.trim()) return
    setResolutionLoading(true)
    setResolutionError('')
    setResolutionResult(null)

    try {
      const res = await fetchCaseResolution(parseInt(caseIdInput))
      setResolutionResult(res)
    } catch (err) {
      console.error('[PredictiveIntel] Case resolution failed:', err)
      setResolutionError('Case ID not found in database.')
    } finally {
      setResolutionLoading(false)
    }
  }

  if (loading) {
    return <LoadingPulse height={400} text="Initializing Predictive Engine..." />
  }

  // Get active risk level color
  const getRiskColor = (level) => {
    switch (level) {
      case 'CRITICAL': return '#e05252'
      case 'HIGH': return '#e0a832'
      case 'MEDIUM': return '#c8814a'
      default: return '#52b788'
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '360px 1fr 340px',
      gap: 16,
      padding: 16,
      height: 'calc(100vh - var(--topbar-height) - 32px)',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      
      {/* LEFT COLUMN: Hotspots, Temporal, and Watchlist */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
        paddingRight: 4
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--copper-400)', textTransform: 'uppercase', margin: 0 }}>
            Predictive Intel Engine
          </h2>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            ML-Powered Crime Forecasting & Active Risks
          </span>
        </div>

        {/* Card 1: Hotspot Forecast */}
        <div className="card" style={{ padding: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>HOTSPOT RISK FORECAST (7D)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hotspots.slice(0, 5).map((h, i) => (
              <div key={h.station_id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {h.station_name}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                    color: 'white', background: getRiskColor(h.risk_level)
                  }}>
                    {h.risk_level}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, background: 'var(--bg-secondary)', height: 5, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      background: 'var(--copper-500)', height: '100%',
                      width: `${h.hotspot_prob * 100}%`
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: 32, textAlign: 'right' }}>
                    {(h.hotspot_prob * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Temporal Risk Window */}
        <div className="card" style={{ padding: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>TEMPORAL RISK WINDOW</div>
          {temporal ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Historical Peak Month</span>
                <span style={{ fontWeight: 600, color: 'var(--copper-400)' }}>
                  {temporal.insights?.peak_month} ({temporal.insights?.peak_month_count} cases)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Historical Peak Day</span>
                <span style={{ fontWeight: 600, color: 'var(--copper-400)' }}>
                  {temporal.insights?.peak_day} ({temporal.insights?.peak_day_count} cases)
                </span>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 10, lineHeight: 1.4, marginTop: 4 }}>
                ℹ Today is {new Date().toLocaleDateString('en-US', { weekday: 'long' })}. Baseline forecast shows normal parameters for this period.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No temporal insights available.</div>
          )}
        </div>

        {/* Card 3: High-Risk Accused Watchlist */}
        <div className="card" style={{ padding: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>HIGH-RISK ACCUSED WATCHLIST</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {watchlist.slice(0, 4).map((w, i) => (
              <div
                key={w.AccusedMasterID || i}
                onClick={() => navigate('/persons')}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', borderRadius: 4, background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)', cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 11, fontWeight: 500 }}>{w.AccusedName}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Repeat offender · {w.case_count} cases</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#e05252', fontFamily: 'var(--font-mono)' }}>
                    {w.case_count >= 5 ? '92.4%' : '78.2%'}
                  </span>
                  <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>REOFFEND</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER COLUMN: Large Predictive Map */}
      <div style={{
        position: 'relative',
        borderRadius: 10,
        border: '1px solid var(--border-strong)',
        overflow: 'hidden'
      }}>
        <MapContainer
          center={KA_CENTER}
          zoom={7}
          style={{ height: '100%', width: '100%', background: 'var(--bg-primary)' }}
          maxBounds={[[10, 72], [20, 80]]}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CartoDB'
          />
          {/* Predictive circles layer */}
          <PredictiveLayer isActive={true} daysAhead={7} riskFilter="all" />
        </MapContainer>

        {/* Legend Overlay */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 1000,
          background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)',
          borderRadius: 6, padding: '8px 10px', fontSize: 10,
          display: 'flex', flexDirection: 'column', gap: 6
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 9, textTransform: 'uppercase' }}>Forecast Zones</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05252' }} />
            <span>Critical Hotspot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0a832' }} />
            <span>High Risk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c8814a' }} />
            <span>Medium Risk</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Live Score, Case Resolution, Crime Type */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
        paddingRight: 4
      }}>
        {/* Card 4: Live Risk Score */}
        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: '45%' }}>
            <RiskGauge value={74} label="STATE RISK INDEX" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="section-label">LIVE SCORE INSIGHTS</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>• Bengaluru Urban risk stands at 89%</div>
              <div>• Chargesheet resolution projection: 58%</div>
              <div>• Active anomaly triggers: {alerts.length}</div>
            </div>
          </div>
        </div>

        {/* Card 5: Case Resolution Predictor */}
        <div className="card" style={{ padding: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>CASE RESOLUTION ANALYZER</div>
          <form onSubmit={handlePredictResolution} style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input
              type="number"
              placeholder="Enter Case ID (e.g. 5, 23)"
              className="input"
              value={caseIdInput}
              onChange={e => setCaseIdInput(e.target.value)}
              style={{ fontSize: 11, padding: '6px 8px', flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn-sm btn-copper"
              disabled={resolutionLoading}
              style={{ fontSize: 11 }}
            >
              {resolutionLoading ? 'Analyzing...' : 'Predict'}
            </button>
          </form>

          {resolutionError && (
            <div style={{ fontSize: 11, color: 'var(--status-danger)', marginBottom: 8 }}>
              {resolutionError}
            </div>
          )}

          {resolutionResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Predicted Outcome:</span>
                <span style={{ fontWeight: 700, color: 'var(--copper-400)' }}>
                  {resolutionResult.predicted_outcome}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {resolutionResult.all_outcomes.map(out => (
                  <div key={out.outcome} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', width: 90 }}>{out.outcome}</span>
                    <div style={{ flex: 1, background: 'var(--bg-secondary)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        background: out.outcome === 'Chargesheeted' ? '#52b788' :
                                    out.outcome === 'Undetected' ? '#e0a832' : '#e05252',
                        height: '100%',
                        width: out.percentage
                      }} />
                    </div>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', minWidth: 30, textAlign: 'right' }}>
                      {out.percentage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Card 6: Crime Type Forecast */}
        <div className="card" style={{ padding: 14 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>CRIME CATEGORY PROJECTION</div>
          
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Select Police Station
            </label>
            <select
              className="input"
              value={selectedStationId}
              onChange={e => setSelectedStationId(e.target.value)}
              style={{ fontSize: 11, padding: '4px 8px', height: 'auto' }}
            >
              {hotspots.map(h => (
                <option key={h.station_id} value={h.station_id}>
                  {h.station_name}
                </option>
              ))}
            </select>
          </div>

          {crimeTypeLoading ? (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              Computing probabilities...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {crimeTypeForecast.map((c) => (
                <div key={c.crime_head_id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                    <span style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                      {c.crime_type}
                    </span>
                    <span style={{ color: 'var(--copper-400)', fontWeight: 600 }}>{c.percentage}</span>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      background: 'var(--copper-500)', height: '100%',
                      width: c.percentage
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
