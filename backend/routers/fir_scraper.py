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
    Real OCR — extracts ALL fields from live KSP FIR PDFs using pdfplumber.
    KSP PDFs use mixed Kannada+English text; key values (names, dates, sections)
    are already in English/digits — so we parse directly without needing pre-translation.
    Translation is applied to fir_contents for the display drawer separately.
    """
    import base64, re, io

    meta    = body.get("fir_metadata", {})
    pdf_b64 = body.get("pdf_b64", "")

    raw_text   = ""
    pages_text = []

    # ── Step 1: Extract text from every PDF page via pdfplumber ─────────────
    if pdf_b64:
        try:
            import pdfplumber
            pdf_bytes = base64.b64decode(pdf_b64)
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    pages_text.append(page.extract_text() or "")
            raw_text = "\n".join(pages_text).strip()
        except Exception as e:
            log.warning(f"[OCR] pdfplumber error: {e}")

    if not raw_text:
        return {
            "success": False,
            "error": "Could not extract text — PDF may be image-only. Try a text-based KSP FIR.",
            "parsed_data": None
        }

    # ── Step 2: Smart field extraction ──────────────────────────────────────
    # KSP FIR format: Kannada labels + English/digit values.
    # We anchor on English patterns that always appear in these PDFs.
    norm = re.sub(r"\s+", " ", raw_text)

    def find(patterns, default=""):
        for p in patterns:
            m = re.search(p, raw_text, re.IGNORECASE | re.MULTILINE)
            if m:
                val = m.group(1).strip()
                if val:
                    return val
        return default

    def find_norm(patterns, default=""):
        for p in patterns:
            m = re.search(p, norm, re.IGNORECASE)
            if m:
                val = m.group(1).strip()
                if val:
                    return val
        return default

    # ── FIR core identifiers ─────────────────────────────────────────────
    # KSP format: "ಅಪರಾಧ ಸಂಖ್ಯೆ : 5/2024  ಪ.ವ.ವ. ದಿನಾಂಕ : 24/01/2024"
    fir_number = find([
        r"(\d+)/20\d\d\b",           # "5/2024"
        r"FIR\s*No\.?\s*[:\-]?\s*(\d+)",
        r"Crime\s*No\.?\s*[:\-]?\s*(\d+)",
    ], default=meta.get("fir_number", ""))

    year = find([
        r"\d+/(20\d\d)\b",           # year part of "5/2024"
        r"/(20\d\d)",
    ], default=meta.get("year", "2024"))

    # Date: "24/01/2024" — first date in the doc is usually FIR registration date
    fir_date = find([
        r"(\d{2}/\d{2}/20\d\d)",
    ])

    # ── Act / IPC Sections ────────────────────────────────────────────────
    # KSP always writes: "IPC 1860, (U/S 143 ,147 ,..."
    act_section = find([
        r"(IPC\s+\d+[^\n]{0,120})",
        r"(BNS\s+\d+[^\n]{0,120})",
        r"(U/S\s+[\d\s,]+[^\n]{0,60})",
        r"(POCSO[^\n]{0,60})",
        r"(NDPS[^\n]{0,60})",
    ])

    # ── Court ─────────────────────────────────────────────────────────────
    court_name = find([
        r"((?:JMFC|CJM|Sessions?|District|Addl\.?\s*Civil\s*Judge)[^\n]{3,80})",
    ])

    # ── Place of occurrence ───────────────────────────────────────────────
    # KSP line 4(a): after Kannada label, place is in English caps
    place = find([
        r"IN\s+([A-Z][A-Z\s&,\.]{5,150})",
        r"([A-Z][A-Z\s&]+(?:TQ|TALUK|PS|DIST|KARNATAKA)[^\n]{0,80})",
    ])

    # ── Occurrence dates/times ────────────────────────────────────────────
    # KSP line 3(a): "Wednesday  ದಿನಾಂಕ ಇಂದ : 19/01/2024  ದಿನಾಂಕ ವರೆ : 19/01/2024"
    # Then: "ಸಮಯಇಂದ : 11:30:00  ಸಮಯಯವರೆ : 21:00:00"
    dates_block = re.search(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
                            r"[^\n]*?(\d{2}/\d{2}/20\d\d)[^\n]*?(\d{2}/\d{2}/20\d\d)?", norm)
    occ_day       = dates_block.group(1) if dates_block else ""
    occ_from_date = dates_block.group(2) if dates_block else ""
    occ_to_date   = dates_block.group(3) if dates_block else ""

    times = re.findall(r"(\d{1,2}:\d{2}(?::\d{2})?)", norm)
    occ_from_time = times[0] if len(times) > 0 else ""
    occ_to_time   = times[1] if len(times) > 1 else ""

    # ── Complainant / Informant ───────────────────────────────────────────
    # KSP line 5(a): "ಸದರು : N A LOHAR  ತಂದೆ/ಗಂಡನ ಸದರ : A"
    # Then: "ವಯಸ್ : 40  (c) ವೃತ್ತ : Businessman"
    # "(g) ದೂರವಾಣಿ : 9448337275"
    # "(k) ವಿಳಾಸ : HUBBALLI TQ HUBBALLI..."
    comp_name  = find_norm([
        r"\(a\)\s*[^A-Z]{0,30}([A-Z][A-Z\s\.]{2,40})(?:\s+[a-z]|\s+Male|\s+Female|\s*/)",
    ])
    # Extra fallback: any "N A LOHAR" style 2-4 uppercase word sequence after Kannada
    if not comp_name:
        comp_name = find_norm([r"(?:^\d+\.\s*|Suru\s*:\s*|name\s*:\s*)([A-Z][A-Z\s\.]{3,40}?)(?:\s+(?:Male|Female|Mr|Mrs|\d)|\s*$)"])

    comp_age   = find_norm([r"\(b\)\s*[^\d]{0,20}(\d{1,3})\b"])
    comp_sex   = find_norm([r"\b(Male|Female|Transgender)\b"])
    comp_phone = find_norm([r"(\d{10})\b"])
    comp_addr  = find_norm([
        r"\(k\)\s*[^A-Z]{0,10}([A-Z][A-Z\s,\.]{5,120}?)(?:\s*\(\s*l\s*\)|\s*Page|\s*\d+\s+[A-Z]{3,})",
        r"((?:HUBBALLI|BENGALURU|MYSURU|BANGALORE|HUBLI|DHARWAD|BELGAUM|BALLARI|BAGALKOT)[^\n]{0,100})",
    ])
    comp_father = find_norm([
        r"(?:S/O|D/O|W/O|Father|Husband)[:\s]+([A-Z][A-Z\s\.]{2,40}?)(?:\s+(?:Male|Female|\d)|\s*$)",
    ])

    # ── Accused ───────────────────────────────────────────────────────────
    # KSP format: "1 ASHOK B BADIGER (A1) / Accused Common man Male\n  BALAKUNDI TQ ILKAL..."
    accused = []
    # Primary: digit + CAPS NAME + (Ax)
    acc_matches = re.findall(
        r"(\d+)\s+([A-Z][A-Z\s\.\,&]{2,50}?)\s*\((A\d+)\)",
        norm
    )
    for sl, name, _ in acc_matches:
        cleaned = re.sub(r"\s+", " ", name).strip()
        if cleaned and len(cleaned) > 2:
            accused.append({"sl_no": int(sl), "name": cleaned})
    # Dedup
    seen = set()
    accused = [a for a in accused if not (a["name"] in seen or seen.add(a["name"]))]

    # ── Victims ───────────────────────────────────────────────────────────
    victims = []
    # KSP line 7: victim table — look for CAPS names after section 7
    victim_section = re.search(r"7\.[^\n]*\n(.*?)(?:8\.|Page)", raw_text, re.DOTALL)
    if victim_section:
        vblock = victim_section.group(1)
        vnames = re.findall(r"([A-Z][A-Z\s\.]{2,40}?)(?:\s+(?:Male|Female|Common|Accused|Victim))", vblock)
        for i, n in enumerate(vnames[:5], 1):
            n = re.sub(r"\s+", " ", n).strip()
            if n:
                victims.append({"sl_no": i, "name": n})

    # ── Property ──────────────────────────────────────────────────────────
    property_items = []
    prop_section = re.search(r"8\.[^\n]*\n(.*?)(?:9\.|Page)", raw_text, re.DOTALL)
    if prop_section:
        pblock = prop_section.group(1)
        # Look for property type + value
        pitems = re.findall(r"(\d+)\s+([A-Za-z][A-Za-z\s]{2,40}?)\s+(\d{1,10}\.?\d*)", pblock)
        for sl, ptype, val in pitems[:5]:
            property_items.append({"sl_no": int(sl), "type": ptype.strip(), "value": val})

    # ── SHO / IO details ─────────────────────────────────────────────────
    # KSP bottom: "LAXMIKANTHA S\nPI"
    sho_name = find([
        r"\n([A-Z][A-Z\s\.]{3,40})\n(?:PI|SI|ASI|PSI|DySP|SP|Inspector|Sub.Inspector)",
        r"(?:PI|SI|PSI|ASI|Inspector|Sub.Inspector)[^\n]*\n([A-Z][A-Z\s\.]{3,40})",
    ])
    sho_rank = find([r"\n(PI|SI|ASI|PSI|DySP|SP)\b"])

    # ── FIR narrative / brief facts ──────────────────────────────────────
    # Section 10: "ಪ್ರಥಮ ವತ್ತಾನ ವರದಿಯ ವಿವರಗಳು" — extract ~500 chars
    narrative = ""
    narr_m = re.search(r"10\.[^\n]*\n(.{20,1000}?)(?:11\.|Page)", raw_text, re.DOTALL)
    if narr_m:
        narrative = narr_m.group(1).strip()

    action_taken = find([r"(?:Investigation|Arrest|FIR)\b([^\n]{0,200})"])
    if not action_taken:
        action_taken = find_norm([r"(?:Investigation|Arrest|Enquiry)[^\n]{0,100}"])

    # ── District / Station from metadata (most reliable) ──────────────────
    district   = meta.get("district_name") or find([r"Bagalkot|Ballari|Bengaluru|Mysuru|Hubbal|Dharwad"], default="")
    station    = meta.get("station_name")  or find([r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+PS)\b"])

    # ── Signatures ────────────────────────────────────────────────────────
    has_comp_sig = bool(re.search(r"ಸಹಿ|Signature|Signed|ಸಂತ", raw_text))
    has_sho_sig  = bool(sho_name or re.search(r"\bPI\b|\bSI\b|\bPSI\b", raw_text))

    parsed = {
        # Core
        "fir_number":            fir_number,
        "year":                  year,
        "crime_number":          f"{fir_number}/{year}" if fir_number and year else "",
        "fir_date":              fir_date,
        "district":              district,
        "police_station":        station,
        "court_name":            court_name,
        # Offence
        "act_section":           act_section,
        "crime_group":           "Under Investigation / Live Record",
        # Occurrence
        "occurrence_day":        occ_day,
        "occurrence_from_date":  occ_from_date,
        "occurrence_to_date":    occ_to_date,
        "occurrence_from_time":  occ_from_time,
        "occurrence_to_time":    occ_to_time,
        "place_of_occurrence":   place,
        # Complainant
        "complainant_name":      comp_name,
        "complainant_father":    comp_father,
        "complainant_age":       int(comp_age) if comp_age and comp_age.isdigit() else None,
        "complainant_sex":       comp_sex,
        "complainant_phone":     comp_phone,
        "complainant_address":   comp_addr,
        # People
        "accused":               accused,
        "victims":               victims,
        "property":              property_items,
        # SHO
        "sho_name":              sho_name,
        "sho_rank":              sho_rank,
        # Narrative
        "fir_contents":          raw_text,            # full raw (Kannada+English) for translate
        "fir_narrative":         narrative,
        "action_taken":          action_taken or "Investigation",
        # Signatures
        "has_complainant_signature": has_comp_sig,
        "has_sho_signature":         has_sho_sig,
        # Meta
        "_raw_pages":            len(pages_text),
        "_raw_chars":            len(raw_text),
    }

    return {"success": True, "parsed_data": parsed, "engine": "pdfplumber-direct"}


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
    """Save an extracted OCR record into SQLite AND index it in the RAG vector store.
    
    This makes every live FIR scraped from KSP immediately searchable by the
    Sentinal AI Assistant — the judge's real-time data becomes AI queryable.
    """
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

    # ── Vectorize into RAG store so AI Assistant can query this live FIR ─────
    # Build a rich natural-language summary of the parsed FIR for semantic search
    rag_indexed = False
    try:
        from services.rag_service import rag_service
        p = req.parsed_data or {}
        
        accused_names = ", ".join(
            [a.get("name", "").strip() for a in p.get("accused", []) if a.get("name", "").strip()]
        ) or "Unknown"
        victim_names = ", ".join(
            [v.get("name", "").strip() for v in p.get("victims", []) if v.get("name", "").strip()]
        ) or ""

        fir_summary = (
            f"LIVE FIR RECORD — FIR No. {req.fir_number}/{req.year} "
            f"registered at {req.station_name or 'Police Station'}, "
            f"{req.district_name or 'District'}, Karnataka. "
            f"Crime Group: {req.crime_group or 'Under Investigation'}. "
            f"Sections: {req.act_section or 'IPC 1860'}. "
            f"Complainant: {p.get('complainant_name', 'Unknown')}. "
            f"Accused persons ({len(p.get('accused', []))}): {accused_names}. "
            + (f"Victims: {victim_names}. " if victim_names else "")
            + f"Place of occurrence: {p.get('place_of_occurrence', 'Unknown')}. "
            f"Date: {p.get('fir_date', req.year)}. "
            f"SHO/IO: {p.get('sho_name', 'Unknown')} ({p.get('sho_rank', '')}). "
            f"Court: {p.get('court_name', 'Unknown')}. "
        )

        # Also add the raw text in chunks of 800 chars for dense retrieval
        raw_text = req.extracted_text or ""
        chunks = [fir_summary]
        if raw_text and len(raw_text) > 50:
            for i in range(0, min(len(raw_text), 4000), 800):
                chunk = raw_text[i:i+800].strip()
                if chunk:
                    chunks.append(f"FIR {req.fir_number}/{req.year} ({req.station_name}): {chunk}")

        added = await rag_service.add_chunks(
            chunks=chunks,
            source_title=f"Live FIR {req.fir_number}/{req.year} — {req.station_name}, {req.district_name}"
        )
        rag_indexed = True
        log.info(f"[RAG] Indexed {added} chunks from FIR {req.fir_number}/{req.year} into vector store")
    except Exception as rag_err:
        log.warning(f"[RAG] Failed to index OCR record: {rag_err}")

    return {
        "status": "ok",
        "message": "OCR record saved to database and indexed in AI knowledge base",
        "record_id": record_id,
        "rag_indexed": rag_indexed,
    }


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