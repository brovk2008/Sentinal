import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Icon from '../Icons'

const getLogoPath = () => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) return 'logo.png';
  return window.location.pathname.includes('/app/') ? 'logo.png' : 'app/logo.png';
};

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()

  const sections = [
    {
      label: t('Command Center'),
      items: [
        { path: '/warroom', icon: <Icon name="warroom" size={13} />, label: t('nav.warroom') },
        { path: '/dashboard', icon: <Icon name="dashboard" size={13} />, label: t('nav.dashboard') },
        { path: '/upload', icon: <Icon name="ingestion" size={13} />, label: 'Upload Intel' },
        { path: '/ingestion', icon: <Icon name="fir" size={13} />, label: t('nav.dataingestion') },
      ],
    },
    {
      label: t('Investigations'),
      items: [
        { path: '/timeline', icon: <Icon name="cases" size={13} />, label: t('nav.cases') },
        { path: '/connections', icon: <Icon name="canvas" size={13} />, label: t('nav.canvas') },
        { path: '/patterns', icon: <Icon name="pattern" size={13} />, label: 'Pattern Intel' },
        { path: '/board', icon: <Icon name="evidence" size={13} />, label: t('nav.evidence') },
        { path: '/network-3d', icon: <Icon name="network" size={13} />, label: '3D Network' },
        { path: '/map', icon: <Icon name="map" size={13} />, label: t('nav.map') },
        { path: '/persons', icon: <Icon name="persons" size={13} />, label: t('nav.persons') },
        { path: '/fir-search', icon: <Icon name="fir" size={13} />, label: t('nav.firsearch') },
      ],
    },
    {
      label: t('Intelligence'),
      items: [
        { path: '/financial', icon: <Icon name="financial" size={13} />, label: t('nav.financial') },
        { path: '/cdr', icon: <Icon name="cdr" size={13} />, label: t('nav.cdr') },
        { path: '/predict', icon: <Icon name="predict" size={13} />, label: t('nav.predictive') },
        { path: '/assistant', icon: <Icon name="ai" size={13} />, label: t('nav.ai') },
        { path: '/darkweb', icon: <Icon name="darkweb" size={13} />, label: t('nav.darkweb') },
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
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <img
          src={getLogoPath()}
          alt="Sentinal"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
            if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
          }}
          style={{
            height: 28,
            width: 'auto',
            objectFit: 'contain',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            display: 'none',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: 'var(--copper-500)',
            color: '#000',
            fontWeight: 900,
            fontSize: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          🛡️
        </div>
        <div>
          <div style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--copper-400)',
            letterSpacing: '0.12em',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
          }}>
            SENTINAL
          </div>
          <div style={{
            fontSize: 8,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            marginTop: 2,
            textTransform: 'uppercase',
          }}>
            KSP INTELLIGENCE
          </div>
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
