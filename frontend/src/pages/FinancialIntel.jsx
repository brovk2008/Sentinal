import { useState, useEffect, useRef } from 'react'
import { fetchSuspiciousTxns, fetchMuleAccounts, fetchFinancialSummary } from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'

export default function FinancialIntel() {
  const [txns, setTxns] = useState([])
  const [mules, setMules] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchSuspiciousTxns(50).catch(() => []),
      fetchMuleAccounts().catch(() => []),
      fetchFinancialSummary().catch(() => null),
    ]).then(([t, m, s]) => {
      setTxns(t)
      setMules(m)
      setSummary(s)
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingPulse text="Retrieving financial intelligence..." />

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Financial Intelligence (FININT)</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Suspicious transaction monitoring and money mule account detection
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
            <div className="section-label">Total Volume Monitored</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              Rs. {summary.summary.total_amount?.toLocaleString('en-IN') || 0}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Across {summary.summary.total_txns?.toLocaleString()} transactions
            </div>
          </div>

          <div className="card" style={{ borderColor: 'var(--status-danger)' }}>
            <div className="section-label" style={{ color: 'var(--status-danger)' }}>Suspicious Volume</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--status-danger)' }}>
              Rs. {summary.summary.suspicious_amount?.toLocaleString('en-IN') || 0}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {summary.summary.suspicious_count} flagged transfers
            </div>
          </div>

          <div className="card">
            <div className="section-label">Avg Transaction Value</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
              Rs. {Math.round(summary.summary.avg_amount || 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="card">
            <div className="section-label">Mule Accounts Detected</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--status-warning)' }}>
              {mules.length} Accounts
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Receiving from 3+ unique sources
            </div>
          </div>
        </div>
      )}

      {/* Two panels: Mule accounts & Suspicious transactions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
      }}>
        {/* Suspicious Transactions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 500 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Suspicious Transfer Ledger</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 4px' }}>Sender</th>
                  <th style={{ padding: '8px 4px' }}>Receiver</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '8px 4px' }}>Type</th>
                  <th style={{ padding: '8px 4px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 500 }}>{t.sender_name}</td>
                    <td style={{ padding: '8px 4px' }}>{t.receiver_name}</td>
                    <td className="mono" style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--status-danger)' }}>
                      ₹{t.amount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      <Badge text={t.txn_type} variant="badge-copper" />
                    </td>
                    <td className="mono" style={{ padding: '8px 4px', color: 'var(--text-muted)', fontSize: 10 }}>
                      {t.txn_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mule accounts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 500 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Money Mule Account Anomaly Detection</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 4px' }}>Account Holder</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Unique Senders</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total Received</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Flagged Txns</th>
                </tr>
              </thead>
              <tbody>
                {mules.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 4px', fontWeight: 500 }}>{m.name}</td>
                    <td className="mono" style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--status-warning)', fontWeight: 'bold' }}>
                      {m.unique_senders}
                    </td>
                    <td className="mono" style={{ padding: '8px 4px', textAlign: 'right' }}>
                      ₹{m.total_received.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <span className="badge badge-danger">{m.suspicious_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
