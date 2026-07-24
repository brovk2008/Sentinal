from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import json
import base64
from datetime import datetime
from database import query, execute, query_one
from services.quickml_service import call_ai

router = APIRouter()

# ── Board DB initialization is handled centrally by init_db.init_all_tables() in main.py
# Tables: evidence_boards, board_state are created at startup.


# ─── Canvas Board (ReactFlow) schemas ────────────────────────────────

class CanvasSaveRequest(BaseModel):
    case_id: str
    nodes: list
    edges: list


# Pydantic Schemas
class BoardSaveRequest(BaseModel):
    board_id: str
    name: str
    nodes: list
    connections: list

# ─── Endpoints ───────────────────────────────────────────────────────

@router.get("/list")
def list_boards():
    try:
        rows = query("SELECT board_id, name, data, updated_at FROM evidence_boards ORDER BY updated_at DESC")
        results = []
        for r in rows:
            try:
                board_data = json.loads(r["data"])
                node_count = len(board_data.get("nodes", []))
            except:
                node_count = 0
            results.append({
                "board_id": r["board_id"],
                "name": r["name"],
                "node_count": node_count,
                "updated_at": r["updated_at"]
            })
        return results
    except Exception as e:
        raise HTTPException(500, f"Failed to list boards: {e}")

@router.get("/load/{board_id}")
def load_board(board_id: str):
    row = query_one("SELECT * FROM evidence_boards WHERE board_id = ?", (board_id,))
    if not row:
        raise HTTPException(404, "Evidence Board not found.")
    try:
        board_data = json.loads(row["data"])
        return {
            "board_id": row["board_id"],
            "name": row["name"],
            "nodes": board_data.get("nodes", []),
            "connections": board_data.get("connections", []),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"]
        }
    except Exception as e:
        raise HTTPException(500, f"Error decoding board data: {e}")

@router.post("/save")
def save_board(request: BoardSaveRequest):
    now = datetime.now().isoformat()
    board_data = {
        "nodes": request.nodes,
        "connections": request.connections
    }
    data_str = json.dumps(board_data)
    try:
        # Check if exists
        exists = query_one("SELECT board_id FROM evidence_boards WHERE board_id = ?", (request.board_id,))
        if exists:
            execute(
                "UPDATE evidence_boards SET name = ?, data = ?, updated_at = ? WHERE board_id = ?",
                (request.name, data_str, now, request.board_id)
            )
        else:
            execute(
                "INSERT INTO evidence_boards (board_id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (request.board_id, request.name, data_str, now, now)
            )
        return {"success": True, "board_id": request.board_id}
    except Exception as e:
        raise HTTPException(500, f"Failed to save board: {e}")

@router.delete("/{board_id}")
def delete_board(board_id: str):
    try:
        execute("DELETE FROM evidence_boards WHERE board_id = ?", (board_id,))
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, f"Failed to delete board: {e}")

