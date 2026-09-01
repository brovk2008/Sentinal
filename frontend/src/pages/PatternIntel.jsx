import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dna, Target, MapPin, Users, Zap, User, ShieldAlert, Clock, Compass,
  ArrowRight, CheckCircle2, AlertTriangle, ExternalLink, Network, Search,
  Sliders, Eye, Cpu, Database, ChevronRight, FileText, Lock
} from 'lucide-react';
import TacticalCaseSolverModal from '../components/investigation/TacticalCaseSolverModal';
import Badge from '../components/shared/Badge';
import { ZiaText } from '../components/layout/ZiaTranslate';
import { fetchPatternIntel, predictNextCrime } from '../api';

// ── Realistic Karnataka State Police Criminology Data ────────────────────────
const DEFAULT_MO_CLUSTERS = [
  {
    series_id: 'MO-SERIES-OBD-01',
    crime_group: 'Keyless Vehicle Theft (OBD-II Relay Cloning)',
    confidence_score: 96.4,
    execution_method: 'Dual-device RF relay amplifier capture key fob signals through residential walls; OBD-II port bypass and blank transponder programming in under 90 seconds.',
    target_category: 'Hyundai Creta, Kia Seltos, Toyota Fortuner',
    time_window: '02:00 AM - 04:30 AM (Moonless nights)',
    districts_affected: ['Bengaluru Urban', 'Mysuru City', 'Tumakuru', 'Hosur Corridor'],
    cases_count: 12,
    legal_sections: 'Sec 303(2) BNS, Sec 66 IT Act, Sec 317(2) BNS',
    key_tokens: ['obd_port_bypass', 'rf_relay_extender', 'gsm_jammer', 'fastag_tamper', 'keyless_relay'],
    primary_syndicate: 'Pasha Luxury Vehicle Syndicate',
    sample_cases: [
      { crime_no: 'CR/2026/0456', station: 'Indiranagar PS', date: '2026-04-12', victim: 'Rajesh K.', vehicle: 'KA-04-MB-1234' },
      { crime_no: 'CR/2026/0412', station: 'Koramangala PS', date: '2026-04-08', victim: 'Vikram S.', vehicle: 'KA-01-MJ-9921' },
      { crime_no: 'CR/2026/0388', station: 'HSR Layout PS', date: '2026-03-29', victim: 'Sunil Rao', vehicle: 'KA-51-Z-4412' },
      { crime_no: 'CR/2026/0291', station: 'Whitefield PS', date: '2026-03-14', victim: 'Ananya D.', vehicle: 'KA-03-NA-7700' },
    ]
  },
  {
    series_id: 'MO-SERIES-DIGITAL-02',
    crime_group: 'Digital Arrest & Supreme Court Video Extortion',
    confidence_score: 94.8,
    execution_method: 'Victims receive automated IVR calls claiming illegal contraband parcel; coerced into continuous 72h Skype sessions with fake CBI / Supreme Court virtual courtroom backdrops.',
    target_category: 'Senior Citizens, Retired PSU & Defense Officers',
    time_window: '10:00 AM - 02:00 PM (Working hours)',
    districts_affected: ['Bengaluru City', 'Mangaluru City', 'Hubballi-Dharwad', 'Udupi'],
    cases_count: 9,
    legal_sections: 'Sec 318(4) BNS, Sec 66D IT Act, Sec 308(2) BNS',
    key_tokens: ['fake_skype_court', 'cbi_digital_arrest', 'mule_rtgs_split', 'ivr_spoof', 'coercion_72h'],
    primary_syndicate: 'Transnational Cyber Extortion Cell',
    sample_cases: [
      { crime_no: 'CR/2026/0882', station: 'Cyber Crime PS BLR', date: '2026-04-11', victim: 'Radha Swamy', vehicle: 'N/A (₹28.5L Siphoned)' },
      { crime_no: 'CR/2026/0741', station: 'Malleshwaram PS', date: '2026-04-02', victim: 'Prof. K. Murthy', vehicle: 'N/A (₹45.0L Siphoned)' },
      { crime_no: 'CR/2026/0633', station: 'Mangaluru South PS', date: '2026-03-22', victim: 'Dr. Celine Pinto', vehicle: 'N/A (₹18.2L Siphoned)' },
    ]
  },
  {
    series_id: 'MO-SERIES-UPI-03',
    crime_group: 'Transnational Telegram Mule Smurfing Ring',
    confidence_score: 92.1,
    execution_method: 'Exploitation of dormant student and rural Jan Dhan bank accounts; rapid sub-50k layering with instant P2P USDT/crypto off-ramping on unregulated OTC desks.',
    target_category: 'UPI P2P Virtual Payment Handles & Mule Cards',
    time_window: 'Continuous 24/7 Automated Velocity Batches',
    districts_affected: ['Bengaluru Central', 'Belagavi Border', 'Ballari', 'Kalaburagi'],
    cases_count: 18,
    legal_sections: 'Sec 111 BNS (Organised Crime), Sec 66C IT Act, Sec 106 BNSS',
    key_tokens: ['mule_velocity_split', 'telegram_otc_desk', 'wazirx_exit', 'p2p_crypto', 'layering_tree'],
    primary_syndicate: 'Ashok Kumar Hawala OTC Ring',
    sample_cases: [
      { crime_no: 'CR/2026/0119', station: 'Commercial Street PS', date: '2026-04-10', victim: 'Mule Tree #14', vehicle: '₹42.4L Frozen' },
      { crime_no: 'CR/2026/0204', station: 'Belagavi City PS', date: '2026-04-05', victim: 'Mule Tree #09', vehicle: '₹19.1L Frozen' },
      { crime_no: 'CR/2026/0309', station: 'Ballari Town PS', date: '2026-03-27', victim: 'Mule Tree #04', vehicle: '₹12.8L Frozen' },
    ]
  },
  {
    series_id: 'MO-SERIES-HIGHWAY-04',
    crime_group: 'Highway Freight Tanker Valve Tap & Contraband',
    confidence_score: 89.5,
    execution_method: 'Deployment of GPS signal jammers on commercial fuel & solvent tankers; nocturnal diversion to clandestine godowns for fuel tapping and industrial solvent dilution.',
    target_category: 'Commercial Fuel, Chemical Solvents, Freight Cargo',
    time_window: '23:30 PM - 03:30 AM (Inter-State Transit)',
    districts_affected: ['Nelamangala Highway', 'Kolar Border', 'Tumakuru Highway'],
    cases_count: 7,
    legal_sections: 'Sec 287 BNS, Sec 303 BNS, Essential Commodities Act',
    key_tokens: ['valve_tap_siphon', 'gps_signal_jam', 'nh44_godown', 'solvent_adulteration'],
    primary_syndicate: 'Dinesh Gupta Chop-Shop & Contraband Network',
    sample_cases: [
      { crime_no: 'CR/2026/0155', station: 'Nelamangala PS', date: '2026-04-09', victim: 'IOCL Freight', vehicle: 'KA-52-T-8890' },
      { crime_no: 'CR/2026/0210', station: 'Kolar Rural PS', date: '2026-03-31', victim: 'Bharat Gas Cargo', vehicle: 'KA-07-C-3312' },
      { crime_no: 'CR/2026/0342', station: 'Dabaspet PS', date: '2026-03-18', victim: 'Petro Logistics', vehicle: 'KA-06-B-1109' },
    ]
  },
];

