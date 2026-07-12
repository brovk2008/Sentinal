"""CDR (Call Detail Records) analytics router."""
from fastapi import APIRouter, Query
from database import query
from typing import Optional

router = APIRouter()


@router.get("/call-graph")
async def call_graph(limit: int = Query(100, ge=10, le=500)):
    """Caller/receiver network for CDR visualization."""
    nodes = {}
    edges = []

    rows = query("""
        SELECT caller_name, receiver_name,
               COUNT(*) as call_count,
               SUM(call_duration_seconds) as total_duration
        FROM cdr_records
        WHERE linked_accused_id IS NOT NULL
        GROUP BY caller_name, receiver_name
        HAVING call_count >= 2
        ORDER BY call_count DESC
        LIMIT ?
    """, (limit,))

    for row in rows:
        c = row["caller_name"]
        r = row["receiver_name"]
        if c not in nodes:
            nodes[c] = {"id": c, "label": c, "type": "caller"}
        if r not in nodes:
            nodes[r] = {"id": r, "label": r, "type": "receiver"}
        edges.append({
            "from": c, "to": r,
            "calls": row["call_count"],
            "duration": row["total_duration"],
        })

    return {"nodes": list(nodes.values()), "edges": edges}


@router.get("/frequent-callers")
async def frequent_callers(limit: int = Query(20, ge=1, le=100)):
    """Most active callers linked to accused."""
    rows = query("""
        SELECT caller_name as name,
               COUNT(*) as total_calls,
               COUNT(DISTINCT receiver_name) as unique_contacts,
               SUM(call_duration_seconds) as total_duration,
               COUNT(DISTINCT linked_case_id) as linked_cases
        FROM cdr_records
        WHERE linked_accused_id IS NOT NULL
        GROUP BY caller_name
        ORDER BY total_calls DESC
        LIMIT ?
    """, (limit,))
    return rows


@router.get("/tower-activity")
async def tower_activity(district_id: Optional[int] = Query(None)):
    """Call volume per tower district per day."""
    if district_id:
        rows = query("""
            SELECT call_date, COUNT(*) as call_count,
                   SUM(call_duration_seconds) as total_duration,
                   d.DistrictName
            FROM cdr_records cdr
            JOIN District d ON cdr.tower_district_id = d.DistrictID
            WHERE cdr.tower_district_id = ?
            GROUP BY call_date
            ORDER BY call_date
        """, (district_id,))
    else:
        rows = query("""
            SELECT d.DistrictName, COUNT(*) as call_count,
                   SUM(call_duration_seconds) as total_duration
            FROM cdr_records cdr
            JOIN District d ON cdr.tower_district_id = d.DistrictID
            GROUP BY d.DistrictName
            ORDER BY call_count DESC
        """)
    return rows


@router.get("/pre-incident-calls")
async def pre_incident_calls():
    """Calls made 1-3 days before linked case incidents."""
    rows = query("""
        SELECT cdr.caller_name, cdr.receiver_name,
               cdr.call_date, cdr.call_duration_seconds,
               cm.CrimeNo, cm.IncidentFromDate, cm.BriefFacts,
               d.DistrictName
        FROM cdr_records cdr
        JOIN CaseMaster cm ON cdr.linked_case_id = cm.CaseMasterID
        JOIN District d ON cdr.tower_district_id = d.DistrictID
        WHERE julianday(cm.IncidentFromDate) - julianday(cdr.call_date) BETWEEN 0 AND 3
        ORDER BY cm.IncidentFromDate DESC
        LIMIT 50
    """)
    return rows


@router.get("/summary")
async def cdr_summary():
    """Aggregate CDR statistics."""
    stats = query("""
        SELECT COUNT(*) as total_records,
               COUNT(DISTINCT caller_name) as unique_callers,
               COUNT(DISTINCT receiver_name) as unique_receivers,
               AVG(call_duration_seconds) as avg_duration,
               SUM(CASE WHEN linked_accused_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_accused,
               SUM(CASE WHEN linked_case_id IS NOT NULL THEN 1 ELSE 0 END) as linked_to_cases
        FROM cdr_records
    """)
    return stats[0] if stats else {}


# ─── CDR Upload & Advanced Analysis ─────────────────────────────────

import sqlite3, io, os
from fastapi import UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List

_DB_PATH = os.getenv("DB_PATH", "data/sentinal.db")

