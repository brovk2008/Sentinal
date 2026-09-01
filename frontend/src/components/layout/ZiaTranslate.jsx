import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { translateBatch, translateText } from '../../api'

// ─── Instant High-Speed Kannada & Hindi Lexicon (0ms Synchronous Render) ─────
const INSTANT_DICT = {
  kn: {
    // Header & Navigation
    "COMMAND CENTER": "ಕಮಾಂಡ್ ಸೆಂಟರ್",
    "COMMAND CENTER INTELLIGENCE HUB": "ಕಮಾಂಡ್ ಸೆಂಟರ್ ಇಂಟೆಲಿಜೆನ್ಸ್ ಹಬ್",
    "STATE POLICE HQ · V1.5": "ರಾಜ್ಯ ಪೊಲೀಸ್ ಪ್ರಧಾನ ಕಛೇರಿ · V1.5",
    "STATE POLICE HQ · V1.4": "ರಾಜ್ಯ ಪೊಲೀಸ್ ಪ್ರಧಾನ ಕಛೇರಿ · V1.5",
    "41 Karnataka Districts Synced": "41 ಕರ್ನಾಟಕ ಜಿಲ್ಲೆಗಳ ನೈಜ ದತ್ತಾಂಶ ಸಂಪರ್ಕಿತ",
    "Hawkes ETAS & ML Ensembles: 90.8% Acc": "ಹಾಕ್ಸ್ ETAS & ML ಎನ್‌ಸೆಂoptions: 90.8% ನಿಖರತೆ",
    "3D Globe": "3D ಭೂಗೋಳ",
    "AI Reasoner": "AI ತರ್ಕಗಾರ",
    "ENTER WAR ROOM": "ವಾರ್ ರೂಮ್ ಪ್ರವೇಶಿಸಿ",
    "War Room": "ವಾರ್ ರೂಮ್",
    "Dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "Upload Intel": "ಮಾಹಿತಿ ಅಪ್‌ಲೋಡ್",
    "Data Ingestion": "ದತ್ತಾಂಶ ಇಂಜೆಕ್ಷನ್",
    "Cases": "ಪ್ರಕರಣಗಳು",
    "Investigation Canvas": "ತನಿಖಾ ಕ್ಯಾನ್ವಾಸ್",
    "Pattern Intel": "ಮಾದರಿ ಗುಪ್ತಚರ",
    "Evidence Board": "ಸಾಕ್ಷ್ಯ ಬೋರ್ಡ್",
    "3D Network": "3D ನೆಟ್‌ವರ್ಕ್",
    "Geospatial Map": "ಭೂ-ಸ್ಥಳ ನಕ್ಷೆ",
    "Persons": "ವ್ಯಕ್ತಿಗಳು",
    "FIR Search": "ಎಫ್‌ಐಆರ್ ಹುಡುಕಾಟ",
    "OCR Store": "OCR ಸಂಗ್ರಹ",
    "Financial Intel": "ಆರ್ಥಿಕ ಬೇಹುಗಾರಿಕೆ",
    "CDR Analytics": "CDR ವಿಶ್ಲೇಷಣೆ",
    "Predictive Intel": "ಮುನ್ಸೂಚನಾ ಬುದ್ಧಿಮತ್ತೆ",
    "AI Assistant": "AI ಸಹಾಯಕ",
    "Dark Web": "ಡಾರ್ಕ್ ವೆಬ್",
    "Forensic Intel": "ಫೊರೆನ್ಸಿಕ್ ಇಂಟೆಲ್",

    // KPI Cards
    "TOTAL CASES": "ಒಟ್ಟು ಪ್ರಕರಣಗಳು",
    "Total Cases": "ಒಟ್ಟು ಪ್ರಕರಣಗಳು",
    "ACTIVE INVESTIGATIONS": "ಸಕ್ರಿಯ ತನಿಖೆಗಳು",
    "Active Investigations": "ಸಕ್ರಿಯ ತನಿಖೆಗಳು",
    "SUSPECTS ARRESTED": "ಬಂಧಿತ ಶಂಕಿತರು",
    "Suspects Arrested": "ಬಂಧಿತ ಶಂಕಿತರು",
    "CHARGESHEETS FILED": "ದಾಖಲಾದ ದೋಷಾರೋಪಣಾ ಪಟ್ಟಿಗಳು",
    "Chargesheets Filed": "ದಾಖಲಾದ ದೋಷಾರೋಪಣಾ ಪಟ್ಟಿಗಳು",
    "CONVICTION RATE": "ಶಿಕ್ಷೆಯ ಪ್ರಮಾಣ",
    "Conviction Rate": "ಶಿಕ್ಷೆಯ ಪ್ರಮಾಣ",
    "FROZEN MULE ASSETS": "ಮುಟ್ಟುಗೋಲು ಹಾಕಿಕೊಂಡ ಮ್ಯೂಲ್ ಆಸ್ತಿಗಳು",
    "Frozen Mule Assets": "ಮುಟ್ಟುಗೋಲು ಹಾಕಿಕೊಂಡ ಮ್ಯೂಲ್ ಆಸ್ತಿಗಳು",
    "Under Inquiry": "ವಿಚಾರಣೆ ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    "In Custody": "ನ್ಯಾಯಾಂಗ ಬಂಧನದಲ್ಲಿ",
    "Court Ready": "ನ್ಯಾಯಾಲಯಕ್ಕೆ ಸಿದ್ಧ",
    "State Judiciary": "ರಾಜ್ಯ ನ್ಯಾಯಾಂಗ",
    "Sec 106 BNSS": "ಸೆಕ್ಷನ್ 106 ಬಿಎನ್‌ಎಸ್‌ಎಸ್",
    "Sec 173 BNSS": "ಸೆಕ್ಷನ್ 173 ಬಿಎನ್‌ಎಸ್‌ಎಸ್",
    "41 Districts": "41 ಜಿಲ್ಲೆಗಳು",

    // Filter Domain Pills
    "FILTER DOMAIN:": "ಡೊಮೇನ್ ಫಿಲ್ಟರ್:",
    "All Crimes": "ಎಲ್ಲಾ ಅಪರಾಧಗಳು",
    "Cyber & Mule Smurfing": "ಸೈಬರ್ & ಮ್ಯೂಲ್ ಸ್ಮರ್ಫಿಂಗ್",
    "OBD Vehicle Theft": "OBD ವಾಹನ ಕಳ್ಳತನ",
    "Narcotics (NDPS)": "ಮಾದಕ ದ್ರವ್ಯಗಳು (NDPS)",
    "Financial Hawala": "ಆರ್ಥಿಕ ಹವಾಲಾ",
    "Heinous & Homicide": "ಘೋರ ಅಪರಾಧ & ಕೊಲೆ",

    // Chart & Widget Titles
    "CRIME TREND & HAWKES FORECAST": "ಅಪರಾಧ ಪ್ರವೃತ್ತಿ & ಹಾಕ್ಸ್ ಮುನ್ಸೂಚನೆ",
    "24h-72h Hawkes Point-Process Projection": "24ಗಂ-72ಗಂ ಹಾಕ್ಸ್ ಪಾಯಿಂಟ್-ಪ್ರಕ್ರಿಯೆ ಮುನ್ನೋಟ",
    "CRIME MATRIX BREAKDOWN": "ಅಪರಾಧ ವರ್ಗೀಕರಣ ವಿಶ್ಲೇಷಣೆ",
    "LIVE TELEMETRY FEED": "ಲೈವ್ ಟೆಲಿಮೆಟ್ರಿ ಫೀಡ್",
    "HIGH-PRIORITY WANTED SYNDICATES": "ಹೆಚ್ಚಿನ ಆದ್ಯತೆಯ ವಾಂಟೆಡ್ ಸಿಂಡಿಕೇಟ್‌ಗಳು",
    "DISTRICT CLEARANCE & CASELOAD": "ಜಿಲ್ಲಾವಾರು ಪ್ರಕರಣ ವಿಲೇವಾರಿ & ಹೊರೆ",
    "HAWKES AI RISK": "ಹಾಕ್ಸ್ AI ಅಪಾಯ ಸೂಚ್ಯಂಕ",
    "TACTICAL PATROL ALERTS": "ಕಾರ್ಯಾಚರಣೆ ಗಸ್ತು ಎಚ್ಚರಿಕೆಗಳು",
    "Historical Baseline": "ಐತಿಹಾಸಿಕ ಮೂಲ ರೇಖೆ",
    "Hawkes ETAS AI Forecast": "ಹಾಕ್ಸ್ ETAS AI ಮುನ್ಸೂಚನೆ",
    "24H": "24ಗಂ",
    "WEEKLY": "ಸಾಪ್ತಾಹಿಕ",
    "MONTHLY": "ಮಾಸಿಕ",

    // Crime Categories
    "Cyber Crime": "ಸೈಬರ್ ಅಪರಾಧ",
    "Theft & Burglary": "ಕಳ್ಳತನ & ಮನೆಗಳ್ಳತನ",
    "Cheating & Fraud": "ವಂಚನೆ & ಮೋಸ",
    "Narcotics": "ಮಾದಕ ದ್ರವ್ಯಗಳು",
    "Robbery & Dacoity": "ದರೋಡೆ & ಸುಲಿಗೆ",
    "Economic Offences": "ಆರ್ಥಿಕ ಅಪರಾಧಗಳು",
    "Crimes Against Women": "ಮಹಿಳೆಯರ ವಿರುದ್ಧದ ಅಪರಾಧಗಳು",
    "Murder & Homicide": "ಕೊಲೆ & ಹತ್ಯೆ",
    "Attempt to Murder": "ಕೊಲೆ ಯತ್ನ",
    "Gambling": "ಜೂಜಾಟ (Gambling)",
    "Arms Act Violations": "ಶಸ್ತ್ರಾಸ್ತ್ರ ಕಾಯ್ದೆ ಉಲ್ಲಂಘನೆ",

    // Syndicates & Modus Operandi
    "Imran Pasha": "ಇಮ್ರಾನ್ ಪಾಷಾ",
    "Ashok Kumar": "ಅಶೋಕ್ ಕುಮಾರ್",
    "Dinesh Gupta": "ದಿನೇಶ್ ಗುಪ್ತಾ",
    "Suresh Reddi": "ಸುರೇಶ್ ರೆಡ್ಡಿ",
    "Venkatesh Murthy": "ವೆಂಕಟೇಶ್ ಮೂರ್ತಿ",
    "Luxury Car Theft (OBD Cloning)": "ಐಷಾರಾಮಿ ಕಾರು ಕಳ್ಳತನ (OBD ಕ್ಲೋನಿಂಗ್)",
    "Transnational UPI Smurfing": "ಅಂತರರಾಷ್ಟ್ರೀಯ UPI ಸ್ಮರ್ಫಿಂಗ್",
    "Chop-Shop Receiver Ring": "ಚಾಪ್-ಶಾಪ್ ಬಿಡಿಭಾಗ ಸ್ವೀಕಾರ ಜಾಲ",
    "Land Extortion Syndicate": "ಭೂ ಸುಲಿಗೆ ಸಿಂಡಿಕೇಟ್",
    "Gold Chain Snatching Network": "ಚಿನ್ನದ ಸರಗಳ್ಳತನ ಜಾಲ",
    "RED CORNER NOTICE": "ರೆಡ್ ಕಾರ್ನರ್ ನೋಟಿಸ್",
    "LOC ACTIVE": "ಲುಕ್‌ಔಟ್ ನೋಟಿಸ್ ಸಕ್ರಿಯ",
    "NBW ACTIVE": "ಜಾಮೀನುರಹಿತ ವಾರಂಟ್ ಸಕ್ರಿಯ",
    "WANTED": "ಬೇಕಾಗಿದ್ದಾನೆ",
    "UNDER SURVEILLANCE": "ಕಣ್ಗಾವಲಿನಲ್ಲಿ",

    // Districts
    "Bengaluru City": "ಬೆಂಗಳೂರು ನಗರ",
    "Bengaluru Urban": "ಬೆಂಗಳೂರು ನಗರ",
    "Bengaluru Rural": "ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ",
    "Mysuru City": "ಮೈಸೂರು ನಗರ",
    "Mysuru": "ಮೈಸೂರು",
    "Mangaluru City": "ಮಂಗಳೂರು ನಗರ",
    "Mangaluru": "ಮಂಗಳೂರು",
    "Hubballi Dharwad": "ಹುಬ್ಬಳ್ಳಿ ಧಾರವಾಡ",
    "Hubballi-Dharwad": "ಹುಬ್ಬಳ್ಳಿ ಧಾರವಾಡ",
    "Belagavi City": "ಬೆಳಗಾವಿ ನಗರ",
    "Belagavi": "ಬೆಳಗಾವಿ",
    "Kalaburagi": "ಕಲಬುರಗಿ",
    "Udupi": "ಉಡುಪಿ",
    "Mandya": "ಮಂಡ್ಯ",
    "Chikkaballapura": "ಚಿಕ್ಕಬಳ್ಳಾಪುರ",
    "Ballari": "ಬಳ್ಳಾರಿ",
    "Tumakuru": "ತುಮಕೂರು",
    "Davanagere": "ದಾವಣಗೆರೆ",
    "Shivamogga": "ಶಿವಮೊಗ್ಗ",
    "Vijayapura": "ವಿಜಯಪುರ",

    // Alerts & Tactical Directives
    "UPI Mule Velocity Spike Detected": "UPI ಮ್ಯೂಲ್ ವೇಗದ ತೀವ್ರತೆ ಪತ್ತೆಯಾಗಿದೆ",
    "FASTag ANPR Convoy Trajectory": "ಫಾಸ್ಟ್‌ಟ್ಯಾಗ್ ANPR ಬೆಂಗಾವಲು ವಾಹನ ಪಥ",
    "Repeat Offender Tower Ping Match": "ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿ ಟವರ್ ಸಿಗ್ನಲ್ ಹೊಂದಾಣಿಕೆ",
    "Deploy Hoysala Patrol": "ಹೊಯ್ಸಳ ಗಸ್ತು ನಿಯೋಜಿಸಿ",
    "Investigate": "ತನಿಖೆ ನಡೆಸಿ",
    "DISPATCH READY": "ನಿಯೋಜನೆಗೆ ಸಿದ್ಧ",
    "CRITICAL": "ಅತ್ಯಂತ ಗಂಭೀರ",
    "HIGH": "ಗಂಭೀರ",
    "MEDIUM": "ಮಧ್ಯಮ",
    "LOW": "ಕಡಿಮೆ",
    "Resolved": "ಪರಿಹರಿಸಲಾಗಿದೆ",
    "Total FIRs": "ಒಟ್ಟು ಎಫ್‌ಐಆರ್‌ಗಳು",
    "Hawkes Near-Repeat Contagion ↑ 28%": "ಹಾಕ್ಸ್ ಪುನರಾವರ್ತಿತ ಅಪಾಯ ↑ 28%",
    "Keyless Vehicle Theft Vector Active": "ಕೀಲೆಸ್ ವಾಹನ ಕಳ್ಳತನ ಜಾಲ ಸಕ್ರಿಯ",
    "Kim Rossmo Den Density: 91.4%": "ಕಿಮ್ ರೋಸ್ಮೋ ಅಡಗುದಾಣ ಸಾಂದ್ರತೆ: 91.4%",
  }
}

