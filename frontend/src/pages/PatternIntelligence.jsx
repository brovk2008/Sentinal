import { useState, useEffect } from 'react';
import { fetchMoClusters, fetchNearRepeatRisk, fetchSyndicateGraph, fetchSpreeAlerts } from '../api';
import Badge from '../components/shared/Badge';

export default function PatternIntelligence() {
  const [activeTab, setActiveTab] = useState('mo');
  const [loading, setLoading] = useState(true);
  const [moClusters, setMoClusters] = useState([]);
  const [nearRepeatRisk, setNearRepeatRisk] = useState([]);
  const [syndicates, setSyndicates] = useState([]);
  const [spreeAlerts, setSpreeAlerts] = useState([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [moRes, nrRes, synRes, spreeRes] = await Promise.all([
          fetchMoClusters().catch(() => ({ mo_clusters: [] })),
          fetchNearRepeatRisk().catch(() => ({ risk_zones: [] })),
          fetchSyndicateGraph().catch(() => ({ syndicates: [] })),
          fetchSpreeAlerts().catch(() => ({ spree_alerts: [] }))
        ]);
        setMoClusters(moRes.mo_clusters || []);
        setNearRepeatRisk(nrRes.risk_zones || []);
        setSyndicates(synRes.syndicates || []);
        setSpreeAlerts(spreeRes.spree_alerts || []);
      } catch (err) {
        console.error('Failed to load criminology data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🧬</span> Pattern &amp; Predictive Criminology AI
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Automated Modus Operandi (MO) Series Linking • Near-Repeat Spatial Risk • Syndicate Cross-Matching
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge type="info">Catalyst QuickML AI</Badge>
          <Badge type="success">Live Multi-District Stream</Badge>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('mo')}
          style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'none',
            color: activeTab === 'mo' ? 'var(--copper-400)' : 'var(--text-muted)',
            borderBottom: activeTab === 'mo' ? '2px solid var(--copper-400)' : 'none'
          }}
        >
          🔍 MO Series Linking ({moClusters.length})
        </button>
        <button
          onClick={() => setActiveTab('nearRepeat')}
          style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'none',
            color: activeTab === 'nearRepeat' ? 'var(--copper-400)' : 'var(--text-muted)',
            borderBottom: activeTab === 'nearRepeat' ? '2px solid var(--copper-400)' : 'none'
          }}
        >
          🎯 Near-Repeat Risk ({nearRepeatRisk.length})
        </button>
        <button
          onClick={() => setActiveTab('syndicates')}
          style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'none',
            color: activeTab === 'syndicates' ? 'var(--copper-400)' : 'var(--text-muted)',
            borderBottom: activeTab === 'syndicates' ? '2px solid var(--copper-400)' : 'none'
          }}
        >
          🕸️ Syndicate Roster ({syndicates.length})
        </button>
        <button
          onClick={() => setActiveTab('spree')}
          style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'none',
            color: activeTab === 'spree' ? 'var(--copper-400)' : 'var(--text-muted)',
            borderBottom: activeTab === 'spree' ? '2px solid var(--copper-400)' : 'none'
          }}
        >
          ⚡ Spree Alerts ({spreeAlerts.length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--copper-400)', fontSize: 14 }}>
          ⏳ Analyzing crime patterns &amp; spatial risks across 41 districts...
        </div>
      ) : (
        <div>
          {/* TAB 1: MO SERIES LINKING */}
          {activeTab === 'mo' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
              {moClusters.map((cluster, i) => (
                <div key={i} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: 18, position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--copper-400)', fontFamily: 'var(--font-mono)' }}>
                      {cluster.series_id}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      {cluster.confidence_score}% Confidence
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {cluster.crime_group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    <div><strong>Execution Method:</strong> {cluster.execution_method}</div>
                    <div><strong>Target Asset:</strong> {cluster.target_category}</div>
                    <div><strong>Time Window:</strong> {cluster.time_window}</div>
                    <div><strong>Affected Districts:</strong> {cluster.districts_affected?.join(', ')}</div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Linked Sample FIRs ({cluster.cases_count} total):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cluster.sample_cases?.map((sc, j) => (
                        <span key={j} style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                          FIR {sc.crime_no} ({sc.station})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: NEAR REPEAT RISK */}
          {activeTab === 'nearRepeat' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
              {nearRepeatRisk.map((zone, i) => (
                <div key={i} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--copper-500)',
                  borderRadius: 8, padding: 18
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)' }}>{zone.station}, {zone.district}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                      Risk Multiplier: {zone.risk_multiplier}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    <strong>Category:</strong> {zone.crime_group} &nbsp;|&nbsp; <strong>Window:</strong> {zone.timeframe}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 6, borderLeft: '3px solid var(--copper-500)' }}>
                    🎯 <strong>Tactical Action:</strong> {zone.recommended_action}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: SYNDICATE ROSTER */}
          {activeTab === 'syndicates' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
              {syndicates.map((syn, i) => (
                <div key={i} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: 18
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--copper-400)', fontFamily: 'var(--font-mono)' }}>{syn.syndicate_id}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: syn.risk_level === 'CRITICAL' ? '#ef4444' : '#f59e0b', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                      {syn.risk_level} THREAT
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    👤 {syn.primary_suspect}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--copper-400)', fontWeight: 600, marginBottom: 8 }}>
                    Role: {syn.role}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <div>Primary Jurisdiction: {syn.primary_station}, {syn.primary_district}</div>
                    <div>Linked FIR Count: {syn.total_linked_firs} cases</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: SPREE ALERTS */}
          {activeTab === 'spree' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {spreeAlerts.map((alt, i) => (
                <div key={i} style={{
                  background: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444',
                  borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>
                      ⚡ {alt.alert_type} — {alt.district} ({alt.station})
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 4 }}>
                      <strong>Crime Group:</strong> {alt.crime_group} &nbsp;|&nbsp; <strong>Cluster:</strong> {alt.frequency_cluster}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      <strong>Suggested Response:</strong> {alt.suggested_response}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444' }}>{alt.threat_score}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Threat Score</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
