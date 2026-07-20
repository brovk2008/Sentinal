# 🛡️ Project Sentinal — Complete System Architecture, Logic & Workflow Guide

> **Karnataka Police Crime Intelligence & Predictive AI Platform**  
> Powered by **Zoho Catalyst (AppSail, Serverless Functions, QuickML, DataStore, SmartBrowz)**

---

## 📐 1. Master System Architecture & Component Connections

```mermaid
graph TD
    subgraph ClientLayer["🌐 CLIENT LAYER (React 18 SPA + Vite)"]
        UI_Dash["📊 Dashboard (Stats & Live Feed)"]
        UI_Map["🗺️ 2D Heatmap & 3D Incident Globe"]
        UI_Canvas["🕸️ Investigation Canvas (ReactFlow)"]
        UI_FIR["📄 FIR Search & PDF Viewer"]
        UI_Ingest["📥 Data Ingestion (SmartBrowz Control)"]
        UI_Pattern["🧬 Pattern & Criminology AI Engine"]
        UI_AI["💬 AI Intelligence Assistant (RAG)"]
        UI_CDR["📱 CDR & Financial Intelligence"]
    end

    subgraph CatalystCloud["☁️ ZOHO CATALYST INFRASTRUCTURE"]
        subgraph WebClient["📦 Web Client Hosting"]
            ServerlessClient["Catalyst Web Client (/app/index.html)<br>Custom Domain: sentinal-peak.onslate.in"]
        end

        subgraph ServerlessFn["⚡ Serverless Functions"]
            OCR_Fn["fir_ocr_processor<br>(Python Advanced I/O Function)"]
        end

        subgraph AppSailContainer["🚀 AppSail Container (FastAPI Backend)"]
            FastAPI["FastAPI Engine (main.py)"]
            
            subgraph Routers["API Routers"]
                R_Auth["/api/v1/auth"]
                R_Analytics["/api/v1/analytics"]
                R_Map["/api/v1/heatmap"]
                R_Board["/api/v1/board"]
                R_Brain["/api/v1/brain"]
                R_Criminology["/api/v1/criminology"]
                R_Scraper["/api/v1/scraper"]
                R_FIR["/api/v1/fir"]
                R_CDR["/api/v1/cdr"]
                R_Financial["/api/v1/financial"]
            end

            subgraph Services["Core Intelligence Services"]
                S_Rag["RAG Service (BGE Embeddings)"]
                S_Crim["Criminology Engine (MO & Near-Repeat)"]
                S_QML["QuickML Service (GLM-4.7 & Vision)"]
                S_Smart["SmartBrowz Scraper Service"]
            end

            subgraph Storage["Data Tier"]
                DB[("SQLite Master DB<br>sentinal.db - 10,000+ FIRs")]
                VEC[("Vector Index<br>embeddings.npy.gz & metadata")]
            end
        end

        subgraph QuickMLEngine["🧠 Catalyst QuickML & AI Services"]
            QML_GLM["GLM-4.7-Flash<br>(LLM Reasoning & Graph Analysis)"]
            QML_Vision["VL-Qwen3.6-35B-A3B<br>(Vision OCR & Evidence Processing)"]
            QML_NLP["Catalyst NLP<br>(Translation, STT & Speech Synthesis)"]
        end

        subgraph SmartBrowzCloud["🕷️ Catalyst SmartBrowz"]
            Browser360["Webdriver 360 Headless Browser<br>(KSP Portal Automation)"]
        end
    end

    %% Connections
    ClientLayer -->|HTTPS Requests| ServerlessClient
    ClientLayer -->|REST API Calls| FastAPI
    FastAPI --> Routers
    Routers --> Services
    Services --> DB
    Services --> VEC
    Services -->|OAuth 2.0 Auth| QuickMLEngine
    S_Smart -->|Remote Webdriver Protocol| Browser360
    S_Smart -->|Send Image Stream| OCR_Fn
    OCR_Fn -->|Structured Extraction| DB
```

---

## 🔄 2. Data Ingestion & Automated OCR Pipeline Logic

