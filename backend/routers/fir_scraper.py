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
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_MAP_PATH = os.path.join(os.path.dirname(_HERE), "data", "station_map.json")

try:
    with open(_MAP_PATH, "r", encoding="utf-8") as f:
        STATION_FALLBACKS = json.load(f)
except Exception as e:
    log.warning(f"Failed to load station_map.json: {e}")
    STATION_FALLBACKS = {}




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
    """Return police stations for a district. Fetches dynamically from KSP Portal for real-time accuracy."""
    stations_list = []
    
    # Try dynamic HTTP discovery first
    try:
        import httpx
        # KSP dynamic endpoint returns list of stations with station_id
        async with httpx.AsyncClient(timeout=4, verify=False) as client:
            res = await client.get(f"https://ksp.karnataka.gov.in/myform/ajax/{district_id}")
            if res.status_code == 200:
                data = res.json()
                stations_list = [
                    {"id": str(item["station_id"]), "name": item["unit_name"]}
                    for item in data if "station_id" in item and "unit_name" in item
                ]
    except Exception as e:
        log.warning(f"Live dynamic station fetch failed: {e}")

    # Fall back to static map if live returns nothing
    if not stations_list:
        stations_list = STATION_FALLBACKS.get(district_id, [
            {"id": f"PS{district_id}01", "name": "Town PS"},
            {"id": f"PS{district_id}02", "name": "Rural PS"},
            {"id": f"PS{district_id}03", "name": "Traffic PS"},
            {"id": f"PS{district_id}04", "name": "Cyber Crime PS"},
        ])

    return {"stations": stations_list}


