import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Icon from '../Icons'
import logoImg from '../../assets/logo.png'

export default function Sidebar() {
  const { t } = useTranslation()
  const location = useLocation()

  const sections = [
    {
      label: t('Command Center'),
      items: [
        { path: '/warroom', icon: <Icon name="warroom" size={14} />, label: t('nav.warroom') },
        { path: '/dashboard', icon: <Icon name="dashboard" size={14} />, label: t('nav.dashboard') },
        { path: '/upload', icon: <Icon name="ingestion" size={14} />, label: 'Upload Intel' },
        { path: '/ingestion', icon: <Icon name="fir" size={14} />, label: t('nav.dataingestion') },
      ],
    },
    {
      label: t('Investigations'),
      items: [
        { path: '/timeline', icon: <Icon name="cases" size={14} />, label: t('nav.cases') },
        { path: '/connections', icon: <Icon name="canvas" size={14} />, label: t('nav.canvas') },
        { path: '/patterns', icon: <Icon name="pattern" size={14} />, label: 'Pattern Intel' },
        { path: '/board', icon: <Icon name="evidence" size={14} />, label: t('nav.evidence') },
        { path: '/network-3d', icon: <Icon name="network" size={14} />, label: '3D Network' },
        { path: '/map', icon: <Icon name="map" size={14} />, label: t('nav.map') },
        { path: '/persons', icon: <Icon name="persons" size={14} />, label: t('nav.persons') },
        { path: '/fir-search', icon: <Icon name="fir" size={14} />, label: t('nav.firsearch') },
        { path: '/ocr-records', icon: <Icon name="evidence" size={14} />, label: 'OCR Store' },
      ],
    },
    {
      label: t('Intelligence'),
      items: [
        { path: '/financial', icon: <Icon name="financial" size={14} />, label: t('nav.financial') },
        { path: '/cdr', icon: <Icon name="cdr" size={14} />, label: t('nav.cdr') },
        { path: '/predict', icon: <Icon name="predict" size={14} />, label: t('nav.predictive') },
        { path: '/assistant', icon: <Icon name="ai" size={14} />, label: t('nav.ai') },
        { path: '/darkweb', icon: <Icon name="darkweb" size={14} />, label: t('nav.darkweb') },
        { path: '/web-investigate', icon: <Icon name="persons" size={14} />, label: 'Web Investigate' },
        { path: '/web-intel', icon: <Icon name="global" size={14} />, label: 'Web Scraper' },
        { path: '/forensic', icon: <Icon name="evidence" size={14} />, label: 'Forensic Suite' },
      ],
    },
  ]

  return (
    <aside style={{
      gridColumn: '1',
      gridRow: '1 / 4',
      background: 'rgba(9, 10, 16, 0.95)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        height: 'var(--topbar-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 17, 26, 0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={logoImg}
            alt="Sentinal"
            style={{
              height: 30,
              width: 'auto',
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.3))',
            }}
          />
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--copper-400)',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-heading)',
              lineHeight: 1,
            }}>
              SENTINAL
            </div>
            <div style={{
              fontSize: 8,
              color: 'var(--cyan-accent)',
              letterSpacing: '0.12em',
              marginTop: 3,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              KSP COMMAND CENTER
            </div>
          </div>
        </div>
        <span className="badge badge-copper" style={{ fontSize: 9, padding: '2px 6px' }}>
          v1.4
        </span>
      </div>

      {/* Navigation Sections */}
      <div style={{ flex: 1, paddingTop: 12, paddingBottom: 12 }}>
        {sections.map(section => (
          <div key={section.label} style={{ padding: '6px 0' }}>
            <div className="section-label" style={{ padding: '0 18px 6px' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--copper-400)' }} />
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
                    gap: 12,
                    padding: '9px 18px',
                    margin: '2px 8px',
                    borderRadius: 8,
                    color: isActive ? 'var(--copper-400)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid transparent',
                    boxShadow: isActive ? '0 0 16px rgba(245, 158, 11, 0.15)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <span style={{
                    color: isActive ? 'var(--copper-400)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                  }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>

      {/* System Status Footer */}
      <div style={{
        padding: '14px 18px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(12, 14, 22, 0.8)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'var(--status-success)', fontWeight: 600,
        }}>
          <span className="live-dot" />
          <span>Catalyst Live System</span>
        </div>
        <div style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 4,
          fontFamily: 'var(--font-mono)',
        }}>
          AppSail: Active · 113k FIRs
        </div>
      </div>
    </aside>
  )
}

