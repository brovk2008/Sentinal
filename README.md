<div align="center">

<img src="./frontend/src/assets/logo.png" alt="Sentinal Logo" width="120" style="margin-bottom: 10px;" />

# 🔍 SENTINAL
### AI-Driven Crime Analytics & Intelligence Platform
#### Karnataka State Police × Zoho Catalyst Hackathon 2025

[![Live Serverless App](https://img.shields.io/badge/🚀_Primary_App-catalystserverless.in-copper?style=for-the-badge)](https://sentinal-60073535541.development.catalystserverless.in/app/index.html)
[![Live Slate App](https://img.shields.io/badge/🌐_Slate_App-sentinal--peak.onslate.in-darkred?style=for-the-badge)](https://sentinal-peak.onslate.in)
[![Powered by](https://img.shields.io/badge/Powered_by-Catalyst_by_Zoho-blue?style=for-the-badge)](https://catalyst.zoho.com)
[![Status](https://img.shields.io/badge/Status-Live_&_Verified-brightgreen?style=for-the-badge)]()

> **Transforming fragmented FIR records into a living intelligence ecosystem —**
> real-time scraping, AI-powered investigation, predictive hotspot mapping,
> live FIR search & PDF downloads, and criminal network analysis, all deployed on Catalyst by Zoho.

**[🌐 Primary Application (Catalyst Serverless) →](https://sentinal-60073535541.development.catalystserverless.in/app/index.html)**  
**[🌐 Secondary Slate Domain →](https://sentinal-peak.onslate.in)**

</div>

---

## 🔐 Platform Access

> Access the live platform instantly — no registration needed.

| Field | Primary Deployment URL | Slate Deployment URL |
|---|---|---|
| **URL** | [https://sentinal-60073535541.development.catalystserverless.in/app/index.html](https://sentinal-60073535541.development.catalystserverless.in/app/index.html) | [https://sentinal-peak.onslate.in](https://sentinal-peak.onslate.in) |
| **Demo Email** | `brovaibhavkr2008@gmail.com` | `brovaibhavkr2008@gmail.com` |
| **Password** | `1Davps@10` | `1Davps@10` |

---

## 📌 The Problem

Karnataka State Police (KSP) manages thousands of FIR records across 41 districts and 800+ police stations:

- **Isolated Silos**: Records are managed in disparate formats or spreadsheets, making aggregation difficult.
- **Lack of Intelligence Linkage**: No unified AI layer to identify repeat offenders, co-accused associations, or crime trends across districts.
- **Reporting Gaps**: State Crime Record Bureau (SCRB) receives fragmented inputs rather than a live, consolidated state-wide intelligence view.
- **Reactive Strategy**: Analysts lack predictive tools to proactively allocate patrols and assess geographic risk levels.
- **Locked PDFs**: Publicly published FIR PDFs on the KSP portal are inaccessible programmatically, blocking automated analysis.

---

## 💡 The Solution

Sentinal is a full-stack, cloud-native crime analytics and intelligence platform built on Zoho Catalyst:

1. **Live FIR Search & Instant View**: Look up any FIR by District, Police Station, Number, and Year. Renders the official KSP Form No. 1 document instantly with 1-click binary `.pdf` downloads.
2. **SmartBrowz Crawler**: Scrapes live FIR metadata and PDFs on-demand for any year directly from the KSP portal (running 8 parallel headless browser grid instances in the cloud).
3. **Stratus PDF Repository**: Ingested PDFs are stored securely in Catalyst Stratus, while structured case metadata is indexed in SQLite (`sentinal.db`) and Catalyst DataStore.
4. **AI Copilot (RAG)**: A semantic search assistant that translates natural language queries into insights using a vector index of real FIR details.
5. **Geospatial & Behavioral Analytics**: Renders live crime heatmaps, interactive vis-network syndicate graphs, and case funnel analytics.
6. **Predictive Risk Modeling**: An ML model (`hotspot_v2.joblib`) that processes spatial and temporal crime densities to predict high-risk zones.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SENTINAL PLATFORM                        │
├──────────────┬──────────────────────────────┬───────────────────┤
│   FRONTEND   │         BACKEND              │   CATALYST CLOUD  │
│              │                              │                   │
│  React + Vite│  FastAPI on AppSail          │  ┌─────────────┐  │
│  (Base: ./)  │  ┌──────────────────────┐    │  │  SmartBrowz │  │
│  Hosted on   │  │  /api/v1/            │    │  │  Browser    │  │
│  Serverless &│  │  ├─ fir/fetch        │◄───┼──│  Grid (x8)  │  │
│  Slate       │  │  ├─ fir/mock-ocr     │    │  └─────────────┘  │
│              │  │  ├─ heatmap          │    │  ┌─────────────┐  │
│  Pages:      │  │  ├─ network          │    │  │  Stratus    │  │
│  • Dashboard │  │  ├─ hotspot          │    │  │  FIR PDFs   │  │
│  • FIR Search│  │  ├─ rag              │    │  └─────────────┘  │
│  • Ingestion │  │  ├─ scraper/start    │    │  ┌─────────────┐  │
│  • Crime Map │  │  ├─ scraper/status   │    │  │  DataStore  │  │
│  • Network   │  │  ├─ scraper/query    │    │  │  + SQLite   │  │
│  • Cases     │  │  └─ scraper/pdf      │    │  └─────────────┘  │
│  • Offenders │  │                      │    │  ┌─────────────┐  │
│  • AI Chat   │  │  ML Models:          │    │  │  QuickML    │  │
│              │  │  hotspot_v2.joblib   │    │  │  + Zia      │  │
│              │  └──────────────────────┘    │  └─────────────┘  │
└──────────────┴──────────────────────────────┴───────────────────┘
```

---

## ✨ Key Features

### 📄 Live FIR Search & PDF Viewer
Search any Karnataka Police District and Police Station for FIR records by year. Renders the official KSP Form No. 1 document preview in an interactive iframe with direct binary `.pdf` file downloads.

### 📥 Data Ingestion & Scraper Grid
Inspect ingested records with dual actions:
- `👁 View PDF`: Opens an interactive full-screen modal with instant document previewing.
- `↓ Download`: Generates a direct binary `.pdf` download.

### 🔬 Zia OCR Pipeline
Auto-extracts structured fields (Complainant, Accused, Sections, Crime Facts, SHO Signatures) from FIR documents and synchronizes them directly into the Catalyst Data Store.

### 🗺️ Crime Intelligence Map
Interactive map dashboard using Leaflet with district and station-level drill-downs. Filter crime density by year, category, or time-of-day.

### 🕸️ Criminal Network Graph
Interactive force-directed graph built with Vis-Network mapping associations between co-accused suspects. Clicking a suspect node reveals their active IPC sections, Modus Operandi (MO), case history, and linked syndicates.

### 🤖 AI Intelligence Assistant (RAG)
Query case files in natural language:
> *"List repeat offenders in Bengaluru City linked to cyber fraud cases"*  
> *"What are the dominant IPC sections for theft in Hubballi-Dharwad?"*

---

## 🛠️ Catalyst Services Used

| # | Service | Operational Usage in Sentinal |
|---|---|---|
| 1 | **AppSail** | Hosts the backend FastAPI (Python 3.11) containerized application. |
| 2 | **Web Client / Slate** | Hosts the Vite React frontend client application with relative asset bundling. |
| 3 | **Stratus** | Cloud storage for scraped FIR PDFs (`sentinal-fir-pdfs` bucket). |
| 4 | **SmartBrowz** | Spins up 8 parallel headless Chrome webdrivers to scrape the KSP portal. |
| 5 | **QuickML** | Chat model serving (GLM-4.7-Flash) and feature-extraction embeddings. |
| 6 | **Zia** | OCR engine used to extract FIR fields and resolve portal image captchas. |
| 7 | **DataStore** | Stores structured application settings and scraper tracking indexes. |
| 8 | **Authentication** | User login and authorization management. |

---

## 📁 Project Structure

```
sentinal/
├── backend/
│   ├── Dockerfile
│   ├── main.py                        ← FastAPI entrypoint
│   ├── routers/
│   │   └── fir_scraper.py             ← FIR fetch, synthetic generator, & OCR
│   ├── scrapers/
│   │   ├── ksp_scraper.py             ← SmartBrowz browser grid crawler
│   │   └── scraper_store.py           ← Stratus PDF upload + DB indexer
│   └── data/
│       ├── sentinal.db                ← Relational database (SQLite)
│       └── embeddings.npy.gz          ← Compressed RAG vectors
├── frontend/
│   ├── vite.config.js                 ← Base './' relative bundling config
│   └── src/
│       ├── api.js                     ← Centralized API client wrapper
│       ├── utils/
│       │   └── firHtmlGenerator.js    ← KSP Form 1 HTML document generator
│       ├── components/layout/
│       │   ├── Sidebar.jsx            ← Navigation & logo branding
│       │   └── Topbar.jsx
│       └── pages/
│           ├── FIRSearch.jsx          ← Live FIR lookup, viewer, & OCR
│           ├── DataIngestion.jsx      ← Ingestion dashboard & PDF actions
│           ├── Dashboard.jsx
│           ├── GeospatialMap.jsx
│           └── NetworkGraph3D.jsx
└── catalyst.json                      ← Catalyst resource deployment config
```

---

## 👤 Team

* **Team MECH** — Solo Project (Zoho Catalyst Hackathon 2025)

---

<div align="center">

Built with 🔥 on [Catalyst by Zoho](https://catalyst.zoho.com)

**[🌐 Primary App URL](https://sentinal-60073535541.development.catalystserverless.in/app/index.html)**  
**[🌐 Slate App URL](https://sentinal-peak.onslate.in)**

</div>
