"""Cases router — case listing, detail, search, timeline."""
from fastapi import APIRouter, Query
from database import query, query_one
from typing import Optional

router = APIRouter()


@router.get("/")
async def list_cases(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    crime_type: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """Paginated case list with filters."""
    conditions = ["1=1"]
    params = []

    if status:
        conditions.append("cs.CaseStatusName = ?")
        params.append(status)
    if crime_type:
        conditions.append("ch.CrimeGroupName = ?")
        params.append(crime_type)
    if district:
        conditions.append("d.DistrictName = ?")
        params.append(district)
    if q:
        conditions.append("(cm.BriefFacts LIKE ? OR cm.CrimeNo LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])

    where = " AND ".join(conditions)
    offset = (page - 1) * limit

    total = query_one(f"""
        SELECT COUNT(*) as cnt FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE {where}
    """, tuple(params))["cnt"]

    rows = query(f"""
        SELECT cm.CaseMasterID, cm.CrimeNo, cm.CaseNo,
               cm.CrimeRegisteredDate, cm.BriefFacts,
               ch.CrimeGroupName, cs.CaseStatusName,
               d.DistrictName, cm.CaseStatusID
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE {where}
        ORDER BY cm.CrimeRegisteredDate DESC
        LIMIT ? OFFSET ?
    """, tuple(params) + (limit, offset))

    return {"total": total, "page": page, "limit": limit, "cases": rows}


@router.get("/recent-timeline")
async def recent_timeline():
    """Return last 10 events across recent cases for dashboard widget."""
    rows = query("""
        SELECT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
               ch.CrimeGroupName, cs.CaseStatusName,
               d.DistrictName, cm.BriefFacts,
               e.FirstName as officer_name
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        JOIN Employee e ON cm.PolicePersonID = e.EmployeeID
        ORDER BY cm.CrimeRegisteredDate DESC
        LIMIT 10
    """)
    return rows


@router.get("/search")
async def search_cases(q: str = Query(..., min_length=2)):
    """Full text search on BriefFacts, AccusedName, VictimName."""
    rows = query("""
        SELECT DISTINCT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
               ch.CrimeGroupName, cs.CaseStatusName, cm.BriefFacts
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        LEFT JOIN Accused a ON a.CaseMasterID = cm.CaseMasterID
        LEFT JOIN Victim v ON v.CaseMasterID = cm.CaseMasterID
        WHERE cm.BriefFacts LIKE ?
           OR a.AccusedName LIKE ?
           OR v.VictimName LIKE ?
           OR cm.CrimeNo LIKE ?
        LIMIT 50
    """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"))
    return rows


@router.get("/{case_id}")
async def get_case(case_id: int):
    """Full case detail with all related records."""
    case = query_one("""
        SELECT cm.*, ch.CrimeGroupName, cs.CaseStatusName,
               d.DistrictName, e.FirstName as OfficerName,
               u.UnitName as StationName
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        JOIN Employee e ON cm.PolicePersonID = e.EmployeeID
        WHERE cm.CaseMasterID = ?
    """, (case_id,))
    if not case:
        return {"error": "Case not found"}

    accused = query("SELECT * FROM Accused WHERE CaseMasterID = ?", (case_id,))
    victims = query("SELECT * FROM Victim WHERE CaseMasterID = ?", (case_id,))
    complainants = query("SELECT * FROM ComplainantDetails WHERE CaseMasterID = ?", (case_id,))
    sections = query("""
        SELECT asa.ActID, asa.SectionID, a.ShortName
        FROM ActSectionAssociation asa
        JOIN Act a ON asa.ActID = a.ActCode
        WHERE asa.CaseMasterID = ?
    """, (case_id,))
    arrests = query("SELECT * FROM ArrestSurrender WHERE CaseMasterID = ?", (case_id,))
    chargesheets = query("SELECT * FROM ChargesheetDetails WHERE CaseMasterID = ?", (case_id,))

    return {
        "case": case,
        "accused": accused,
        "victims": victims,
        "complainants": complainants,
        "sections": sections,
        "arrests": arrests,
        "chargesheets": chargesheets,
    }