# Column format maps for different Indian telcos
_COLUMN_MAPS = [
    # BSNL / Airtel standard
    {'phone': 'MSISDN', 'called': 'Called_Number', 'lat': 'LAT', 'lng': 'LONG',
     'tower': 'Tower_ID', 'date': 'Date', 'time': 'Time', 'duration': 'Duration',
     'imei': 'IMEI', 'call_type': 'Call_Type'},
    # Jio format
    {'phone': 'A_Number', 'called': 'B_Number', 'lat': 'Latitude', 'lng': 'Longitude',
     'tower': 'Cell_ID', 'date': 'Call_Date', 'time': 'Call_Time', 'duration': 'Call_Duration',
     'imei': 'IMEI', 'call_type': 'Call_Type'},
    # Generic / fallback
    {'phone': 'caller', 'called': 'called_party', 'lat': 'lat', 'lng': 'lng',
     'tower': 'tower_id', 'date': 'date', 'time': 'time', 'duration': 'duration',
     'imei': 'imei', 'call_type': 'call_type'},
    # Lower-case generic
    {'phone': 'msisdn', 'called': 'called_number', 'lat': 'latitude', 'lng': 'longitude',
     'tower': 'tower_id', 'date': 'date', 'time': 'time', 'duration': 'duration',
     'imei': 'imei', 'call_type': 'type'},
]

def _ensure_cdr_upload_columns():
    """Add upload-specific columns to cdr_records if they don't exist."""
    con = sqlite3.connect(_DB_PATH)
    for col, dtype in [
        ('phone', 'TEXT'), ('called', 'TEXT'), ('call_type_raw', 'TEXT'),
        ('date', 'DATE'), ('time', 'TIME'), ('duration_sec', 'INTEGER'),
        ('tower_id', 'TEXT'), ('lat', 'REAL'), ('lng', 'REAL'), ('imei', 'TEXT'),
        ('uploaded_at', 'TIMESTAMP'),
    ]:
        try:
            con.execute(f"ALTER TABLE cdr_records ADD COLUMN {col} {dtype}")
        except:
            pass  # column already exists
    con.execute("CREATE INDEX IF NOT EXISTS idx_cdr_phone   ON cdr_records(phone)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_cdr_tower   ON cdr_records(tower_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_cdr_imei    ON cdr_records(imei)")
    con.commit()
    con.close()

_ensure_cdr_upload_columns()


def _detect_column_map(cols: list) -> dict:
    cols_lower = [c.lower() for c in cols]
    for cmap in _COLUMN_MAPS:
        # Check if majority of map keys exist in actual columns
        matches = sum(1 for v in cmap.values() if v.lower() in cols_lower)
        if matches >= 4:
            return {k: next((c for c in cols if c.lower() == v.lower()), None)
                    for k, v in cmap.items()}
    # Fallback: use positional mapping
    return {}


