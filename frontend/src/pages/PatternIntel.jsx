/**
 * PatternIntel.jsx — Advanced Criminology & Pattern AI Hub
 * Displays real-world criminological pattern analysis:
 * - Modus Operandi (MO) Series Linking & Strategy Matrix
 * - Bowers & Johnson Near-Repeat Spatial Risk Forecasting
 * - Cross-FIR Syndicate & Entity Matching Roster
 * - Crime Spree & Repeat Victimization Detection
 * - Predictive Next-Crime Forecasting
 */
import { useEffect, useState } from 'react';
import {
  fetchPatterns,
  fetchPredictNext,
  fetchMoClusters,
  fetchNearRepeatRisk,
  fetchSyndicateGraph,
  fetchSpreeAlerts
} from '../api';
import Badge from '../components/shared/Badge';

export default function PatternIntel() {
  const [activeTab, setActiveTab] = useState('mo');
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [moClusters, setMoClusters] = useState([]);
  const [nearRepeatRisk, setNearRepeatRisk] = useState([]);
  const [syndicates, setSyndicates] = useState([]);
  const [spreeAlerts, setSpreeAlerts] = useState([]);

  useEffect(() => {
    async function loadAllIntelligence() {
      setLoading(true);
      try {
        const [p, n, moRes, nrRes, synRes, spreeRes] = await Promise.all([
          fetchPatterns().catch(() => null),
          fetchPredictNext().catch(() => null),
          fetchMoClusters().catch(() => ({ mo_clusters: [] })),
          fetchNearRepeatRisk().catch(() => ({ risk_zones: [] })),
          fetchSyndicateGraph().catch(() => ({ syndicates: [] })),
          fetchSpreeAlerts().catch(() => ({ spree_alerts: [] }))
        ]);
        setPatterns(p);
        setPrediction(n);
        setMoClusters(moRes.mo_clusters || []);
        setNearRepeatRisk(nrRes.risk_zones || []);
        setSyndicates(synRes.syndicates || []);
        setSpreeAlerts(spreeRes.spree_alerts || []);
      } catch (err) {
        console.error('Failed to load pattern intelligence data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAllIntelligence();
  }, []);

  // Listen to demo mode auto-triggers
  useEffect(() => {
    const handleDemoTab = (e) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('demo-trigger-pattern-tab', handleDemoTab);
    return () => window.removeEventListener('demo-trigger-pattern-tab', handleDemoTab);
  }, []);

  return (
    <div style={{ padding: '24px 32px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', minHeight: '100%', background: '#07070e' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--copper-400)', margin: 0, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🧬</span> CRIME PATTERN &amp; PREDICTIVE AI HUB
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Multi-District Modus Operandi (MO) Linking • Bowers &amp; Johnson Near-Repeat Risk • Syndicate Auto-Extraction
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge type="info">Catalyst QuickML &amp; Zia AI</Badge>
          <Badge type="success">Live FIR Stream</Badge>
        </div>
      </div>

      {/* Next Crime Prediction Hero Card */}
      {prediction && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(224,82,82,0.08), rgba(200,129,74,0.08))',
          border: '1px solid rgba(224,82,82,0.3)', borderRadius: 10,
          padding: '20px 24px', marginBottom: 24,
          display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Predicted Next Crime Type
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e05252' }}>
              {prediction.predicted_crime || 'Cyber Fraud & Breach'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {prediction.basis || 'Based on historical temporal & seasonal crime density'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Likely Time Window
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--copper-400)' }}>
              {prediction.predicted_time || 'Weekend (22:00 - 04:00)'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Day-of-week &amp; festival period correlation
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Confidence &amp; Tactical Action
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
              {prediction.confidence || 88}% Confidence
            </div>
            <div style={{ fontSize: 11, color: 'var(--copper-400)', marginTop: 6, fontWeight: 600 }}>
              ⚡ {prediction.recommended_action || 'Deploy night patrols & cyber cell monitoring'}
            </div>
          </div>
        </div>
      )}

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
          🎯 MO Series Linking ({moClusters.length})
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
          📍 Near-Repeat Risk ({nearRepeatRisk.length})
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
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--copper-400)', fontSize: 13 }}>
          ⏳ Analyzing crime patterns, MO tactics, and spatial risks across 41 districts...
        </div>
      ) : (
        <div>
          {/* TAB 1: MO SERIES LINKING */}
          {activeTab === 'mo' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
              {moClusters.map((cluster, i) => (
                <div key={i} style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: 18
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--copper-400)', fontFamily: 'var(--font-mono)' }}>
                      {cluster.series_id}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      {cluster.confidence_score}% Match Confidence
                    </span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                    {cluster.crime_group}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    <div><strong>Execution Method:</strong> {cluster.execution_method}</div>
                    <div><strong>Target Asset:</strong> {cluster.target_category}</div>
                    <div><strong>Time Window:</strong> {cluster.time_window}</div>
                    <div><strong>Districts Affected:</strong> {cluster.districts_affected?.join(', ')}</div>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Sample Linked FIRs ({cluster.cases_count} total):</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {cluster.sample_cases?.map((sc, j) => (
                        <span key={j} style={{ fontSize: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                          FIR #{sc.crime_no} ({sc.station})
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
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--copper-400)' }}>{zone.station}, {zone.district}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                      Risk Multiplier: {zone.risk_multiplier}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    <strong>Category:</strong> {zone.crime_group} &nbsp;|&nbsp; <strong>Window:</strong> {zone.timeframe}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 6, borderLeft: '3px solid var(--copper-500)' }}>
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
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444' }}>{alt.threat_score}</div>
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