```mermaid
sequenceDiagram
    autonumber
    actor Investigator as 👮 Police Investigator
    participant UI as 🖥️ DataIngestion.jsx
    participant Backend as 🚀 AppSail (FastAPI)
    participant SmartBrowz as 🕷️ Catalyst SmartBrowz
    participant KSPPortal as 🌐 KSP Public Portal
    participant OCRFn as ⚡ fir_ocr_processor (Serverless)
    participant DB as 🗄️ sentinal.db
    participant RAG as 🧠 RAG Vector Index

    Investigator->>UI: Click "Start Automated Ingestion"
    UI->>Backend: POST /api/v1/scraper/start
    Backend->>SmartBrowz: Connect to Remote Browser Session
    SmartBrowz->>KSPPortal: Navigate, Select District & Fetch Form 1 FIR PDFs
    KSPPortal-->>SmartBrowz: Raw PDF Payload Stream
    SmartBrowz-->>Backend: Return Scraped PDF Documents
    Backend->>OCRFn: Trigger Advanced I/O Function (PDF Payload)
    Note over OCRFn: Performs OCR, Layout Analysis,<br/>Extracts Accused, Complainant & IPC Sections
    OCRFn-->>Backend: Return Structured JSON Metadata
    Backend->>DB: INSERT into CaseMaster & AccusedMaster Tables
    Backend->>RAG: Compute 384-dim Embedding for BriefFacts
    RAG-->>Backend: Update embeddings.npy.gz
    Backend-->>UI: Real-Time WebSocket/Progress Update (FIR Ingested ✓)
    UI-->>Investigator: Display Dual Actions (👁 View PDF & ↓ Download)
```

---

## 🧬 3. Criminology Pattern & Predictive AI Logic

```mermaid
flowchart LR
    subgraph DataInput["📥 Raw FIR Text & Coordinates"]
        Facts["Brief Facts Narrative"]
        Sections["IPC / BNS Sections"]
        Coords["Spatial Lat / Lng"]
        Time["Crime Registered Date"]
    end

    subgraph CriminologyEngine["🧠 Criminology Engine (services/criminology_engine.py)"]
        subgraph MO_Pipeline["1. Modus Operandi (MO) Linking"]
            ExtractTraits["Extract Target Asset, Entry Method,<br/>Time Window & Signature Keywords"]
            GroupMO["Group Matching Signature Clusters"]
            ScoreMO["Calculate Series Match Confidence (0 - 100%)"]
        end

        subgraph NR_Pipeline["2. Near-Repeat Risk Matrix"]
            BowersModel["Bowers & Johnson Spatial Decay Model"]
            ProjectRisk["Project 500m Elevated Risk Radius<br/>(4.2x Risk Multiplier for 14 Days)"]
        end

        subgraph Syn_Pipeline["3. Syndicate Hierarchy Builder"]
            MatchEntities["Cross-Match Accused Names, IMEIs,<br/>Bank Accounts & Vehicles"]
            ClassifyRoles["Assign Roles: Mastermind, Mule,<br/>Enforcer & Receiver"]
        end

        subgraph Spree_Pipeline["4. Spree & Repeat Victimization"]
            CheckClustering["Detect ≥ 3 Offences in 72h Window"]
            FlagSpree["Raise Active Spree APB Alert & Threat Score"]
        end
    end

    subgraph OutputUI["🖥️ Pattern & Predictive AI Hub (/#/patterns)"]
        Card1["🎯 MO Series Linking Cards"]
        Card2["📍 Near-Repeat Tactical Patrol Zones"]
        Card3["🕸️ Criminal Syndicate Roster"]
        Card4["⚡ Active Crime Spree Alerts"]
    end

    DataInput --> CriminologyEngine
    Facts --> ExtractTraits
    Sections --> ExtractTraits
    Coords --> BowersModel
    Time --> CheckClustering

    ExtractTraits --> GroupMO --> ScoreMO --> Card1
    BowersModel --> ProjectRisk --> Card2
    MatchEntities --> ClassifyRoles --> Card3
    CheckClustering --> FlagSpree --> Card4
```

---

## 🕸️ 4. Investigation Canvas & AI Graph Analysis Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Officer as 👮 Detective / Analyst
    participant Canvas as 🎨 ConnectionsBoard.jsx (ReactFlow)
    participant Backend as 🚀 AppSail (/api/v1/brain/analyze-board)
    participant DB as 🗄️ sentinal.db
    participant QuickML as 🧠 Catalyst QuickML (GLM-4.7-Flash)

    Officer->>Canvas: Drag Nodes (Suspect, Phone, Case) & Draw Edge ("Primary Beneficiary")
    Officer->>Canvas: Click "AI Analyze" or "Connect Dots"
    Canvas->>Backend: POST /api/v1/brain/analyze-board { nodes, connections }
    Backend->>DB: Fetch related case briefs, CDR logs & bank account ties
    DB-->>Backend: Return CaseMaster & CDR Join Data
    Backend->>QuickML: Submit Graph Payload + Criminological Analyst Prompt
    Note over QuickML: Analyzes graph topology,<br/>identifies hidden mule networks,<br/>predicts next withdrawal location
    QuickML-->>Backend: Return Structured JSON { new_connections, predicted_locations, key_insights }
    Backend-->>Canvas: Return Analysis Response
    Canvas->>Canvas: Auto-draw Green Dashed AI Suggested Edges
    Canvas-->>Officer: Render Anomaly Brief in SENTINAL AI BRAIN Panel
