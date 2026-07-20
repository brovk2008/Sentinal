#!/bin/sh
# start.sh — AppSail startup wrapper for Sentinal backend
# Installs pip packages then launches FastAPI via uvicorn.

echo "[start.sh] AppSail Python 3.11 startup — $(date)" 1>&2
echo "[start.sh] PORT: ${X_ZOHO_CATALYST_LISTEN_PORT}" 1>&2

PORT=${X_ZOHO_CATALYST_LISTEN_PORT:-9000}

# Phase 1: Install critical packages needed to START the server
echo "[start.sh] Phase 1: Installing core FastAPI + uvicorn..." 1>&2
pip3 install --quiet --no-cache-dir \
    "fastapi==0.111.0" \
    "uvicorn==0.30.1" \
    "python-multipart==0.0.9" \
    "python-dotenv==1.0.1" \
    "httpx==0.27.0" \
    "aiofiles==23.2.1" \
    "requests>=2.32.3" \
    "zcatalyst-sdk==1.0.3" \
    "pdfplumber==0.11.4" \
    "beautifulsoup4==4.12.3" 1>&2
echo "[start.sh] Phase 1 done." 1>&2

# Phase 2: Install heavy ML/data packages in background
echo "[start.sh] Phase 2: Background-installing ML packages..." 1>&2
pip3 install --quiet --no-cache-dir \
    "numpy==1.26.4" \
    "scikit-learn==1.5.0" \
    "joblib==1.4.2" \
    "pandas==2.2.2" \
    "reportlab==4.2.0" \
    "urllib3>=2.0.0" &
PIP_BG_PID=$!

echo "[start.sh] Background pip PID: $PIP_BG_PID" 1>&2

# Phase 3: Start the FastAPI server immediately (ML routes will return 503 until background install finishes)
echo "[start.sh] Phase 3: Starting uvicorn on 0.0.0.0:${PORT}..." 1>&2
exec python3 -m uvicorn main:app --host 0.0.0.0 --port $PORT --log-level info
