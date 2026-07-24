import sys, os

# MUST BE AT VERY TOP: Add bundled Linux AMD64 wheels in ./lib to sys.path
_HERE_LIB = os.path.join(os.path.dirname(__file__), "lib")
for _pkg_path in [_HERE_LIB, "/catalyst/lib", "/app/lib", "/tmp/sentinal-packages", "/tmp/site-packages"]:
    if os.path.exists(_pkg_path) and _pkg_path not in sys.path:
        sys.path.insert(0, _pkg_path)

for _pp in os.environ.get("PYTHONPATH", "").split(":"):
    if _pp and os.path.exists(_pp) and _pp not in sys.path:
        sys.path.insert(0, _pp)

print("[Sentinal Main] Python script starting...", flush=True)
import asyncio
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

DEBUG_LOG = "/tmp/startup_debug.txt"

def _log_debug(msg: str):
    print(f"[Sentinal Backend] {msg}", flush=True)
    try:
        with open(DEBUG_LOG, "a") as f:
            f.write(f"{msg}\n")
    except Exception:
        pass

_log_debug("Sentinal Backend Startup Initiated")
_log_debug(f"Python path: {sys.path[:3]}")
_log_debug(f"X_ZOHO_CATALYST_LISTEN_PORT: {os.environ.get('X_ZOHO_CATALYST_LISTEN_PORT')}")
_log_debug(f"PORT: {os.environ.get('PORT')}")



# Also honour PYTHONPATH entries
for _pp in os.environ.get("PYTHONPATH", "").split(":"):
    if _pp and os.path.exists(_pp) and _pp not in sys.path:
        sys.path.insert(0, _pp)

import site
user_site = site.getusersitepackages()
if user_site and user_site not in sys.path:
    sys.path.insert(0, user_site)

for extra_path in ["/catalyst/.local/lib/python3.11/site-packages", "/catalyst/.local/lib/python3.12/site-packages"]:
    if os.path.exists(extra_path) and extra_path not in sys.path:
        sys.path.insert(0, extra_path)


# Detect if running inside Zoho Catalyst AppSail production environment
IS_CATALYST = bool(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("CATALYST_ENV"))

# Router definitions: (module_name, route_prefix, tag)
ALL_ROUTERS = [
    ("analytics",    "/api/v1/analytics",    "Analytics"),
    ("heatmap",      "/api/v1/heatmap",      "Heatmap"),
    ("network",      "/api/v1/network",      "Network"),
    ("intelligence", "/api/v1/intelligence", "Intelligence"),
    ("alerts",       "/api/v1/alerts",       "Alerts"),
    ("persons",      "/api/v1/persons",      "Persons"),
    ("cases",        "/api/v1/cases",        "Cases"),
    ("financial",    "/api/v1/financial",    "Financial"),
    ("cdr",          "/api/v1/cdr",          "CDR"),
    ("ai",           "/api/v1/ai",           "AI"),
    ("actions",      "/api/v1/actions",      "Actions"),
    ("reports",      "/api/v1/reports",      "Reports"),
    ("predict",      "/api/v1/predict",      "Prediction"),
    ("board",        "/api/v1/board",        "Board"),
    ("brain",        "/api/v1/brain",        "Brain"),
    ("livefeed",     "/api/v1/livefeed",     "Live Feed"),
    ("darkweb",      "/api/v1/darkweb",      "Dark Web Intel"),
    ("fir_scraper",  "/api/v1/fir",          "FIR Scraper"),
    ("scraper",      "/api/v1/scraper",      "KSP FIR Scraper (SmartBrowz)"),
    ("nlp",          "/api/v1/nlp",          "Catalyst NLP"),
    ("uploads",      "/api/v1/uploads",      "File Uploads"),
    ("criminology",  "/api/v1/criminology",  "Criminology & Crime Pattern AI"),
    ("auth",         "/api/v1/auth",         "Auth"),
]

LOADED_ROUTERS = set()

def _import_and_mount_router(mod_name: str, prefix: str, tag: str) -> bool:
    if mod_name in LOADED_ROUTERS:
        return True
    try:
        import importlib
        mod = importlib.import_module(f"routers.{mod_name}")
        if hasattr(mod, "router"):
            app.include_router(mod.router, prefix=prefix, tags=[tag])
            LOADED_ROUTERS.add(mod_name)
            _log_debug(f"Router mounted: {mod_name} -> {prefix}")
            return True
    except Exception as e:
        _log_debug(f"Router {mod_name} skipped for now: {e}")
    return False

from init_db import init_all_tables