@router.post("/upload-evidence")
async def upload_evidence(http_request: Request, file: UploadFile = File(...)):
    """
    Process image/pdf upload, simulate Catalyst Zia face/OCR extraction,
    and suggest case connections using LLM context.
    """
    try:
        file_bytes = await file.read()
        b64_str = base64.b64encode(file_bytes).decode('utf-8')
        file_url = f"data:{file.content_type};base64,{b64_str}"
        
        filename_lower = file.filename.lower()
        
        # Zia Simulation
        zia_analysis = {
            "faces": [],
            "objects": [],
            "text_found": ""
        }
        
        # Mock analysis based on filename clues
        if any(x in filename_lower for x in ["cctv", "suspect", "face", "accused", "person"]):
            zia_analysis["faces"] = [{"age": "28-34", "gender": "Male", "features": "Short dark hair, light beard, scars on left cheek"}]
            zia_analysis["objects"] = ["person", "jacket", "vehicle"]
            zia_analysis["text_found"] = "CCTV Bengaluru North Crossing"
        elif any(x in filename_lower for x in ["bank", "statement", "invoice", "receipt", "money"]):
            zia_analysis["objects"] = ["document", "paper"]
            zia_analysis["text_found"] = "State Bank of India Account No. 90812328 · UPI Ref 4301988 · Transaction of Rs. 4,80,000 to Ashok Kumar"
        else:
            zia_analysis["objects"] = ["document", "evidence"]
            zia_analysis["text_found"] = f"Evidence record for case file: {file.filename}. Primary notes indicate mobile phone logs extracted."

        # Fetch recent case contexts
        recent_cases = query("""
            SELECT cm.CaseMasterID as case_id, cm.CrimeNo as crime_no, 
                   ch.CrimeGroupName as crime_group, cm.BriefFacts as facts
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            ORDER BY cm.CaseMasterID DESC LIMIT 8
        """)
        
        system_prompt = (
            "You are a forensic advisor assistant for Karnataka Police. "
            "Examine the uploaded file metadata, Zia text extraction, and recent case files to suggest linkages. "
            "Output must be a valid JSON object ONLY. No markdown formatting tags, no explanation block."
        )
        
        user_prompt = f"""
        Evidence file name: {file.filename}
        Zia Extracted Data: {json.dumps(zia_analysis)}
        
        Recent Cases Database:
        {json.dumps(recent_cases)}
        
        Based on this, suggest which cases this evidence might be linked to.
        Provide response as JSON object matching this schema:
        {{
           "suggested_case_links": [
              {{ "case_id": 12, "crime_no": "0012/2024", "confidence": "85%", "reason": "Reason details" }}
           ],
           "suggested_tags": ["Cyber Fraud", "Money Trail"]
        }}
        """
        
        ai_response = await call_ai(system_prompt, user_prompt, max_tokens=1500, request=http_request)
        
        # Clean potential markdown surrounding tags
        cleaned = ai_response.strip().replace("```json", "").replace("```", "").strip()
        try:
            ai_data = json.loads(cleaned)
        except Exception:
            ai_data = {
                "suggested_case_links": [],
                "suggested_tags": ["Evidence Upload", "File"]
            }
            
        return {
            "file_url": file_url,
            "zia_analysis": zia_analysis,
            "suggested_tags": ai_data.get("suggested_tags", ["Evidence"]),
            "suggested_case_links": ai_data.get("suggested_case_links", [])
        }
    except Exception as e:
        raise HTTPException(500, f"Upload processing failed: {e}")

@router.post("/match-suspect")
async def match_suspect(http_request: Request, file: UploadFile = File(...)):
    """
    Simulate Catalyst Zia face analysis and run demographic matching
    against the registered Accused directory in the database.
    """
    try:
        # Simulate Zia face parsing
        zia_analysis = {
            "age_range": "30-35",
            "gender": "Male",
            "description": "Male suspect with short cropped hair, spectacles, sharp jawline."
        }
        
        # Get list of top repeat offenders for matching reference
        accused_list = query("""
            SELECT AccusedName as name, MIN(AccusedMasterID) as accused_id, 
                   COUNT(DISTINCT CaseMasterID) as case_count, AVG(AgeYear) as age
            FROM Accused
            GROUP BY AccusedName
            ORDER BY case_count DESC LIMIT 20
        """)
        
        system_prompt = (
            "You are a forensic suspect match expert for KSP. "
            "Compare the Zia physical description to the database of repeat offenders. "
            "Output must be a valid JSON object matching the requested schema. No markdown formatting tags."
        )
        
        user_prompt = f"""
        Zia Face Description: {json.dumps(zia_analysis)}
        Top Repeat Offenders: {json.dumps(accused_list)}
        
        Select the top 3 most probable matches. 
        Output JSON object structure:
        {{
           "matches": [
              {{ "accused_id": 5, "name": "Ashok Kumar", "confidence": "94%", "reasoning": "Reason details" }}
           ]
        }}
        """
        
        ai_response = await call_ai(system_prompt, user_prompt, max_tokens=1500, request=http_request)
        cleaned = ai_response.strip().replace("```json", "").replace("```", "").strip()
        try:
            ai_data = json.loads(cleaned)
        except Exception:
            ai_data = {"matches": []}
            
        return {
            "zia_analysis": zia_analysis,
            "matches": ai_data.get("matches", []),
            "disclaimer": "Results are probabilistic. Verify with official records."
        }
    except Exception as e:
        raise HTTPException(500, f"Suspect matching failed: {e}")


