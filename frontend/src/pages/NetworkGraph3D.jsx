/**
 * NetworkGraph3D.jsx — Flat Force-Directed Graph (Obsidian-Style)
 * Uses D3 force simulation. Beautiful, clean, dark-themed, and highly interactive.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import { fetchNetworkGraph } from '../api'

const NODE_COLORS = {
  person:    '#e05252',
  case:      '#c8814a',
  phone:     '#52e07a',
  bank:      '#52e0cc',
  vehicle:   '#b452e0',
  location:  '#52b0e0',
  evidence:  '#e0c852',
}

const NODE_LABELS = {
  person:    'Person',
  case:      'Case File',
  phone:     'Phone Record',
  bank:      'Bank Account',
  vehicle:   'Vehicle Record',
  location:  'Location Tower',
  evidence:  'Evidence',
}

export default function NetworkGraph3D() {
  const navigate = useNavigate()
  const svgRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('All')
  const simulationRef = useRef(null)

  useEffect(() => {
    fetchNetworkGraph(400)
      .then(data => {
        setGraphData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || !graphData.nodes?.length) return
    drawGraph(graphData)
  }, [graphData, loading, filterType, searchTerm])

  const drawGraph = (data) => {
    const svg = d3.select(svgRef.current)
    const container = svgRef.current
    if (!container) return
    const width = container.clientWidth || 1200
    const height = container.clientHeight || 700

    svg.selectAll('*').remove()

    // Filter nodes
    let nodes = data.nodes || []
    if (filterType !== 'All') {
      nodes = nodes.filter(n => n.type === filterType)
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      nodes = nodes.filter(n => (n.label || '').toLowerCase().includes(term))
    }

    const nodeIds = new Set(nodes.map(n => n.id))
    
    // Map edges from -> source, to -> target and filter
    const links = (data.links || data.edges || [])
      .map(l => ({
        ...l,
        source: l.from || l.source,
        target: l.to || l.target
      }))
      .filter(l => nodeIds.has(l.source) && nodeIds.has(l.target))

    const zoom = d3.zoom()
      .scaleExtent([0.05, 5])
      .on('zoom', (event) => g.attr('transform', event.transform))

    svg.call(zoom)

    const g = svg.append('g')

    // Force simulation
    simulationRef.current = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(120)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(32))

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#22223b')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)

    // Draw node groups
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulationRef.current.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulationRef.current.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )
      .on('click', (event, d) => {
        event.stopPropagation()
        setSelectedNode(d)
        // Highlight links
        link.attr('stroke', l =>
          l.source.id === d.id || l.target.id === d.id ? '#c8814a' : '#22223b'
        ).attr('stroke-width', l =>
          l.source.id === d.id || l.target.id === d.id ? 2.5 : 1.5
        )
      })
      .style('cursor', 'pointer')

    // Draw node circles
    node.append('circle')
      .attr('r', d => {
        // Calculate size based on link connections
        const connections = links.filter(l =>
          (l.source.id || l.source) === d.id ||
          (l.target.id || l.target) === d.id
        ).length
        return Math.max(8, Math.min(24, 8 + connections * 1.2))
      })
      .attr('fill', d => NODE_COLORS[d.type] || '#888')
      .attr('fill-opacity', 0.85)
      .attr('stroke', '#040408')
      .attr('stroke-width', 2)

    // Add labels
    node.append('text')
      .text(d => (d.label || d.id || '').slice(0, 24))
      .attr('x', 0)
      .attr('y', d => {
        const connections = links.filter(l =>
          (l.source.id || l.source) === d.id ||
          (l.target.id || l.target) === d.id
        ).length
        return Math.max(8, Math.min(24, 8 + connections * 1.2)) + 14
      })
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-family', 'var(--font-mono)')
      .attr('fill', '#aaa')
      .attr('pointer-events', 'none')

    simulationRef.current.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    svg.on('click', () => {
      setSelectedNode(null)
      link.attr('stroke', '#22223b').attr('stroke-width', 1.5)
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column',
                  background: '#040408', color: 'var(--text-primary)' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)', display: 'flex',
                    gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-400)',
                      fontFamily: 'var(--font-mono)' }}>
          CRIMINAL ASSOCIATION NETWORK
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {graphData.nodes?.length || 0} entities · {graphData.links?.length || 0} connections
        </div>
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search name/ID..."
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                   borderRadius: 4, color: 'var(--text-primary)', fontSize: 11,
                   padding: '4px 10px', width: 160 }}
        />
        {['All', 'person', 'case', 'phone', 'bank', 'vehicle', 'location'].map(type => (
          <button key={type} onClick={() => setFilterType(type)}
            style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 10,
              cursor: 'pointer', fontWeight: filterType === type ? 700 : 400,
              background: filterType === type ? 'rgba(200,129,74,0.2)' : 'transparent',
              border: `1px solid ${filterType === type ? 'var(--copper-400)' : 'var(--border-subtle)'}`,
              color: filterType === type ? 'var(--copper-400)' : 'var(--text-muted)',
            }}>
            {NODE_LABELS[type] || 'All'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
          Scroll to zoom · Drag nodes · Click to inspect
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-muted)', fontSize: 13 }}>
            Computing force simulation...
          </div>
        )}

        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16,
                      background: 'rgba(4,4,8,0.9)', border: '1px solid var(--border-subtle)',
                      borderRadius: 6, padding: '10px 14px' }}>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center',
                                     gap: 6, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%',
                            background: color }} />
              <span style={{ fontSize: 10, color: '#888' }}>{NODE_LABELS[type]}</span>
            </div>
          ))}
        </div>

        {/* Node Inspector Panel */}
        {selectedNode && (
          <div style={{
            position: 'absolute', top: 16, right: 16, width: 280,
            background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
            borderRadius: 8, padding: 14, boxShadow: '0 10px 30px rgba(0,0,0,0.8)', zIndex: 100
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper-400)', textTransform: 'uppercase' }}>
                Inspected Node
              </span>
              <button onClick={() => setSelectedNode(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
                ×
              </button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {selectedNode.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Type: {selectedNode.type?.toUpperCase()}
            </div>
            
            <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 10, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Entity matches database records. Connection weight active.
              </div>
              {selectedNode.type === 'person' && (
                <button
                  className="btn btn-xs btn-copper"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    const pid = selectedNode.id.replace('p_', '')
                    navigate(`/accused/${pid}`)
                  }}
                >
                  📁 Open Criminal Dossier
                </button>
              )}
              {selectedNode.type === 'case' && (
                <button
                  className="btn btn-xs btn-copper"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    const cid = selectedNode.id.replace('c_', '')
                    navigate(`/timeline/${cid}`)
                  }}
                >
                  📂 Open Case File
                </button>
              )}
              {!['person', 'case'].includes(selectedNode.type) && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
                  Inspect mode active
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