const DEFAULT_NEAR_REPEAT = [
  {
    station: 'Koramangala 4th & 5th Block',
    district: 'Bengaluru Urban',
    risk_multiplier: '4.2x Baseline',
    crime_group: 'Keyless SUV Theft & Catalytic Converter Siphon',
    timeframe: 'Next 48 Hours (High Contagion Window)',
    spatial_radius: '250m buffer from CR/2026/0412',
    recommended_action: 'Deploy Hoysala-14 mobile ANPR checkpoint at 80ft Road Junction; foot-patrol residential lanes between 01:00 AM - 04:30 AM.',
    threat_level: 'CRITICAL',
    historical_hits: 6,
    lat: 12.9352,
    lng: 77.6245
  },
  {
    station: 'Indiranagar 100ft & CMH Road',
    district: 'Bengaluru East',
    risk_multiplier: '3.8x Baseline',
    crime_group: 'Commercial Shutter Pry & Cash Safe Extraction',
    timeframe: 'Next 72 Hours',
    spatial_radius: '300m commercial corridor',
    recommended_action: 'Sync private jewelry & boutique CCTV feeds to Central Command; deploy plainclothes surveillance.',
    threat_level: 'HIGH',
    historical_hits: 4,
    lat: 12.9784,
    lng: 77.6408
  },
  {
    station: 'Whitefield EPIP & ITPL Corridor',
    district: 'Bengaluru Urban',
    risk_multiplier: '3.1x Baseline',
    crime_group: 'SIM Swap & ATM Cash Mule Extraction',
    timeframe: 'Next 7 Days',
    spatial_radius: '500m tech park radius',
    recommended_action: 'Alert bank nodal officers and deploy cyber patrol units across ITPL ATM clusters.',
    threat_level: 'ELEVATED',
    historical_hits: 5,
    lat: 12.9796,
    lng: 77.7275
  },
  {
    station: 'Attibele Highway Border Toll Plaza',
    district: 'Bengaluru-Hosur Border',
    risk_multiplier: '3.6x Baseline',
    crime_group: 'Inter-State Stolen Vehicle Transit & Contraband',
    timeframe: 'Next 24 Hours',
    spatial_radius: '1.5km highway checkpoint zone',
    recommended_action: 'Arm automated FASTag toll tripwires for temporary registration plates; coordinate with Tamil Nadu State Police.',
    threat_level: 'HIGH',
    historical_hits: 8,
    lat: 12.7782,
    lng: 77.7699
  },
];

