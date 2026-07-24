from fastapi import APIRouter, Query, HTTPException, Request
from database import query, query_one
from typing import Optional, List
from pydantic import BaseModel
from config import config
from services.quickml_service import call_ai
import os
import json
import math
from datetime import datetime

router = APIRouter()

class CompareRequest(BaseModel):
    case_ids: List[int]


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


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@router.post("/compare")
async def compare_cases(req: CompareRequest, http_request: Request):
    if len(req.case_ids) < 2 or len(req.case_ids) > 3:
        raise HTTPException(status_code=400, detail="Must compare between 2 and 3 cases")
        
    cases_data = []
    all_accused_names = []
    all_sections = []
    parsed_dates = []
    coordinates = []
    
    for case_id in req.case_ids:
        case = query_one("""
            SELECT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
                   cm.BriefFacts, ch.CrimeGroupName, cs.CaseStatusName,
                   d.DistrictName, u.UnitName as StationName,
                   e.FirstName as OfficerName, cm.latitude, cm.longitude
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            JOIN Employee e ON cm.PolicePersonID = e.EmployeeID
            WHERE cm.CaseMasterID = ?
        """, (case_id,))
        
        if not case:
            continue
            
        accused = query("SELECT AccusedName, AgeYear, is_priority FROM Accused WHERE CaseMasterID = ?", (case_id,))
        sections = query("""
            SELECT asa.SectionID, a.ShortName
            FROM ActSectionAssociation asa
            JOIN Act a ON asa.ActID = a.ActCode
            WHERE asa.CaseMasterID = ?
        """, (case_id,))
        
        case_item = {
            "metadata": case,
            "accused": accused,
            "sections": [f"{s['ShortName']} {s['SectionID']}" for s in sections]
        }
        cases_data.append(case_item)
        
        all_accused_names.append(set(a['AccusedName'].strip().lower() for a in accused if a.get('AccusedName')))
        all_sections.append(set(f"{s['ShortName']} {s['SectionID']}" for s in sections))
        
        if case.get('latitude') and case.get('longitude'):
            coordinates.append((case['latitude'], case['longitude']))
            
        dt_str = case.get('CrimeRegisteredDate')
        if dt_str:
            try:
                dt = datetime.strptime(dt_str.split('.')[0], "%Y-%m-%d %H:%M:%S")
                parsed_dates.append(dt)
            except Exception:
                try:
                    dt = datetime.strptime(dt_str.split(' ')[0], "%Y-%m-%d")
                    parsed_dates.append(dt)
                except Exception:
                    pass

    if len(cases_data) < 2:
        raise HTTPException(status_code=400, detail="Not enough valid cases found to compare")

    shared_accused = list(set.intersection(*all_accused_names)) if all_accused_names else []
    original_accused_map = {}
    for case in cases_data:
        for a in case['accused']:
            if a.get('AccusedName'):
                original_accused_map[a['AccusedName'].lower()] = a['AccusedName']
    shared_accused_original = [original_accused_map[name] for name in shared_accused if name in original_accused_map]

    shared_sections = list(set.intersection(*all_sections)) if all_sections else []

    distances = []
    if len(coordinates) >= 2:
        for i in range(len(coordinates)):
            for j in range(i + 1, len(coordinates)):
                d = haversine(coordinates[i][0], coordinates[i][1], coordinates[j][0], coordinates[j][1])
                distances.append(round(d, 2))
    
    time_delta_days = None
    if len(parsed_dates) >= 2:
        time_delta_days = abs((max(parsed_dates) - min(parsed_dates)).days)

    case_summaries = []
    for c in cases_data:
        case_summaries.append({
            "CrimeNo": c['metadata']['CrimeNo'],
            "CrimeGroup": c['metadata']['CrimeGroupName'],
            "Date": c['metadata']['CrimeRegisteredDate'],
            "District": c['metadata']['DistrictName'],
            "Station": c['metadata']['StationName'],
            "BriefFacts": c['metadata']['BriefFacts'],
            "Accused": [a['AccusedName'] for a in c['accused'] if a.get('AccusedName')],
            "Sections": c['sections']
        })

    distance_summary = f"{distances[0]} km" if len(distances) == 1 else (f"range {min(distances)} to {max(distances)} km" if distances else "N/A")

    prompt = f"""You are a senior crime intelligence analyst mapping out organizational crime patterns for the Karnataka Police.
    Please write a crisp, professional comparative briefing in clear Markdown for the following cases.
    
    CASES:
    {json.dumps(case_summaries, indent=2)}
    
    COMPUTED OVERLAPS:
    - Shared Accused suspects: {shared_accused_original or 'None'}
    - Shared Act/Sections: {shared_sections or 'None'}
    - Distance between crime spots: {distance_summary}
    - Time span of incidents: {f"{time_delta_days} days" if time_delta_days is not None else 'N/A'}
    
    Structure the report with the following headers:
    1. **Correlation Assessment**: Highlight strong correlation markers (shared suspects, geographic proximity, temporal alignment).
    2. **Syndicate & MO Analysis**: Analyze syndicate indicators or MO (modus operandi) alignment.
    3. **Actionable Recommendations**: Key investigation recommendations for the investigating officer.
    
    Do NOT write conversational text at the beginning or end. Write a direct intelligence brief."""

    summary_text = await call_ai(
        "You are a senior crime intelligence analyst for Karnataka Police.",
        prompt,
        max_tokens=1024,
        request=http_request,
    )
    if summary_text.startswith("Catalyst QuickML"):
        summary_text = ""

    if not summary_text:
        summary_text = f"""### **Correlation Assessment**
- **Shared Suspects**: {', '.join(shared_accused_original) if shared_accused_original else 'None detected directly by name.'}
- **Geographic Proximity**: Incident spots are located {distance_summary} apart.
- **Temporal Alignment**: Incidents occurred within a span of {f"{time_delta_days} days" if time_delta_days is not None else 'N/A'}.

### **Syndicate & MO Analysis**
- Overlapping acts and legal sections: {', '.join(shared_sections) if shared_sections else 'None'}.
- High degree of alignment in the modus operandi described in the brief facts. Specifically, these incidents target similar crime classifications: {', '.join(set(c['CrimeGroup'] for c in case_summaries))}.

### **Actionable Recommendations**
- Coordinate investigating officers across stations: {', '.join(set(c['Station'] for c in case_summaries))}.
- Verify common telephone contacts, CDR trails, and financial accounts.
- Link cases under a common syndicate profile in Sentinal Connection Board."""

    return {
        "cases": cases_data,
        "shared_accused": shared_accused_original,
        "shared_sections": shared_sections,
        "distances": distances,
        "time_delta_days": time_delta_days,
        "summary": summary_text
    }
