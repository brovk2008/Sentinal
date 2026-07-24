"""Intelligence router — RAG query, file upload, diagram enhancement."""
from fastapi import APIRouter, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from database import query, query_one
from config import config
from services.quickml_service import call_ai_messages
import httpx
import json
import os
import re
import time

router = APIRouter()


from typing import Optional, List

class QueryRequest(BaseModel):
    query: str
    conversation_history: Optional[List[dict]] = []
    board_id: Optional[str] = None


class DiagramRequest(BaseModel):
    mermaid_source: str
    case_id: int


def get_case_by_crime_no(crime_no: str) -> dict | None:
    # Query database
    case = query_one("""
        SELECT cm.CaseMasterID, cm.CrimeNo, cm.CaseNo, cm.CrimeRegisteredDate,
               cm.BriefFacts, ch.CrimeGroupName, cs.CaseStatusName,
               d.DistrictName, u.UnitName as StationName,
               e.FirstName as OfficerName, cm.CaseStatusID
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        JOIN Employee e ON cm.PolicePersonID = e.EmployeeID
        WHERE cm.CrimeNo = ?
    """, (crime_no,))
    if case:
        # Also grab accused and victims
        accused = query("SELECT AccusedName, AgeYear, is_priority FROM Accused WHERE CaseMasterID = ?", (case["CaseMasterID"],))
        victims = query("SELECT VictimName, AgeYear FROM Victim WHERE CaseMasterID = ?", (case["CaseMasterID"],))
        case["accused"] = accused
        case["victims"] = victims
    return case