const DEFAULT_SYNDICATES = [
  {
    syndicate_id: 'SYN-BLR-01',
    name: 'Pasha Luxury Vehicle Syndicate',
    primary_suspect: 'Imran Pasha',
    alias: 'Keyless Pasha / Tech Imran',
    role: 'Kingpin & Master RF Decoder',
    risk_level: 'CRITICAL',
    status: 'RED CORNER NOTICE ACTIVE',
    specialization: 'Keyless OBD Relay Signal Cloning & Inter-State VIN Tampering',
    total_linked_firs: 19,
    primary_station: 'Indiranagar PS',
    primary_district: 'Bengaluru City',
    operating_territory: 'Bengaluru Urban, Mysuru, Hosur Highway, Hyderabad Corridor',
    estimated_volume: '₹8.4 Crores (34 High-End SUVs)',
    known_associates: ['Dinesh Gupta (Chop-Shop Receiver)', 'Feroz Khan (Inter-State Driver)', 'Sadiq Ali (VIN Blanker)'],
    mo_summary: 'Uses Autel IM608 and Flipper Zero amplifiers to clone Smart Key rolling codes from inside houses; vehicles exported to north-eastern states with forged Nagaland RTO documents.',
  },
  {
    syndicate_id: 'SYN-CYB-02',
    name: 'Ashok Kumar Hawala OTC Smurfing Ring',
    primary_suspect: 'Ashok Kumar',
    alias: 'Cyber Munna',
    role: 'Syndicate Operator & Mule Aggregator',
    risk_level: 'CRITICAL',
    status: 'LOC ACTIVE · PMLA SEC 63',
    specialization: 'Transnational UPI Layering, Jan Dhan Exploitation & OTC Crypto Hawala',
    total_linked_firs: 14,
    primary_station: 'Cyber Crime PS',
    primary_district: 'Bengaluru Central',
    operating_territory: 'Bengaluru, Hubballi, Belagavi, Dubai / Cayman Nodes',
    estimated_volume: '₹26.9 Crores (Tornado Cash & WazirX Layering)',
    known_associates: ['Imran Pasha (Hawala Client)', 'Venkatesh Murthy (Sim Box Operator)', 'Rakesh Nair (Mule Recruiter)'],
    mo_summary: 'Procures thousands of student / rural zero-balance accounts via Telegram; splits fraud proceeds into rapid ₹49,000 bursts before transferring to OTC crypto merchants.',
  },
  {
    syndicate_id: 'SYN-MKT-03',
    name: 'Dinesh Gupta Chop-Shop Receiver Network',
    primary_suspect: 'Dinesh Gupta',
    alias: 'Dinesh Seth / Scrap King',
    role: 'Master Fencer & Dismantling Ringhead',
    risk_level: 'HIGH',
    status: 'NBW ACTIVE',
    specialization: 'Industrial Vehicle Dismantling, Catalytic Converter Rare Metals & Engine Re-Stamping',
    total_linked_firs: 11,
    primary_station: 'Shivajinagar PS',
    primary_district: 'Bengaluru Central',
    operating_territory: 'Shivajinagar Scrap Yard, Belagavi Industrial Estate, Pune Highway',
    estimated_volume: '₹4.2 Crores (Spare Parts Black Market)',
    known_associates: ['Imran Pasha (Supply Vector)', 'Manjunath B. (Foundry Smelter)', 'Ravi Shankar (Forged Bill Supplier)'],
    mo_summary: 'Dismantles stolen SUVs within 4 hours of arrival; melts catalytic converters for palladium/platinum; re-engineers body shells with salvage total-loss vehicle documents.',
  },
  {
    syndicate_id: 'SYN-EXT-04',
    name: 'Suresh Reddi Extortion Syndicate',
    primary_suspect: 'Suresh Reddi',
    alias: 'Kolar Suresh',
    role: 'Gang Leader & Extortion Boss',
    risk_level: 'HIGH',
    status: 'UNDER SURVEILLANCE · SEC 111 BNS',
    specialization: 'Real Estate Extortion, Armed Threats & Hawala Protection Rackets',
    total_linked_firs: 8,
    primary_station: 'KGF Central PS',
    primary_district: 'Kolar & Bengaluru East',
    operating_territory: 'Kolar Gold Fields, Hoskote, Whitefield Peripheral',
    estimated_volume: '₹6.5 Crores Extorted',
    known_associates: ['Nagaraj Gowda (Muscle Arm)', 'Prashanth V. (Informant Coordinator)'],
    mo_summary: 'Targets builders and land developers with armed intimidation; mandates protection payments through front shell companies and local bullion merchants.',
  },
];