@router.post("/upload")
async def upload_cdr(file: UploadFile = File(...)):
    """
    Accept CSV/XLS CDR file. Auto-detect telco format. Insert into cdr_records.
    Returns count of records inserted and column mapping used.
    """
    import pandas as pd
    content = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith('.csv') or filename.endswith('.txt'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse file: {e}")

    col_map = _detect_column_map(list(df.columns))
    if not col_map:
        raise HTTPException(400, f"Could not detect CDR format. Columns found: {list(df.columns)[:10]}")

    con = sqlite3.connect(_DB_PATH)
    inserted = 0
    from datetime import datetime as dt
    now = dt.now().isoformat()

    for _, row in df.iterrows():
        def g(key):
            col = col_map.get(key)
            if col and col in df.columns:
                val = row.get(col)
                return None if (val is None or (isinstance(val, float) and __import__('math').isnan(val))) else str(val)
            return None

        try:
            con.execute("""
                INSERT INTO cdr_records
                (phone, called, call_type_raw, date, time, duration_sec,
                 tower_id, lat, lng, imei, uploaded_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, (
                g('phone'), g('called'), g('call_type'),
                g('date'), g('time'),
                int(float(g('duration') or 0)) if g('duration') else None,
                g('tower'),
                float(g('lat')) if g('lat') else None,
                float(g('lng')) if g('lng') else None,
                g('imei'), now
            ))
            inserted += 1
        except Exception:
            continue

    con.commit()
    con.close()
    return {
        "success":     True,
        "inserted":    inserted,
        "total_rows":  len(df),
        "columns_detected": col_map,
        "filename":    file.filename,
    }


@router.get("/movement-trail/{phone_number}")
async def movement_trail(phone_number: str):
    """
    Chronological tower locations for a phone number.
    Shows suspect's physical movement over time. Used to plot trail on map.
    """
    rows = query("""
        SELECT date, time, tower_id, lat, lng, called, duration_sec, call_type_raw
        FROM cdr_records
        WHERE phone = ? AND (lat IS NOT NULL OR tower_id IS NOT NULL)
        ORDER BY date ASC, time ASC
        LIMIT 500
    """, (phone_number,))

    trail = [dict(r) for r in rows]
    return {
        "phone":       phone_number,
        "trail":       trail,
        "total_pings": len(trail),
        "unique_towers": len(set(r["tower_id"] for r in trail if r.get("tower_id"))),
    }


@router.get("/common-contacts/{phone_number}")
async def common_contacts(phone_number: str, min_calls: int = Query(2, ge=1)):
    """
    Find all numbers that called/were called by this number.
    Builds contact network for criminal association analysis.
    """
    outgoing = query("""
        SELECT called as contact, COUNT(*) as calls,
               SUM(duration_sec) as total_sec, 'outgoing' as direction
        FROM cdr_records
        WHERE phone = ? AND called IS NOT NULL
        GROUP BY called HAVING COUNT(*) >= ?
        ORDER BY calls DESC LIMIT 100
    """, (phone_number, min_calls))

    incoming = query("""
        SELECT phone as contact, COUNT(*) as calls,
               SUM(duration_sec) as total_sec, 'incoming' as direction
        FROM cdr_records
        WHERE called = ? AND phone IS NOT NULL
        GROUP BY phone HAVING COUNT(*) >= ?
        ORDER BY calls DESC LIMIT 100
    """, (phone_number, min_calls))

    all_contacts = [dict(r) for r in outgoing] + [dict(r) for r in incoming]
    # Deduplicate and merge
    merged = {}
    for c in all_contacts:
        key = c["contact"]
        if key not in merged:
            merged[key] = c
        else:
            merged[key]["calls"] = (merged[key].get("calls") or 0) + (c.get("calls") or 0)
            merged[key]["direction"] = "both"

    contacts = sorted(merged.values(), key=lambda x: x.get("calls") or 0, reverse=True)
    return {
        "phone":         phone_number,
        "contacts":      contacts,
        "total_contacts": len(contacts),
    }


class PreIncidentRequest(BaseModel):
    case_id: int
    crime_timestamp: str   # ISO format: "2024-03-15T14:30:00"
    nearby_tower_ids: List[str] = []
    window_hours: int = 2

@router.post("/pre-incident-window")
async def pre_incident_window(payload: PreIncidentRequest):
    """
    Find all CDR activity within N hours before a crime timestamp.
    This is how police identify suspects near a crime scene using tower dumps.
    """
    from datetime import datetime as dt, timedelta
    try:
        crime_time = dt.fromisoformat(payload.crime_timestamp)
        window_start = (crime_time - timedelta(hours=payload.window_hours)).isoformat()
    except Exception:
        raise HTTPException(400, "Invalid crime_timestamp format. Use ISO 8601.")

    params: list = [window_start, payload.crime_timestamp]
    tower_filter = ""
    if payload.nearby_tower_ids:
        placeholders = ",".join("?" * len(payload.nearby_tower_ids))
        tower_filter = f"AND tower_id IN ({placeholders})"
        params.extend(payload.nearby_tower_ids)

    rows = query(f"""
        SELECT phone, called, date, time, tower_id, lat, lng, duration_sec
        FROM cdr_records
        WHERE (date || 'T' || COALESCE(time, '00:00:00')) BETWEEN ? AND ?
        {tower_filter}
        ORDER BY date DESC, time DESC
        LIMIT 500
    """, tuple(params))

    activity = [dict(r) for r in rows]
    phones_present = list(set(r["phone"] for r in activity if r.get("phone")))

    return {
        "case_id":          payload.case_id,
        "window_start":     window_start,
        "window_end":       payload.crime_timestamp,
        "activity":         activity,
        "phones_present":   phones_present,
        "total_activity":   len(activity),
        "unique_phones":    len(phones_present),
        "note": "Phones active near crime scene in the pre-incident window — potential suspects/witnesses",
    }


@router.get("/tower-dump/{tower_id}")
async def tower_dump(tower_id: str, date: str = Query(..., description="Date in YYYY-MM-DD format")):
    """
    All phones active at a tower on a given date.
    Tower dump — a fundamental police investigation technique.
    """
    rows = query("""
        SELECT DISTINCT phone, called, time, duration_sec, imei
        FROM cdr_records
        WHERE tower_id = ? AND date = ?
        ORDER BY time ASC
        LIMIT 1000
    """, (tower_id, date))

    records = [dict(r) for r in rows]
    unique_phones = list(set(r["phone"] for r in records if r.get("phone")))
    unique_imeis  = list(set(r["imei"]  for r in records if r.get("imei")))

    return {
        "tower_id":     tower_id,
        "date":         date,
        "records":      records,
        "total":        len(records),
        "unique_phones": unique_phones,
        "unique_imeis":  unique_imeis,
        "phone_count":  len(unique_phones),
    }


@router.get("/imei-trace/{imei}")
async def imei_trace(imei: str):
    """
    Track a specific device (IMEI) across SIM changes.
    Criminals change SIMs but keep phones — IMEI exposes them.
    """
    rows = query("""
        SELECT phone, date, time, tower_id, lat, lng
        FROM cdr_records
        WHERE imei = ?
        ORDER BY date ASC, time ASC
        LIMIT 500
    """, (imei,))

    records = [dict(r) for r in rows]
    sims_used = list(set(r["phone"] for r in records if r.get("phone")))

    return {
        "imei":       imei,
        "records":    records,
        "sims_used":  sims_used,
        "sim_count":  len(sims_used),
        "note": f"Device used {len(sims_used)} different SIM(s) — indicates SIM swapping behaviour" if len(sims_used) > 1 else "Single SIM device",
    }