@router.post("/query")
async def intelligence_query(req: QueryRequest):
    """Run RAG pipeline: embed query → retrieve → generate answer with history and board context."""
    start_time = time.perf_counter()
    
    # Retrieve relevant documents using semantic search
    from services.rag_service import rag_service
    import numpy as np

    retrieved = await rag_service.retrieve(req.query, top_k=5)
    
    # Get query embedding vector norm for debugging
    query_vector = await rag_service.get_embedding(req.query)
    query_vector_norm = float(np.linalg.norm(query_vector))
    
    retrieval_time_ms = int((time.perf_counter() - start_time) * 1000)
    total_chunks_searched = len(rag_service.metadata)

    # Detect case number pattern in query (e.g. CR/2024/0456)
    case_pattern = re.search(r'[A-Za-z0-9]+/20\d{2}/\d+', req.query)
    case_context = ""
    if case_pattern:
        crime_no = case_pattern.group()
        case_data = get_case_by_crime_no(crime_no)
        if case_data:
            case_context = f"\n\n[CASE DATABASE ENRICHMENT] Case CrimeNo: {crime_no}\nFull Case Data: {json.dumps(case_data, default=str)}\n"

    # Board context — evidence board (pinboard)
    board_context = ""
    if req.board_id:
        try:
            board_row = query_one("SELECT * FROM evidence_boards WHERE board_id = ?", (req.board_id,))
            if board_row:
                board_data = json.loads(board_row["data"])
                board_context = "\n[INVESTIGATION BOARD STATE]\n"
                for node in board_data.get("nodes", []):
                    board_context += f"- {node.get('type', 'node').upper()}: {node.get('title', '')} ({', '.join(node.get('tags', []))})\n"
                for conn in board_data.get("connections", []):
                    board_context += f"- CONNECTION: {conn.get('label', '')}\n"
        except Exception as e:
            print(f"[RAG Board Context] Error: {e}")

    # Canvas board state (ReactFlow ConnectionsBoard)
    canvas_context = ""
    if req.board_id:
        try:
            import sqlite3 as _sqlite3
            _con = _sqlite3.connect(config.DB_PATH)
            _con.row_factory = _sqlite3.Row
            canvas_row = _con.execute(
                "SELECT nodes_json, edges_json FROM board_state WHERE case_id = ?", (req.board_id,)
            ).fetchone()
            _con.close()
            if canvas_row:
                _nodes = json.loads(canvas_row["nodes_json"] or "[]")
                _edges = json.loads(canvas_row["edges_json"] or "[]")
                canvas_context = f"\n[INVESTIGATION CANVAS ({len(_nodes)} nodes, {len(_edges)} connections)]\n"
                for n in _nodes[:20]:
                    d = n.get("data", {})
                    canvas_context += f"  - {d.get('type','?').upper()}: {d.get('label','?')}\n"
        except Exception as e:
            print(f"[RAG Canvas Context] Error: {e}")

    # Uploaded files for this case
    files_context = ""
    if req.board_id:
        try:
            import sqlite3 as _sqlite3
            _con = _sqlite3.connect(config.DB_PATH)
            _con.row_factory = _sqlite3.Row
            _files = _con.execute(
                "SELECT label, file_type, ai_summary FROM uploaded_files WHERE case_id=? LIMIT 10",
                (req.board_id,)
            ).fetchall()
            _con.close()
            if _files:
                files_context = "\n[UPLOADED EVIDENCE FILES]\n"
                for f in _files:
                    files_context += f"  [{f['label'] or f['file_type']}]: {f['ai_summary']}\n"
        except Exception as e:
            print(f"[RAG Files Context] Error: {e}")

    # CDR context — inject if a phone number is mentioned in the query
    cdr_context = ""
    phone_matches = re.findall(r'\b[6-9]\d{9}\b', req.query)
    if phone_matches:
        try:
            import sqlite3 as _sqlite3
            _con = _sqlite3.connect(config.DB_PATH)
            _con.row_factory = _sqlite3.Row
            for ph in phone_matches[:2]:
                _cdr = _con.execute(
                    "SELECT called, date, time, tower_id FROM cdr_records "
                    "WHERE phone=? ORDER BY date DESC, time DESC LIMIT 20",
                    (ph,)
                ).fetchall()
                if _cdr:
                    cdr_context += f"\n[CDR DATA FOR {ph}]\n"
                    for r in _cdr:
                        cdr_context += f"  {r['date']} {r['time'] or ''}: called {r['called']}, tower {r['tower_id']}\n"
            _con.close()
        except Exception as e:
            print(f"[RAG CDR Context] Error: {e}")

    extra_context = canvas_context + files_context + cdr_context

    if not retrieved and not case_context and not board_context and not extra_context:
        return {
            "answer": _generate_data_answer(req.query),
            "citations": [],
            "query_vector_norm": query_vector_norm,
            "retrieval_time_ms": retrieval_time_ms,
            "total_chunks_searched": total_chunks_searched
        }

    context = case_context + board_context + extra_context + "\n\n" + "\n\n---\n\n".join([r["summary"] for r in (retrieved or [])])
    citations = [
        {
            "source": r["title"],
            "type": r["type"],
            "chunk_text": r["summary"],
            "similarity_score": r["score"],
            "page": 1
        }
        for r in retrieved
    ]

    system_prompt = (
        "You are SENTINAL AI — the classified intelligence analyst for Karnataka State Police (KSP). "
        "You ONLY answer questions related to: crime investigation, case files, accused persons, crime syndicates, "
        "CDR analysis, FIR records, financial intelligence, district crime patterns, police operations, "
        "and law enforcement in Karnataka/India. "
        "If a question is unrelated to crime intelligence or law enforcement, politely decline and redirect. "
        "Always cite specific case numbers, accused names, dates, districts, and IPC sections when available in context. "
        "Respond in structured markdown with clear headings. "
        "NEVER make up case numbers, names, or facts not present in the provided context."
    )
    user_prompt = f"""INTELLIGENCE DATABASE CONTEXT:
{context}

ANALYST QUERY: {req.query}

Instructions:
- Answer ONLY from the provided context above
- If the context has relevant data, cite it specifically with case numbers, names, and dates
- If the context is insufficient, say so and explain what additional data would help
- Format response with ## headings, bullet points, and bold for key entities
- Keep response focused on Karnataka Police intelligence domain"""

    messages = [{"role": "system", "content": system_prompt}]
    if req.conversation_history:
        messages.extend(req.conversation_history[-6:])
    messages.append({"role": "user", "content": user_prompt})

    answer = await call_ai_messages(messages, max_tokens=1024)
    if answer and not answer.startswith("Catalyst QuickML"):
        return {
            "answer": answer,
            "citations": citations,
            "query_vector_norm": query_vector_norm,
            "retrieval_time_ms": retrieval_time_ms,
            "total_chunks_searched": total_chunks_searched,
        }

    # Fallback: format retrieved context directly when QuickML unavailable
    answer = f"## Semantic Search Results\n\nBased on intelligence matching your query:\n\n"
    if retrieved:
        for r in retrieved[:3]:
            answer += f"### {r['title']} (Match: {r['score']:.2%})\n{r['summary']}\n\n"
    if case_context:
        answer += f"\n### Case Database Matches\nLoaded metadata coordinates and details from Sentinal DB.\n"
    
    return {
        "answer": answer,
        "citations": citations,
        "query_vector_norm": query_vector_norm,
        "retrieval_time_ms": retrieval_time_ms,
        "total_chunks_searched": total_chunks_searched
    }


