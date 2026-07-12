import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()

  const sections = [
    {
      label: t('Command Center'),
      items: [
        { path: '/warroom', icon: '⚔️', label: t('nav.warroom') },
        { path: '/dashboard', icon: '⬡', label: t('nav.dashboard') },
        { path: '/ingestion', icon: '📥', label: t('nav.dataingestion') },
      ],
    },
    {
      label: t('Investigations'),
      items: [
        { path: '/timeline', icon: '◈', label: t('nav.cases') },
        { path: '/connections', icon: '⬡', label: t('nav.canvas') },
        { path: '/patterns', icon: '⟁', label: 'Pattern Intel' },
        { path: '/board', icon: '📌', label: t('nav.evidence') },
        { path: '/network-3d', icon: '⬡', label: '3D Network' },
        { path: '/map', icon: '◎', label: t('nav.map') },
        { path: '/persons', icon: '◉', label: t('nav.persons') },
        { path: '/fir-search', icon: '🔍', label: t('nav.firsearch') },
      ],
    },
    {
      label: t('Intelligence'),
      items: [
        { path: '/financial', icon: '◈', label: t('nav.financial') },
        { path: '/cdr', icon: '◇', label: t('nav.cdr') },
        { path: '/predict', icon: '⟁', label: t('nav.predictive') },
        { path: '/assistant', icon: '◎', label: t('nav.ai') },
        { path: '/darkweb', icon: '🕸️', label: t('nav.darkweb') },
      ],
    },
  ]


  return (
    <aside style={{
      gridColumn: '1',
      gridRow: '1 / 4',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        height: 'var(--topbar-height)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--copper-400)',
          letterSpacing: '0.08em',
          fontFamily: 'var(--font-mono)',
        }}>
          PROJECT SENTINAL
        </div>
        <div style={{
          fontSize: 9,
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          marginTop: 1,
          textTransform: 'uppercase',
        }}>
          v2 · Karnataka Police Intelligence
        </div>
      </div>

      {/* Navigation sections */}
      <div style={{ flex: 1, paddingTop: 8 }}>
        {sections.map(section => (
          <div key={section.label} style={{ padding: '8px 0' }}>
            <div className="section-label" style={{ padding: '0 16px 6px' }}>
              {section.label}
            </div>
            {section.items.map(item => {
              const isActive = location.pathname === item.path ||
                (item.path === '/timeline' && location.pathname.startsWith('/timeline'))
              return (
                <NavLink
                  key={item.path + item.label}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 16px',
                    color: isActive ? 'var(--copper-400)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    borderLeft: isActive ? '2px solid var(--copper-400)' : '2px solid transparent',
                    background: isActive ? 'rgba(200,129,74,0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>

      {/* System status */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--status-success)',
        }}>
          <span className="live-dot" />
          All systems operational
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          DB: Connected · 113,115 records
        </div>
      </div>
    </aside>
  )
}
