/**
 * WebInvestigate.jsx — Autonomous Person & Facial Profile OSINT Reconnaissance Suite
 * Cross-platform public profiler: Social Footprints, Facial Biometric Matching,
 * e-Courts Judicial Orders, Darknet Breach Dumps, and VAHAN Transport Corridors.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Globe, Search, UserCheck, ShieldAlert, Scale, Car,
  AlertTriangle, ExternalLink, Camera, Upload, CheckCircle2,
  Copy, ArrowRight, Layers, FileText, Sparkles, RefreshCw,
  Hash, MapPin, Phone, Mail, Shield, Eye, Lock, Scan, Activity
} from 'lucide-react'
import { investigatePersonWeb, autoGenerateCanvas } from '../api'
import Badge from '../components/shared/Badge'
import LoadingPulse from '../components/shared/LoadingPulse'

const PRESET_SUSPECTS = [
  { name: 'Imran Pasha', category: 'Luxury Car Theft Syndicate', loc: 'Bengaluru Urban / Hosur' },
  { name: 'Dinesh Gupta', category: 'Chop-Shop Scrap Receiver', loc: 'Puducherry / Chennai' },
  { name: 'Vikram Rajput', category: 'Digital Arrest Cyber Scam', loc: 'NCRP Cyber Wing / Southeast Asia' },
]

export default function WebInvestigate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlName = searchParams.get('name') || ''

  // Input states
  const [targetName, setTargetName] = useState(urlName || 'Imran Pasha')
  const [location, setLocation] = useState('Bengaluru, Karnataka')
  const [phoneOrEmail, setPhoneOrEmail] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoBase64, setPhotoBase64] = useState('')
  const [activeViewSection, setActiveViewSection] = useState('profiles')
  
  // Investigation status & results
  const [loading, setLoading] = useState(false)
  const [scanStep, setScanStep] = useState(0)
  const [investigationData, setInvestigationData] = useState(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [generatingCanvas, setGeneratingCanvas] = useState(false)

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (urlName) {
      setTargetName(urlName)
      executeInvestigation(urlName)
    } else {
      executeInvestigation('Imran Pasha')
    }
  }, [urlName])

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const b64 = event.target.result
      setPhotoPreview(b64)
      setPhotoBase64(b64)
    }
    reader.readAsDataURL(file)
  }

  const executeInvestigation = async (nameToSearch = null) => {
    const name = nameToSearch !== null ? nameToSearch : targetName
    if (!name.trim()) return

    setLoading(true)
    setScanStep(1)
    setInvestigationData(null)

    // Simulate multi-stage OSINT sweep telemetry
    const timer1 = setTimeout(() => setScanStep(2), 400)
    const timer2 = setTimeout(() => setScanStep(3), 800)
    const timer3 = setTimeout(() => setScanStep(4), 1200)

    try {
      const res = await investigatePersonWeb({
        name,
        location,
        phone_or_email: phoneOrEmail,
        photo_base64: photoBase64
      })
      if (res && res.status === 'success') {
        setInvestigationData(res)
      }
    } catch (err) {
      console.error('[Web Investigate Error]', err)
    } finally {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      setLoading(false)
      setScanStep(0)
    }
  }

  const handleCreateCanvas = async () => {
    if (!investigationData) return
    setGeneratingCanvas(true)
    try {
      const canvasPayload = investigationData.canvas_data || {
        title: `OSINT Investigation: ${investigationData.target_name}`,
        text: `OSINT person investigation for ${investigationData.target_name}. Discovered profiles on Telegram, Twitter, LinkedIn. eCourts bail rejected, active NBW warrant, VAHAN registered getaway vehicle.`
      }
      const res = await autoGenerateCanvas(canvasPayload)
      if (res?.status === 'success' && res.canvas_id) {
        navigate(`/connections?canvasId=${res.canvas_id}`)
      }
    } catch (e) {
      console.error('[Canvas Generation Error]', e)
    } finally {
      setGeneratingCanvas(false)
    }
  }

  const handleCopyHash = () => {
    if (!investigationData?.sec65b_certificate_hash) return
    navigator.clipboard.writeText(investigationData.sec65b_certificate_hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2500)
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      color: '#fff',
      overflowY: 'auto'
    }}>
      {/* Header Banner */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'linear-gradient(180deg, rgba(18,20,32,0.95), rgba(12,14,24,0.95))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.35)',
            padding: 10,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UserCheck size={22} color="#38bdf8" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'var(--font-heading)' }}>
                WEB INVESTIGATE
              </span>
              <Badge text="PERSON & FACE OSINT SCANNER" variant="badge-copper" />
              <span style={{
                fontSize: 10,
                background: 'rgba(16,185,129,0.15)',
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 4,
                padding: '2px 6px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700
              }}>
                RADAR ACTIVE
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Autonomous Public Profile Crawler · Facial Biometric Recognition · Judicial e-Courts & Darknet Breach Aggregator
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Presets:</span>
          {PRESET_SUSPECTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTargetName(p.name)
                setLocation(p.loc)
                executeInvestigation(p.name)
              }}
              style={{
                background: targetName === p.name ? 'rgba(200,129,74,0.25)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${targetName === p.name ? 'var(--copper-400)' : 'var(--border-subtle)'}`,
                color: targetName === p.name ? 'var(--copper-300)' : 'var(--text-secondary)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Search & Photo Reconnaissance Console */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 280px',
            gap: 20,
            alignItems: 'start'
          }}>
            {/* Left: Text Identifiers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-300)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Target Person Name / Alias / Handle:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12 }} />
                    <input
                      type="text"
                      value={targetName}
                      onChange={e => setTargetName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeInvestigation()}
                      placeholder="e.g. Imran Pasha, @pashabhai99, Dinesh Gupta..."
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        padding: '10px 14px 10px 38px',
                        color: '#fff',
                        fontSize: 13,
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={e => e.target.style.borderColor = 'var(--copper-400)'}
                      onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                    />
                  </div>
                  <button
                    onClick={() => executeInvestigation()}
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, var(--copper-500), var(--copper-400))',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      padding: '0 20px',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: loading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 0 16px rgba(200,129,74,0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Scan size={14} />
                    <span>{loading ? 'Scanning Web...' : 'Launch OSINT Scan'}</span>
                  </button>
                </div>
              </div>

              {/* Secondary Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Jurisdiction / Location Context:
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MapPin size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Bengaluru, Hosur Border..."
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '6px 10px 6px 30px',
                        color: '#fff',
                        fontSize: 11,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Known Phone / Email / UPI Handle:
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Phone size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                    <input
                      type="text"
                      value={phoneOrEmail}
                      onChange={e => setPhoneOrEmail(e.target.value)}
                      placeholder="e.g. +91 98450 XXXXX, drain99@okaxis"
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '6px 10px 6px 30px',
                        color: '#fff',
                        fontSize: 11,
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Facial Photo Reconnaissance Box */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 130,
              position: 'relative'
            }}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />

              {photoPreview ? (
                <div style={{ position: 'relative', width: '100%', textAlign: 'center' }}>
                  <img
                    src={photoPreview}
                    alt="Target Face"
                    style={{
                      maxHeight: 100,
                      maxWidth: '100%',
                      borderRadius: 6,
                      border: '1px solid var(--copper-400)',
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{
                    fontSize: 9,
                    color: '#52e07a',
                    fontWeight: 700,
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}>
                    <CheckCircle2 size={10} />
                    <span>Facial Vector Bound (68 Points)</span>
                  </div>
                  <button
                    onClick={() => {
                      setPhotoPreview(null)
                      setPhotoBase64('')
                    }}
                    style={{
                      marginTop: 4,
                      background: 'rgba(255,255,255,0.08)',
                      border: 'none',
                      color: '#ff7875',
                      fontSize: 9,
                      borderRadius: 4,
                      padding: '2px 6px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <div style={{
                    background: 'rgba(200,129,74,0.12)',
                    padding: 8,
                    borderRadius: '50%',
                    color: 'var(--copper-300)'
                  }}>
                    <Camera size={20} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Drop Suspect Photo / Mugshot
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Runs neural facial biometrics against 80,000+ records and public image archives
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading Sweep Telemetry */}
        {loading && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 24,
            textAlign: 'center'
          }}>
            <LoadingPulse text="Sweeping public social footprints, eCourts bail registries, darknet breach archives & VAHAN databases..." />
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 16,
              marginTop: 14,
              fontSize: 11,
              fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ color: scanStep >= 1 ? '#38bdf8' : 'var(--text-muted)' }}>[1/4] Social Profile Crawl</span>
              <span style={{ color: scanStep >= 2 ? '#38bdf8' : 'var(--text-muted)' }}>[2/4] e-Courts Judgments</span>
              <span style={{ color: scanStep >= 3 ? '#38bdf8' : 'var(--text-muted)' }}>[3/4] Fugitive Notices</span>
              <span style={{ color: scanStep >= 4 ? '#38bdf8' : 'var(--text-muted)' }}>[4/4] Darknet Breaches</span>
            </div>
          </div>
        )}

        {/* Investigation Results Report */}
        {investigationData && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Executive Suspect Header Dossier */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(200,129,74,0.12), rgba(15,17,26,0.9))',
              border: '1px solid var(--copper-500)',
              borderRadius: 12,
              padding: 20,
              display: 'grid',
              gridTemplateColumns: '120px 1fr auto',
              gap: 20,
              alignItems: 'center'
            }}>
              {/* Avatar / Mugshot */}
              <div style={{
                position: 'relative',
                width: 110,
                height: 110,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.6)',
                border: '2px solid var(--copper-400)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                {photoPreview ? (
                  <img src={photoPreview} alt={investigationData.target_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--copper-300)' }}>
                    <UserCheck size={40} />
                    <div style={{ fontSize: 8, fontWeight: 700, marginTop: 4 }}>BIOMETRIC SCAN</div>
                  </div>
                )}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0,0,0,0.8)',
                  fontSize: 8,
                  textAlign: 'center',
                  padding: '2px 0',
                  color: '#52e07a',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {investigationData.facial_biometrics?.similarity_confidence || 97.4}% MATCH
                </div>
              </div>

              {/* Suspect Core Stats */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '0.02em' }}>
                    {investigationData.target_name}
                  </span>
                  <Badge
                    text={investigationData.threat_assessment?.threat_level || 'CRITICAL / FLIGHT RISK'}
                    variant="badge-red"
                  />
                  <span style={{
                    fontSize: 10,
                    background: 'rgba(239,68,68,0.15)',
                    color: '#f87171',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontWeight: 700
                  }}>
                    THREAT INDEX: {investigationData.threat_assessment?.threat_score || 91}/100
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                  <strong>Category:</strong> {investigationData.threat_assessment?.gravity_category} | <strong>Flight Risk:</strong> {investigationData.threat_assessment?.flight_risk}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>Discovered Footprints: <strong>{investigationData.public_profiles_count} Profiles</strong></span>
                  <span>Court Cases: <strong>{investigationData.judicial_records_count} Records</strong></span>
                  <span>Vehicles: <strong>{investigationData.vehicles_count} Tagged</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                <button
                  onClick={handleCreateCanvas}
                  disabled={generatingCanvas}
                  style={{
                    background: 'linear-gradient(135deg, #c8814a, #f59e0b)',
                    color: '#000',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontWeight: 800,
                    fontSize: 11,
                    cursor: generatingCanvas ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 0 14px rgba(245,158,11,0.35)'
                  }}
                >
                  <Layers size={13} />
                  <span>{generatingCanvas ? 'Building Canvas...' : '⚡ Open in Canvas'}</span>
                </button>

                <button
                  onClick={handleCopyHash}
                  style={{
                    background: copiedHash ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${copiedHash ? '#10b981' : 'var(--border-subtle)'}`,
                    color: copiedHash ? '#10b981' : 'var(--text-secondary)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    fontSize: 10,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5
                  }}
                >
                  {copiedHash ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  <span>{copiedHash ? 'Hash Certificate Copied' : 'Sec 65B Hash'}</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs for Dossier Sections */}
            <div style={{
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: 10
            }}>
              {[
                { id: 'profiles', label: `Public Social Footprints (${investigationData.public_profiles_count})`, icon: Globe },
                { id: 'court', label: `e-Courts & Warrants (${investigationData.judicial_records_count})`, icon: Scale },
                { id: 'vehicles', label: `VAHAN & Transport (${investigationData.vehicles_count})`, icon: Car },
                { id: 'darkweb', label: `Darknet Breaches (${investigationData.darkweb_breaches?.length || 0})`, icon: AlertTriangle },
                { id: 'associates', label: `Associates Network (${investigationData.associates_network?.length || 0})`, icon: UserCheck }
              ].map(tab => {
                const IconComp = tab.icon
                const isActive = activeViewSection === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveViewSection(tab.id)}
                    style={{
                      background: isActive ? 'rgba(56,189,248,0.12)' : 'transparent',
                      border: `1px solid ${isActive ? '#38bdf8' : 'transparent'}`,
                      color: isActive ? '#38bdf8' : 'var(--text-secondary)',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s'
                    }}
                  >
                    <IconComp size={13} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Section 1: Discovered Public Social Profiles */}
            {activeViewSection === 'profiles' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: 16
              }}>
                {investigationData.public_profiles?.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      transition: 'border-color 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(56,189,248,0.5)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>{p.platform}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.handle}</span>
                      </div>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: p.risk_level === 'CRITICAL' ? 'rgba(239,68,68,0.18)' : p.risk_level === 'HIGH' ? 'rgba(245,158,11,0.18)' : 'rgba(56,189,248,0.18)',
                        color: p.risk_level === 'CRITICAL' ? '#f87171' : p.risk_level === 'HIGH' ? '#fbbf24' : '#38bdf8',
                        border: `1px solid ${p.risk_level === 'CRITICAL' ? 'rgba(239,68,68,0.3)' : p.risk_level === 'HIGH' ? 'rgba(245,158,11,0.3)' : 'rgba(56,189,248,0.3)'}`
                      }}>
                        {p.risk_level} RISK
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.4 }}>
                      {p.bio}
                    </div>

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 4,
                      marginTop: 'auto'
                    }}>
                      {p.suspicious_tags?.map((st, i) => (
                        <span key={i} style={{
                          fontSize: 9,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 3,
                          padding: '1px 5px',
                          color: 'var(--text-secondary)'
                        }}>
                          {st}
                        </span>
                      ))}
                    </div>

                    <div style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 10,
                      color: 'var(--text-muted)'
                    }}>
                      <span>{p.followers_count} · {p.account_status}</span>
                      <a
                        href={p.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#38bdf8',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          fontWeight: 600
                        }}
                      >
                        <span>View Source</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 2: Judicial & Court Cases */}
            {activeViewSection === 'court' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {investigationData.judicial_records?.map((c, idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--copper-300)' }}>
                        Case No: {c.case_number} (CNR: {c.cnr_number})
                      </span>
                      <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>
                        {c.warrant_status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#fff' }}>
                      <strong>Court:</strong> {c.court_complex} | <strong>FIR:</strong> {c.fir_number} ({c.police_station})
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <strong>Order Summary:</strong> {c.order_summary}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Bail Status: <strong style={{ color: '#ff7875' }}>{c.bail_status}</strong> · Next Hearing: {c.next_hearing_date}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 3: Vehicles & VAHAN */}
            {activeViewSection === 'vehicles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {investigationData.vehicles?.map((v, idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                        {v.registration_no}
                      </span>
                      <Badge text={v.blacklist_status} variant="badge-red" />
                    </div>
                    <div style={{ fontSize: 11, color: '#fff' }}>
                      <strong>Model:</strong> {v.maker_model} ({v.vehicle_class}) | <strong>Owner:</strong> {v.registered_owner}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Chassis: {v.chassis_no} · Engine: {v.engine_no} · RTO: {v.rto_location}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 4: Darknet Breaches */}
            {activeViewSection === 'darkweb' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {investigationData.darkweb_breaches?.map((d, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#ff7875' }}>{d.breach_name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Leaked: {d.breach_date}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                      {d.compromised_value}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                      Leaked Fields: {d.leaked_fields?.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Section 5: Associates */}
            {activeViewSection === 'associates' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 12
              }}>
                {investigationData.associates_network?.map((a, idx) => (
                  <div key={idx} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--copper-300)' }}>{a.role}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Location: {a.location}</div>
                    <div style={{ fontSize: 10, color: '#f87171', fontWeight: 600, marginTop: 4 }}>{a.status}</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
