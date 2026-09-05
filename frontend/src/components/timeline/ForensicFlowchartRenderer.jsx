import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Zap, Shield, AlertTriangle, ArrowDown, Activity, Sparkles, Copy, Check } from 'lucide-react'

export default function ForensicFlowchartRenderer({
  code,
  loading = false,
  enhancing = false,
  typology = 'CHRONOLOGICAL',
  onEnhance,
}) {
  const containerRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [renderError, setRenderError] = useState(false)

  // Copy Mermaid source code to clipboard
  const handleCopy = () => {
    if (!code) return
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    let isMounted = true
    setRenderError(false)

    if (loading || !code) return

    const renderMermaid = async () => {
      // Check if Mermaid script is loaded
      if (!window.mermaid) {
        // Retry shortly if script is still downloading from CDN
        setTimeout(() => {
          if (isMounted) renderMermaid()
        }, 250)
        return
      }

      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis',
          },
        })
      } catch (e) {
        // Already initialized
      }

      const id = 'mermaid-flowchart-' + Math.random().toString(36).substring(2, 9)

      try {
        const { svg } = await window.mermaid.render(id, code)
        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = svg
          // Enhance SVG styling for maximum contrast & crisp look
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            svgEl.style.maxWidth = '100%'
            svgEl.style.height = 'auto'
            svgEl.style.display = 'block'
            svgEl.style.margin = '0 auto'
          }
          setRenderError(false)
        }
      } catch (err) {
        console.warn('[ForensicFlowchartRenderer] Mermaid render exception, activating structured fallback:', err)
        if (isMounted) {
          setRenderError(true)
        }
      }
    }

    renderMermaid()

    return () => {
      isMounted = false
    }
  }, [code, loading])

  // Fallback Structured Node Parser if Mermaid syntax fails
  const parseFallbackStages = (mermaidCode) => {
    if (!mermaidCode) return []
    const lines = mermaidCode.split('\n')
    const stages = []
    
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\["(.*?)"\](?:::([a-z]+))?/)
      if (match) {
        const [, nodeId, rawLabel, nodeClass] = match
        const parts = rawLabel.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
        const title = parts[0] || 'Investigation Event'
        const subtitle = parts[1] || ''
        const detail = parts.slice(2).join(' · ')
        
        stages.push({
          id: nodeId,
          title,
          subtitle,
          detail,
          nodeClass: nodeClass || 'police'
        })
      }
    }
    return stages
  }

  const fallbackStages = renderError ? parseFallbackStages(code) : []

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Top Toolbar / Status */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
            padding: '2px 8px', borderRadius: 4,
            background: 'rgba(200, 129, 74, 0.15)', color: 'var(--copper-400)',
            border: '1px solid rgba(200, 129, 74, 0.3)',
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            <Activity size={10} />
            <span>{typology === 'FINANCIAL' ? 'MONEY TRAIL GRAPH' : 'FORENSIC SEQUENCE GRAPH'}</span>
          </span>
          {code && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Ground Truth Real Database Execution
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {code && (
            <button
              onClick={handleCopy}
              className="btn btn-xs"
              style={{
                fontSize: 10, padding: '2px 8px', background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 4
              }}
              title="Copy Mermaid Code"
            >
              {copied ? <Check size={11} color="#4ac880" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy Code'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        padding: '20px 16px',
        minHeight: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowX: 'auto',
        position: 'relative',
      }}>
        {loading || enhancing ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, padding: '30px 0',
          }}>
            <RefreshCw size={24} className="animate-spin" color="var(--copper-400)" />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--copper-300)', letterSpacing: '0.04em' }}>
              {enhancing ? 'AI Cognitive Engine Reconstructing Sequence...' : 'Extracting CCTNS Investigation Graph...'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Correlating FIR facts, accused statements, cell tower pings &amp; evidence ledger
            </div>
          </div>
        ) : renderError && fallbackStages.length > 0 ? (
          /* Structured Fallback Rendering */
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'var(--copper-300)', marginBottom: 6,
            }}>
              <Sparkles size={13} />
              <span>Structured Chronological Sequence</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {fallbackStages.map((stage, idx) => {
                const borderColors = {
                  prep: '#4a9eff',
                  crime: '#e05252',
                  trail: '#c8814a',
                  police: '#4ac880',
                  court: '#a855f7',
                }
                const borderColor = borderColors[stage.nodeClass] || '#4a9eff'

                return (
                  <div
                    key={stage.id || idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${borderColor}`,
                      borderLeft: `4px solid ${borderColor}`,
                      borderRadius: 6,
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {stage.title}
                    </div>
                    {stage.subtitle && (
                      <div style={{ fontSize: 11, color: 'var(--copper-300)', fontWeight: 500 }}>
                        {stage.subtitle}
                      </div>
                    )}
                    {stage.detail && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 2 }}>
                        {stage.detail}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Primary Mermaid SVG Container */
          <div
            ref={containerRef}
            id="mermaid-container"
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              minHeight: 140,
            }}
          />
        )}
      </div>
    </div>
  )
}