```

---

## 📋 5. Comprehensive Feature & Component Matrix

| Feature Module | Primary Component / Page | API Endpoint | Description & Underpinning Logic |
|---|---|---|---|
| **Command Center Dashboard** | [`Dashboard.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/Dashboard.jsx) | `GET /api/v1/analytics/overview` | High-level KPI metrics (Total FIRs, Arrests, Charge Sheet Rate, Cyber Crimes), district performance rankings, and live crime feed. |
| **2D Heatmap & 3D Incident Globe** | [`GeospatialMap.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/GeospatialMap.jsx) | `GET /api/v1/heatmap/points`<br>`GET /api/v1/heatmap/dbscan-clusters` | Renders Leaflet 2D density maps & Three.js 3D solid oceanic globe with cyan grid, atmosphere glow halo, and vertical 3D incident light beams pointing at crime locations. |
| **Investigation Canvas** | [`ConnectionsBoard.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/ConnectionsBoard.jsx) | `POST /api/v1/board/canvas/save`<br>`POST /api/v1/brain/analyze-board` | Infinite ReactFlow corkboard for linking suspects, cases, vehicles, phones & financial accounts. Features QuickML AI graph analysis and auto-connection suggestions. |
| **Pattern & Predictive AI Hub** | [`PatternIntel.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/PatternIntel.jsx) | `GET /api/v1/criminology/mo-clusters`<br>`GET /api/v1/criminology/near-repeat-risk`<br>`GET /api/v1/criminology/syndicate-graph` | Executes Modus Operandi (MO) series linking, Bowers & Johnson Near-Repeat spatial risk multipliers, syndicate role extraction, and spree alerts. |
| **FIR Search & PDF Viewer** | [`FIRSearch.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/FIRSearch.jsx) | `GET /api/v1/fir/list`<br>`GET /api/v1/fir/fetch` | Live lookup across 10,000+ Karnataka FIRs. Renders official KSP Form 1 HTML document preview in an iframe with 1-click binary Blob PDF downloads. |
| **Data Ingestion Control** | [`DataIngestion.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/DataIngestion.jsx) | `POST /api/v1/scraper/start`<br>`GET /api/v1/scraper/status` | Controls Catalyst SmartBrowz multi-worker headless scrapers. Features dual **👁 View PDF** and **↓ Download** action buttons. |
| **AI Copilot (RAG Assistant)** | [`AIAssistant.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/AIAssistant.jsx) | `POST /api/v1/intelligence/query` | Conversational RAG agent performing 384-dim vector similarity searches across 10,000+ FIR records via Catalyst QuickML (GLM-4.7-Flash). |
| **Financial & Mule Intelligence** | [`FinancialIntel.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/FinancialIntel.jsx) | `GET /api/v1/financial/transactions` | Detects suspicious money transfers, shell account rings, and high-velocity mule account cashouts. |
| **CDR Analysis Engine** | [`CDRAnalytics.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/CDRAnalytics.jsx) | `POST /api/v1/cdr/upload` | Parses Call Detail Records (CDR) to identify top callers, tower co-location overlaps, and night-time communication bursts. |
| **3D Criminal Network Graph** | [`NetworkGraph3D.jsx`](file:///c:/Users/techp/Downloads/more%20projects/Sentinal%20new/frontend/src/pages/NetworkGraph3D.jsx) | `GET /api/v1/network/nodes` | 3D force-directed WebGL graph visualization showing criminal organizational trees, hubs, and isolated bridges. |
| **Serverless OCR Processor** | `functions/fir_ocr_processor` | Advanced I/O Function URL | Catalyst Serverless function executing layout OCR on raw FIR PDF bytes to extract structured fields into Catalyst DataStore. |

---

### 🌐 Live Deployment Endpoints
- **Primary Application (Catalyst Serverless)**: [https://sentinal-60073535541.development.catalystserverless.in/app/index.html](https://sentinal-60073535541.development.catalystserverless.in/app/index.html)
- **Slate Custom Domain**: [https://sentinal-peak.onslate.in](https://sentinal-peak.onslate.in)
- **AppSail Backend API**: [https://sentinal-backend-50043676705.development.catalystappsail.in](https://sentinal-backend-50043676705.development.catalystappsail.in)
