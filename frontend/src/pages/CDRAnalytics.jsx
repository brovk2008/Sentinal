import { useState, useEffect } from 'react'
import { fetchFrequentCallers, fetchTowerActivity, fetchPreIncidentCalls, fetchCdrSummary } from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'

export default function CDRAnalytics() {
  const [frequentCallers, setFrequentCallers] = useState([])
  const [towerActivity, setTowerActivity] = useState([])
  const [preIncident, setPreIncident] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchFrequentCallers(20).catch(() => []),
      fetchTowerActivity().catch(() => []),
      fetchPreIncidentCalls().catch(() => []),
      fetchCdrSummary().catch(() => null),
    ]).then(([f, t, p, s]) => {
      setFrequentCallers(f)
      setTowerActivity(t)
      setPreIncident(p)
      setSummary(s)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingPulse text="Compiling Call Detail Records (CDR)..." />

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Call Detail Record (CDR) Analytics</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Communication surveillance analysis, cell tower linkages, and pre-incident coordination tracking
        </div>
      </div>

      {/* Aggregate Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}>
          <div className="card">
            <div className="section-label">Total Logs Analyzed</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              {summary.total_records?.toLocaleString()} Calls
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Active surveillance feed
            </div>
          </div>

          <div className="card">
            <div className="section-label">Target Linked Numbers</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--copper-400)' }}>
              {summary.linked_to_accused?.toLocaleString()} Logs
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Directly connected to accused persons
            </div>
          </div>

          <div className="card">
            <div className="section-label">Unique Subscribers</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              {summary.unique_callers?.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Distinct callers identified
            </div>
          </div>

          <div className="card">
            <div className="section-label">Avg Call Duration</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              {Math.round(summary.avg_duration || 0)}s
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Typical voice link duration
            </div>
          </div>
        </div>
      )}

      {/* Panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 16,
      }}>
        {/* Pre-Incident Calls */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 450 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Pre-Incident Coordinated Calls</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px 4px' }}>Caller</th>
                  <th style={{ padding: '6px 4px' }}>Receiver</th>
                  <th style={{ padding: '6px 4px' }}>Call Date</th>
                  <th style={{ padding: '6px 4px' }}>Target Case</th>
                  <th style={{ padding: '6px 4px' }}>Incident Date</th>
                </tr>
              </thead>
              <tbody>
                {preIncident.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '6px 4px', fontWeight: 500 }}>{p.caller_name}</td>
                    <td style={{ padding: '6px 4px' }}>{p.receiver_name}</td>
                    <td className="mono" style={{ padding: '6px 4px', color: 'var(--status-warning)' }}>{p.call_date}</td>
                    <td className="mono" style={{ padding: '6px 4px' }}>{p.CrimeNo}</td>
                    <td className="mono" style={{ padding: '6px 4px', color: 'var(--text-muted)' }}>{p.IncidentFromDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cell Tower Volume Activity */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 450 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Surveillance Tower Volumes</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px 4px' }}>District Location</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Total Calls</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Duration (Hrs)</th>
                </tr>
              </thead>
              <tbody>
                {towerActivity.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '6px 4px', fontWeight: 500 }}>{t.DistrictName}</td>
                    <td className="mono" style={{ padding: '6px 4px', textAlign: 'right' }}>{t.call_count.toLocaleString()}</td>
                    <td className="mono" style={{ padding: '6px 4px', textAlign: 'right' }}>
                      {Math.round(t.total_duration / 3600).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Frequent Callers List */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Most Active Accused-Linked Communication Links</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 4px' }}>Subscriber Name</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>Total Call Vol</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>Unique Contacts</th>
                <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total Cumulative Duration</th>
                <th style={{ padding: '8px 4px', textAlign: 'center' }}>Linked Criminal Cases</th>
              </tr>
            </thead>
            <tbody>
              {frequentCallers.map((f, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px 4px', fontWeight: 500 }}>{f.name}</td>
                  <td className="mono" style={{ padding: '8px 4px', textAlign: 'center' }}>{f.total_calls}</td>
                  <td className="mono" style={{ padding: '8px 4px', textAlign: 'center' }}>{f.unique_contacts}</td>
                  <td className="mono" style={{ padding: '8px 4px', textAlign: 'right' }}>
                    {Math.round(f.total_duration / 60)} mins
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                    <span className="badge badge-copper">{f.linked_cases}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
