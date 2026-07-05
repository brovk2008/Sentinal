import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import { request } from '../api'

export default function AccusedProfile() {
  const { accusedId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const graphRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    request(`/api/v1/persons/${accusedId}/knowledge-graph`)
      .then(res => {
        setData(res)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [accusedId])

  useEffect(() => {
    if (loading || !data || !graphRef.current) return

    const { Network, DataSet } = window.vis || {}
    if (!Network) {
      console.error("vis-network library not found on window object.")
      return
    }

    // Prepare vis-network graph
    const nodes = new DataSet(data.graph.nodes)
    const edges = new DataSet(data.graph.edges)

    const options = {
      physics: {
        forceAtlas2Based: {
          gravitationalConstant: -26,
          centralGravity: 0.005,
          springLength: 90,
          springConstant: 0.08
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      },
      nodes: {
        shape: 'dot',
        font: { size: 11, color: '#a0a0b0', face: 'monospace' },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        width: 1.5,
        shadow: true,
        smooth: { type: 'continuous' },
        font: { size: 9, color: 'var(--text-muted)', face: 'monospace', align: 'top' }
      }
    }

    const network = new Network(graphRef.current, { nodes, edges }, options)

    // Handle double-click co-accused or cases
    network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0]
        if (nodeId.startsWith('co_')) {
          const targetId = nodeId.split('_')[1]
          navigate(`/accused/${targetId}`)
        } else if (nodeId.startsWith('case_')) {
          const targetId = nodeId.split('_')[1]
          navigate(`/timeline/${targetId}`)
        }
      }
    })

    return () => {
      network.destroy()
    }
  }, [loading, data, navigate])

  if (loading) {
    return <LoadingPulse height={400} text="Compiling Criminal Profile Knowledge Graph..." />
  }

  if (!data || data.error) {
    return (
      <div style={{ padding: 20, color: 'var(--status-danger)' }}>
        Profile search yielded no results. Confirm AccusedMasterID.
      </div>
    )
  }

  const { profile, mo_summary, associates, reoffend_risk, risk_factors } = data
  const initials = profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '400px 1fr',
      gap: 20,
      height: 'calc(100vh - var(--topbar-height) - 32px)',
      background: '#07070a',
      color: 'var(--text-primary)',
      padding: 16,
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)'
    }}>
      
      {/* LEFT COLUMN — PROFILE DETAILS */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflowY: 'auto'
      }}>
        {/* Profile Avatar & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            background: 'var(--copper-700)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, border: '2px solid var(--copper-500)'
          }}>
            {initials}
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{profile.name}</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <span className="badge badge-danger">MOST WANTED</span>
              <span className="badge badge-copper">{profile.case_count} CASES</span>
            </div>
          </div>
        </div>

        {/* Info Table */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>CRIMINAL RECORD</div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              {[
                { label: 'Accused ID', val: profile.accused_id },
                { label: 'Age / Gender', val: `${profile.age || 'N/A'} / ${profile.gender}` },
                { label: 'Active Districts', val: profile.districts.join(', ') || 'None' },
                { label: 'IPC Sections', val: profile.sections.slice(0, 4).join(', ') || 'N/A' },
                { label: 'Known Syndicates', val: profile.syndicates.join(', ') || 'None' },
                { label: 'Status', val: <span style={{ color: 'var(--status-danger)', fontWeight: 700 }}>AT LARGE</span> }
              ].map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '6px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>{row.label}</td>
                  <td style={{ padding: '6px 0', color: 'var(--text-primary)', textAlign: 'right' }}>{row.val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AI MO Summary */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>MODUS OPERANDI</div>
          <div style={{ background: 'rgba(200,129,74,0.04)', padding: 10, borderRadius: 6, fontSize: 11, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
            {mo_summary}
          </div>
        </div>

        {/* Financial & CDR metrics */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>INTELLIGENCE CORRELATION</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>SUSPICIOUS TRANS.</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--status-warning)' }}>
                ₹{profile.total_suspicious_amount?.toLocaleString('en-IN') || 0}
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>CALL GRAPH RECORDS</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--copper-400)' }}>
                {profile.cdr_count} calls
              </div>
            </div>
          </div>
        </div>

        {/* Associates */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>CRIMINAL ASSOCIATES ({associates.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {associates.map((ass, idx) => (
              <Link
                key={idx}
                to={`/accused/${ass.accused_id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', padding: 8,
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  borderRadius: 4, textDecoration: 'none', fontSize: 11, color: 'var(--text-primary)'
                }}
              >
                <span>👤 {ass.name}</span>
                <span style={{ color: 'var(--copper-400)' }}>{ass.shared_cases} shared cases</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN — VIS-NETWORK KNOWLEDGE GRAPH */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {/* Risk Level Header */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
          borderRadius: 8, padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>RISK FACTOR INDEX</div>
            <div style={{ fontSize: 10, display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {risk_factors.map((f, i) => (
                <span key={i} style={{ color: 'var(--status-danger)', fontWeight: 600 }}>• {f}</span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>REOFFEND PROBABILITY</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--status-danger)' }}>{reoffend_risk.toFixed(1)}%</div>
          </div>
        </div>

        {/* Vis-network Container */}
        <div style={{
          flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
          borderRadius: 8, position: 'relative', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 100,
            fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)'
          }}>
            Double-click co-accused spheres to navigate · Double-click case nodes to explore timeline
          </div>
          <div ref={graphRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>

    </div>
  )
}
