import os
import sys
import traceback

# Write immediate diagnostic info at startup
try:
    with open("startup_debug.txt", "w") as f:
        f.write("Sentinal Backend Startup Initiated\n")
        f.write(f"Python path: {sys.path}\n")
        f.write(f"Env port var: {os.environ.get('X_ZOHO_CATALYST_LISTEN_PORT')}\n")
        f.write(f"Full Env keys: {list(os.environ.keys())}\n")
except Exception as e:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import heatmap, network, intelligence, alerts, persons, cases, analytics, financial, cdr, ai, actions, reports, predict, board, brain, livefeed, darkweb, fir_scraper, nlp
from routers.predict import load_models as load_predict_models

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — load models and embeddings at startup."""
    try:
        with open("startup_debug.txt", "a") as f:
            f.write("Lifespan starting...\n")
        load_predict_models()
        with open("startup_debug.txt", "a") as f:
            f.write("Models loaded successfully.\n")
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "https://sentinal-60073535541.development.catalystappsail.in",
        "https://*.development.catalystappsail.in",
        "https://*.development.catalystserverless.in",
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
app.include_router(nlp.router, prefix="/api/v1/nlp", tags=["Catalyst NLP"])


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

