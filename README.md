<div align="center">

# 🔍 SENTINAL
### AI-Driven Crime Analytics & Intelligence Platform
#### Karnataka State Police × Zoho Catalyst Hackathon 2025

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-sentinal--peak.onslate.in-copper?style=for-the-badge)](https://sentinal-peak.onslate.in)
[![Team](https://img.shields.io/badge/Team-MECH-darkred?style=for-the-badge)]()
[![Powered by](https://img.shields.io/badge/Powered_by-Catalyst_by_Zoho-blue?style=for-the-badge)](https://catalyst.zoho.com)
[![Deployed](https://img.shields.io/badge/Status-Live_&_Deployed-brightgreen?style=for-the-badge)]()

> **Transforming fragmented FIR records into a living intelligence ecosystem —**
> real-time scraping, AI-powered investigation, predictive hotspot mapping,
> and criminal network analysis, all deployed entirely on Catalyst by Zoho.

**[🌐 Live Platform →](https://sentinal-peak.onslate.in)**

</div>

---

## 🔐 Demo Access

> Use these credentials to log into the live platform instantly — no registration needed.

| Field | Value |
|---|---|
| **URL** | https://sentinal-peak.onslate.in |
| **Email** | `brovaibhavkr2008@gmail.com` |
| **Password** | `1Davps@10` |

> **Note for judges**: The platform uses Catalyst Authentication. If the demo account doesn't log in on the live Slate URL, use the sign-up page to create a free account — it takes 10 seconds. All features are accessible to any registered user.

---

## 📌 The Problem

Karnataka State Police (KSP) manages thousands of FIR records across 41 districts and 800+ police stations. The current challenges are:

- **Isolated Silos**: Records are managed in disparate formats or spreadsheets, making aggregation difficult.
- **Lack of Intelligence Linkage**: No unified AI layer to identify repeat offenders, co-accused associations, or crime trends across districts.
- **Reporting Gaps**: State Crime Record Bureau (SCRB) receives fragmented inputs rather than a live, consolidated state-wide intelligence view.
- **Reactive Strategy**: Analysts lack predictive tools to proactively allocate patrols and assess geographic risk levels.
- **Locked PDFs**: Publicly published FIR PDFs on the KSP portal are inaccessible programmatically, blocking automated analysis.

---

## 💡 The Solution

Sentinal is a full-stack, cloud-native crime analytics and intelligence platform built on Zoho Catalyst:

1. **SmartBrowz Crawler**: Scrapes live FIR metadata and PDFs on-demand for any year directly from the KSP portal (running 8 parallel headless browser grid instances in the cloud).
2. **Stratus PDF Repository**: Ingested PDFs are stored securely in Catalyst Stratus, while structured case metadata is indexed in SQLite (`sentinal.db`) and Catalyst DataStore.
3. **AI Copilot (RAG)**: A semantic search assistant that translates natural language queries into insights using a vector index of real FIR details.
4. **Geospatial & Behavioral Analytics**: Renders live crime heatmaps, interactive vis-network syndicate graphs, and case funnel analytics.
5. **Predictive Risk Modeling**: An ML model (`hotspot_v2.joblib`) that processes spatial and temporal crime densities to predict high-risk zones.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SENTINAL PLATFORM                        │
├──────────────┬──────────────────────────────┬───────────────────┤
│   FRONTEND   │         BACKEND              │   CATALYST CLOUD  │
│              │                              │                   │
│  React + Vite│  FastAPI on AppSail          │  ┌─────────────┐  │
│  Hosted on   │  ┌──────────────────────┐    │  │  SmartBrowz │  │
│  Slate       │  │  /api/v1/            │    │  │  Browser    │  │
│              │  │  ├─ heatmap          │◄───┼──│  Grid (x8)  │  │
│  Pages:      │  │  ├─ network          │    │  └─────────────┘  │
│  • Overview  │  │  ├─ hotspot          │    │  ┌─────────────┐  │
│  • Crime Map │  │  ├─ rag              │    │  │  Stratus    │  │
│  • Network   │  │  ├─ scraper/start    │    │  │  FIR PDFs   │  │
│  • Cases     │  │  ├─ scraper/status   │    │  └─────────────┘  │
│  • Offenders │  │  ├─ scraper/query    │    │  ┌─────────────┐  │
│  • Ingestion │  │  └─ scraper/pdf      │    │  │  DataStore  │  │
│  • AI Chat   │  │                      │    │  │  + SQLite   │  │
│              │  │  ML Models:          │    │  └─────────────┘  │
│              │  │  hotspot_v2.joblib   │    │  ┌─────────────┐  │
│              │  │                      │    │  │  QuickML    │  │
│              │  │  RAG Pipeline:       │    │  │  + Zia      │  │
│              │  │  embeddings.npy.gz   │    │  └─────────────┘  │
│              │  │  chunk_metadata.gz   │    │  ┌─────────────┐  │
│              │  └──────────────────────┘    │  │  Signals +  │  │
│              │                              │  │  Circuits + │  │
│              │                              │  │  Cron       │  │
└──────────────┴──────────────────────────────┴──┴─────────────┴──┘
```

---

## ✨ Features

### 🗺️ Crime Intelligence Map
Interactive map dashboard using Leaflet with district and station-level drill-downs. Filter crime density by year, category, or time-of-day. Leverages coordinates parsed from real and synthetic records to plot hotspots and active alert zones.

### 🕸️ Criminal Network Graph
Interactive force-directed graph built with Vis-Network mapping associations between co-accused suspects. Clicking a suspect node instantly reveals their active IPC sections, Modus Operandi (MO), case history, and linked syndicates.

### 📎 Universal Evidence Upload
Drag-and-drop any file — suspect photos, CDR CSVs, CCTV frames, PDFs, audio. Catalyst Qwen Vision analyzes images (physical description, objects, license plates). pdfplumber extracts FIR text. CDR CSVs auto-pipe to the CDR engine. All uploads are searchable by the AI assistant.

### 🎯 Pattern Intelligence Engine
Real criminological analysis:
- **MO Clustering** — identical crime method + section + time = likely same offender
- **Repeat Victimization** — same victim/location targeted again (research-backed)
- **Spree Detection** — rapid succession crimes in same area = active perpetrator
- **Next Crime Prediction** — historical day-of-week + month pattern forecasting

### 📱 CDR Movement Trail
Upload CDR CSV (BSNL/Airtel/Jio formats auto-detected). Plot suspect movement trail across towers on the live map. Tower dump, IMEI trace, pre-incident window, common contacts network.

### 🌐 Language Support
Full UI in: English · हिंदी (Hindi) · ಕನ್ನಡ (Kannada) · தமிழ் (Tamil) · తెలుగు (Telugu) · اردو (Urdu). Instant switching — no page reload. All nav, auth, and UI strings translated.

### 🤖 AI Intelligence Assistant (RAG)
Analysts can query the case files in natural language:
> *"List repeat offenders in Bengaluru City linked to cyber fraud cases"*
> *"What are the dominant IPC sections for theft in Hubballi-Dharwad?"*
> *"Which police stations have active narcotics cases involving priority accused?"*

Powered by a lightweight vector retriever + Catalyst QuickML (GLM-4.7-Flash). The AI can also call scraper APIs as tools to trigger live web crawls.

### 📡 Live FIR Scraper (SmartBrowz)
Trigger crawlers for any year (2015–2025) and specific districts directly from the UI. AppSail spins up 8 parallel headless browser workers via Catalyst SmartBrowz to navigate the KSP portal, resolve image captchas using **Zia OCR**, and store PDFs directly in **Stratus**. Progress is piped to the UI console in real-time. Already-scraped FIRs are automatically skipped (resumable).

### 📊 Case Lifecycle Funnel
A visual flow representation mapping the pipeline from FIR Registration → Under Investigation → Chargesheet Filed → Court Case Status, pinpointing investigative backlogs across districts.

### 👤 Repeat Offender Profiles
Aggregated profiles for individuals appearing in 3 or more case files. Outlines chronological event timelines, syndicate alliances, and behavioral indicators.

### 📈 Predictive Hotspot Scoring
Uses a pre-trained scikit-learn model (`hotspot_v2.joblib`) to calculate risk scores for police station jurisdictions based on historical frequencies, seasonal weights, and severity categories.

---

## 🛠️ Catalyst Services Used

Every core function of Project Sentinal v2 maps to a native Zoho Catalyst service:

| # | Service | Operational Usage in Sentinal |
|---|---|---|
| 1 | **AppSail** | Hosts the backend FastAPI (Python 3.11) containerized application. |
| 2 | **Slate** | Hosts the Vite React frontend client application. |
| 3 | **Stratus** | Cloud storage for scraped FIR PDFs (`sentinal-fir-pdfs` bucket). |
| 4 | **SmartBrowz** | Spins up 8 parallel headless Chrome webdrivers to scrape the KSP portal. |
| 5 | **QuickML** | Chat model serving (GLM-4.7-Flash) and feature-extraction embeddings. |
| 6 | **Zia** | OCR engine used as a fallback to resolve portal image captchas. |
| 7 | **DataStore** | Stores structured application settings and scraper tracking indexes. |
| 8 | **Authentication** | Out-of-the-box user login and authorization management. |
| 9 | **Signals** | Dispatches real-time triggers when a high-severity incident is ingested. |
| 10 | **Circuits** | Orchestrates sequential pipelines (Ingest → Run OCR → Update Vector Store). |
| 11 | **Cron** | Triggers nightly incremental scrapes to sync new current-year records. |

---

## 🚀 Live Demo

**Platform URL**: [https://sentinal-peak.onslate.in](https://sentinal-peak.onslate.in)

Explore these key tabs:
* **Dashboard (`/dashboard`)**: Unified analytics summary.
* **Geospatial Map (`/map`)**: Heatmaps and ML hotspot risk boundaries.
* **Network Graph (`/network-3d`)**: Cooperative co-accused mapping.
* **Data Ingestion (`/ingestion`)**: Live SmartBrowz scraping panel and database index search.
* **Copilot Chat (`/assistant`)**: Semantic AI analyst helper.

---

## 📁 Project Structure

```
sentinal/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                        ← FastAPI entrypoint
│   ├── app-config.json                ← AppSail configurations
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── ksp_scraper.py             ← SmartBrowz browser grid crawler
│   │   └── scraper_store.py           ← Stratus PDF upload + DB indexer
│   ├── data/
│   │   ├── sentinal.db                ← Relational database (SQLite)
│   │   ├── embeddings.npy.gz          ← Compressed RAG vectors (10k FIRs + 1k Narratives)
│   │   └── chunk_metadata.json.gz     ← Compressed chunk metadata
│   └── models/
│       └── ml/saved/
│           └── hotspot_v2.joblib      ← Pre-trained hotspot predictor
├── frontend/
│   ├── vite.config.js
│   └── src/
│       ├── api.js                     ← API requests client wrapper
│       ├── App.jsx                    ← Client router and entry point
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── GeospatialMap.jsx
│       │   ├── NetworkGraph3D.jsx
│       │   ├── DataIngestion.jsx      ← Scraper UI and Log Console
│       │   └── AIAssistant.jsx        ← Copilot RAG chat UI
│       └── components/layout/
│           └── Sidebar.jsx
└── catalyst.json                      ← Catalyst resource deployment config
```

---

## ⚙️ Environment Variables (AppSail Config)

AppSail prohibits environment variables starting with the reserved `CATALYST_` prefix. Sentinal uses the `SENTINAL_` prefix throughout.

> **QuickML auth note**: Inside AppSail, `zcatalyst_sdk` auto-fetches a fresh OAuth token — no separate API key is needed. The URL itself is the full endpoint (exactly as shown in the Catalyst QuickML console). `SENTINAL_QUICKML_KEY` is only needed for local dev/testing — paste a Zoho OAuth token from the console there.

```env
SENTINAL_PROJECT_ID         = "50170000000065001"
SENTINAL_ORG_ID             = "60073535541"
SENTINAL_QUICKML_URL        = "https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/glm/chat"
SENTINAL_VISION_URL         = "https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/qwen/chat"
SENTINAL_LLM_MODEL          = "GLM-4.7-Flash"
SENTINAL_VISION_MODEL       = "VL-Qwen3.6-35B-A3B"
SENTINAL_NLP_TRANSLATE_URL  = "https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/nlp/text-translation"
SENTINAL_NLP_TTS_URL        = "https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/nlp/text-to-audio"
SENTINAL_NLP_STT_URL        = "https://api.catalyst.zoho.in/quickml/v1/project/50170000000065001/nlp/audio-to-text"
SMARTBROWZ_WEBDRIVER_URL    = "https://smartbrowz.catalyst.zoho.in/selenium/wd/hub?apikey=YOUR_KEY"
STRATUS_BUCKET              = "sentinal-fir-pdfs"
SCRAPE_WORKERS              = 8

# Local dev only (not needed inside AppSail):
SENTINAL_QUICKML_KEY        = "<paste-a-zoho-oauth-token-here>"
```


---

## 👤 Team

* **Team MECH** — Solo Project (Zoho Catalyst 2025)

---

<div align="center">

Built with 🔥 on [Catalyst by Zoho](https://catalyst.zoho.com)

**[🌐 sentinal-peak.onslate.in](https://sentinal-peak.onslate.in)**

</div>
