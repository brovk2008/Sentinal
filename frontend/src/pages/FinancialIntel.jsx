import { useState, useEffect, useRef } from 'react'
import { fetchSuspiciousTxns, fetchMuleAccounts, fetchFinancialSummary, detectSmurfingRings } from '../api'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import { ShieldAlert, FileText, CheckCircle2, AlertTriangle, Layers, X, Printer, Lock } from 'lucide-react'

function SmurfingModal({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    detectSmurfingRings({ primary_account: "HDFC-MULE-991204821" })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0d0d1a', border: '1px solid var(--status-danger)',
        borderRadius: 14, padding: 24, width: 720, maxHeight: '85vh',
        overflowY: 'auto', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} color="#ff4d4f" />
            <span style={{ fontWeight: 700, fontSize: 15 }}>HAWALA & UPI SMURFING RING DE-ANONYMIZER</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Analyzing transaction graphs, sub-₹50k layering hops & UBO beneficiaries...</div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {/* Overview */}
            <div style={{ background: 'rgba(224,82,82,0.15)', border: '1px solid rgba(224,82,82,0.4)', padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#ff7875', fontWeight: 700 }}>★ CYBER MULE SYNDICATE UNMASKED ({data.cyber_syndicate_confidence}% CONFIDENCE)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                Total Diverted Fraud Volume: Rs. {data.total_diverted_amount_inr?.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: '#ccc', marginTop: 2 }}>
                Network: <strong>{data.mule_network_size} Intermediary Mule Accounts</strong> fan-out to evade PMLA reporting limits.
              </div>
            </div>

            {/* Layering Analysis */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--copper-400)', marginBottom: 6 }}>3-STAGE MULE ROUTING TOPOLOGY:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.layering_analysis.map((l, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--copper-500)', padding: 10, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{l.layer}</div>
                    {l.account && <div>Account: <span className="mono" style={{ color: 'var(--copper-300)' }}>{l.account}</span> {l.holder_name && `(${l.holder_name})`}</div>}
                    {l.smurfing_signature && <div style={{ color: '#ff7875', marginTop: 2 }}>Signature: {l.smurfing_signature}</div>}
                    {l.destination && <div style={{ color: '#52e07a', marginTop: 2 }}>Off-Ramp Destination: <strong>{l.destination}</strong></div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory Bank Freeze Order */}
            <div style={{ background: 'rgba(82,224,204,0.08)', border: '1px solid rgba(82,224,204,0.3)', padding: 12, borderRadius: 8, fontSize: 11 }}>
              <div style={{ fontWeight: 700, color: '#52e0cc', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} />
                <span>STATUTORY BANK FREEZE NOTICE ({data.statutory_freeze_order.statutory_act})</span>
              </div>
              <div style={{ color: '#eee', marginTop: 4 }}>Order No: <strong>{data.statutory_freeze_order.order_number}</strong></div>
              <div style={{ color: '#ccc', marginTop: 2 }}>Directive: {data.statutory_freeze_order.bank_directive}</div>
              <div style={{ color: '#888', fontSize: 10, marginTop: 4 }}>Digital Signature Hash: {data.statutory_freeze_order.digital_signature_hash}</div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'var(--copper-500)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Export Statutory Freeze Notice (PDF)
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function FinancialIntel() {
  const [txns, setTxns] = useState([])
  const [mules, setMules] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSmurfingModal, setShowSmurfingModal] = useState(false)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Financial Intelligence (FININT)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Suspicious transaction monitoring, money mule account detection, and Hawala circular routing
          </div>
        </div>

        <button
          onClick={() => setShowSmurfingModal(true)}
          style={{
            background: 'linear-gradient(135deg, rgba(224,82,82,0.9), rgba(200,129,74,0.85))',
            color: '#fff', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 0 16px rgba(224,82,82,0.4)'
          }}
        >
          <ShieldAlert size={14} />
          <span>⚡ Unmask Smurfing & Mule Rings</span>
        </button>
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
                {txns.map(t => (
                  <tr key={t.TxnID} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="mono" style={{ padding: '8px 4px' }}>{t.SenderAccount}</td>
                    <td className="mono" style={{ padding: '8px 4px' }}>{t.ReceiverAccount}</td>
                    <td className="mono" style={{ padding: '8px 4px', textAlign: 'right', color: 'var(--status-danger)', fontWeight: 600 }}>
                      Rs. {t.Amount?.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 4px' }}>
                      <Badge text={t.TransferType || 'TRANSFER'} variant="badge-copper" />
                    </td>
                    <td style={{ padding: '8px 4px', fontSize: 10, color: 'var(--text-muted)' }}>
                      {t.TxnTimestamp?.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mule Accounts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: 500 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Identified Money Mule Accounts</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mules.map(m => (
                <div key={m.AccountNumber} style={{
                  padding: 12,
                  background: 'var(--bg-secondary)',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{m.AccountNumber}</span>
                    <Badge text={`${m.UniqueSenders} Senders`} variant="badge-danger" />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Holder: <strong style={{ color: 'var(--text-primary)' }}>{m.AccountHolder}</strong> ({m.BankName})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Received:</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--status-danger)' }}>
                      Rs. {m.TotalReceived?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showSmurfingModal && <SmurfingModal onClose={() => setShowSmurfingModal(false)} />}
    </div>
  )
}
