/**
 * PatternIntel.jsx
 * Displays real criminological pattern analysis:
 * - Repeat victimization
 * - MO clusters (same crime method = likely same offender)
 * - Crime sprees
 * - Next crime prediction
 * - Uploaded files gallery
 */
import { useEffect, useState } from 'react';
import { fetchPatterns, fetchPredictNext } from '../api';

export default function PatternIntel() {
  const [patterns,   setPatterns]   = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([fetchPatterns(), fetchPredictNext()])
      .then(([p, n]) => {
        setPatterns(p);
        setPrediction(n);
      })
      .catch(err => {
        console.error('Failed to load pattern data', err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      Loading pattern intelligence...
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)', minHeight: '100%', background: '#07070e' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--copper-400)',
                     margin: 0, fontFamily: 'var(--font-mono)' }}>
          PATTERN INTELLIGENCE ENGINE
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Real-time criminological pattern detection · MO clustering · Spree analysis · Predictive next-crime
        </p>
      </div>

      {/* Next Crime Prediction — hero card */}
      {prediction && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(224,82,82,0.08), rgba(200,129,74,0.08))',
          border: '1px solid rgba(224,82,82,0.3)', borderRadius: 10,
          padding: '20px 24px', marginBottom: 28,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)',
                         textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Predicted Next Crime Type
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#e05252' }}>
              {prediction.predicted_crime || 'Insufficient Data'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {prediction.basis}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)',
                         textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Likely Time Window
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--copper-400)' }}>
              {prediction.predicted_time}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Based on historical same day-of-week patterns
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)',
                         textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Confidence Score
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--status-success)' }}>
              {prediction.confidence}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--copper-400)', marginTop: 8,
                         fontWeight: 600 }}>
              ⚡ {prediction.recommended_action}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* MO Clusters */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                     borderRadius: 8, padding: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)',
                      margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🎯 MO Clusters — Likely Same Offender
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Cases with identical crime type + IPC section + time pattern.
            Same MO across multiple FIRs = likely same perpetrator.
          </p>
          {(patterns?.mo_clusters || []).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              No modus operandi clusters detected.
            </div>
          ) : (patterns?.mo_clusters || []).slice(0, 8).map((m, i) => (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 8, borderRadius: 6,
              background: 'var(--bg-primary)',
              borderLeft: `3px solid ${m.risk === 'HIGH' ? '#e05252' : '#e0a832'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                           alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{m.crime_head}</span>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 3, fontWeight: 700,
                  background: m.risk === 'HIGH' ? 'rgba(224,82,82,0.15)' : 'rgba(224,168,50,0.15)',
                  color: m.risk === 'HIGH' ? '#e05252' : '#e0a832',
                }}>{m.risk}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {m.act_section} · {m.time_pattern} · {m.frequency}x in {m.spread} stations
              </div>
            </div>
          ))}
        </div>

        {/* Repeat Victimization */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                     borderRadius: 8, padding: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)',
                      margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            🔄 Repeat Victimization
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Victims or locations targeted more than once in 90 days.
            Research: 40% of burglaries recur near same address within 1 month.
          </p>
          {(patterns?.repeat_victimization || []).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              No repeat victimization detected in last 90 days.
            </div>
          ) : (patterns?.repeat_victimization || []).slice(0, 8).map((v, i) => (
            <div key={i} style={{
              padding: '10px 12px', marginBottom: 8, borderRadius: 6,
              background: 'var(--bg-primary)',
              borderLeft: '3px solid #e05252',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, color: '#fff' }}>
                {v.victim}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {v.incidents}x incidents · Last: {v.last_incident} · {v.address}
              </div>
            </div>
          ))}
        </div>

        {/* Crime Sprees */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                     borderRadius: 8, padding: 20, gridColumn: '1 / -1' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)',
                      margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            ⚡ Active Crime Sprees — Same Type Within 48h
          </h2>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Multiple crimes of same type in rapid succession.
            Indicates an active perpetrator — prioritize patrol response.
          </p>
          {(patterns?.sprees || []).length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              No active sprees detected.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {(patterns?.sprees || []).slice(0, 6).map((s, i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 6,
                  background: 'rgba(224,82,82,0.06)',
                  border: '1px solid rgba(224,82,82,0.2)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e05252',
                               marginBottom: 4 }}>
                    {s.crime_type}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Cases {s.case_1} &amp; {s.case_2}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {s.hours_apart}h apart
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
