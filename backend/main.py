from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import heatmap, network, intelligence, alerts, persons, cases, analytics, financial, cdr, ai, actions, reports, predict
from routers.predict import load_models as load_predict_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — load models and embeddings at startup."""
    print("Project Sentinel v2 — Starting up...")
    load_predict_models()
    yield
    print("Project Sentinel v2 — Shutting down...")


app = FastAPI(
    title="Project Sentinel v2",
    description="Karnataka Police Crime Intelligence Platform API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "platform": "Project Sentinel v2"}