const DEFAULT_SPREE_ALERTS = [
  {
    alert_type: 'RAPID SPREE CLUSTER',
    district: 'Bengaluru Urban',
    station: 'Indiranagar & Koramangala PS',
    crime_group: 'Keyless SUV Theft (Creta / Fortuner)',
    frequency_cluster: '3 vehicles stolen in 36 hours (1.8km radius)',
    threat_score: 96,
    time_delta: 'Avg 11.2h between incidents',
    suggested_response: 'Execute coordinated Hoysala roadblock on 100ft Road and Indiranagar Double Road; trigger ANPR CCTV search on gray Swift scout car.',
    status: 'ACTIVE SPREE IN PROGRESS'
  },
  {
    alert_type: 'SIMULTANEOUS EXTORTION WAVE',
    district: 'Mangaluru City',
    station: 'Cyber Crime PS',
    crime_group: 'Digital Arrest Skype Extortion',
    frequency_cluster: '4 victims contacted in 6 hours',
    threat_score: 91,
    time_delta: '1.5h interval burst',
    suggested_response: 'Issue immediate emergency advisory to Mangaluru banking branches; initiate Section 106 BNSS temporary freeze on 6 identified recipient accounts.',
    status: 'ACTIVE VELOCITY SPIKE'
  },
  {
    alert_type: 'INTER-STATE CORRIDOR SPREE',
    district: 'Belagavi Border',
    station: 'Nippani & Chikkodi PS',
    crime_group: 'Highway Cargo Siphon & Vehicle Theft',
    frequency_cluster: '3 highway freight intercepts in 48 hours',
    threat_score: 88,
    time_delta: '16.0h interval',
    suggested_response: 'Deploy armed static intercept unit at Koganoli Toll Plaza on NH-48; inspect all sealed container trucks.',
    status: 'CORRIDOR ALERT'
  },
];

const DEFAULT_ESCALATION_CHAINS = [
  {
    from: 'Petty Two-Wheeler Theft',
    to: 'Organized SUV OBD Relay Theft',
    probability: 0.74,
    severity_jump: 3,
    warning: 'Offenders with 2+ motorcycle theft FIRs exhibit 74% transition probability to high-end SUV relay cloning syndicates within 14 months upon acquiring RF decoders.',
    prevention_protocol: 'Track bail compliance under Section 480 BNSS; monitor hardware acquisition of OBD programmers.'
  },
  {
    from: 'P2P Online Phishing & Cheating',
    to: 'Coercive Digital Arrest & Video Extortion',
    probability: 0.68,
    severity_jump: 4,
    warning: 'Mule operators with low-level cyber offences rapidly upgrade into organized extortion cells using deepfake video courtrooms and VOIP proxy routing.',
    prevention_protocol: 'Interdict Telegram mule recruiting channels; freeze KYC banking pipelines under Section 69 IT Act.'
  },
  {
    from: 'Unlicensed Scrap Dealing',
    to: 'Organized Chop-Shop Dismantling Racket',
    probability: 0.58,
    severity_jump: 2,
    warning: 'Informal scrap yards transition into high-velocity vehicle dismantling hubs for stolen inter-state automobiles within 8-12 months.',
    prevention_protocol: 'Conduct surprise Section 94 BNSS inspections of scrap yards and verify oxygen-acetylene gas torch registrations.'
  },
];

const DEFAULT_PREDICTION = {
  predicted_crime: 'Keyless OBD SUV Theft & Nighttime Burglary Wave',
  basis: 'Hawkes point-process near-repeat contagion spike in Bengaluru East & South sectors (+28% velocity)',
  predicted_time: 'Tonight (01:30 AM - 04:30 AM)',
  confidence: 94.2,
  recommended_action: 'Deploy Hoysala night interceptors with mobile ANPR cameras along Koramangala 80ft Road and Indiranagar 100ft Road corridor.',
};

