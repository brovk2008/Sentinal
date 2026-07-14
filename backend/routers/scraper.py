"""
routers/scraper.py
FastAPI router for KSP FIR Scraper — SmartBrowz Edition

Endpoints:
  POST /api/v1/scraper/start          → start a scrape job (background)
  GET  /api/v1/scraper/status         → live progress (poll every 2s)
  POST /api/v1/scraper/stop           → graceful stop
  GET  /api/v1/scraper/query          → query stored FIR index
  GET  /api/v1/scraper/pdf/{key}      → get Stratus download URL for a PDF
  GET  /api/v1/scraper/districts      → list of all 41 KSP district names/IDs
"""

from fastapi import APIRouter, BackgroundTasks
from typing import Optional

from scrapers.ksp_scraper import (
    run_scraper, stop_scraper, scrape_progress, progress_lock, DISTRICT_NAMES
)
from scrapers.scraper_store import query_firs, get_pdf_download_url

router = APIRouter()

VALID_YEARS = [str(y) for y in range(2015, 2026)]


# ── Start scrape ──────────────────────────────────────────────────────────────

@router.post("/start")
async def start_scraper_endpoint(payload: dict, background_tasks: BackgroundTasks):
    """
    Start a background scrape job.

    Body:
    {
      "year":         "2024",         ← required (2015–2025)
      "district_ids": [5, 6, 31]      ← optional; omit for all 41 districts
    }

    Returns immediately — poll /status for live progress.
    """
    with progress_lock:
        if scrape_progress["status"] == "running":
            return {
                "error":    "A scrape is already running",
                "progress": dict(scrape_progress),
            }

    year         = str(payload.get("year", "2024"))
    district_ids = payload.get("district_ids", None)   # None = all districts

    if year not in VALID_YEARS:
        return {"error": f"Invalid year. Choose from {VALID_YEARS}"}

    if district_ids is not None:
        invalid = [d for d in district_ids if d not in DISTRICT_NAMES]
        if invalid:
            return {"error": f"Invalid district IDs: {invalid}. Valid range: 1–41"}

    background_tasks.add_task(run_scraper, year, district_ids)
    return {
        "message":      f"Scraper started for year {year}",
        "year":         year,
        "district_ids": district_ids or "all",
        "workers":      2,
    }


# ── Status (live poll) ────────────────────────────────────────────────────────

@router.get("/status")
async def scraper_status():
    """
    Live progress snapshot. Poll every 2s from UI.
    AI agent can also read this to know scrape state.

    Returns:
    {
      "status":          "running",
      "year":            "2024",
      "total_stations":  820,
      "done_stations":   143,
      "firs_found":      4231,
      "firs_not_found":  12891,
      "firs_skipped":    301,
      "errors":          3,
      "current":         "W2 → Bengaluru City → Indiranagar PS",
      "log":             ["[W0] ✓ FIR 0023 (2024) → found", ...]
    }
    """
    with progress_lock:
        return dict(scrape_progress)


# ── Stop ──────────────────────────────────────────────────────────────────────

@router.post("/stop")
async def stop_scraper_endpoint():
    """
    Send a graceful stop signal.
    Workers finish their current FIR then exit. Already-scraped records are kept.
    """
    stop_scraper()
    return {"message": "Stop signal sent — workers will finish current FIR then exit"}


# ── Query stored FIR index ────────────────────────────────────────────────────

@router.get("/query")
async def query_scraped_firs(
    year:     Optional[str] = None,
    district: Optional[str] = None,
    station:  Optional[str] = None,
    status:   Optional[str] = None,
    limit:    int           = 100,
):
    """
    Query the stored FIR index. All params optional.

    Used by:
      - UI search/filter panel
      - AI agent tool call to look up real scraped FIRs

    Examples:
      /api/v1/scraper/query?year=2024&district=Bengaluru City
      /api/v1/scraper/query?status=found&limit=500
      /api/v1/scraper/query?year=2023&station=Indiranagar
    """
    if limit > 1000:
        limit = 1000

    rows = query_firs(
        year=year, district=district,
        station=station, status=status,
        limit=limit,
    )
    return {"count": len(rows), "results": rows}


# ── PDF download URL ──────────────────────────────────────────────────────────

@router.get("/pdf/{stratus_key:path}")
async def get_fir_pdf_url(stratus_key: str):
    """
    Get a download URL for a stored FIR PDF from Catalyst Stratus.
    stratus_key format: "2024/5/PS001/0023.pdf"
    """
    url = get_pdf_download_url(stratus_key)
    if not url:
        return {"error": "PDF not found in Stratus", "key": stratus_key}
    return {"url": url, "key": stratus_key}


# ── Districts reference ───────────────────────────────────────────────────────

@router.get("/districts")
async def list_districts():
    """
    Returns all 41 KSP district IDs and names.
    Used by UI dropdown to populate district selector.
    """
    return {
        "districts": [
            {"id": did, "name": name}
            for did, name in sorted(DISTRICT_NAMES.items())
        ]
    }
