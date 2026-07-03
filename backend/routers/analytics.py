"""Analytics router — KPIs, crime distribution, district comparison."""
from fastapi import APIRouter, Query
from database import query, query_one

router = APIRouter()


@router.get("/kpis")
async def get_kpis():
    """Return dashboard KPI metrics."""
    total = query_one("SELECT COUNT(*) as cnt FROM CaseMaster")["cnt"]
    active = query_one(
        "SELECT COUNT(*) as cnt FROM CaseMaster WHERE CaseStatusID IN (1, 2)"
    )["cnt"]
    arrests = query_one("SELECT COUNT(*) as cnt FROM ArrestSurrender")["cnt"]
    chargesheets = query_one("SELECT COUNT(*) as cnt FROM ChargesheetDetails")["cnt"]
    court_trial = query_one(
        "SELECT COUNT(*) as cnt FROM CaseMaster WHERE CaseStatusID = 4"
    )["cnt"]
    closed = query_one(
        "SELECT COUNT(*) as cnt FROM CaseMaster WHERE CaseStatusID = 5"
    )["cnt"]

    # Conviction rate: cases that reached chargesheet stage or beyond
    # denominator = only RESOLVED cases (exclude still-open Registered + Under Investigation)
    resolved_cases = query_one(
        "SELECT COUNT(*) as cnt FROM CaseMaster WHERE CaseStatusID IN (3, 4, 5)"
    )["cnt"]
    # numerator = chargesheet filed + court trial + closed (all have progressed)
    progressed = query_one(
        "SELECT COUNT(*) as cnt FROM CaseMaster WHERE CaseStatusID IN (3, 4, 5)"
    )["cnt"]
    # conviction = cases that made it to court or closed (beyond just chargesheet)
    convicted = query_one(
        "SELECT COUNT(*) as cnt FROM CaseMaster WHERE CaseStatusID IN (4, 5)"
    )["cnt"]
    conviction_rate = round((convicted / resolved_cases * 100), 1) if resolved_cases > 0 else 0

    return {
        "total_cases": total,
        "active_investigations": active,
        "arrests_made": arrests,
        "chargesheets_filed": chargesheets,
        "conviction_rate": conviction_rate,
        "pending_court": court_trial,
    }


@router.get("/crime-distribution")
async def crime_distribution():
    """Return case counts per crime head for pie/donut chart."""
    rows = query("""
        SELECT ch.CrimeGroupName as name, COUNT(*) as value
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        GROUP BY ch.CrimeGroupName
        ORDER BY value DESC
    """)
    return rows


@router.get("/top-offenders")
async def top_offenders(limit: int = Query(5, ge=1, le=50)):
    """Return accused with most case appearances."""
    rows = query("""
        SELECT AccusedName as name,
               COUNT(DISTINCT CaseMasterID) as case_count
        FROM Accused
        GROUP BY AccusedName
        ORDER BY case_count DESC
        LIMIT ?
    """, (limit,))
    return rows


@router.get("/district-comparison")
async def district_comparison(
    year1: int = Query(2023), year2: int = Query(2024)
):
    """Compare case counts per district across two years."""
    rows = query("""
        SELECT d.DistrictName as district,
               SUM(CASE WHEN CrimeRegisteredDate LIKE ? THEN 1 ELSE 0 END) as year1_count,
               SUM(CASE WHEN CrimeRegisteredDate LIKE ? THEN 1 ELSE 0 END) as year2_count
        FROM CaseMaster cm
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        GROUP BY d.DistrictName
        ORDER BY (year1_count + year2_count) DESC
        LIMIT 10
    """, (f"{year1}%", f"{year2}%"))
    return {"year1": year1, "year2": year2, "districts": rows}


@router.get("/monthly-trend")
async def monthly_trend():
    """Return monthly case counts for sparkline charts."""
    rows = query("""
        SELECT strftime('%Y-%m', CrimeRegisteredDate) as month,
               COUNT(*) as count
        FROM CaseMaster
        GROUP BY month
        ORDER BY month
    """)
    return rows


@router.get("/status-breakdown")
async def status_breakdown():
    """Return case counts by status."""
    rows = query("""
        SELECT cs.CaseStatusName as status, COUNT(*) as count
        FROM CaseMaster cm
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        GROUP BY cs.CaseStatusName
    """)
    return rows
