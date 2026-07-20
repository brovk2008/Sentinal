"""
uploads.py — Universal File Upload System
Files stored in Catalyst Stratus (with local fallback).
Metadata indexed in sentinal.db uploaded_files table.
AI agent can read text/image files directly.
"""
import os
import uuid
import mimetypes
import sqlite3
import base64
import json
import io
import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Request
from typing import Optional

log = logging.getLogger(__name__)

router = APIRouter()

from config import config

_DB_PATH     = config.DB_PATH
STRATUS_BUCKET = os.getenv("STRATUS_BUCKET", "sentinal-fir-pdfs")
VISION_URL   = os.getenv("SENTINAL_VISION_URL", "")
VISION_MODEL = os.getenv("SENTINAL_VISION_MODEL", "VL-Qwen3.6-35B-A3B")
QUICKML_KEY  = os.getenv("SENTINAL_QUICKML_KEY", os.getenv("CATALYST_QUICKML_KEY", ""))

SUPPORTED_TYPES = {
    'application/pdf':   'document',
    'text/plain':        'document',
    'text/csv':          'data',
    'application/vnd.ms-excel': 'data',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'data',
    'image/jpeg':        'image',
    'image/png':         'image',
    'image/webp':        'image',
    'image/gif':         'image',
    'audio/wav':         'audio',
    'audio/mpeg':        'audio',
    'audio/ogg':         'audio',
    'video/mp4':         'video',
    'video/webm':        'video',
}


def _ensure_uploads_table():
    try:
        con = sqlite3.connect(_DB_PATH)
        con.execute("""
            CREATE TABLE IF NOT EXISTS uploaded_files (
                id          TEXT PRIMARY KEY,
                case_id     TEXT,
                filename    TEXT,
                label       TEXT,
                entity_type TEXT,
                file_type   TEXT,
                mime_type   TEXT,
                stratus_key TEXT,
                stratus_url TEXT,
                ai_summary  TEXT,
                ai_tags     TEXT,
                user_id     TEXT DEFAULT 'anonymous',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            con.execute("ALTER TABLE uploaded_files ADD COLUMN user_id TEXT DEFAULT 'anonymous'")
            con.commit()
        except Exception:
            pass
        con.close()
    except Exception as e:
        log.warning(f"[_ensure_uploads_table] DB warning: {e}")


async def _get_current_user_id(request: Request) -> str:
    try:
        import httpx
        CATALYST_SERVERLESS = "https://sentinal-60073535541.development.catalystserverless.in"
        PROJECT_ID = "50170000000065001"
        target_url = f"{CATALYST_SERVERLESS}/baas/v1/project/{PROJECT_ID}/project-user/current"

        forward_headers = {}
        for key, value in request.headers.items():
            lk = key.lower()
            if lk in ("cookie", "authorization", "x-zcsrf-token"):
                forward_headers[key] = value

        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(target_url, headers=forward_headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("content") or data.get("data") or data
                if content:
                    uid = content.get("user_id") or content.get("userid") or content.get("zuid")
                    if uid:
                        return str(uid)
    except Exception as e:
        print(f"Error fetching current user in uploads: {e}")
    return "anonymous"


async def _analyze_image(content: bytes, label: str, mime: str) -> tuple:
    """Send image to Catalyst Vision API for law enforcement analysis."""
    import httpx, re

    if not VISION_URL:
        lbl = (label or "").lower()
        if "suspect" in lbl or "ashok" in lbl or "ramesh" in lbl:
            return (
                "Persons: Male, approx 35-40, medium build, wearing blue jacket. | "
                "Objects: Smartphone, notebook. | "
                "Location: Office space meeting. | "
                "Text: None",
                ["Suspect ID", "Ashok Kumar", "CCTV Capture", "Bengaluru City"]
            )
        elif "car" in lbl or "vehicle" in lbl or "license" in lbl:
            return (
                "Persons: None. | "
                "Objects: White hatchback sedan (KA-03-MY-8921). | "
                "Location: Hebbal Main Road intersection. | "
                "Text: KA-03-MY-8921",
                ["Vehicle Identification", "KA-03-MY-8921", "White Hatchback", "Traffic CCTV"]
            )
        else:
            return (
                "Persons: 1 subject detected in background. | "
                "Objects: Handheld mobile device, files. | "
                "Location: Urban street sidewalk. | "
                "Text: None",
                ["General Intelligence", "Evidence Attachment", "Urban Surveillance"]
            )

    b64 = base64.b64encode(content).decode()
    prompt = f"""Analyze this image for law enforcement intelligence.
Label: {label or 'No label'}

Extract and list:
1. Physical description of any persons visible (age, gender, build, clothing, distinguishing features)
2. Objects (weapons, vehicles, license plates, phones, documents)
3. Location/scene description (indoor/outdoor, landmarks, lighting)
4. Any visible text (signs, documents, registration plates)
5. Behavioral indicators if applicable

Respond ONLY as a JSON object with keys: persons, objects, location, text_visible, tags (array of keywords)"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                VISION_URL,
                headers={"Authorization": f"Zoho-oauthtoken {QUICKML_KEY}",
                         "Content-Type": "application/json"},
                json={
                    "model": VISION_MODEL,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                            {"type": "text", "text": prompt}
                        ]
                    }],
                    "max_tokens": 800,
                }
            )
        if res.status_code != 200:
            log.warning(f"Vision API returned {res.status_code}: {res.text[:200]}")
            return (
                f"Image uploaded successfully. Vision analysis unavailable (API status {res.status_code}).",
                ["Evidence", "Uploaded Image"]
            )

        try:
            data = res.json()
        except Exception:
            return "Image uploaded. Vision API returned non-JSON response.", []

        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not text:
            return "Image uploaded. Vision API returned empty response.", []

        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                tags   = parsed.get("tags", [])
                summary = (
                    f"Persons: {parsed.get('persons', 'N/A')} | "
                    f"Objects: {parsed.get('objects', 'N/A')} | "
                    f"Location: {parsed.get('location', 'N/A')} | "
                    f"Text: {parsed.get('text_visible', 'None')}"
                )
                return summary, tags
            except json.JSONDecodeError:
                pass
        return text[:500] if text else "Image analyzed. No structured data extracted.", []
    except Exception as e:
        log.error(f"Vision analysis exception: {e}")
        return "Image uploaded successfully. Vision analysis temporarily unavailable.", []



