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
