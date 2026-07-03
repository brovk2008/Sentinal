import { useState, useEffect, useRef, useCallback } from 'react'
import LoadingPulse from '../components/shared/LoadingPulse'
import Badge from '../components/shared/Badge'
import { fetchNetworkGraph, fetchSyndicates } from '../api'

const NODE_COLORS = {
  person: '#7f77dd',
  case: '#e05252',
  phone: '#4a9ede',
  bank: '#52b788',
  vehicle: '#e0a832',
}

const EDGE_COLORS = {
  involved_in: '#e05252',
  calls: '#4a9ede',
  transaction: '#52b788',
  member_of: '#c8814a',
}

export default function ConnectionsBoard() {
  const containerRef = useRef(null)
  const networkRef = useRef(null)
  const [syndicates, setSyndicates] = useState([])
  const [selectedSyndicate, setSelectedSyndicate] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 })
  const [loading, setLoading] = useState(true)

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const { Network, DataSet } = window.vis || {}
      if (!Network || !DataSet) {
        console.error("vis-network library not loaded via CDN yet")
        return
      }

      const [graphData, syndList] = await Promise.all([
        fetchNetworkGraph(200, selectedSyndicate),
        fetchSyndicates(),
      ])
      setSyndicates(syndList)

      if (!containerRef.current) return

      const nodes = new DataSet(
        graphData.nodes.map(n => ({
          id: n.id,
          label: n.label,
          color: {
            background: NODE_COLORS[n.type] || '#6b7280',
            border: NODE_COLORS[n.type] || '#6b7280',
            highlight: { background: '#c8814a', border: '#c8814a' },
          },
          shape: n.type === 'case' ? 'diamond' : 'dot',
          size: n.type === 'person' ? (n.cases > 5 ? 25 : 18) : 12,
          font: { color: '#e8e6e0', size: 10, face: 'Inter' },
          borderWidth: n.center ? 3 : 1,
          _data: n,
        }))
      )

      const edges = new DataSet(
        graphData.edges.map((e, i) => ({
          id: `e_${i}`,
          from: e.from,
          to: e.to,
          color: { color: EDGE_COLORS[e.type] || '#5a5855', opacity: 0.6 },
          width: e.type === 'involved_in' ? 1.5 : 1,
          dashes: e.type === 'member_of',
          arrows: e.type === 'calls' ? { to: { enabled: true, scaleFactor: 0.5 } } : undefined,
        }))
      )

      setGraphStats({ nodes: graphData.nodes.length, edges: graphData.edges.length })

      const options = {
        physics: {
          barnesHut: { gravitationalConstant: -3000, centralGravity: 0.2, springLength: 120 },
          stabilization: { iterations: 100 },
        },
        interaction: { hover: true, tooltipDelay: 200 },
        nodes: {
          borderWidth: 1,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', x: 0, y: 2, size: 8 },
        },
        edges: { smooth: { type: 'continuous' } },
      }

      if (networkRef.current) networkRef.current.destroy()
      networkRef.current = new Network(containerRef.current, { nodes, edges }, options)

      networkRef.current.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0]
          const node = nodes.get(nodeId)
          setSelectedNode(node?._data || null)
        } else {
          setSelectedNode(null)
        }
      })

      networkRef.current.on('doubleClick', (params) => {
        if (params.nodes.length > 0) {
          const node = nodes.get(params.nodes[0])
          if (node?._data?.type === 'case') {
            const caseId = node._data.id.replace('c_', '')
            window.location.href = `/timeline/${caseId}`
          }
        }
      })

      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [selectedSyndicate])

  useEffect(() => { loadGraph() }, [loadGraph])

  return (
    <div style={{ height: '100%', display: 'flex', position: 'relative' }}>
      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 16, left: 16, right: selectedNode ? 340 : 16,
        zIndex: 10, display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <select
          className="input"
          style={{ width: 280, fontSize: 12 }}
          value={selectedSyndicate || ''}
          onChange={e => setSelectedSyndicate(e.target.value || null)}
        >
          <option value="">All Networks</option>
          {syndicates.map(s => (
            <option key={s.syndicate_id} value={s.syndicate_id}>
              {s.syndicate_name} ({s.total_cases} cases)
            </option>
          ))}
        </select>

        <div className="badge badge-copper" style={{ fontSize: 10, flexShrink: 0 }}>
          {graphStats.nodes} nodes · {graphStats.edges} edges
        </div>

        <div style={{ flex: 1 }} />

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)',
          background: 'var(--bg-overlay)', padding: '6px 12px', borderRadius: 6,
        }}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: type === 'case' ? 1 : 4, background: color }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Graph container */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', zIndex: 5 }}>
            <LoadingPulse height={400} text="Building connections graph..." />
          </div>
        )}
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--bg-primary)',
          }}
        />
      </div>

      {/* Node Detail Panel */}
      {selectedNode && (
        <div className="slide-in-right" style={{
          width: 320, background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-subtle)',
          padding: 20, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              {selectedNode.type === 'person' ? 'PERSON DETAIL' : 'CASE DETAIL'}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 16,
              }}
            >×</button>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: `linear-gradient(135deg, ${NODE_COLORS[selectedNode.type]}, ${NODE_COLORS[selectedNode.type]}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'white',
              border: '2px solid var(--copper-400)',
            }}>
              {selectedNode.label?.slice(0, 2)?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedNode.label}</div>
              <Badge text={selectedNode.type} variant="badge-copper" />
            </div>
          </div>

          {selectedNode.cases && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Cases Involved</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{selectedNode.cases}</div>
            </div>
          )}

          {selectedNode.crime_type && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Crime Type</div>
              <Badge text={selectedNode.crime_type} />
            </div>
          )}

          <button className="btn btn-copper" style={{ width: '100%', marginTop: 12 }}>
            View Full Profile
          </button>
        </div>
      )}
    </div>
  )
}
