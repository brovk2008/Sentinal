# Project Sentinal v2

A high-performance, internally consistent fake crime intelligence platform for the Karnataka Police ecosystem (2023-2024), deployed on Zoho Catalyst.

## Tech Stack
- **Frontend**: React + Vite, Leaflet Maps, vis-network force-directed graph rendering, Recharts analytics, and custom Palantir-inspired CSS variables layout.
- **Backend**: FastAPI (Python 3.11+), SQLite local data storage.
- **RAG & ML**: Custom KNN semantic retrieval with Sentence Transformers + Catalyst QuickML (GLM-4.7-Flash) for analyst chats, and Scikit-Learn recidivism prediction.

## Directory Structure
- `frontend/`: Vite React app with central style system and Leaflet integration.
- `backend/`: FastAPI routers and data access logic.
- `scripts/`: Generation and build automation scripts for training ML models and embedding RAG datasets.

## Development Setup

### Backend setup
1. Install Python packages:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Build embeddings and ingest FIR dataset:
   ```bash
   python scripts/add_fir_data.py
   python scripts/build_embeddings.py
   python scripts/train_models.py
   ```
3. Start the dev server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend setup
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```

## Zoho Catalyst Platform Integration

Project Sentinal v2 integrates with the Zoho Catalyst cloud ecosystem:
1. **Catalyst QuickML — GLM-4.7-Flash**: Primary LLM for analyst chat, case summaries, and intelligence synthesis.
2. **Catalyst QuickML — Qwen 3.6 Vision (VL-Qwen3.6-35B-A3B)**: Multimodal image + text analysis for evidence and diagram enhancement.
3. **Catalyst Zia NLP**: Text Translation, Text-to-Audio Synthesis, and Audio-to-Text Transcription for voice interface and Kannada support.
4. **Catalyst Zia OCR**: Extraction of text from uploaded FIR PDFs/images into RAG.
5. **Catalyst Stratus**: Cloud storage for RAG evidence file uploads.
6. **Catalyst SmartBrowz**: HTML-to-PDF report compiler.
7. **Catalyst Signals**: Active anomaly and spike alert triggers.

Key environment variables:
   - `CATALYST_QUICKML_KEY` / `CATALYST_QUICKML_URL`
   - `CATALYST_LLM_MODEL` (default: `GLM-4.7-Flash`)
   - `CATALYST_VISION_MODEL` (default: `VL-Qwen3.6-35B-A3B`)
   - `CATALYST_NLP_TRANSLATION_URL`, `CATALYST_NLP_TTS_URL`, `CATALYST_NLP_STT_URL`
   - `CATALYST_ZIA_KEY`, `CATALYST_ZIA_OCR_URL`
   - `CATALYST_STRATUS_URL`, `CATALYST_STRATUS_KEY`

All integrations gracefully degrade to local SQLite/SentenceTransformers/ReportLab/weasyprint fallbacks if keys are not set.
