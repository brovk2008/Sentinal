"""
minimal_test.py — Minimal FastAPI test to verify AppSail container boots
"""
import sys, os
print("[TEST] Python starting...", flush=True)

import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"status": "ok", "python": sys.version, "env": dict(os.environ)}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("PORT") or 9000)
    print(f"[TEST] Starting on port {port}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)