# Pre-built investigation scenario for demo mode
DEMO_BOARD = {
    "nodes": [
        {"id": "n1", "type": "sentinalNode", "position": {"x": 200, "y": 200},
         "data": {"type": "person", "label": "Ashok Kumar",
                  "subtitle": "Suspected Syndicate Coordinator",
                  "risk": "HIGH"}},
        {"id": "n2", "type": "sentinalNode", "position": {"x": 550, "y": 150},
         "data": {"type": "case", "label": "Case #456 — UPI Cyber Fraud",
                  "subtitle": "Bengaluru Urban · Under Investigation"}},
        {"id": "n3", "type": "sentinalNode", "position": {"x": 550, "y": 350},
         "data": {"type": "person", "label": "Ramesh Kumar",
                  "subtitle": "Financial Mule · 3 prior cases",
                  "risk": "HIGH"}},
        {"id": "n4", "type": "sentinalNode", "position": {"x": 300, "y": 420},
         "data": {"type": "location", "label": "Hebbal, Bengaluru",
                  "subtitle": "Known meeting point"}},
        {"id": "n5", "type": "sentinalNode", "position": {"x": 800, "y": 250},
         "data": {"type": "financial", "label": "Account 90812328",
                  "subtitle": "₹2.4Cr suspicious transactions"}},
    ],
    "edges": [
        {"id": "e1", "source": "n1", "target": "n2",
         "label": "Primary Beneficiary",
         "style": {"stroke": "#c8814a", "strokeWidth": 2},
         "markerEnd": {"type": "arrowclosed", "color": "#c8814a"}},
        {"id": "e2", "source": "n1", "target": "n3",
         "label": "Co-accused (3 cases)",
         "style": {"stroke": "#e05252", "strokeWidth": 2},
         "markerEnd": {"type": "arrowclosed", "color": "#e05252"}},
        {"id": "e3", "source": "n3", "target": "n5",
         "label": "Controls account",
         "style": {"stroke": "#4ac880", "strokeWidth": 1.5},
         "markerEnd": {"type": "arrowclosed", "color": "#4ac880"}},
        {"id": "e4", "source": "n1", "target": "n4",
         "label": "Active location",
         "style": {"stroke": "#4a9eff", "strokeWidth": 1.5},
         "markerEnd": {"type": "arrowclosed", "color": "#4a9eff"}},
    ]
}

@router.get("/demo")
def get_demo_board():
    """Returns pre-built demo board for presentation mode."""
    return DEMO_BOARD


# ─── Canvas Board Endpoints (ReactFlow ConnectionsBoard) ─────────────

@router.get("/canvas/load/{case_id}")
def canvas_load(case_id: str):
    """Load ReactFlow nodes + edges for a given case canvas."""
    row = query_one("SELECT nodes_json, edges_json, updated_at FROM board_state WHERE case_id = ?", (case_id,))
    if not row:
        return {"nodes": [], "edges": [], "case_id": case_id}
    try:
        return {
            "case_id":    case_id,
            "nodes":      json.loads(row["nodes_json"] or "[]"),
            "edges":      json.loads(row["edges_json"] or "[]"),
            "updated_at": row["updated_at"],
        }
    except Exception as e:
        raise HTTPException(500, f"Error decoding canvas state: {e}")


@router.post("/canvas/save")
def canvas_save(req: CanvasSaveRequest):
    """Persist ReactFlow nodes + edges for a case canvas."""
    now = datetime.now().isoformat()
    nodes_str = json.dumps(req.nodes)
    edges_str = json.dumps(req.edges)
    try:
        exists = query_one("SELECT case_id FROM board_state WHERE case_id = ?", (req.case_id,))
        if exists:
            execute(
                "UPDATE board_state SET nodes_json = ?, edges_json = ?, updated_at = ? WHERE case_id = ?",
                (nodes_str, edges_str, now, req.case_id)
            )
        else:
            execute(
                "INSERT INTO board_state (case_id, nodes_json, edges_json, updated_at) VALUES (?, ?, ?, ?)",
                (req.case_id, nodes_str, edges_str, now)
            )
        return {"success": True, "case_id": req.case_id, "updated_at": now}
    except Exception as e:
        raise HTTPException(500, f"Failed to save canvas: {e}")

