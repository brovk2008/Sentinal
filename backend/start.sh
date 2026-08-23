#!/bin/sh
# start.sh — Instant AppSail startup wrapper for Sentinal backend
# Optimizes cold-start from ~40s down to <1.5s by skipping redundant pip installs.

echo "[start.sh] AppSail Instant Startup — $(date)" 1>&2
PORT=${X_ZOHO_CATALYST_LISTEN_PORT:-${PORT:-9000}}
echo "[start.sh] Binding to PORT: ${PORT}" 1>&2

# Fast-check if core packages exist
python3 -c "import fastapi, uvicorn" 2>/dev/null
HAS_CORE=$?

if [ $HAS_CORE -ne 0 ]; then
    echo "[start.sh] Core packages missing. Installing from requirements.txt..." 1>&2
    pip3 install --no-cache-dir -r requirements.txt 1>&2
else
    echo "[start.sh] Core dependencies verified. Launching uvicorn immediately..." 1>&2
fi

# Launch FastAPI server immediately
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1 --log-level info