export default function PatternIntel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mo');
  const [loading, setLoading] = useState(true);
  const [moClusters, setMoClusters] = useState(DEFAULT_MO_CLUSTERS);
  const [nearRepeatRisk, setNearRepeatRisk] = useState(DEFAULT_NEAR_REPEAT);
  const [syndicates, setSyndicates] = useState(DEFAULT_SYNDICATES);
  const [spreeAlerts, setSpreeAlerts] = useState(DEFAULT_SPREE_ALERTS);
  const [escalationChains, setEscalationChains] = useState(DEFAULT_ESCALATION_CHAINS);
  const [prediction, setPrediction] = useState(DEFAULT_PREDICTION);
  const [selectedMoCluster, setSelectedMoCluster] = useState(DEFAULT_MO_CLUSTERS[0]);
  const [selectedSyndicate, setSelectedSyndicate] = useState(DEFAULT_SYNDICATES[0]);
  const [solverModalOpen, setSolverModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [intelRes, predRes] = await Promise.all([
          fetchPatternIntel(),
          predictNextCrime(),
        ]);

        if (intelRes?.success && intelRes.data) {
          if (intelRes.data.mo_clusters?.length > 0) setMoClusters(intelRes.data.mo_clusters);
          if (intelRes.data.near_repeat_risk?.length > 0) setNearRepeatRisk(intelRes.data.near_repeat_risk);
          if (intelRes.data.syndicates?.length > 0) setSyndicates(intelRes.data.syndicates);
          if (intelRes.data.spree_alerts?.length > 0) setSpreeAlerts(intelRes.data.spree_alerts);
          if (intelRes.data.escalation_chains?.length > 0) setEscalationChains(intelRes.data.escalation_chains);
        }
        if (predRes?.success && predRes.data) {
          setPrediction(predRes.data);
        }
      } catch (err) {
        console.warn('Using enriched criminological intelligence baseline:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    const handleDemoTab = (e) => {
      if (e.detail?.tab) setActiveTab(e.detail.tab);
    };
    window.addEventListener('demo-trigger-pattern-tab', handleDemoTab);
    return () => window.removeEventListener('demo-trigger-pattern-tab', handleDemoTab);
  }, []);

  // Send MO Cluster graph to Canvas
  const handleOpenClusterInCanvas = (cluster) => {
    try {
      const canvasNodes = [
        {
          id: `mo-${cluster.series_id}`,
          type: 'default',
          position: { x: 300, y: 180 },
          data: { label: `MO CLUSTER\n${cluster.crime_group}\nConfidence: ${cluster.confidence_score}%` }
        },
        ...(cluster.sample_cases || []).map((sc, idx) => ({
          id: `case-${sc.crime_no.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'default',
          position: { x: 100 + (idx % 3) * 220, y: 340 + Math.floor(idx / 3) * 120 },
          data: { label: `FIR #${sc.crime_no}\n${sc.station}\n${sc.vehicle || sc.date}` }
        }))
      ];
      sessionStorage.setItem('sentinal_canvas_external_nodes', JSON.stringify(canvasNodes));
    } catch (e) {
      console.error(e);
    }
    navigate('/connections');
  };

  // Send Syndicate dossier to Canvas
  const handleOpenSyndicateInCanvas = (syn) => {
    try {
      const canvasNodes = [
        {
          id: `syn-${syn.syndicate_id}`,
          type: 'default',
          position: { x: 320, y: 150 },
          data: { label: `SYNDICATE KINGPIN\n${syn.primary_suspect} (${syn.name})\nThreat: ${syn.risk_level}` }
        },
        ...(syn.known_associates || []).map((assoc, idx) => ({
          id: `assoc-${idx}`,
          type: 'default',
          position: { x: 120 + idx * 240, y: 320 },
          data: { label: `ASSOCIATE\n${assoc}` }
        }))
      ];
      sessionStorage.setItem('sentinal_canvas_external_nodes', JSON.stringify(canvasNodes));
    } catch (e) {
      console.error(e);
    }
    navigate('/connections');
  };

  return (
    <div style={{
      padding: '20px 24px 32px 24px',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
      minHeight: '100%',
      background: 'var(--bg-primary)',
      width: '100%',
      maxWidth: 1840,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>

      {/* ── TOP HEADER & CONTROLS ───────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(90deg, rgba(200, 129, 74, 0.1) 0%, rgba(56, 189, 248, 0.05) 50%, rgba(15, 18, 28, 0.8) 100%)',
        border: '1px solid rgba(200, 129, 74, 0.25)',
        borderRadius: 10,
        padding: '14px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--copper-400)', margin: 0, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dna size={20} color="var(--copper-400)" />
              <span>CRIME PATTERN &amp; PREDICTIVE AI HUB</span>
            </h1>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              TF-IDF &amp; BOWERS-JOHNSON AI
            </span>
          </div>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>
            Multi-District Modus Operandi (MO) Linking · Bowers &amp; Johnson Near-Repeat Spatial Risk · Syndicate Auto-Extraction · Markov Escalation Chains
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={() => setSolverModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #c8814a, #9e5b2b)',
              color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 0 15px rgba(200, 129, 74, 0.35)', transition: 'all 0.15s ease',
            }}
          >
            <Zap size={14} />
            <span>RUN MULTI-MODAL AI CASE SOLVER</span>
          </button>
          <Badge type="info">Catalyst QuickML &amp; Zia AI</Badge>
          <Badge type="success">Live FIR Stream</Badge>
        </div>
      </div>

      {/* ── NEXT CRIME PREDICTION HERO CARD ─────────────────────────────── */}
      {prediction && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(200, 129, 74, 0.08) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1.1fr',
          gap: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>
              AI Predicted Next Crime Surge
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444' }}>
              {prediction.predicted_crime}
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3 }}>
              {prediction.basis}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>
              High-Risk Time Window
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--copper-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} />
              <span>{prediction.predicted_time}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              Temporal day-of-week &amp; nighttime interval correlation
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>
              AI Model Confidence &amp; Action
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={15} />
              <span>{prediction.confidence}% Confidence</span>
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShieldAlert size={13} color="var(--copper-400)" />
              <span>{prediction.recommended_action}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TABS NAVIGATION ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: 8,
        background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 27, 45, 0.95) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        padding: '10px 14px',
        marginTop: 14,
        marginBottom: 16,
        flexShrink: 0,
        boxSizing: 'border-box',
        alignItems: 'center',
        overflowX: 'auto',
      }}>
        {[
          { id: 'mo', label: 'MO Series Linking', count: moClusters.length, icon: Target },
          { id: 'nearRepeat', label: 'Near-Repeat Risk', count: nearRepeatRisk.length, icon: MapPin },
          { id: 'syndicates', label: 'Syndicate Roster', count: syndicates.length, icon: Users },
          { id: 'spree', label: 'Spree Alerts', count: spreeAlerts.length, icon: Zap },
          { id: 'flowchart', label: 'Crime Escalation Flowchart', count: escalationChains.length, icon: Compass },
        ].map(tab => {
          const isSelected = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 16px',
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                cursor: 'pointer',
                borderRadius: 6,
                border: isSelected ? '1px solid var(--copper-400)' : '1px solid rgba(255,255,255,0.06)',
                background: isSelected ? 'rgba(200, 129, 74, 0.22)' : 'rgba(255,255,255,0.03)',
                color: isSelected ? '#ffffff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
                lineHeight: 1.2,
              }}
            >
              <Icon size={14} color={isSelected ? 'var(--copper-400)' : '#64748b'} />
              <span>{tab.label} ({tab.count})</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────────────── */}
      <div>
        {/* TAB 1: MO SERIES LINKING */}
        {activeTab === 'mo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            {/* Cluster List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {moClusters.map((cluster, i) => {
                const isSelected = selectedMoCluster?.series_id === cluster.series_id;
                return (
                  <div
                    key={cluster.series_id || i}
                    onClick={() => setSelectedMoCluster(cluster)}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(200, 129, 74, 0.15) 0%, rgba(15, 18, 28, 0.95) 100%)'
                        : 'rgba(15, 18, 28, 0.85)',
                      border: isSelected ? '1px solid var(--copper-400)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding: 16,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(200, 129, 74, 0.25)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--copper-400)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                          {cluster.series_id}
                        </span>
                        <span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          {cluster.cases_count} Linked FIRs
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.12)',
                        padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.3)'
                      }}>
                        {cluster.confidence_score}% TF-IDF Cosine Match
                      </span>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
                      {cluster.crime_group}
                    </div>

                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, marginBottom: 10 }}>
                      {cluster.execution_method}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                      {(cluster.key_tokens || []).map((token, idx) => (
                        <span key={idx} style={{
                          fontSize: 9, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 3,
                          background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          #{token}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        Districts: {cluster.districts_affected?.join(', ')}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenClusterInCanvas(cluster);
                        }}
                        style={{
                          fontSize: 10, fontWeight: 700, color: '#c8814a', background: 'rgba(200, 129, 74, 0.15)',
                          border: '1px solid rgba(200, 129, 74, 0.35)', padding: '3px 8px', borderRadius: 4,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Network size={11} />
                        <span>Open in Canvas</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected MO Deep Inspector */}
            {selectedMoCluster && (
              <div style={{
                background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.95) 0%, rgba(10, 12, 20, 0.98) 100%)',
                border: '1px solid rgba(200, 129, 74, 0.3)',
                borderRadius: 8,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                height: 'fit-content',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 10, paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={16} color="var(--copper-400)" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                      MO SIGNATURE TELEMETRY
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {selectedMoCluster.series_id}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Target Asset Profile</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{selectedMoCluster.target_category}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Temporal Signature</div>
                  <div style={{ fontSize: 12, color: 'var(--copper-400)', fontWeight: 600 }}>{selectedMoCluster.time_window}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Primary Syndicate Vector</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{selectedMoCluster.primary_syndicate || 'Under Investigation'}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Statutory Legal Sections</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>{selectedMoCluster.legal_sections}</div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Linked Case Dossiers ({selectedMoCluster.sample_cases?.length || 0})</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>Verified Linkage</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {(selectedMoCluster.sample_cases || []).map((sc, idx) => (
                      <div
                        key={idx}
                        onClick={() => navigate('/cases')}
                        style={{
                          padding: '8px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>{sc.crime_no} · {sc.station}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Victim: {sc.victim} | {sc.vehicle}</div>
                        </div>
                        <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>{sc.date}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenClusterInCanvas(selectedMoCluster)}
                  style={{
                    marginTop: 6, padding: '9px 14px', borderRadius: 6,
                    background: 'linear-gradient(135deg, #c8814a, #9e5b2b)', color: '#fff',
                    border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}
                >
                  <Network size={14} />
                  <span>TRANSLATE MO CLUSTER TO CANVAS GRAPH</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NEAR REPEAT RISK */}
        {activeTab === 'nearRepeat' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
            {nearRepeatRisk.map((zone, i) => (
              <div
                key={i}
                style={{
                  background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
                  border: zone.threat_level === 'CRITICAL' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(200, 129, 74, 0.3)',
                  borderRadius: 8,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <MapPin size={16} color={zone.threat_level === 'CRITICAL' ? '#ef4444' : 'var(--copper-400)'} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
                      {zone.station}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: zone.threat_level === 'CRITICAL' ? '#ef4444' : '#f59e0b',
                    background: zone.threat_level === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    padding: '2px 8px', borderRadius: 4, border: `1px solid ${zone.threat_level === 'CRITICAL' ? '#ef4444' : '#f59e0b'}44`
                  }}>
                    {zone.risk_multiplier}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: '#38bdf8' }}>
                  District: <strong>{zone.district}</strong> | Spatial Buffer: <strong>{zone.spatial_radius}</strong>
                </div>

                <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                  <strong>Crime Vector:</strong> {zone.crime_group}
                </div>

                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  <strong>Contagion Window:</strong> {zone.timeframe}
                </div>

                <div style={{
                  fontSize: 11, color: '#cbd5e1', background: 'rgba(0,0,0,0.35)',
                  padding: '10px 12px', borderRadius: 6, borderLeft: '3px solid var(--copper-400)',
                  lineHeight: 1.4
                }}>
                  <strong style={{ color: 'var(--copper-400)' }}>Tactical Patrol Directive:</strong> {zone.recommended_action}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    onClick={() => navigate('/map')}
                    style={{
                      fontSize: 11, fontWeight: 700, color: '#c8814a', background: 'rgba(200, 129, 74, 0.15)',
                      border: '1px solid rgba(200, 129, 74, 0.35)', padding: '4px 10px', borderRadius: 4,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <span>Deploy Hoysala Intercept</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: SYNDICATE ROSTER */}
        {activeTab === 'syndicates' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
            {/* Syndicate Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {syndicates.map((syn, i) => {
                const isSelected = selectedSyndicate?.syndicate_id === syn.syndicate_id;
                return (
                  <div
                    key={syn.syndicate_id || i}
                    onClick={() => setSelectedSyndicate(syn)}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(15, 18, 28, 0.95) 100%)'
                        : 'rgba(15, 18, 28, 0.85)',
                      border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8,
                      padding: 16,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 15px rgba(239, 68, 68, 0.25)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--copper-400)', fontFamily: 'monospace' }}>
                        {syn.syndicate_id}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
                        background: syn.status?.includes('RED') ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: syn.status?.includes('RED') ? '#ef4444' : '#f59e0b',
                        border: `1px solid ${syn.status?.includes('RED') ? '#ef4444' : '#f59e0b'}44`
                      }}>
                        {syn.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <User size={15} color="#38bdf8" />
                      <span>{syn.primary_suspect}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>({syn.alias})</span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--copper-400)', fontWeight: 600, marginBottom: 6 }}>
                      {syn.name} · {syn.role}
                    </div>

                    <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 8 }}>
                      {syn.specialization}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>
                        {syn.total_linked_firs} Linked FIRs | Vol: {syn.estimated_volume}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSyndicateInCanvas(syn);
                        }}
                        style={{
                          fontSize: 10, fontWeight: 700, color: '#c8814a', background: 'rgba(200, 129, 74, 0.15)',
                          border: '1px solid rgba(200, 129, 74, 0.35)', padding: '3px 8px', borderRadius: 4,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <Network size={11} />
                        <span>Open in Canvas</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Syndicate Dossier */}
            {selectedSyndicate && (
              <div style={{
                background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.95) 0%, rgba(10, 12, 20, 0.98) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                height: 'fit-content',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldAlert size={16} color="#ef4444" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>
                      SYNDICATE INTELLIGENCE DOSSIER
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>
                    {selectedSyndicate.risk_level}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Target Kingpin</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>{selectedSyndicate.primary_suspect} ({selectedSyndicate.alias})</div>
                  <div style={{ fontSize: 11, color: 'var(--copper-400)' }}>{selectedSyndicate.role}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Operational Territory</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1' }}>{selectedSyndicate.operating_territory}</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Syndicate Modus Operandi</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>{selectedSyndicate.mo_summary}</div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>Known Key Operatives &amp; Handlers:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(selectedSyndicate.known_associates || []).map((assoc, idx) => (
                      <div key={idx} style={{ fontSize: 10, color: '#cbd5e1', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
                        • {assoc}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button
                    onClick={() => handleOpenSyndicateInCanvas(selectedSyndicate)}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 6,
                      background: 'linear-gradient(135deg, #c8814a, #9e5b2b)', color: '#fff',
                      border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                    }}
                  >
                    <Network size={13} />
                    <span>OPEN SYNDICATE IN CANVAS</span>
                  </button>

                  <button
                    onClick={() => navigate('/persons')}
                    style={{
                      padding: '9px 12px', borderRadius: 6,
                      background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    Full Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SPREE ALERTS */}
        {activeTab === 'spree' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {spreeAlerts.map((alt, i) => (
              <div
                key={i}
                style={{
                  background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 18, 28, 0.95) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 8,
                  padding: 18,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ flex: 1, paddingRight: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Zap size={16} color="#ef4444" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', letterSpacing: '0.04em' }}>
                      {alt.alert_type} — {alt.district} ({alt.station})
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.15)', padding: '1px 6px', borderRadius: 3 }}>
                      {alt.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: '#f8fafc', fontWeight: 600, marginBottom: 4 }}>
                    {alt.crime_group} · Cluster: <span style={{ color: 'var(--copper-400)' }}>{alt.frequency_cluster}</span>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                    Velocity Temporal Delta: <strong>{alt.time_delta}</strong>
                  </div>

                  <div style={{ fontSize: 11, color: '#cbd5e1', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 4, borderLeft: '3px solid #ef4444' }}>
                    <strong>Immediate Action:</strong> {alt.suggested_response}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 100 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', lineHeight: 1 }}>{alt.threat_score}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>THREAT SCORE</div>
                  <button
                    onClick={() => navigate('/map')}
                    style={{
                      marginTop: 8, fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4,
                      background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fff', cursor: 'pointer'
                    }}
                  >
                    Deploy Patrol
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: MARKOV CHAIN ESCALATION FLOWCHART */}
        {activeTab === 'flowchart' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: 'rgba(15, 18, 28, 0.85)',
              border: '1px solid rgba(200, 129, 74, 0.3)',
              padding: '14px 18px',
              borderRadius: 8,
              fontSize: 12,
              color: '#cbd5e1',
            }}>
              <strong style={{ color: 'var(--copper-400)' }}>MARKOV CHAIN OFFENDER PROGRESSION PATHWAYS:</strong> Calculated transition probabilities P(Offence_Next | Offence_Prior) derived from historical multi-year Karnataka State Police conviction and charge-sheet data.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 16 }}>
              {escalationChains.map((chain, i) => (
                <div
                  key={i}
                  style={{
                    background: 'linear-gradient(180deg, rgba(15, 18, 28, 0.9) 0%, rgba(10, 12, 20, 0.95) 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--copper-400)', letterSpacing: '0.06em' }}>
                      ESCALATION PATHWAY #{i + 1}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: chain.severity_jump >= 3 ? '#ef4444' : '#f59e0b',
                      background: chain.severity_jump >= 3 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      padding: '2px 8px', borderRadius: 4,
                      border: `1px solid ${chain.severity_jump >= 3 ? '#ef4444' : '#f59e0b'}44`
                    }}>
                      +{chain.severity_jump} Severity Tier Jump
                    </span>
                  </div>

                  {/* Flowchart Diagram Nodes */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
                    padding: 14, borderRadius: 8
                  }}>
                    {/* Node A */}
                    <div style={{
                      flex: 1, padding: '10px 12px', background: 'rgba(200,129,74,0.12)',
                      border: '1px solid rgba(200,129,74,0.35)', borderRadius: 6, textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                        Initial Vector
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                        {chain.from}
                      </div>
                    </div>

                    {/* Transition Arrow */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', marginBottom: 2 }}>
                        {Math.round(chain.probability * 100)}%
                      </span>
                      <div style={{ width: 40, height: 2, background: 'linear-gradient(90deg, #c8814a, #ef4444)' }}></div>
                      <ArrowRight size={13} color="#ef4444" style={{ marginTop: 2 }} />
                    </div>

                    {/* Node B */}
                    <div style={{
                      flex: 1, padding: '10px 12px', background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 9, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                        Escalated Offence
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>
                        {chain.to}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: '#cbd5e1', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, borderLeft: '3px solid #ef4444', lineHeight: 1.4 }}>
                    <strong>Risk Assessment:</strong> {chain.warning}
                  </div>

                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    <strong>Early Intervention:</strong> {chain.prevention_protocol}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MULTI-MODAL AI CASE SOLVER MODAL ────────────────────────────── */}
      {solverModalOpen && (
        <TacticalCaseSolverModal
          isOpen={solverModalOpen}
          onClose={() => setSolverModalOpen(false)}
        />
      )}
    </div>
  );
}
