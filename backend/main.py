import os
import sys
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Write immediate diagnostic info at startup
try:
    with open("startup_debug.txt", "w") as f:
        f.write("Sentinal Backend Startup Initiated\n")
        f.write(f"Python path: {sys.path}\n")
        f.write(f"Env port var: {os.environ.get('X_ZOHO_CATALYST_LISTEN_PORT')}\n")
        f.write(f"Full Env keys: {list(os.environ.keys())}\n")
except Exception as e:
    pass

# Detect if running inside Zoho Catalyst AppSail production environment
IS_CATALYST = bool(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("CATALYST_ENV"))

from routers import heatmap, network, intelligence, alerts, persons, cases, analytics, financial, cdr, ai, actions, reports, predict, board, brain, livefeed, darkweb, fir_scraper, nlp, scraper, uploads, auth
from routers.predict import load_models as load_predict_models
from scrapers.scraper_store import init_scrape_table

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — load models and embeddings at startup."""
    try:
        with open("startup_debug.txt", "a") as f:
            f.write("Lifespan starting...\n")
        load_predict_models()
        init_scrape_table()
        with open("startup_debug.txt", "a") as f:
            f.write("Models and scrape table initialised successfully.\n")
    except Exception as e:
        with open("startup_debug.txt", "a") as f:
            f.write(f"Lifespan error: {traceback.format_exc()}\n")
    yield
    try:
        with open("startup_debug.txt", "a") as f:
            f.write("Lifespan shutdown.\n")
    except:
        pass


app = FastAPI(
    title="Project Sentinal v2",
    description="Karnataka Police Crime Intelligence Platform API",
    version="2.0.0",
    lifespan=lifespan,
)


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

# Mount all routers
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(heatmap.router, prefix="/api/v1/heatmap", tags=["Heatmap"])
app.include_router(network.router, prefix="/api/v1/network", tags=["Network"])
app.include_router(intelligence.router, prefix="/api/v1/intelligence", tags=["Intelligence"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(persons.router, prefix="/api/v1/persons", tags=["Persons"])
app.include_router(cases.router, prefix="/api/v1/cases", tags=["Cases"])
app.include_router(financial.router, prefix="/api/v1/financial", tags=["Financial"])
app.include_router(cdr.router, prefix="/api/v1/cdr", tags=["CDR"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI"])
app.include_router(actions.router, prefix="/api/v1/actions", tags=["Actions"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(predict.router, prefix="/api/v1/predict", tags=["Prediction"])
app.include_router(board.router, prefix="/api/v1/board", tags=["Board"])
app.include_router(brain.router, prefix="/api/v1/brain", tags=["Brain"])
app.include_router(livefeed.router, prefix="/api/v1/livefeed", tags=["Live Feed"])
app.include_router(darkweb.router, prefix="/api/v1/darkweb", tags=["Dark Web Intel"])
app.include_router(fir_scraper.router, prefix="/api/v1/fir", tags=["FIR Scraper"])
app.include_router(scraper.router, prefix="/api/v1/scraper", tags=["KSP FIR Scraper (SmartBrowz)"])
app.include_router(nlp.router, prefix="/api/v1/nlp", tags=["Catalyst NLP"])
app.include_router(uploads.router, prefix="/api/v1/uploads", tags=["File Uploads"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "platform": "Project Sentinal v2"}

@app.get("/debug-logs")
async def debug_logs():
    try:
        if os.path.exists("startup_debug.txt"):
            with open("startup_debug.txt", "r") as f:
                content = f.read()
            return {"success": True, "logs": content}
        return {"success": False, "error": "startup_debug.txt not found"}
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", 9000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, workers=1)
