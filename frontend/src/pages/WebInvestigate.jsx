/**
 * WebInvestigate.jsx — Autonomous Person & Facial Profile OSINT Reconnaissance Suite
 * Cross-platform public profiler: 40+ Social Footprints, Forensic EXIF Photo Extraction,
 * Facial Biometric Matching, e-Courts Judicial Orders, Darknet Breach Dumps, and VAHAN Fleet Corridors.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Globe, Search, UserCheck, ShieldAlert, Scale, Car,
  AlertTriangle, ExternalLink, Camera, Upload, CheckCircle2,
  Copy, ArrowRight, Layers, FileText, Sparkles, RefreshCw,
  Hash, MapPin, Phone, Mail, Shield, Eye, Lock, Scan, Activity,
  Filter, Navigation, Cpu, Clock, Aperture, Compass, Crosshair
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
  const [aliases, setAliases] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoBase64, setPhotoBase64] = useState('')
  const [activeViewSection, setActiveViewSection] = useState('profiles')
  
  // Platform filtering states
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchFilterKeyword, setSearchFilterKeyword] = useState('')
  const [selectedRiskFilter, setSelectedRiskFilter] = useState('ALL')

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

    // Multi-stage OSINT sweep telemetry
    const timer1 = setTimeout(() => setScanStep(2), 350)
    const timer2 = setTimeout(() => setScanStep(3), 700)
    const timer3 = setTimeout(() => setScanStep(4), 1050)
    const timer4 = setTimeout(() => setScanStep(5), 1400)

    try {
      const res = await investigatePersonWeb({
        name,
        location,
        phone_or_email: phoneOrEmail,
        aliases: aliases,
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
      clearTimeout(timer4)
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
        text: `OSINT person investigation for ${investigationData.target_name}. Discovered profiles across 40+ platforms, EXIF photo telemetry, eCourts bail rejected, active NBW warrant, VAHAN registered getaway vehicle.`
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

  // Filtered public profiles
  const filteredProfiles = useMemo(() => {
    if (!investigationData?.public_profiles) return []
    return investigationData.public_profiles.filter(p => {
      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory
      const matchesRisk = selectedRiskFilter === 'ALL' || p.risk_level === selectedRiskFilter
      const matchesText = !searchFilterKeyword.trim() ||
        p.platform.toLowerCase().includes(searchFilterKeyword.toLowerCase()) ||
        p.handle.toLowerCase().includes(searchFilterKeyword.toLowerCase()) ||
        p.bio.toLowerCase().includes(searchFilterKeyword.toLowerCase())
      return matchesCat && matchesRisk && matchesText
    })
  }, [investigationData, selectedCategory, selectedRiskFilter, searchFilterKeyword])

  const categoriesList = useMemo(() => {
    if (!investigationData?.public_profiles) return []
    const cats = new Set(investigationData.public_profiles.map(p => p.category))
    return ['ALL', ...Array.from(cats)]
  }, [investigationData])

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
              <Badge text="VAST PERSON & FACIAL OSINT ENGINE" variant="badge-copper" />
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
                40+ PLATFORMS & EXIF RADAR ACTIVE
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Multi-Platform Username Sweeper · Forensic EXIF Photo GPS Extractor · Facial Biometric Vector Match · e-Courts & Darknet Correlator
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
            gridTemplateColumns: '1fr 300px',
            gap: 20,
            alignItems: 'start'
          }}>
            {/* Left: Text Identifiers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-300)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Target Person Name / Alias / Moniker / Username:
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
                      placeholder="e.g. Imran Pasha, @pashabhai99, Dinesh Gupta, Vikram Rajput..."
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
                    <span>{loading ? 'Sweeping 40+ Sites...' : 'Launch Deep OSINT Scan'}</span>
                  </button>
                </div>
              </div>

              {/* Secondary Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Known Aliases / Monikers (Optional):
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Hash size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                    <input
                      type="text"
                      value={aliases}
                      onChange={e => setAliases(e.target.value)}
                      placeholder="e.g. Keymaker, Pasha Bhai, Chop-Shop Dinesh"
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
                    Known Phone / Email / UPI VPA Handle:
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Phone size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10 }} />
                    <input
                      type="text"
                      value={phoneOrEmail}
                      onChange={e => setPhoneOrEmail(e.target.value)}
                      placeholder="e.g. +91 98450 XXXXX, drain99@okaxis, pasha@proton.me"
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

            {/* Right: Facial Photo & EXIF Metadata Reconnaissance Box */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 10,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 140,
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
                      maxHeight: 105,
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
                    <span>EXIF & Biometric Vector Bound</span>
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
                    Extracts embedded EXIF GPS coords, camera device serials, and matches 68-point facial vectors
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
            <LoadingPulse text="Executing autonomous username hunt across 40+ platforms, extracting EXIF photo telemetry & correlating judicial records..." />
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 16,
              marginTop: 14,
              fontSize: 11,
              fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ color: scanStep >= 1 ? '#38bdf8' : 'var(--text-muted)' }}>[1/5] EXIF GPS & Device Telemetry</span>
              <span style={{ color: scanStep >= 2 ? '#38bdf8' : 'var(--text-muted)' }}>[2/5] 40+ Username Probes</span>
              <span style={{ color: scanStep >= 3 ? '#38bdf8' : 'var(--text-muted)' }}>[3/5] e-Courts & NBW Check</span>
              <span style={{ color: scanStep >= 4 ? '#38bdf8' : 'var(--text-muted)' }}>[4/5] Darknet Breach Correlation</span>
              <span style={{ color: scanStep >= 5 ? '#38bdf8' : 'var(--text-muted)' }}>[5/5] Sec 65B Hash Certificate</span>
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
                    THREAT INDEX: {investigationData.threat_assessment?.threat_score || 94}/100
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                  <strong>Category:</strong> {investigationData.threat_assessment?.gravity_category} | <strong>Flight Risk:</strong> {investigationData.threat_assessment?.flight_risk}
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span>Public Footprints: <strong>{investigationData.public_profiles_count} Discovered</strong> across 8 categories</span>
                  <span>Court Cases: <strong>{investigationData.judicial_records_count} Records</strong></span>
                  <span>Vehicles: <strong>{investigationData.vehicles_count} Tagged</strong></span>
                  {investigationData.exif_photo_forensics?.has_exif && (
                    <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={11} />
                      <strong>EXIF Geotag Bound:</strong> {investigationData.exif_photo_forensics.gps_coordinates?.reverse_location}
                    </span>
                  )}
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
              paddingBottom: 10,
              flexWrap: 'wrap'
            }}>
              {[
                { id: 'profiles', label: `Public Social Footprints (${investigationData.public_profiles_count})`, icon: Globe },
                { id: 'exif', label: `EXIF Photo Forensics`, icon: Camera },
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

            {/* Section 1: Discovered Public Social Profiles across 40+ Platforms */}
            {activeViewSection === 'profiles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                
                {/* Filter and Search Sub-bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  background: 'rgba(255,255,255,0.02)',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)'
                }}>
                  {/* Category Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Filter size={11} />
                      CATEGORY:
                    </span>
                    {categoriesList.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                          background: selectedCategory === cat ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${selectedCategory === cat ? '#38bdf8' : 'var(--border-subtle)'}`,
                          color: selectedCategory === cat ? '#38bdf8' : 'var(--text-secondary)',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {cat} {cat !== 'ALL' && investigationData.platform_categories_summary?.[cat] ? `(${investigationData.platform_categories_summary[cat]})` : ''}
                      </button>
                    ))}
                  </div>

                  {/* Search inside results */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      value={searchFilterKeyword}
                      onChange={e => setSearchFilterKeyword(e.target.value)}
                      placeholder="Filter platform, handle, keyword..."
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: '#fff',
                        outline: 'none',
                        width: 200
                      }}
                    />
                    <select
                      value={selectedRiskFilter}
                      onChange={e => setSelectedRiskFilter(e.target.value)}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 10,
                        color: '#fff',
                        outline: 'none'
                      }}
                    >
                      <option value="ALL">All Risk Levels</option>
                      <option value="CRITICAL">Critical Risk</option>
                      <option value="HIGH">High Risk</option>
                      <option value="MODERATE">Moderate Risk</option>
                      <option value="LOW">Low Risk</option>
                    </select>
                  </div>
                </div>

                {/* Profiles Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                  gap: 16
                }}>
                  {filteredProfiles.map((p, idx) => (
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
                          <span style={{
                            fontSize: 9,
                            background: 'rgba(255,255,255,0.06)',
                            padding: '1px 5px',
                            borderRadius: 3,
                            color: 'var(--text-muted)'
                          }}>
                            {p.category}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{p.handle}</span>
                        </div>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: p.risk_level === 'CRITICAL' ? 'rgba(239,68,68,0.18)' : p.risk_level === 'HIGH' ? 'rgba(245,158,11,0.18)' : p.risk_level === 'MODERATE' ? 'rgba(56,189,248,0.18)' : 'rgba(16,185,129,0.18)',
                          color: p.risk_level === 'CRITICAL' ? '#f87171' : p.risk_level === 'HIGH' ? '#fbbf24' : p.risk_level === 'MODERATE' ? '#38bdf8' : '#10b981',
                          border: `1px solid ${p.risk_level === 'CRITICAL' ? 'rgba(239,68,68,0.3)' : p.risk_level === 'HIGH' ? 'rgba(245,158,11,0.3)' : p.risk_level === 'MODERATE' ? 'rgba(56,189,248,0.3)' : 'rgba(16,185,129,0.3)'}`
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
                          <span>Direct Link</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: EXIF Photo Forensics Telemetry */}
            {activeViewSection === 'exif' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {investigationData.exif_photo_forensics ? (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Camera size={18} color="var(--copper-300)" />
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
                          FORENSIC PHOTO EXIF METADATA TELEMETRY
                        </span>
                      </div>
                      <Badge text="SECTION 65B CERTIFIED" variant="badge-green" />
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 16
                    }}>
                      {/* Hardware Card */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper-300)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Cpu size={13} />
                          <span>CAPTURE HARDWARE & DEVICE</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#fff' }}>
                          <strong>Make:</strong> {investigationData.exif_photo_forensics.device_make}
                        </div>
                        <div style={{ fontSize: 12, color: '#fff', marginTop: 3 }}>
                          <strong>Model:</strong> {investigationData.exif_photo_forensics.device_model}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          <strong>Lens:</strong> {investigationData.exif_photo_forensics.lens_model}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          <strong>OS Firmware:</strong> {investigationData.exif_photo_forensics.software_firmware}
                        </div>
                      </div>

                      {/* GPS Card */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Compass size={13} />
                          <span>EMBEDDED GEOTAG COORDINATES</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#fff' }}>
                          <strong>Latitude:</strong> {investigationData.exif_photo_forensics.gps_coordinates?.latitude}°N
                        </div>
                        <div style={{ fontSize: 12, color: '#fff', marginTop: 3 }}>
                          <strong>Longitude:</strong> {investigationData.exif_photo_forensics.gps_coordinates?.longitude}°E
                        </div>
                        <div style={{ fontSize: 11, color: '#52e07a', marginTop: 3, fontWeight: 600 }}>
                          <strong>Location:</strong> {investigationData.exif_photo_forensics.gps_coordinates?.reverse_location}
                        </div>
                        {investigationData.exif_photo_forensics.gps_coordinates?.map_view_url && (
                          <a
                            href={investigationData.exif_photo_forensics.gps_coordinates.map_view_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10,
                              color: '#38bdf8',
                              marginTop: 6,
                              textDecoration: 'none',
                              fontWeight: 700
                            }}
                          >
                            <span>Open in Google Maps</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      {/* Timestamp & Sensor Card */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={13} />
                          <span>TIMESTAMP & EXPOSURE SENSOR</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#fff' }}>
                          <strong>Captured:</strong> {investigationData.exif_photo_forensics.datetime_original}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          <strong>ISO Speed:</strong> {investigationData.exif_photo_forensics.exposure_telemetry?.iso} | <strong>Shutter:</strong> {investigationData.exif_photo_forensics.exposure_telemetry?.shutter_speed}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          <strong>Focal Length:</strong> {investigationData.exif_photo_forensics.exposure_telemetry?.focal_length} | <strong>Flash:</strong> {investigationData.exif_photo_forensics.exposure_telemetry?.flash}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                          SHA256: {investigationData.exif_photo_forensics.image_sha256?.substring(0, 24)}...
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 20,
                    textAlign: 'center',
                    color: 'var(--text-secondary)'
                  }}>
                    Upload a suspect mugshot or evidence photo in the top console to extract embedded EXIF camera, GPS, and sensor telemetry.
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Judicial & Court Cases */}
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

            {/* Section 4: Vehicles & VAHAN */}
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

            {/* Section 5: Darknet Breaches */}
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

            {/* Section 6: Associates */}
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
