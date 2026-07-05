"""Heatmap router — geospatial data for map visualization."""
from fastapi import APIRouter, Query
from database import query
from typing import Optional
import math

router = APIRouter()


@router.get("/grid")
async def heatmap_grid(
    crime_group: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    district: Optional[str] = Query(None),
):
    """Return lat/lng/intensity grid for heatmap layer."""
    conditions = ["cm.latitude IS NOT NULL", "cm.longitude IS NOT NULL"]
    params = []

    if year:
        conditions.append("strftime('%Y', cm.CrimeRegisteredDate) = ?")
        params.append(str(year))
    if crime_group:
        conditions.append("ch.CrimeGroupName = ?")
        params.append(crime_group)
    if district:
        conditions.append("d.DistrictName = ?")
        params.append(district)

    where = " AND ".join(conditions)
    rows = query(f"""
        SELECT cm.latitude as lat, cm.longitude as lng,
               CASE WHEN cm.GravityOffenceID = 1 THEN 1.0 ELSE 0.5 END as intensity
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE {where}
    """, tuple(params))
    return rows


@router.get("/hotspots")
async def hotspots():
    """Return top 20 crime hotspot clusters."""
    # Grid-based clustering: round lat/lng to 1 decimal place
    rows = query("""
        SELECT ROUND(latitude, 1) as lat, ROUND(longitude, 1) as lng,
               COUNT(*) as case_count
        FROM CaseMaster
        WHERE latitude IS NOT NULL
        GROUP BY ROUND(latitude, 1), ROUND(longitude, 1)
        ORDER BY case_count DESC
        LIMIT 20
    """)
    return rows


@router.get("/cases-near")
async def cases_near(
    lat: float = Query(...), lng: float = Query(...),
    radius_km: float = Query(2.0),
):
    """Return cases within radius_km of a point using Haversine approximation."""
    # Approximate: 1 degree ≈ 111 km
    delta = radius_km / 111.0
    rows = query("""
        SELECT cm.CaseMasterID, cm.CrimeNo, cm.latitude, cm.longitude,
               cm.CrimeRegisteredDate, cm.BriefFacts,
               ch.CrimeGroupName, cs.CaseStatusName
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        WHERE cm.latitude BETWEEN ? AND ?
          AND cm.longitude BETWEEN ? AND ?
        LIMIT 100
    """, (lat - delta, lat + delta, lng - delta, lng + delta))
    return rows


@router.get("/district-centers")
async def district_centers():
    """Return average lat/lng per district for map markers."""
    rows = query("""
        SELECT d.DistrictName as name,
               AVG(cm.latitude) as lat, AVG(cm.longitude) as lng,
               COUNT(*) as case_count
        FROM CaseMaster cm
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE cm.latitude IS NOT NULL
        GROUP BY d.DistrictName
    """)
    return rows


MONTH_LABELS = {
    "2023-01": "Jan 2023", "2023-02": "Feb 2023", "2023-03": "Mar 2023", "2023-04": "Apr 2023",
    "2023-05": "May 2023", "2023-06": "Jun 2023", "2023-07": "Jul 2023", "2023-08": "Aug 2023",
    "2023-09": "Sep 2023", "2023-10": "Oct 2023", "2023-11": "Nov 2023", "2023-12": "Dec 2023",
    "2024-01": "Jan 2024", "2024-02": "Feb 2024", "2024-03": "Mar 2024", "2024-04": "Apr 2024",
    "2024-05": "May 2024", "2024-06": "Jun 2024", "2024-07": "Jul 2024", "2024-08": "Aug 2024",
    "2024-09": "Sep 2024", "2024-10": "Oct 2024", "2024-11": "Nov 2024", "2024-12": "Dec 2024",
}

@router.get("/timelapse")
async def heatmap_timelapse():
    """Return monthly heatmap data for all 24 months in 2023-2024."""
    rows = query("""
        SELECT strftime('%Y-%m', cm.CrimeRegisteredDate) as month,
               ROUND(cm.latitude, 2) as lat,
               ROUND(cm.longitude, 2) as lng,
               AVG(CASE WHEN cm.GravityOffenceID = 1 THEN 1.0 ELSE 0.5 END) as intensity
        FROM CaseMaster cm
        WHERE cm.latitude IS NOT NULL AND cm.longitude IS NOT NULL
          AND cm.CrimeRegisteredDate BETWEEN '2023-01-01' AND '2024-12-31 23:59:59'
        GROUP BY month, ROUND(cm.latitude, 2), ROUND(cm.longitude, 2)
    """)
    
    frames_dict = {m: [] for m in MONTH_LABELS.keys()}
    for r in rows:
        m = r['month']
        if m in frames_dict:
            frames_dict[m].append({
                "lat": r['lat'],
                "lng": r['lng'],
                "intensity": r['intensity']
            })
            
    frames = []
    for m, label in MONTH_LABELS.items():
        frames.append({
            "month": m,
            "label": label,
            "points": frames_dict[m]
        })
    return {"frames": frames}