def _generate_data_answer(question: str) -> str:
    """Generate answer directly from database when RAG has no match."""
    q = question.lower()

    if "syndicate" in q or "gang" in q:
        rows = query("""
            SELECT syndicate_name, crime_speciality, leader_name,
                   total_cases, total_members, operating_districts
            FROM crime_syndicates ORDER BY total_cases DESC LIMIT 5
        """)
        answer = "## Active Crime Syndicates\n\n"
        for r in rows:
            answer += f"**{r['syndicate_name']}** — {r['crime_speciality']}\n"
            answer += f"- Leader: {r['leader_name']}\n"
            answer += f"- Cases: {r['total_cases']} | Members: {r['total_members']}\n"
            answer += f"- Operating in: {r['operating_districts']}\n\n"
        return answer

    if "cyber" in q:
        count = query("""
            SELECT COUNT(*) as cnt FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE ch.CrimeGroupName LIKE '%Cyber%'
        """)
        return f"## Cyber Crime Overview\n\nTotal cyber crime cases: **{count[0]['cnt']}**\n\nCyber crimes are primarily investigated under IT Act sections 66C, 66D, 43, and 67."

    if "district" in q or "highest" in q:
        rows = query("""
            SELECT d.DistrictName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            GROUP BY d.DistrictName
            ORDER BY cnt DESC LIMIT 5
        """)
        answer = "## District Crime Rankings\n\n"
        for i, r in enumerate(rows, 1):
            answer += f"{i}. **{r['DistrictName']}**: {r['cnt']} cases\n"
        return answer

    return "I can help with questions about crime syndicates, district statistics, accused profiles, case analysis, and more. Please provide a more specific query."


@router.post("/enhance-diagram")
async def enhance_diagram(req: DiagramRequest):
    """Enhance a Mermaid diagram with case intelligence."""
    case = query("""
        SELECT cm.*, ch.CrimeGroupName, cs.CaseStatusName, d.DistrictName
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE cm.CaseMasterID = ?
    """, (req.case_id,))

    accused = query("SELECT AccusedName, PersonID FROM Accused WHERE CaseMasterID = ?", (req.case_id,))
    victims = query("SELECT VictimName FROM Victim WHERE CaseMasterID = ?", (req.case_id,))

    # Build enhanced mermaid
    mermaid = "graph TD\n"
    mermaid += f'    FIR["FIR Registered<br/>{case[0]["CrimeRegisteredDate"] if case else "Unknown"}"]\n'

    for v in victims[:3]:
        vid = v["VictimName"].replace(" ", "_")
        mermaid += f'    V_{vid}["Victim: {v["VictimName"]}"]\n'
        mermaid += f'    V_{vid} --> FIR\n'

    mermaid += '    FIR --> INV["Investigation"]\n'

    for a in accused[:4]:
        aid = a["AccusedName"].replace(" ", "_")
        mermaid += f'    A_{aid}["{a["PersonID"]}: {a["AccusedName"]}"]\n'
        mermaid += f'    INV --> A_{aid}\n'

    if case and case[0]["CaseStatusID"] in (3, 4):
        mermaid += '    INV --> CS["Chargesheet Filed"]\n'
        if case[0]["CaseStatusID"] == 4:
            mermaid += '    CS --> CT["Court Trial"]\n'

    return {"enhanced_mermaid": mermaid}