// ─── Persistent Memory & LocalStorage Cache ──────────────────────────────────
const memCache = {}

function getCachedTranslation(lang, text) {
  if (!text || lang === 'en') return text
  
  // 1. Instant Dictionary Check (0ms)
  if (INSTANT_DICT[lang] && INSTANT_DICT[lang][text]) {
    return INSTANT_DICT[lang][text]
  }

  // 2. In-Memory Cache Check (0ms)
  const key = `${lang}:${text}`
  if (memCache[key]) return memCache[key]

  // 3. LocalStorage Cache Check (0ms)
  try {
    const lsVal = localStorage.getItem(`sen_tr_${key}`)
    if (lsVal) {
      memCache[key] = lsVal
      return lsVal
    }
  } catch (e) {}

  return null
}

function setCachedTranslation(lang, text, translation) {
  const key = `${lang}:${text}`
  memCache[key] = translation
  try {
    localStorage.setItem(`sen_tr_${key}`, translation)
  } catch (e) {}
}

// ─── High-Speed Batch Translation Queue (20ms Debounced Dispatch) ─────────────
let batchQueue = []
let subscribers = {}
let batchTimer = null

function enqueueTranslation(text, lang, onDone) {
  const key = `${lang}:${text}`
  if (!subscribers[key]) {
    subscribers[key] = []
  }
  subscribers[key].push(onDone)

  if (!batchQueue.some(item => item.text === text && item.lang === lang)) {
    batchQueue.push({ text, lang })
  }

  if (batchTimer) clearTimeout(batchTimer)
  batchTimer = setTimeout(flushBatchQueue, 25)
}