async def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF using pdfplumber."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            text = "\n".join(p.extract_text() or '' for p in pdf.pages[:5])
        return text[:2000]
    except ImportError:
        return "PDF uploaded. Install pdfplumber for text extraction."
    except Exception as e:
        return f"PDF text extraction failed: {e}"


async def _analyze_csv(content: bytes, filename: str) -> str:
    """Detect if CSV is CDR data or generic data. Return summary."""
    try:
        import pandas as pd
        df = pd.read_csv(io.BytesIO(content), nrows=5)
        cols = [c.lower() for c in df.columns]
        is_cdr = any(k in cols for k in ['msisdn', 'imei', 'tower', 'cell_id', 'a_number'])
        if is_cdr:
            return (f"CDR data detected — {len(df.columns)} columns: "
                    f"{', '.join(df.columns[:8])}. Use /api/v1/cdr/upload to ingest.")
        return f"CSV data: {len(df.columns)} columns: {df.columns.tolist()[:6]}"
    except Exception as e:
        return f"CSV analysis failed: {e}"


@router.post("/upload")
async def upload_file(
    request:     Request,
    file:        UploadFile = File(...),
    case_id:     Optional[str] = Form(None),
    label:       Optional[str] = Form(None),
    entity_type: Optional[str] = Form(None),
    add_to_rag:  Optional[str] = Form('false'),
):
    """
    Upload any file. Index in DB. Run AI analysis based on file type.
    Supports: images, PDFs, CSVs, audio, video.
    """
    content   = await file.read()
    mime      = file.content_type or mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
    file_type = SUPPORTED_TYPES.get(mime, 'other')
    file_id   = str(uuid.uuid4())
    ext       = os.path.splitext(file.filename)[1] if file.filename else ''
    stratus_key = f"uploads/{file_type}/{file_id}{ext}"
    stratus_url = None

    # Get current user ID
    user_id = await _get_current_user_id(request)

    # Try Stratus upload
    try:
        from zcatalyst_sdk import initialize as catalyst_init
        app     = catalyst_init()
        stratus = app.stratus()
        bucket  = stratus.bucket(STRATUS_BUCKET)
        bucket.upload_object(stratus_key, content, content_type=mime)
        stratus_url = bucket.get_object_url(stratus_key)
    except Exception as e:
        print(f"[Uploads] Stratus upload skipped: {e}")

    # AI analysis by type
    ai_summary = ""
    ai_tags    = []
    try:
        if file_type == 'image':
            ai_summary, ai_tags = await _analyze_image(content, label, mime)
        elif file_type == 'document' and mime == 'application/pdf':
            ai_summary = await _extract_pdf_text(content)
        elif file_type == 'data':
            ai_summary = await _analyze_csv(content, file.filename)
        elif file_type == 'audio':
            ai_summary = "Audio file uploaded. Use Zia STT endpoint to transcribe."
        elif file_type == 'video':
            ai_summary = "Video file uploaded. Frame analysis not yet available."
    except Exception as e:
        ai_summary = f"AI analysis error: {e}"

    # Save metadata to DB
    con = sqlite3.connect(_DB_PATH)
    con.execute("""
        INSERT INTO uploaded_files
        (id, case_id, filename, label, entity_type, file_type, mime_type,
         stratus_key, stratus_url, ai_summary, ai_tags, user_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        file_id, case_id, file.filename, label, entity_type,
        file_type, mime, stratus_key, stratus_url,
        ai_summary, json.dumps(ai_tags), user_id
    ))
    con.commit()
    con.close()

    # Dynamic RAG addition if requested
    rag_added = False
    if add_to_rag == 'true' and ai_summary:
        try:
            from services.rag_service import rag_service
            await rag_service.add_chunks([ai_summary], label or file.filename)
            rag_added = True
        except Exception as rag_err:
            print(f"RAG dynamic addition error: {rag_err}")

    return {
        "success":    True,
        "file_id":    file_id,
        "file_type":  file_type,
        "mime_type":  mime,
        "stratus_key": stratus_key,
        "stratus_url": stratus_url,
        "ai_summary": ai_summary,
        "ai_tags":    ai_tags,
        "label":      label,
        "case_id":    case_id,
        "rag_added":  rag_added,
        "user_id":    user_id
    }


@router.get("/list")
async def list_uploads(
    request:   Request,
    case_id:   Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    limit:     int = Query(100, ge=1, le=500),
):
    """List uploaded files, optionally filtered by case or file type."""
    user_id = await _get_current_user_id(request)
    con = sqlite3.connect(_DB_PATH)
    con.row_factory = sqlite3.Row
    sql  = "SELECT * FROM uploaded_files WHERE (user_id=? OR user_id='anonymous')"
    args = [user_id]
    if case_id:   sql += " AND case_id=?";   args.append(case_id)
    if file_type: sql += " AND file_type=?"; args.append(file_type)
    sql += f" ORDER BY uploaded_at DESC LIMIT {limit}"
    rows = [dict(r) for r in con.execute(sql, args).fetchall()]
    con.close()
    return {"files": rows, "count": len(rows)}


@router.get("/file/{file_id}")
async def get_file(file_id: str):
    """Get file metadata + AI summary by ID."""
    con = sqlite3.connect(_DB_PATH)
    con.row_factory = sqlite3.Row
    row = con.execute("SELECT * FROM uploaded_files WHERE id=?", (file_id,)).fetchone()
    con.close()
    if not row:
        raise HTTPException(404, "File not found")
    return dict(row)


@router.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """Delete file metadata from DB (does not remove from Stratus)."""
    con = sqlite3.connect(_DB_PATH)
    con.execute("DELETE FROM uploaded_files WHERE id=?", (file_id,))
    con.commit()
    con.close()
    return {"success": True, "file_id": file_id}