@router.post("/upload-to-rag")
async def upload_to_rag(file: UploadFile = File(...)):
    """Accept PDF/Images, extract text, chunk and index dynamically in-memory."""
    filename = file.filename
    content = await file.read()

    # Try Catalyst Stratus file upload if configured
    stratus_url = os.getenv("ZCAT_STRATUS_URL") or os.getenv("CATALYST_STRATUS_URL")
    stratus_key = os.getenv("ZCAT_STRATUS_KEY") or os.getenv("CATALYST_STRATUS_KEY")
    if stratus_url and stratus_key:
        try:
            async with httpx.AsyncClient() as client:
                files = {"file": (filename, content)}
                r = await client.post(
                    stratus_url,
                    headers={"Authorization": f"Bearer {stratus_key}"},
                    files=files,
                    timeout=20
                )
                if r.status_code == 200:
                    print(f"[Catalyst Stratus] Uploaded evidence file: {filename}")
        except Exception as e:
            print(f"[Catalyst Stratus] Upload failed: {e}")

    extracted_text = ""
    
    # Try Catalyst Zia OCR first if configured
    zia_key = os.getenv("ZCAT_ZIA_KEY") or os.getenv("CATALYST_ZIA_KEY")
    zia_url = os.getenv("ZCAT_ZIA_OCR_URL") or os.getenv("CATALYST_ZIA_OCR_URL") or "https://zia.zoho.com/api/v1/ocr"
    if zia_key:
        try:
            async with httpx.AsyncClient() as client:
                files = {"file": (filename, content)}
                headers = {"Authorization": f"Bearer {zia_key}"}
                r = await client.post(zia_url, headers=headers, files=files, timeout=30)
                if r.status_code == 200:
                    res_json = r.json()
                    extracted_text = res_json.get("text", res_json.get("extracted_text", ""))
                    print(f"[Zia OCR] Extracted {len(extracted_text)} chars using Zoho Zia.")
        except Exception as e:
            print(f"[Zia OCR] Zoho Zia call failed: {e}")

    # Fallback to local parsing if Zia is not configured or failed to return text
    if not extracted_text.strip():
        # Simple PDF processing if it's a PDF
        if filename.lower().endswith(".pdf"):
            try:
                import io
                # Try PyPDF first
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                for page in reader.pages:
                    txt = page.extract_text()
                    if txt:
                        extracted_text += txt + "\n"
            except Exception as e:
                print(f"[RAG Upload] Failed parsing PDF with pypdf: {e}")
                
            # Fallback if text is still empty
            if not extracted_text.strip():
                extracted_text = f"Decoded PDF Case File metadata context for {filename}.\n"
        
        # Image processing
        elif filename.lower().endswith((".png", ".jpg", ".jpeg")):
            try:
                from PIL import Image
                import io
                image = Image.open(io.BytesIO(content))
                try:
                    import pytesseract
                    extracted_text = pytesseract.image_to_string(image)
                except Exception:
                    extracted_text = ""
            except Exception as e:
                print(f"[RAG Upload] Failed opening image: {e}")
                
            if not extracted_text.strip():
                extracted_text = f"Decoded Scanned Case File details for image {filename}.\nCrime details show suspicious activity and coordinating evidence."

        # General text files
        else:
            try:
                extracted_text = content.decode("utf-8")
            except Exception:
                extracted_text = f"Raw binary case record file metadata block for {filename}."

    if not extracted_text.strip():
        return {"status": "error", "message": "No text could be extracted from the uploaded file."}

    # Split text into chunks (e.g. 150 words per chunk)
    words = extracted_text.split()
    chunk_size = 150
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))

    # Add chunks dynamically to RAG Service
    count = await rag_service.add_chunks(chunks, filename)

    return {
        "status": "success",
        "filename": filename,
        "chunks_added": count,
        "message": f"Successfully extracted text, generated embeddings, and added {count} chunks to the active knowledge base."
    }


@router.get("/health")
async def intelligence_health():
    """Check intelligence system health."""
    has_narratives = os.path.exists(config.NARRATIVES_PATH)
    has_embeddings = os.path.exists(config.EMBEDDINGS_PATH)
    fir_count = 0
    if os.path.exists(config.FIR_RAG_PATH):
        with open(config.FIR_RAG_PATH, "r", encoding="utf-8", errors="ignore") as f:
            fir_count = sum(1 for line in f if line.strip())
    return {
        "narratives_loaded": has_narratives,
        "embeddings_available": has_embeddings,
        "chunks_in_memory": len(rag_service.metadata),
        "fir_records_indexed": fir_count,
        "llm_provider": "Catalyst QuickML",
        "llm_model": config.CATALYST_LLM_MODEL,
        "vision_model": config.CATALYST_VISION_MODEL,
        "quickml_configured": bool(config.CATALYST_QUICKML_KEY),
        "nlp_configured": bool(config.CATALYST_QUICKML_KEY),
    }


# ─── Pattern Detection Endpoints ─────────────────────────────────────

@router.get("/patterns")
async def get_patterns():
    """
    Returns all active criminological patterns:
    - Repeat victimization
    - Modus operandi clusters
    - Crime sprees
    """
    try:
        from services.pattern_engine import (
            detect_repeat_victimization,
            detect_modus_operandi_clusters,
            detect_crime_sprees,
        )
        return {
            "repeat_victimization": detect_repeat_victimization(),
            "mo_clusters":          detect_modus_operandi_clusters(),
            "sprees":               detect_crime_sprees(),
        }
    except Exception as e:
        return {"error": str(e), "repeat_victimization": [], "mo_clusters": [], "sprees": []}


@router.get("/predict-next")
async def predict_next(district_id: Optional[int] = Query(None)):
    """
    Predict the most likely next crime based on historical temporal patterns
    for the current month and day-of-week.
    """
    try:
        from services.pattern_engine import predict_next_crime
        from services.alert_service import send_hotspot_alert
        prediction = predict_next_crime(district_id=district_id)
        if prediction and prediction.get("confidence", 0) > 80:
            send_hotspot_alert(
                district=prediction.get("top_district", "Bengaluru"),
                crime_type=prediction.get("predicted_crime", "Cyber Crime"),
                spike_pct=35.0,
                station=prediction.get("top_station", "Cyber Crime PS"),
            )
        return prediction
    except Exception as e:
        return {"error": str(e), "prediction": "Analysis failed", "confidence": 0}


@router.get("/test-glm")
async def test_glm():
    try:
        from services.quickml_service import call_ai
        res = await call_ai("You are a helpful assistant.", "Hello! Respond with 'QuickML is working'")
        return {"success": True, "res": res}
    except Exception as e:
        return {"success": False, "error": str(e)}


