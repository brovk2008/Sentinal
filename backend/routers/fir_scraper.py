"""
fir_scraper.py — FIR Scraper Router
Mounts at /api/v1/fir
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log    = logging.getLogger(__name__)
router = APIRouter()

_executor = ThreadPoolExecutor(max_workers=2)

DISTRICTS = [
    {"id": "1",  "name": "Bagalkot"},
    {"id": "2",  "name": "Ballari"},
    {"id": "3",  "name": "Belagavi City"},
    {"id": "4",  "name": "Belagavi Dist"},
    {"id": "5",  "name": "Bengaluru City"},
    {"id": "6",  "name": "Bengaluru Dist"},
    {"id": "7",  "name": "Bidar"},
    {"id": "8",  "name": "Chamarajanagar"},
    {"id": "9",  "name": "Chickballapura"},
    {"id": "10", "name": "Chikkamagaluru"},
    {"id": "11", "name": "Chitradurga"},
    {"id": "14", "name": "Dakshina Kannada"},
    {"id": "15", "name": "Davanagere"},
    {"id": "16", "name": "Dharwad"},
    {"id": "20", "name": "Hubballi Dharwad City"},
    {"id": "23", "name": "Kalaburagi"},
    {"id": "26", "name": "Kodagu"},
    {"id": "27", "name": "Kolar"},
    {"id": "29", "name": "Mandya"},
    {"id": "30", "name": "Mangaluru City"},
    {"id": "31", "name": "Mysuru City"},
    {"id": "32", "name": "Mysuru Dist"},
    {"id": "33", "name": "Raichur"},
    {"id": "34", "name": "Bengaluru South"},
    {"id": "35", "name": "Shivamogga"},
    {"id": "36", "name": "Tumakuru"},
    {"id": "37", "name": "Udupi"},
    {"id": "38", "name": "Uttara Kannada"},
    {"id": "39", "name": "Vijayapur"},
    {"id": "40", "name": "Yadgir"},
    {"id": "41", "name": "Vijayanagara"},
]

# ── Fallback station list for all districts ───────────────────────────────────
STATION_FALLBACKS = {
    "5": [
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
        {"id": "1450", "name": "Whitefield PS"},
    ],
    "2": [
        {"id": "101", "name": "Ballari Town PS"},
        {"id": "102", "name": "Ballari Rural PS"},
        {"id": "103", "name": "Ballari Traffic PS"},
    ],
    "6": [
        {"id": "201", "name": "Nelamangala PS"},
        {"id": "202", "name": "Doddaballapura PS"},
        {"id": "203", "name": "Devanahalli PS"},
        {"id": "204", "name": "Hosakote PS"},
    ],
    "31": [
        {"id": "301", "name": "Devaraja PS"},
        {"id": "302", "name": "Lashkar PS"},
        {"id": "303", "name": "Mandi PS"},
        {"id": "304", "name": "Nazarbad PS"},
    ],
    "30": [
        {"id": "401", "name": "Mangaluru North PS"},
        {"id": "402", "name": "Mangaluru South PS"},
        {"id": "403", "name": "Bunder PS"},
    ],
    "35": [
        {"id": "501", "name": "Shivamogga Town PS"},
        {"id": "502", "name": "Shivamogga Rural PS"},
        {"id": "503", "name": "Bhadravathi PS"},
    ],
    "36": [
        {"id": "601", "name": "Tumakuru Town PS"},
        {"id": "602", "name": "Tumakuru Rural PS"},
        {"id": "603", "name": "Tiptur PS"},
    ],
}


class FIRRequest(BaseModel):
    district_id: str
    station_id:  str
    fir_num:     str
    year:        str = "2024"


def _get_scraper_fn():
    """Import scraper functions. Returns (fetch_fir, fetch_stations) or (None, None)."""
    try:
        # pyrefly: ignore [missing-import]
        from fir_scraper.scraper import fetch_single_fir, fetch_stations_for_district
        return fetch_single_fir, fetch_stations_for_district
    except ImportError:
        return None, None


@router.get("/districts")
async def get_districts():
    return {"districts": DISTRICTS}


@router.get("/stations/{district_id}")
async def get_stations(district_id: str):
    """Return police stations for a district. Uses live scraper with fast fallback."""
    _, fetch_stations = _get_scraper_fn()

    stations_list = []

    # Try live discovery with 3s timeout
    if fetch_stations is not None:
        loop = asyncio.get_event_loop()
        try:
            stations_list = await asyncio.wait_for(
                loop.run_in_executor(_executor, fetch_stations, district_id),
                timeout=3.0
            )
        except Exception as e:
            log.info(f"Live station fetch skipped ({e}). Using fallback manifest.")

    # Always fall back to static if live returns nothing
    if not stations_list:
        stations_list = STATION_FALLBACKS.get(district_id, [
            {"id": f"PS{district_id}01", "name": "Town PS"},
            {"id": f"PS{district_id}02", "name": "Rural PS"},
            {"id": f"PS{district_id}03", "name": "Traffic PS"},
            {"id": f"PS{district_id}04", "name": "Cyber Crime PS"},
        ])

    return {"stations": stations_list}


@router.post("/fetch")
async def fetch_fir(req: FIRRequest):
    """
    Fetch a single FIR from KSP portal.
    Returns: { status: "found" | "not_found" | "error", pdf_b64, fir_metadata, message }
    """
    fetch_single, _ = _get_scraper_fn()

    if fetch_single is None:
        # Check if ksp_scraper can do it directly
        try:
            from scrapers.ksp_scraper import _make_driver, _get_captcha, _fill_and_submit, \
                _fetch_pdf_via_requests, _close_extra_tabs, BASE_URL
            import re
            from bs4 import BeautifulSoup
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait, Select
            from selenium.webdriver.support import expected_conditions as EC

            loop = asyncio.get_event_loop()

            def _do_single_fetch():
                driver   = _make_driver("fir-single")
                main_tab = driver.current_window_handle
                try:
                    driver.get(BASE_URL)
                    _close_extra_tabs(driver, main_tab)
                    main_tab = driver.current_window_handle

                    Select(
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.NAME, "district_id"))
                        )
                    ).select_by_value(req.district_id)

                    ps_el = WebDriverWait(driver, 10).until(
                        lambda d: d.find_element(By.NAME, "ps_id")
                    )
                    WebDriverWait(driver, 10).until(
                        lambda d: len(Select(ps_el).options) > 1
                    )
                    Select(ps_el).select_by_value(req.station_id)

                    if not _fill_and_submit(driver, req.fir_num.zfill(4), req.year):
                        return {"status": "error", "message": "Could not read captcha"}

                    import time; time.sleep(1.5)
                    _close_extra_tabs(driver, main_tab)

                    try:
                        WebDriverWait(driver, 4).until(
                            lambda d: d.find_elements(By.CLASS_NAME, "firsearchc")
                            or "no records" in d.page_source.lower()
                        )
                    except:
                        pass

                    soup  = BeautifulSoup(driver.page_source, "html.parser")
                    table = soup.find("table", {"class": "firsearchc"})

                    if not table:
                        return {"status": "not_found", "message": "FIR not found in KSP records"}

                    a_tag = soup.find("a", href=re.compile(r'\.pdf', re.IGNORECASE))
                    if not a_tag:
                        return {"status": "found_no_pdf",
                                "message": "FIR found but no PDF link"}

                    href = a_tag["href"].strip()
                    if href.startswith("http"):
                        pdf_url = href
                    elif href.startswith("/"):
                        pdf_url = f"https://ksp.karnataka.gov.in{href}"
                    else:
                        pdf_url = f"https://ksp.karnataka.gov.in/firsearch/{href}"

                    pdf_data = _fetch_pdf_via_requests(driver, pdf_url)
                    if pdf_data:
                        import base64
                        return {
                            "status":  "found",
                            "pdf_b64": base64.b64encode(pdf_data).decode(),
                            "fir_metadata": {
                                "district_id":  req.district_id,
                                "station_id":   req.station_id,
                                "fir_number":   req.fir_num,
                                "year":         req.year,
                            }
                        }
                    return {"status": "found_no_pdf", "message": "PDF could not be downloaded"}

                finally:
                    try: driver.quit()
                    except: pass

            result = await asyncio.wait_for(
                loop.run_in_executor(_executor, _do_single_fetch),
                timeout=45.0
            )
            if result.get("status") == "not_found":
                raise HTTPException(status_code=404, detail="FIR not found in KSP records")
            return result

        except HTTPException:
            raise
        except Exception as e:
            log.error(f"Single FIR fetch error: {e}")
            return {"status": "error", "message": f"Scraper error: {e}"}

    loop = asyncio.get_event_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(
                _executor, fetch_single,
                req.district_id, req.station_id, req.fir_num, req.year
            ),
            timeout=45.0
        )
    except asyncio.TimeoutError:
        return {"status": "error", "message": "FIR fetch timed out (45s). KSP portal may be slow."}
    except Exception as e:
        log.error(f"fetch_fir error: {e}")
        return {"status": "error", "message": f"Scraper execution failed: {e}"}

    if result.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="FIR not found in KSP records")
    return result


@router.post("/mock-ocr")
async def mock_ocr(body: dict):
    """Mock OCR — used when Zia OCR function is not configured."""
    meta = body.get("fir_metadata", {})
    return {
        "success": True,
        "parsed_data": {
            "fir_number":           meta.get("fir_number", "0001"),
            "year":                 meta.get("year", "2024"),
            "district":             "Bengaluru Urban",
            "police_station":       "Cubbon Park PS",
            "court_name":           "JMFC Court",
            "fir_date":             "01/01/2024",
            "crime_number":         f"{meta.get('fir_number','1')}/2024",
            "act_section":          "IPC 420, IPC 34",
            "occurrence_from_date": "31/12/2023",
            "occurrence_to_date":   "31/12/2023",
            "occurrence_from_time": "18:00",
            "occurrence_to_time":   "18:30",
            "occurrence_day":       "Sunday",
            "place_of_occurrence":  "Main Road, Demo Area",
            "complainant_name":     "Demo Complainant",
            "complainant_age":      35,
            "complainant_sex":      "Male",
            "complainant_phone":    "9876543210",
            "complainant_address":  "Demo Address, Bengaluru",
            "fir_contents":         "[Mock OCR] Real OCR requires Zia function deployment.",
            "action_taken":         "FIR registered, investigation initiated",
            "sho_name":             "Inspector Demo",
            "has_complainant_signature": True,
            "has_sho_signature":         True,
            "accused":  [{"sl_no": 1, "name": "Accused Demo 1"}],
            "victims":  [{"sl_no": 1, "name": "Victim Demo 1"}],
            "property": [],
        },
    }