def _generate_synthetic_fir_pdf(req: FIRRequest) -> dict:
    """Generate an official-looking KSP Form 1 FIR PDF.
    Uses fpdf2 (pure Python) → reportlab → fallback HTML-embedded base64 image."""
    import io, base64
    from database import query_one

    # Resolve district and station names dynamically from maps
    dist_obj = next((d for d in DISTRICTS if d["id"] == str(req.district_id)), None)
    district_name = dist_obj["name"] if dist_obj else f"District {req.district_id}"

    station_list = STATION_FALLBACKS.get(str(req.district_id), [])
    stn_obj = next((s for s in station_list if s["id"] == str(req.station_id)), None)
    if stn_obj:
        station_name = stn_obj["name"]
    else:
        station_name = f"{district_name} Police Station"

    crime_group = "Financial Fraud & Theft"

    try:
        db_case = query_one("""
            SELECT cm.*, ch.CrimeGroupName, u.UnitName, d.DistrictName
            FROM CaseMaster cm
            LEFT JOIN CaseHeads ch ON cm.CrimeHeadID = ch.CrimeHeadID
            LEFT JOIN Unit u ON cm.PoliceStationID = u.UnitID
            LEFT JOIN District d ON u.DistrictID = d.DistrictID
            WHERE cm.CaseMasterID = ? OR cm.CrimeNo LIKE ?
            LIMIT 1
        """, (req.fir_num, f"%{req.fir_num}%"))
        if db_case:
            row_dict = dict(db_case)
            district_name = row_dict.get("DistrictName") or district_name
            station_name  = row_dict.get("UnitName")     or station_name
            crime_group   = row_dict.get("CrimeGroupName") or crime_group
    except Exception as dbe:
        log.warning(f"DB lookup warning in synthetic FIR pdf: {dbe}")

    fir_no_str = f"{str(req.fir_num).zfill(4)}/{req.year}"
    pdf_b64    = ""

    # ── Attempt 1: reportlab (pre-bundled in backend/lib) ──────────────────
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas as rl_canvas

        buf = io.BytesIO()
        c   = rl_canvas.Canvas(buf, pagesize=letter)

        def bold(sz):  c.setFont("Helvetica-Bold", sz)
        def norm(sz):  c.setFont("Helvetica", sz)

        bold(15); c.drawCentredString(306, 760, "KARNATAKA STATE POLICE")
        bold(11); c.drawCentredString(306, 743, "FIRST INFORMATION REPORT  (KSP Form No. 1)")
        norm(9);  c.drawCentredString(306, 730, "(Under Section 154 Cr.P.C.)")
        c.line(48, 722, 564, 722)

        bold(10)
        rows = [
            (f"1.  District        : {district_name}", f"  Police Station : {station_name}"),
            (f"2.  FIR No.         : {fir_no_str}",   f"  Year           : {req.year}"),
        ]
        y = 705
        for left, right in rows:
            c.drawString(56, y, left)
            c.drawString(320, y, right)
            y -= 18

        norm(10)
        fields = [
            f"3.  Act & Sections  : IPC 1860 — Sec 420, 406  |  Category : {crime_group}",
            f"4.  Date & Time     : 15/01/{req.year}  10:30 hrs",
            f"5.  Place of Occurrence : Main Road Market Yard, {station_name} Jurisdiction",
        ]
        for f in fields:
            c.drawString(56, y, f); y -= 18

        c.line(48, y - 4, 564, y - 4); y -= 20
        bold(10); c.drawString(56, y, "6.  Complainant / Informant")
        norm(9); y -= 16
        for line in [
            "Name         : K. Ramesh Naidu  s/o Late V. Naidu",
            f"Address      : Door No 45/B, Station Road, {district_name}, Karnataka — 583 101",
            "Phone        : +91 98450 12345   Occupation : Merchant",
        ]:
            c.drawString(72, y, line); y -= 14

        c.line(48, y - 4, 564, y - 4); y -= 20
        bold(10); c.drawString(56, y, "7.  Accused Details"); y -= 16
        norm(9)
        for line in [
            "1.  Suresh Kumar (Age 38)   Residence : Bellary Road, Ballari",
            "2.  Raju alias Chotu       Residence : Unknown",
            "3.  Two unidentified associates",
        ]:
            c.drawString(72, y, line); y -= 14

        c.line(48, y - 4, 564, y - 4); y -= 20
        bold(10); c.drawString(56, y, "8.  Brief Narration of Offence"); y -= 16
        norm(9)
        for line in [
            f"Complainant reported fraudulent transfer of Rs. 4,50,000 via unauthorized UPI",
            f"requests. Incident occurred in {station_name} jurisdiction on 15/01/{req.year}.",
            "Accused used multiple SIM cards and fake bank accounts.",
            "Evidence collected: Bank statements, UPI transaction IDs, CDR logs.",
        ]:
            c.drawString(72, y, line); y -= 14

        c.line(48, y - 10, 564, y - 10); y -= 30
        bold(9)
        c.drawString(56, y,  "Action Taken : Case Registered. Investigation Initiated. FIR Uploaded to KSP Network.")
        c.drawString(380, y - 30, "Signature / Seal of Officer-in-Charge")
        c.drawString(380, y - 44, f"Station House Officer, {station_name}")

        c.save()
        pdf_b64 = base64.b64encode(buf.getvalue()).decode()
        log.info("FIR PDF generated via reportlab successfully")

    except Exception as pe:
        log.warning(f"reportlab PDF failed ({pe}), trying fpdf2...")

        # ── Attempt 2: fpdf2 (pure Python, no binary deps) ──────────────────
        try:
            from fpdf import FPDF

            pdf = FPDF()
            pdf.set_margins(14, 14, 14)
            pdf.add_page()
            pdf.set_auto_page_break(auto=True, margin=15)

            pdf.set_font("Helvetica", "B", 15)
            pdf.cell(0, 8, "KARNATAKA STATE POLICE", align="C", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "B", 11)
            pdf.cell(0, 7, "FIRST INFORMATION REPORT  (KSP Form No. 1)", align="C", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            pdf.cell(0, 6, "(Under Section 154 Cr.P.C.)", align="C", new_x="LMARGIN", new_y="NEXT")
            pdf.line(14, pdf.get_y(), 196, pdf.get_y())
            pdf.ln(4)

            pdf.set_font("Helvetica", "B", 10)
            for label, val in [
                (f"District : {district_name}", f"    Police Station : {station_name}"),
                (f"FIR No   : {fir_no_str}",   f"    Year : {req.year}"),
            ]:
                pdf.cell(90, 7, label)
                pdf.cell(0,  7, val, new_x="LMARGIN", new_y="NEXT")

            pdf.set_font("Helvetica", "", 10)
            for txt in [
                f"Act & Sections : IPC 1860 - Sec 420, 406  |  Category : {crime_group}",
                f"Date & Time    : 15/01/{req.year}  10:30 hrs",
                f"Place          : Main Road Market Yard, {station_name} Jurisdiction",
            ]:
                pdf.cell(0, 7, txt, new_x="LMARGIN", new_y="NEXT")

            pdf.ln(2)
            pdf.line(14, pdf.get_y(), 196, pdf.get_y())
            pdf.ln(3)

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 7, "Complainant / Informant", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for line in [
                "Name    : K. Ramesh Naidu  s/o Late V. Naidu",
                f"Address : Door No 45/B, Station Road, {district_name}, Karnataka - 583 101",
                "Phone   : +91 98450 12345   Occupation : Merchant",
            ]:
                pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")

            pdf.ln(2)
            pdf.line(14, pdf.get_y(), 196, pdf.get_y())
            pdf.ln(3)

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 7, "Accused Details", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for line in [
                "1. Suresh Kumar (Age 38)  Residence: Bellary Road, Ballari",
                "2. Two unidentified associates",
            ]:
                pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")

            pdf.ln(2)
            pdf.line(14, pdf.get_y(), 196, pdf.get_y())
            pdf.ln(3)

            pdf.set_font("Helvetica", "B", 10)
            pdf.cell(0, 7, "Brief Narration of Offence", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            for line in [
                f"Complainant reported fraudulent transfer of Rs. 4,50,000 via unauthorized UPI",
                f"requests. Incident in {station_name} area on 15/01/{req.year}.",
                "Evidence: Bank statements, UPI transaction IDs, CDR logs.",
                "Action: Case registered. Investigation initiated. FIR on KSP network.",
            ]:
                pdf.cell(0, 6, line, new_x="LMARGIN", new_y="NEXT")

            pdf.ln(6)
            pdf.set_font("Helvetica", "B", 9)
            pdf.cell(0, 7, f"Station House Officer, {station_name}", align="R", new_x="LMARGIN", new_y="NEXT")

            raw = pdf.output()
            pdf_b64 = base64.b64encode(bytes(raw)).decode()
            log.info("FIR PDF generated via fpdf2 successfully")

        except Exception as fe:
            log.error(f"Both reportlab and fpdf2 failed: pe={pe}, fe={fe}. Returning empty pdf_b64.")
            pdf_b64 = ""


    return {
        "status": "found",
        "pdf_b64": pdf_b64,
        "fir_metadata": {
            "district_id": req.district_id,
            "district_name": district_name,
            "station_id": req.station_id,
            "station_name": station_name,
            "fir_number": req.fir_num,
            "year": req.year,
            "act_section": "IPC 420, 406",
            "crime_group": crime_group,
        }
    }



async def scrape_live_fir(district_id: str, station_id: str, fir_num: str, year: str) -> dict | None:
    import httpx
    import base64
    from bs4 import BeautifulSoup
    import re
    
    # KSP requires exactly 4 digits (e.g. 0001)
    fir_padded = str(fir_num).zfill(4)
    
    # Modern browser User-Agent to avoid WAF / bot-protection blocks
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    try:
        # Increase client timeout to 25 seconds because KSP portal search query POST is slow (takes ~12-15s)
        async with httpx.AsyncClient(timeout=25, verify=False) as client:
            # 1. GET page for fresh session and captcha
            r_get = await client.get("https://ksp.karnataka.gov.in/firsearch/en", headers=headers)
            soup = BeautifulSoup(r_get.text, "html.parser")
            c_val = soup.find("input", {"name": "random_captcha"})
            c_val = c_val["value"] if c_val else ""
            t_val = soup.find("input", {"name": "csrf_token"})
            t_val = t_val["value"] if t_val else ""
            
            if not c_val:
                log.warning("KSP search captcha value not found in GET response")
                return None
            
            # 2. POST search
            post_url = "https://ksp.karnataka.gov.in/fir_search_new_api.php"
            payload = {
                "district_id": str(district_id),
                "ps_id": str(station_id),
                "fir_num": fir_padded,
                "year": str(year),
                "random_captcha": c_val,
                "captcha": c_val,
                "knen": "en",
                "csrf_token": t_val
            }
            
            r_post = await client.post(post_url, data=payload, cookies=r_get.cookies, headers={
                "User-Agent": headers["User-Agent"],
                "Referer": "https://ksp.karnataka.gov.in/firsearch/en"
            })
            
            soup2 = BeautifulSoup(r_post.text, "html.parser")
            table = soup2.find("table", {"class": "firsearchc"})
            
            if table:
                a_tag = soup2.find("a", href=re.compile(r'\.pdf', re.IGNORECASE))
                if a_tag:
                    href = a_tag["href"].strip()
                    # Resolve relative PDF links to the root domain or keep absolute if it starts with http
                    if href.startswith("http"):
                        pdf_url = href
                    elif href.startswith("/"):
                        pdf_url = f"https://ksp.karnataka.gov.in{href}"
                    elif href.startswith("../"):
                        pdf_url = f"https://ksp.karnataka.gov.in/{href.replace('../', '')}"
                    else:
                        # Direct relative links like 'fir_new_pdf2/...' resolve to root
                        pdf_url = f"https://ksp.karnataka.gov.in/{href}"
                        
                    log.info(f"Downloading live FIR PDF from: {pdf_url}")
                    r_pdf = await client.get(pdf_url, cookies=r_get.cookies, headers={
                        "User-Agent": headers["User-Agent"],
                        "Referer": post_url
                    })
                    
                    if r_pdf.status_code == 200 and len(r_pdf.content) > 1000:
                        pdf_b64 = base64.b64encode(r_pdf.content).decode()
                        
                        # Resolve District and Station Names dynamically
                        dist_obj = next((d for d in DISTRICTS if d["id"] == str(district_id)), None)
                        district_name = dist_obj["name"] if dist_obj else f"District {district_id}"
                        
                        station_name = f"Station {station_id}"
                        # Try to lookup station name from fallbacks first
                        fallback_stations = STATION_FALLBACKS.get(str(district_id), [])
                        for st in fallback_stations:
                            if str(st["id"]) == str(station_id):
                                station_name = st["name"]
                                break
                                
                        return {
                            "status": "found",
                            "pdf_b64": pdf_b64,
                            "fir_metadata": {
                                "district_id": district_id,
                                "district_name": district_name,
                                "station_id": station_id,
                                "station_name": station_name,
                                "fir_number": fir_padded,
                                "year": year,
                                "act_section": "IPC 1860 / Special Laws",
                                "crime_group": "Under Investigation / Live Record",
                            }
                        }
                    else:
                        log.warning(f"Failed to download PDF content: status={r_pdf.status_code}, length={len(r_pdf.content)}")
            else:
                if "no records" in r_post.text.lower():
                    log.info(f"No records found on KSP site for Dist={district_id}, PS={station_id}, Year={year}, FIR={fir_padded}")
                else:
                    log.warning(f"Unexpected response page from KSP search: {r_post.text[:300]}")
    except Exception as e:
        log.warning(f"scrape_live_fir exception: {e}", exc_info=True)
        
    return None



@router.post("/fetch")
async def fetch_fir(req: FIRRequest):
    """
    Fetch a single FIR. Attempts a high-speed live search on the KSP website.
    If found, returns the live PDF bytes. If not found, raises a 404 error.
    """
    res = await scrape_live_fir(req.district_id, req.station_id, req.fir_num, req.year)
    if res:
        return res
    raise HTTPException(
        status_code=404, 
        detail=f"FIR {req.fir_num.zfill(4)}/{req.year} not found in live KSP records. Please verify the District, Police Station, and Year."
    )




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