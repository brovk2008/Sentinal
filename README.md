# Project Sentinel v2

A high-performance, internally consistent fake crime intelligence platform for the Karnataka Police ecosystem (2023-2024), deployed on Zoho Catalyst.

## Tech Stack
- **Frontend**: React + Vite, Leaflet Maps, vis-network force-directed graph rendering, Recharts analytics, and custom Palantir-inspired CSS variables layout.
- **Backend**: FastAPI (Python 3.11+), SQLite local data storage.
- **RAG & ML**: Custom KNN semantic retrieval system with Sentence Transformers (or dynamic HTTP API embeddings) + Groq Llama 3.3 for analyst chats, and a Scikit-Learn recidivism prediction model.

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
2. Build embeddings and ML models:
   ```bash
   python ../scripts/train_models.py
   python ../scripts/build_embeddings.py
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

Project Sentinel v2 integrates with the Zoho Catalyst cloud ecosystem:
1. **Catalyst QuickML**: LLM orchestration and model routing. Setup the following environment keys:
   - `CATALYST_QUICKML_URL`
   - `CATALYST_QUICKML_KEY`
2. **Catalyst Zia OCR**: Extraction of text from uploaded files to RAG:
   - `CATALYST_ZIA_KEY`
   - `CATALYST_ZIA_OCR_URL`
3. **Catalyst Stratus**: Cloud storage for RAG evidence file uploads:
   - `CATALYST_STRATUS_URL`
   - `CATALYST_STRATUS_KEY`
4. **Catalyst SmartBrowz**: HTML-to-PDF report compiler:
   - `CATALYST_SMARTBROWZ_URL`
   - `CATALYST_SMARTBROWZ_KEY`
5. **Catalyst Signals**: Active anomaly and spike alert triggers:
   - `CATALYST_SIGNALS_URL`
   - `CATALYST_SIGNALS_KEY`

All integrations gracefully degrade to local SQLite/SentenceTransformers/ReportLab/weasyprint fallbacks if keys are not set.
