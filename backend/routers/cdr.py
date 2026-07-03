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
