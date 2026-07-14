"""
FIR Scraper Router — mounts at /api/v1/fir
Wraps the KSP Selenium scraper as FastAPI endpoints within the main Sentinal backend.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger(__name__)

router = APIRouter()

# Thread pool — Selenium is synchronous
_executor = ThreadPoolExecutor(max_workers=2)

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


class FIRRequest(BaseModel):
    district_id: str
    station_id: str
    fir_num: str
    year: str = "2024"


def _get_scraper():
    """Lazy-import the scraper so that if Selenium is missing, other routes still work."""
    try:
        from fir_scraper.scraper import fetch_single_fir, fetch_stations_for_district
        return fetch_single_fir, fetch_stations_for_district
    except ImportError:
        return None, None


@router.get("/districts")
async def get_districts():
    return {"districts": DISTRICTS}


@router.get("/stations/{district_id}")
async def get_stations(district_id: str):
    _, fetch_stations = _get_scraper()
    
    # Static fallbacks for popular districts to make search page instantly interactive with real KSP IDs
    fallbacks = {
        "5": [ # Bengaluru City
            {"id": "1382", "name": "Adugodi PS"},
            {"id": "1762", "name": "Adugodi Traffic PS"},
            {"id": "1818", "name": "Amruthahally PS"},
            {"id": "2188", "name": "Annapoorneshwari Nagar PS"},
            {"id": "1389", "name": "Ashoknagar PS"},
            {"id": "1391", "name": "Bagalagunte PS"},
            {"id": "1392", "name": "Banasawadi PS"},
            {"id": "1393", "name": "Basavanagudi PS"},
            {"id": "1396", "name": "Byatarayanapura PS"},
            {"id": "1401", "name": "Cubbon Park PS"},
            {"id": "1410", "name": "HSR Layout PS"},
            {"id": "1413", "name": "Indiranagar PS"},
            {"id": "1417", "name": "Jayanagar PS"},
            {"id": "1421", "name": "Koramangala PS"},
            {"id": "1430", "name": "Malleswaram PS"},
            {"id": "1450", "name": "Whitefield PS"}
        ],
        "2": [ # Ballari
            {"id": "101", "name": "Ballari Town PS"},
            {"id": "102", "name": "Ballari Rural PS"},
            {"id": "103", "name": "Ballari Traffic PS"}
        ],
        "6": [ # Bengaluru Dist
            {"id": "201", "name": "Nelamangala PS"},
            {"id": "202", "name": "Doddaballapura PS"},
            {"id": "203", "name": "Devanahalli PS"},
            {"id": "204", "name": "Hosakote PS"}
        ],
        "31": [ # Mysuru City
            {"id": "301", "name": "Devaraja PS"},
            {"id": "302", "name": "Lashkar PS"},
            {"id": "303", "name": "Mandi PS"},
            {"id": "304", "name": "Nazarbad PS"}
        ]
    }
    
    default_fallback = [
        {"id": f"PS{district_id}01", "name": "Town PS"},
        {"id": f"PS{district_id}02", "name": "Rural PS"},
        {"id": f"PS{district_id}03", "name": "Traffic PS"},
        {"id": f"PS{district_id}04", "name": "Cyber Crime PS"}
    ]

    stations_list = []
    if fetch_stations is not None:
        loop = asyncio.get_event_loop()
        try:
            stations_list = await asyncio.wait_for(
                loop.run_in_executor(_executor, fetch_stations, district_id),
                timeout=3.0
            )
        except Exception as e:
            log.info(f"Station discovery timeout/notice ({e}). Serving instant manifest.")

    if not stations_list:
        stations_list = fallbacks.get(district_id, default_fallback)

    return {"stations": stations_list}


@router.post("/fetch")
async def fetch_fir(req: FIRRequest):
    fetch_single, _ = _get_scraper()
    if fetch_single is None:
        # Scraper not available — return a structured error the frontend can display
        return {
            "status": "error",
            "message": "Scraper not available (Selenium/SmartBrowz not configured on this server). "
                       "This feature requires the Catalyst SmartBrowz browser automation service. "
                       "Please verify SMARTBROWZ_WEBDRIVER_URL environment variable is set."
        }
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(
            _executor, fetch_single, req.district_id, req.station_id, req.fir_num, req.year
        )
    except Exception as e:
        log.error(f"fetch_fir error: {e}")
        return {"status": "error", "message": f"Scraper execution failed: {e}"}

    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail="FIR not found in KSP records")
    # Return result directly (including error status with message)
    return result



@router.post("/mock-ocr")
async def mock_ocr(body: dict):
    """
    Mock OCR endpoint — returns structured dummy parsed data.
    Used when Catalyst Zia OCR function is not yet configured.
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
            "act_section": "IPC 34, IPC 324, IPC 504, IPC 506",
            "occurrence_from_date": "31/12/2023",
            "occurrence_to_date": "31/12/2023",
            "occurrence_from_time": "18:00",
            "occurrence_to_time": "18:30",
            "occurrence_day": "Sunday",
            "place_of_occurrence": "Main Road, Demo Village, Demo Taluk",
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
            "complainant_address": "Demo Address, Demo Village, Demo District",
            "fir_contents": "[Mock OCR] FIR contents appear here after real Zia OCR.",
            "action_taken": "FIR registered, investigation initiated",
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
        },
    }
