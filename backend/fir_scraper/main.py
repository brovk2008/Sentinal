"""
Sentinel FIR Scraper Microservice
Runs on Catalyst AppSail (Docker) — exposes FastAPI endpoints to fetch
Karnataka Police FIRs from ksp.karnataka.gov.in
"""
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from scraper import fetch_single_fir, fetch_stations_for_district

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

app = FastAPI(title="Sentinel FIR Scraper Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool — Selenium is synchronous
executor = ThreadPoolExecutor(max_workers=3)

# ── Karnataka Districts ──────────────────────────────────────────────────────
DISTRICTS = [
    {"id": "1", "name": "Bagalkot"}, {"id": "2", "name": "Ballari"},
    {"id": "3", "name": "Belagavi City"}, {"id": "4", "name": "Belagavi Dist"},
    {"id": "5", "name": "Bengaluru City"}, {"id": "6", "name": "Bengaluru Dist"},
    {"id": "7", "name": "Bidar"}, {"id": "8", "name": "Chamarajanagar"},
    {"id": "9", "name": "Chickballapura"}, {"id": "10", "name": "Chikkamagaluru"},
    {"id": "11", "name": "Chitradurga"}, {"id": "14", "name": "Dakshina Kannada"},
    {"id": "15", "name": "Davanagere"}, {"id": "16", "name": "Dharwad"},
    {"id": "20", "name": "Hubballi Dharwad City"}, {"id": "23", "name": "Kalaburagi"},
    {"id": "26", "name": "Kodagu"}, {"id": "27", "name": "Kolar"},
    {"id": "29", "name": "Mandya"}, {"id": "30", "name": "Mangaluru City"},
    {"id": "31", "name": "Mysuru City"}, {"id": "32", "name": "Mysuru Dist"},
    {"id": "33", "name": "Raichur"}, {"id": "34", "name": "Bengaluru South"},
    {"id": "35", "name": "Shivamogga"}, {"id": "36", "name": "Tumakuru"},
    {"id": "37", "name": "Udupi"}, {"id": "38", "name": "Uttara Kannada"},
    {"id": "39", "name": "Vijayapur"}, {"id": "40", "name": "Yadgir"},
    {"id": "41", "name": "Vijayanagara"},
]


# ── Request Models ────────────────────────────────────────────────────────────
class FIRRequest(BaseModel):
    district_id: str
    station_id: str
    fir_num: str
    year: str = "2024"


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "fir-scraper"}


@app.get("/districts")
async def get_districts():
    return {"districts": DISTRICTS}


@app.get("/stations/{district_id}")
async def get_stations(district_id: str):
    loop = asyncio.get_event_loop()
    try:
        stations = await loop.run_in_executor(
            executor, fetch_stations_for_district, district_id
        )
        return {"stations": stations}
    except Exception as e:
        log.error(f"stations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fir/fetch")
async def fetch_fir(req: FIRRequest):
    log.info(f"FIR fetch: district={req.district_id} station={req.station_id} fir={req.fir_num} year={req.year}")
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            executor,
            fetch_single_fir,
            req.district_id,
            req.station_id,
            req.fir_num,
            req.year,
        )
    except Exception as e:
        log.error(f"fetch_fir executor error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail="FIR not found in KSP records")
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result.get("message", "Scraper error"))
    return result


@app.post("/fir/mock-ocr")
async def mock_ocr(body: dict):
    """
    Fallback mock OCR endpoint — returns structured dummy data
    when Catalyst Zia OCR function is not yet deployed.
    """
    meta = body.get("fir_metadata", {})
    return {
        "success": True,
        "parsed_data": {
            "fir_number": meta.get("fir_number", "0001"),
            "year": meta.get("year", "2024"),
            "district": "Demo District",
            "police_station": "Demo Police Station",
            "circle_subdivision": "Demo Sub-Division",
            "court_name": "JMFC Court",
            "fir_date": "01/01/2024",
            "crime_number": f"{meta.get('fir_number', '1')}/2024",
            "act_section": "IPC 324, IPC 504, IPC 506",
            "occurrence_from_date": "31/12/2023",
            "occurrence_to_date": "31/12/2023",
            "occurrence_from_time": "18:00",
            "occurrence_to_time": "18:30",
            "occurrence_day": "Sunday",
            "place_of_occurrence": "Main Road, Demo Village",
            "distance_from_ps": "2 KM",
            "village": "Demo Village",
            "beat_name": "Beat No. 1",
            "complainant_name": "Ramu (Demo)",
            "complainant_father": "Shivappa",
            "complainant_age": 35,
            "complainant_sex": "Male",
            "complainant_religion": "Hindu",
            "complainant_caste": "OBC",
            "complainant_occupation": "Farmer",
            "complainant_phone": "9876543210",
            "complainant_nationality": "Indian",
            "complainant_address": "Demo Address, Demo Village, District",
            "fir_contents": "[Mock OCR] FIR contents would appear here after real Zia OCR.",
            "action_taken": "FIR registered, investigation started",
            "sho_name": "Inspector Demo",
            "pc_hc_name": "HC Demo",
            "dispatch_datetime": "01/01/2024 09:00",
            "has_complainant_signature": True,
            "has_sho_signature": True,
            "accused": [
                {"sl_no": 1, "name": "Accused Demo 1", "raw": "Mock accused row 1"},
                {"sl_no": 2, "name": "Accused Demo 2", "raw": "Mock accused row 2"},
            ],
            "victims": [
                {"sl_no": 1, "name": "Victim Demo 1", "raw": "Mock victim row 1"}
            ],
            "property": [],
        }
    }