def _bg_model_loader():
    try:
        import subprocess
        # Check if numpy/scikit-learn are installed
        try:
            import numpy, sklearn
            _log_debug("ML packages already installed.")
        except ImportError:
            _log_debug("Installing ML packages in background...")
            pkg_dir = "/tmp/sentinal-packages"
            os.makedirs(pkg_dir, exist_ok=True)
            if pkg_dir not in sys.path:
                sys.path.insert(0, pkg_dir)
            
            cmd = [
                sys.executable, "-m", "pip", "install",
                "--quiet", "--no-cache-dir", "--target", pkg_dir,
                "--only-binary", ":all:",
                "numpy==1.26.4", "scikit-learn==1.5.0", "joblib==1.4.2",
                "pandas==2.2.2", "reportlab==4.2.0", "pdfplumber==0.11.4",
                "beautifulsoup4==4.12.3", "zcatalyst-sdk==1.0.3"
            ]
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            _log_debug(f"Background ML pip install finished (code {r.returncode})")

        # Retry mounting any deferred routers
        for _mname, _prefix, _tag in ALL_ROUTERS:
            _import_and_mount_router(_mname, _prefix, _tag)

        # Load prediction ML models
        if "predict" in LOADED_ROUTERS:
            import importlib
            predict_mod = importlib.import_module("routers.predict")
            if hasattr(predict_mod, "load_models"):
                predict_mod.load_models()
                _log_debug("ML prediction models loaded successfully.")
    except Exception as e:
        _log_debug(f"Background ML/loader error: {traceback.format_exc()}")


@asynccontextmanager
async def lifespan(app: FastAPI):

    """Application lifespan — initialize database instantly and load models asynchronously in background."""
    try:
        _log_debug("Lifespan starting...")

        # Sync/Restore the database from Catalyst File Store if backup exists
        try:
            from services.catalyst_db_sync import download_db_from_filestore
            download_db_from_filestore()
        except Exception as db_sync_err:
            _log_debug(f"Database sync download from Catalyst skipped/failed: {db_sync_err}")

        init_all_tables()  # Creates all missing tables + seeds synthetic data
        # Non-blocking model load so server responds with 200 OK instantly
        asyncio.create_task(asyncio.to_thread(_bg_model_loader))
        _log_debug("All tables ready. Async model loading dispatched.")
    except Exception as e:
        _log_debug(f"Lifespan init error: {traceback.format_exc()}")
    yield
    _log_debug("Lifespan shutdown.")


app = FastAPI(
    title="Project Sentinal",
    description="Karnataka Police Crime Intelligence Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# Attempt top-level granular import of all routers
for _mname, _prefix, _tag in ALL_ROUTERS:
    _import_and_mount_router(_mname, _prefix, _tag)

# ─── Defensive Header Deduplication Middleware ───────────────────────────────
class DeduplicateCORSMiddleware:
    """
    ASGI Middleware to ensure Access-Control-* response headers are never duplicated.
    If a proxy (like Catalyst AppSail / ZGS Gateway) or internal middleware adds duplicate
    headers, this middleware ensures only a single value is sent for Access-Control-Allow-Origin
    and Access-Control-Allow-Credentials.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                new_headers = []
                seen_keys = set()

                for key_bytes, value_bytes in headers:
                    key_lower = key_bytes.lower()
                    
                    if key_lower in (b"access-control-allow-origin", b"access-control-allow-credentials"):
                        # If value contains a comma-separated duplicate, keep only the first item
                        val_str = value_bytes.decode("utf-8", errors="ignore")
                        if "," in val_str:
                            parts = [p.strip() for p in val_str.split(",") if p.strip()]
                            if parts:
                                value_bytes = parts[0].encode("utf-8")

                        # Drop duplicate header entries
                        if key_lower in seen_keys:
                            continue
                        seen_keys.add(key_lower)

                    new_headers.append((key_bytes, value_bytes))

                message["headers"] = new_headers

            await send(message)

        await self.app(scope, receive, send_wrapper)


app.add_middleware(DeduplicateCORSMiddleware)


# ─── Environment-Aware CORS Configuration ─────────────────────────────────────
# Zoho Catalyst AppSail's ZGS Gateway automatically manages CORS headers for all origins
# in production. Adding CORSMiddleware in production causes duplicate headers
# (e.g. 'https://sentinal-peak.onslate.in, https://sentinal-peak.onslate.in').
# Therefore, CORSMiddleware is only enabled in local development mode.
if not IS_CATALYST:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/")
async def root():
    return {"status": "ok", "service": "Project Sentinal Backend", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "platform": "Project Sentinal"}

@app.get("/debug-logs")
async def debug_logs():
    try:
        if os.path.exists(DEBUG_LOG):
            with open(DEBUG_LOG, "r") as f:
                content = f.read()
            return {"success": True, "logs": content}
        return {"success": False, "error": "debug log not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    listen_port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("PORT") or 9000)
    print(f"[Sentinal AppSail Engine] Starting Uvicorn server on 0.0.0.0:{listen_port} (X_ZOHO_CATALYST_LISTEN_PORT={os.environ.get('X_ZOHO_CATALYST_LISTEN_PORT')})...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=listen_port)