async function flushBatchQueue() {
  if (batchQueue.length === 0) return
  const currentBatch = [...batchQueue]
  batchQueue = []

  // Group by target language
  const byLang = {}
  for (const item of currentBatch) {
    if (!byLang[item.lang]) byLang[item.lang] = []
    byLang[item.lang].push(item.text)
  }

  for (const [lang, texts] of Object.entries(byLang)) {
    try {
      // Send single batched API request
      const res = await translateBatch(texts, lang, 'en')
      const translations = res?.translations || {}

      for (const text of texts) {
        const tr = translations[text] || text
        setCachedTranslation(lang, text, tr)
        
        const key = `${lang}:${text}`
        if (subscribers[key]) {
          subscribers[key].forEach(cb => cb(tr))
          delete subscribers[key]
        }
      }
    } catch (e) {
      console.warn("[ZiaTranslate] Batch error, falling back to original:", e)
      for (const text of texts) {
        const key = `${lang}:${text}`
        if (subscribers[key]) {
          subscribers[key].forEach(cb => cb(text))
          delete subscribers[key]
        }
      }
    }
  }
}


// ─── High-Performance Instant ZiaText Component ─────────────────────────────
export function ZiaText({ children, className, style }) {
  const { i18n } = useTranslation()
  const currentLang = i18n.language || 'en'
  const isMounted = useRef(true)

  // Immediate synchronous lookup
  const initialValue = typeof children === 'string'
    ? (getCachedTranslation(currentLang, children) || children)
    : children

  const [translatedText, setTranslatedText] = useState(initialValue)

  useEffect(() => {
    isMounted.current = true
    return () => { isMounted.current = false }
  }, [])

  useEffect(() => {
    if (!children || typeof children !== 'string' || currentLang === 'en') {
      setTranslatedText(children)
      return
    }

    // Instant synchronous check
    const cached = getCachedTranslation(currentLang, children)
    if (cached) {
      setTranslatedText(cached)
      return
    }

    // Enqueue for batch translation
    enqueueTranslation(children, currentLang, (result) => {
      if (isMounted.current) {
        setTranslatedText(result)
      }
    })
  }, [children, currentLang])

  return <span className={className} style={style}>{translatedText}</span>
}
