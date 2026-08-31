import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Terminal, Sparkles, Folder, Search, Navigation,
  FileText, Coins, ShieldAlert, Brain, Globe, Copy, Check,
  ArrowRight, ExternalLink, Command, ShieldCheck, Key
} from 'lucide-react'
import Icon from '../components/Icons'
import { logoutUser } from '../lib/catalystAuth'

const SHORTCUTS_DATA = [
  {
    command: '/mcp',
    syntax: '/mcp <any natural language instruction>',
    title: 'Autonomous AI Site Control',
    category: 'Agentic Control',
    description: 'Instructs the Sentinal MCP engine to autonomously execute tasks across any module (e.g. generate canvases, dispatch patrols, correlate bank records).',
    example: '/mcp make canvas on latest vehicle theft case with Imran Pasha'
  },
  {
    command: '/web',
    syntax: '/web <investigative_query | topic>',
    title: 'Live Browser & Internet Search',
    category: 'Browser & OSINT',
    description: 'Executes autonomous real-time internet search across Google News, Karnataka Police Press Bureau, and High Court portals with live web citations.',
    example: '/web luxury vehicle theft Karnataka 2026'
  },
  {
    command: '/browse',
    syntax: '/browse <public_webpage_url>',
    title: 'Forensic Deep Webpage Scraper',
    category: 'Browser & OSINT',
    description: 'Forensically crawls, sanitizes, and extracts readable evidentiary text and entity graphs from any public target URL.',
    example: '/browse https://ksp.karnataka.gov.in'
  },
  {
    command: '/investigate',
    syntax: '/investigate <person_name | suspect_alias>',
    title: 'Web Investigate & Person Scanner',
    category: 'Person & Face OSINT',
    description: 'Scans across all public social profiles, e-Courts filings, darknet breach dumps, and facial biometric records for a suspect.',
    example: '/investigate Imran Pasha'
  },
  {
    command: '/canvas',
    syntax: '/canvas [case_id | query | *latest]',
    title: 'Instant Investigation Canvas',
    category: 'Causal Graph',
    description: 'Auto-extracts criminal entities (suspects, vehicles, bank accounts, cell towers) and auto-lays them out on the 2D ReactFlow canvas.',
    example: '/canvas Koramangala Luxury Creta Theft with Imran Pasha'
  },
  {
    command: '/search',
    syntax: '/search <keyword | district | IPC/BNS section>',
    title: '10,000 FIR Deep Search',
    category: 'Database Query',
    description: 'Performs lightning-fast parameter search across Karnataka State Police FIR records and panchanama facts.',
    example: '/search luxury vehicle theft Bengaluru Urban'
  },
  {
    command: '/convoy',
    syntax: '/convoy <vehicle_registration_plate>',
    title: 'FASTag ANPR Highway Intercept',
    category: 'Traffic & Toll',
    description: 'Analyzes highway RFID toll cameras and timestamp gaps to detect suspect convoys and trailing scout vehicles.',
    example: '/convoy KA-04-MB-8821'
  },
  {
    command: '/chargesheet',
    syntax: '/chargesheet <accused_name | case_id>',
    title: 'BNS 2023 Chargesheet Generator',
    category: 'Legal Prosecution',
    description: 'Drafts a Section 173 BNSS Final Police Report formatted for the Judicial Magistrate with Section 65B forensic hash certificates.',
    example: '/chargesheet FIR-2026-0456 Imran Pasha'
  },
  {
    command: '/mule',
    syntax: '/mule <UPI_handle | account_number>',
    title: 'UPI Smurfing Mule Ring Scanner',
    category: 'Financial Forensics',
    description: 'Detects high-velocity layering under ₹50,000 and money mule networks for immediate Section 106 BNSS freezing notices.',
    example: '/mule drain99@okaxis'
  },
  {
    command: '/patrol',
    syntax: '/patrol <district | hotspot_zone>',
    title: 'Hoysala Tactical Patrol Dispatch',
    category: 'Field Operations',
    description: 'Dispatches emergency tactical Hoysala patrol units to AI-predicted Hawkes point-process crime hotspots.',
    example: '/patrol Bengaluru Urban Indiranagar'
  },
  {
    command: '/dossier',
    syntax: '/dossier <suspect_full_name>',
    title: 'Criminal Profile & Wanted Notice',
    category: 'Intelligence',
    description: 'Retrieves complete criminal history, syndicate hierarchy, prior arrests, and active LOC / Red Corner notices.',
    example: '/dossier Imran Pasha'
  },
  {
    command: '/osint',
    syntax: '/osint <crime_topic | district>',
    title: 'Real-Time News & Web Intel Scraper',
    category: 'Open Source Intel',
    description: 'Live RSS crawlers querying Deccan Herald, The Hindu, and TOI for breaking Karnataka police dispatches.',
    example: '/osint luxury car keyless theft'
  },
  {
    command: '/navigate',
    syntax: '/navigate <dashboard | map | canvas | warroom | financial | cdr | predict>',
    title: 'Instant View Navigation',
    category: 'App Navigation',
    description: 'Commands the frontend UI to immediately transition to any tactical intelligence module.',
    example: '/navigate map'
  }
]

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [copiedCmd, setCopiedCmd] = useState('')

  useEffect(() => {
    const cached = localStorage.getItem('sentinal_user')
    if (cached) {
      setUser(JSON.parse(cached))
    }
  }, [])

  if (!user) {
    return (
      <div style={{ padding: 40, color: 'var(--text-muted)' }}>
        Loading user profile...
      </div>
    )
  }

  const getDisplayName = (u) => {
    if (!u) return 'Officer'
    if (u.first_name && u.first_name.trim()) return `${u.first_name} ${u.last_name || ''}`.trim()
    if (u.email_id) return u.email_id.split('@')[0]
    return 'Officer'
  }

  const handleSignOut = async () => {
    await logoutUser()
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(text)
    setTimeout(() => setCopiedCmd(''), 2000)
  }

  const handleTryInChat = (commandExample) => {
    navigate('/assistant')
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('demo-auto-type', {
        detail: { query: commandExample }
      }))
    }, 300)
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 880, margin: '0 auto' }}>
      {/* ── Top Tabs ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12
      }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            background: activeTab === 'profile' ? 'var(--copper-500)' : 'rgba(255,255,255,0.04)',
            color: activeTab === 'profile' ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${activeTab === 'profile' ? 'var(--copper-500)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.2s ease'
          }}
        >
          <User size={15} />
          <span>OFFICER PROFILE</span>
        </button>

        <button
          onClick={() => setActiveTab('shortcuts')}
          style={{
            background: activeTab === 'shortcuts' ? 'linear-gradient(135deg, #c8814a, #f59e0b)' : 'rgba(255,255,255,0.04)',
            color: activeTab === 'shortcuts' ? '#000' : '#fbbf24',
            border: `1px solid ${activeTab === 'shortcuts' ? '#f59e0b' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: activeTab === 'shortcuts' ? '0 0 16px rgba(245,158,11,0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Terminal size={15} />
          <span>SHORTCUTS FOR CHAT & MCP</span>
        </button>
      </div>

      {/* ── TAB 1: Profile ────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--copper-500), var(--copper-300))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 700, color: '#000'
            }}>
              {getDisplayName(user).slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 22, fontWeight: 700 }}>
                {getDisplayName(user)}
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                {user.email_id}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Role</span>
              <span className="mono" style={{ color: 'var(--copper-300)', fontSize: 13, fontWeight: 600 }}>
                {user.role?.toUpperCase() || 'OFFICER'}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>User ID</span>
              <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {user.user_id || 'N/A'}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Security Domain</span>
              <span className="mono" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {user.email_id?.split('@')[1] || 'Karnataka Police'}
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)'
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Jurisdiction</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                State Crime Intelligence Unit
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-outline"
              onClick={() => navigate('/timeline?officer=me')}
              style={{ flex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Icon name="cases" size={14} />
              My Active Cases
            </button>
            <button
              onClick={handleSignOut}
              style={{
                flex: 1, height: 40,
                background: 'rgba(224, 82, 82, 0.1)',
                border: '1px solid rgba(224, 82, 82, 0.4)',
                color: '#e05252', borderRadius: 6, fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(224, 82, 82, 0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(224, 82, 82, 0.1)'}
            >
              <Icon name="close" size={14} color="#e05252" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: Shortcuts for Chat & MCP ────────────────────────── */}
      {activeTab === 'shortcuts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(200,129,74,0.15), rgba(245,158,11,0.08))',
            border: '1px solid rgba(200,129,74,0.35)',
            borderRadius: 12, padding: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Terminal size={20} color="#fbbf24" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc' }}>
                SENTINAL MCP & AI CHAT SLASH COMMANDS
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
              Sentinal features a native <b>Model Context Protocol (MCP)</b> engine. You can type any slash command (e.g. <code>/canvas</code>, <code>/mcp</code>, <code>/search</code>) in the <b>AI Assistant</b> terminal to autonomously control features, generate dynamic canvases, track convoys, and query the police database.
            </p>
          </div>

          {/* Shortcuts Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SHORTCUTS_DATA.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(12,12,24,0.85)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '16px 20px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(200,129,74,0.4)'
                  e.currentTarget.style.background = 'rgba(16,16,32,0.95)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.background = 'rgba(12,12,24,0.85)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      background: 'rgba(200,129,74,0.25)', color: '#fbbf24',
                      border: '1px solid rgba(245,158,11,0.5)',
                      borderRadius: 6, padding: '3px 8px', fontSize: 13, fontWeight: 800,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {item.command}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
                      {item.title}
                    </span>
                  </div>

                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(56,189,248,0.15)', color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.3)', textTransform: 'uppercase'
                  }}>
                    {item.category}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                  {item.description}
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '8px 12px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#52e0cc', overflowX: 'auto' }}>
                    {item.example}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleCopy(item.example)}
                      style={{
                        background: 'rgba(255,255,255,0.08)', color: '#fff',
                        border: 'none', borderRadius: 4, padding: '4px 8px',
                        fontSize: 10, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      {copiedCmd === item.example ? <Check size={11} color="#52e07a" /> : <Copy size={11} />}
                      <span>{copiedCmd === item.example ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => handleTryInChat(item.example)}
                      style={{
                        background: 'linear-gradient(135deg, #c8814a, #f59e0b)',
                        color: '#000', border: 'none', borderRadius: 4,
                        padding: '4px 10px', fontSize: 10, fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <span>⚡ Try in Chat</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
