"""
fir_scraper.py — FIR Scraper Router
Mounts at /api/v1/fir
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Query, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from database import query, query_one, execute
from services import zia_nlp_service as zia
import uuid
import json

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
            LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
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
async def real_ocr(body: dict):
    """
    Real OCR using pdfplumber — extracts text from the actual PDF bytes
    and parses KSP FIR fields: complainant, accused, IPC sections, dates, SHO etc.
    Falls back to graceful partial extraction if parsing is incomplete.
    """
    import base64
    import re
    import io

    meta     = body.get("fir_metadata", {})
    pdf_b64  = body.get("pdf_b64", "")

    raw_text = ""
    pages_text = []

    # ── Step 1: Extract raw text from PDF bytes ─────────────────────────────
    if pdf_b64:
        try:
            import pdfplumber
            pdf_bytes = base64.b64decode(pdf_b64)
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    t = page.extract_text() or ""
                    pages_text.append(t)
            raw_text = "\n".join(pages_text).strip()
        except Exception as e:
            log.warning(f"[RealOCR] pdfplumber failed: {e}")

    if not raw_text:
        return {"success": False, "error": "Could not extract text from PDF — PDF may be image-based or corrupted."}

    # ── Step 2: Smart regex parser for KSP FIR format ───────────────────────
    def find(patterns, text=raw_text, default=""):
        for p in patterns:
            m = re.search(p, text, re.IGNORECASE | re.MULTILINE)
            if m:
                return m.group(1).strip()
        return default

    def find_block(start_pattern, end_pattern, text=raw_text):
        m = re.search(rf"{start_pattern}(.*?){end_pattern}", text, re.IGNORECASE | re.DOTALL)
        return m.group(1).strip() if m else ""

    # Core FIR identifiers
    fir_number = find([
        r"FIR\s*No\.?\s*[:\-]?\s*(\d+)",
        r"Crime\s*No\.?\s*[:\-]?\s*(\d+)",
        r"Case\s*No\.?\s*[:\-]?\s*(\d+)",
    ], default=meta.get("fir_number", ""))

    year = find([
        r"Year\s*[:\-]?\s*(\d{4})",
        r"(\d{4})\s*/\s*\d+",
        r"/(\d{4})",
    ], default=meta.get("year", "2024"))

    fir_date = find([
        r"Date\s*of\s*FIR\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        r"FIR\s*Date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
        r"Date\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})",
    ])

    # Act / IPC sections
    act_section = find([
        r"(?:U/?[Ss]|Under\s+[Ss]ection|[Ss]ec(?:tion)?s?)\.?\s*[:\-]?\s*([\d\s,/A-Za-z\(\)]+(?:IPC|BNS|CrPC|POCSO|IT Act|NDPS|Arms Act|MV Act)[^\n]*)",
        r"(?:Sections?|Acts?)\s*[:\-]?\s*([^\n]{5,80})",
        r"(IPC\s*[\d\s,/A-Za-z]+)",
        r"(BNS\s*[\d\s,/A-Za-z]+)",
    ])

    # Place of occurrence
    place = find([
        r"[Pp]lace\s*of\s*[Oo]ccurrence\s*[:\-]?\s*([^\n]{5,100})",
        r"[Ll]ocation\s*[:\-]?\s*([^\n]{5,100})",
        r"[Aa]ddress\s*of\s*[Oo]ffence\s*[:\-]?\s*([^\n]{5,100})",
    ])

    # Occurrence dates/times
    occ_from = find([r"[Ff]rom\s*[Dd]ate\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})"])
    occ_to   = find([r"[Tt]o\s*[Dd]ate\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})"])
    occ_from_time = find([r"[Ff]rom\s*[Tt]ime\s*[:\-]?\s*(\d{1,2}:\d{2})"])
    occ_to_time   = find([r"[Tt]o\s*[Tt]ime\s*[:\-]?\s*(\d{1,2}:\d{2})"])

    # Complainant / Informant
    complainant_name = find([
        r"[Cc]omplainant(?:'s)?\s*[Nn]ame\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
        r"[Ii]nformant\s*[Nn]ame\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
        r"[Nn]ame\s+of\s+[Cc]omplainant\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
    ])
    complainant_age = find([r"[Aa]ge\s*[:\-]?\s*(\d{1,3})\s*[Yy]"])
    complainant_sex = find([r"[Ss]ex\s*[:\-]?\s*(Male|Female|Transgender)", r"[Gg]ender\s*[:\-]?\s*(Male|Female|Transgender)"])
    complainant_phone = find([r"(?:Phone|Mobile|Contact)\s*(?:No\.?)?\s*[:\-]?\s*(\+?[\d\s\-]{8,15})"])
    complainant_addr = find([
        r"[Cc]omplainant'?s?\s*[Aa]ddress\s*[:\-]?\s*([^\n]{10,120})",
        r"[Aa]ddress\s*[:\-]?\s*([^\n]{10,120})",
    ])

    # District and Police Station (from text itself, not just metadata)
    district_text = find([
        r"[Dd]istrict\s*[:\-]?\s*([A-Za-z\s]{3,40})",
    ], default=meta.get("district_id", ""))

    station_text = find([
        r"(?:Police\s+)?[Ss]tation\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
        r"[Tt]hana\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
        r"P\.?S\.?\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
    ], default=meta.get("station_id", ""))

    # SHO / IO details
    sho_name = find([
        r"(?:SHO|Station\s*House\s*Officer|Inspector|Sub-Inspector|SI|ASI)\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
        r"[Ss]igned?\s+by\s*[:\-]?\s*([A-Za-z\s\.]{3,50})",
    ])

    # Accused — extract all names from accused section
    accused = []
    accused_block = find_block(
        r"[Aa]ccused\s*[Dd]etails?",
        r"(?:[Cc]omplainant|[Vv]ictim|[Pp]roperty|[Ss]ection|[Oo]ccurrence|[Ss]ignature)"
    )
    if not accused_block:
        accused_block = find_block(r"[Aa]rrestee|[Ss]uspect", r"(?:[Cc]omplainant|[Vv]ictim|[Ss]ection)")

    if accused_block:
        names = re.findall(
            r"(?:\d+[\.\)]\s*)?([A-Z][a-z]+(?:\s+[A-Z@][a-zA-Z]+){1,4})(?:\s*(?:S/O|D/O|W/O|Alias|@))",
            accused_block
        )
        if not names:
            names = re.findall(r"(?:\d+[\.\)]\s*)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})", accused_block)
        for i, n in enumerate(names[:10], 1):
            accused.append({"sl_no": i, "name": n.strip()})

    # If no accused found via block, try global search for accused names near "A-1", "A-2" markers
    if not accused:
        a_matches = re.findall(r"[Aa]-?\d+\s*[:\.\)]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})", raw_text)
        for i, n in enumerate(a_matches[:10], 1):
            accused.append({"sl_no": i, "name": n.strip()})

    # Victims
    victims = []
    victim_block = find_block(
        r"[Vv]ictim\s*[Dd]etails?",
        r"(?:[Ss]ection|[Oo]ccurrence|[Ss]ignature|[Pp]roperty|[Aa]ccused)"
    )
    if victim_block:
        vnames = re.findall(r"(?:\d+[\.\)]\s*)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})", victim_block)
        for i, n in enumerate(vnames[:5], 1):
            victims.append({"sl_no": i, "name": n.strip()})

    # Crime group / nature
    crime_group = find([
        r"[Cc]rime\s*[Gg]roup\s*[:\-]?\s*([^\n]{5,80})",
        r"[Nn]ature\s*of\s*[Cc]rime\s*[:\-]?\s*([^\n]{5,80})",
        r"[Oo]ffence\s*[:\-]?\s*([^\n]{5,80})",
    ])

    action_taken = find([
        r"[Aa]ction\s*[Tt]aken\s*[:\-]?\s*([^\n]{5,200})",
        r"[Ii]nvestigation\s*[Oo]fficer\s*[:\-]?\s*([^\n]{5,100})",
    ])

    parsed = {
        "fir_number":           fir_number or meta.get("fir_number", ""),
        "year":                 year or meta.get("year", ""),
        "district":             district_text,
        "police_station":       station_text,
        "court_name":           find([r"[Cc]ourt\s*[:\-]?\s*([^\n]{5,60})"]),
        "fir_date":             fir_date,
        "crime_number":         f"{fir_number}/{year}" if fir_number and year else "",
        "act_section":          act_section,
        "crime_group":          crime_group,
        "occurrence_from_date": occ_from,
        "occurrence_to_date":   occ_to,
        "occurrence_from_time": occ_from_time,
        "occurrence_to_time":   occ_to_time,
        "occurrence_day":       find([r"[Dd]ay\s*[:\-]?\s*([A-Za-z]+day)"]),
        "place_of_occurrence":  place,
        "complainant_name":     complainant_name,
        "complainant_age":      int(complainant_age) if complainant_age and complainant_age.isdigit() else None,
        "complainant_sex":      complainant_sex,
        "complainant_phone":    complainant_phone,
        "complainant_address":  complainant_addr,
        "fir_contents":         raw_text[:3000],
        "action_taken":         action_taken,
        "sho_name":             sho_name,
        "has_complainant_signature": bool(re.search(r"[Cc]omplainant.{0,20}[Ss]ignature", raw_text)),
        "has_sho_signature":         bool(re.search(r"SHO|[Ss]igned|[Ss]ignature\s+of\s+[Ss]tation", raw_text)),
        "accused":              accused,
        "victims":              victims,
        "property":             [],
        "_raw_pages":           len(pages_text),
        "_raw_chars":           len(raw_text),
    }

    return {"success": True, "parsed_data": parsed, "engine": "pdfplumber"}


# ── OCR Record Persistence & Translation Endpoints ─────────────────────────

class SaveOCRRequest(BaseModel):
    id: Optional[str] = None
    fir_number: str
    year: str
    district_id: Optional[str] = ""
    district_name: Optional[str] = ""
    station_id: Optional[str] = ""
    station_name: Optional[str] = ""
    act_section: Optional[str] = ""
    crime_group: Optional[str] = ""
    extracted_text: Optional[str] = ""
    translated_text: Optional[str] = ""
    parsed_data: Optional[dict] = {}

class TranslateOCRRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"

@router.post("/ocr/save")
async def save_ocr_record(req: SaveOCRRequest):
    """Save an extracted OCR record into SQLite for account-wide access across tabs."""
    record_id = req.id or f"ocr-{uuid.uuid4().hex[:8]}"
    parsed_json = json.dumps(req.parsed_data or {})
    
    execute("""
        INSERT INTO ocr_records (
            id, fir_number, year, district_id, district_name,
            station_id, station_name, act_section, crime_group,
            extracted_text, translated_text, parsed_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            extracted_text=excluded.extracted_text,
            translated_text=excluded.translated_text,
            parsed_data=excluded.parsed_data,
            created_at=CURRENT_TIMESTAMP
    """, (
        record_id, req.fir_number, req.year, req.district_id, req.district_name,
        req.station_id, req.station_name, req.act_section, req.crime_group,
        req.extracted_text, req.translated_text, parsed_json
    ))
    
    return {"status": "ok", "message": "OCR record saved to database", "record_id": record_id}


@router.get("/ocr/records")
async def get_ocr_records(q: Optional[str] = None, year: Optional[str] = None):
    """Retrieve stored OCR records across all cases and stations."""
    sql = "SELECT * FROM ocr_records WHERE 1=1"
    params = []
    if year:
        sql += " AND year = ?"
        params.append(year)
    if q:
        sql += " AND (fir_number LIKE ? OR district_name LIKE ? OR station_name LIKE ? OR extracted_text LIKE ? OR parsed_data LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
    sql += " ORDER BY created_at DESC LIMIT 100"
    
    rows = query(sql, tuple(params))
    results = []
    for r in rows:
        item = dict(r)
        if item.get("parsed_data"):
            try:
                item["parsed_data"] = json.loads(item["parsed_data"])
            except Exception:
                pass
        results.append(item)
    return {"status": "ok", "total": len(results), "records": results}


@router.get("/ocr/records/{record_id}")
async def get_single_ocr_record(record_id: str):
    """Retrieve single detailed OCR record."""
    row = query_one("SELECT * FROM ocr_records WHERE id = ?", (record_id,))
    if not row:
        raise HTTPException(status_code=404, detail="OCR record not found")
    item = dict(row)
    if item.get("parsed_data"):
        try:
            item["parsed_data"] = json.loads(item["parsed_data"])
        except Exception:
            pass
    return item


@router.post("/ocr/translate")
async def translate_ocr_content(req: TranslateOCRRequest, request: Request):
    """Dynamically translate raw OCR or FIR document text using Catalyst NLP."""
    res = await zia.translate_text(req.text, req.source_lang, req.target_lang, request=request)
    return res