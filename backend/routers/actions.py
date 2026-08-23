from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import execute, query_one, query
import sqlite3
from config import config

router = APIRouter()

# Initialize tables/columns on module load
def init_db():
    conn = sqlite3.connect(config.DB_PATH)
    try:
        # Create investigation_notes table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS investigation_notes (
                note_id INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id INTEGER,
                note_text TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                officer_id INTEGER
            )
        """)
        # Create case_syndicate_links table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS case_syndicate_links (
                case_id INTEGER PRIMARY KEY,
                syndicate_id INTEGER,
                linked_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Alter Accused table to add is_priority if not exists
        try:
            conn.execute("ALTER TABLE Accused ADD COLUMN is_priority INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            # Column already exists
            pass
        conn.commit()
    except Exception as e:
        print(f"[Actions Init] DB initialization error: {e}")
    finally:
        conn.close()

init_db()

# Pydantic Schemas for Requests
class StatusUpdateRequest(BaseModel):
    case_id: int
    status_id: int

class NoteAddRequest(BaseModel):
    case_id: int
    note: str
    officer_id: int

class AccusedFlagRequest(BaseModel):
    accused_id: int
    is_priority: bool

class SyndicateLinkRequest(BaseModel):
    case_id: int
    syndicate_id: int


@router.post("/update-case-status")
async def update_case_status(req: StatusUpdateRequest):
    # Verify status_id exists
    status = query_one("SELECT CaseStatusName FROM CaseStatusMaster WHERE CaseStatusID = ?", (req.status_id,))
    if not status:
        raise HTTPException(status_code=400, detail="Invalid CaseStatusID")
    
    # Update case status
    rowcount = execute("UPDATE CaseMaster SET CaseStatusID = ? WHERE CaseMasterID = ?", (req.status_id, req.case_id))
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Case not found")
        
    return {"success": True, "new_status": status["CaseStatusName"]}


@router.post("/add-investigation-note")
async def add_investigation_note(req: NoteAddRequest):
    if len(req.note) > 500:
        raise HTTPException(status_code=400, detail="Note exceeds 500 characters")
        
    note_id = execute(
        "INSERT INTO investigation_notes (case_id, note_text, officer_id) VALUES (?, ?, ?)",
        (req.case_id, req.note, req.officer_id)
    )
    return {"success": True, "note_id": note_id}


@router.post("/flag-accused")
async def flag_accused(req: AccusedFlagRequest):
    rowcount = execute(
        "UPDATE Accused SET is_priority = ? WHERE AccusedMasterID = ?",
        (1 if req.is_priority else 0, req.accused_id)
    )
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Accused not found")
    return {"success": True}


@router.post("/link-syndicate")
async def link_syndicate(req: SyndicateLinkRequest):
    # Verify syndicate exists if syndicate_id > 0 (allow unlinking if set to 0 or null)
    if req.syndicate_id > 0:
        syndicate = query_one("SELECT syndicate_name FROM crime_syndicates WHERE syndicate_id = ?", (req.syndicate_id,))
        if not syndicate:
            raise HTTPException(status_code=400, detail="Invalid Syndicate ID")
            
        execute(
            "INSERT OR REPLACE INTO case_syndicate_links (case_id, syndicate_id) VALUES (?, ?)",
            (req.case_id, req.syndicate_id)
        )
    else:
        # If syndicate_id is 0 or negative, remove the link
        execute("DELETE FROM case_syndicate_links WHERE case_id = ?", (req.case_id,))
        
    return {"success": True}


@router.get("/investigation-notes/{case_id}")
async def get_investigation_notes(case_id: int):
    # Joined to get officer's name
    notes = query("""
        SELECT n.note_id, n.case_id, n.note_text, n.created_at, n.officer_id,
               e.FirstName as officer_name
        FROM investigation_notes n
        LEFT JOIN Employee e ON n.officer_id = e.EmployeeID
        WHERE n.case_id = ?
        ORDER BY n.created_at DESC
    """, (case_id,))
    return notes


# ─── Immutable AI Action Log — Audit Trail ─────────────────────────────────

from typing import Optional as _OptType

class AnalystDecisionRequest(BaseModel):
    rec_id: str
    decision: str          # CONFIRMED | REJECTED | ESCALATED
    analyst_id: str = "system"
    note: _OptType[str] = None
    entity_ids: _OptType[list] = None


@router.get("/audit-trail")
async def get_audit_trail(
    analyst_id: str = None,
    decision: str = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Query the immutable AI action log.
    Returns all AI recommendations and analyst decisions with full audit chain.
    This table is append-only — no modifications are possible.
    """
    conditions = []
    params = []
    if analyst_id:
        conditions.append("analyst_id = ?")
        params.append(analyst_id)
    if decision:
        conditions.append("analyst_decision = ?")
        params.append(decision.upper())
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    rows = query(f"""
        SELECT rec_id, analyst_id, ai_prompt_summary, analyst_decision,
               analyst_note, outcome_written_back, model_name, entity_ids,
               created_at, decided_at
        FROM ai_action_log
        {where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, tuple(params) + (limit, offset))
    total = query(f"SELECT COUNT(*) as cnt FROM ai_action_log {where}", tuple(params))
    return {
        "total": total[0]["cnt"] if total else 0,
        "limit": limit,
        "offset": offset,
        "records": rows,
        "integrity_note": "This log is append-only. No records can be modified or deleted.",
    }


@router.patch("/audit-trail/decide")
async def record_analyst_decision(req: AnalystDecisionRequest):
    """
    Record an analyst's decision on an AI recommendation (CONFIRMED/REJECTED/ESCALATED).
    This UPDATE is the ONLY permitted modification to ai_action_log
    (updating the analyst_decision and decided_at columns only).
    All other columns remain immutable.
    """
    valid_decisions = {"CONFIRMED", "REJECTED", "ESCALATED", "PENDING"}
    if req.decision.upper() not in valid_decisions:
        raise HTTPException(400, f"Decision must be one of: {valid_decisions}")

    # Verify the rec_id exists
    existing = query_one("SELECT rec_id, analyst_decision FROM ai_action_log WHERE rec_id = ?", (req.rec_id,))
    if not existing:
        raise HTTPException(404, f"AI recommendation {req.rec_id} not found in audit log")

    if existing["analyst_decision"] != "PENDING":
        raise HTTPException(409, f"Decision already recorded: {existing['analyst_decision']}. Cannot overwrite a committed decision.")

    execute("""
        UPDATE ai_action_log
        SET analyst_decision = ?,
            analyst_note = ?,
            decided_at = datetime('now'),
            outcome_written_back = 1
        WHERE rec_id = ? AND analyst_decision = 'PENDING'
    """, (req.decision.upper(), req.note or "", req.rec_id))

    return {
        "rec_id":   req.rec_id,
        "decision": req.decision.upper(),
        "analyst":  req.analyst_id,
        "recorded": True,
        "note": "Decision permanently committed to audit log.",
    }


@router.get("/audit-trail/entity/{entity_id}")
async def get_entity_audit_trail(entity_id: str):
    """
    Return full audit trail for a specific entity (person, case, etc.)
    Shows every AI recommendation and analyst decision that referenced this entity.
    """
    rows = query("""
        SELECT rec_id, analyst_id, ai_prompt_summary, ai_recommendation,
               analyst_decision, analyst_note, outcome_written_back,
               created_at, decided_at
        FROM ai_action_log
        WHERE entity_ids LIKE ?
        ORDER BY created_at DESC
        LIMIT 50
    """, (f"%{entity_id}%",))
    return {
        "entity_id": entity_id,
        "ai_interactions": len(rows),
        "records": rows,
    }

