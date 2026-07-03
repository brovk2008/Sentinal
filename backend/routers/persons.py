"""Persons router — accused profiles and repeat offenders."""
from fastapi import APIRouter, Query
from database import query, query_one

router = APIRouter()


@router.get("/repeat-offenders")
async def repeat_offenders(limit: int = Query(20, ge=1, le=100)):
    """Accused appearing in 3+ cases."""
    rows = query("""
        SELECT AccusedName as name,
               COUNT(DISTINCT CaseMasterID) as case_count,
               GROUP_CONCAT(DISTINCT CaseMasterID) as case_ids,
               MIN(AgeYear) as age,
               GenderID as gender_id
        FROM Accused
        GROUP BY AccusedName
        HAVING case_count >= 3
        ORDER BY case_count DESC
        LIMIT ?
    """, (limit,))

    # Enrich with crime types and districts
    enriched = []
    for row in rows:
        case_id_list = [int(x) for x in row["case_ids"].split(",")][:10]
        ph = ",".join("?" * len(case_id_list))

        crime_types = query(f"""
            SELECT DISTINCT ch.CrimeGroupName
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE cm.CaseMasterID IN ({ph})
        """, tuple(case_id_list))

        districts = query(f"""
            SELECT DISTINCT d.DistrictName
            FROM CaseMaster cm
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            WHERE cm.CaseMasterID IN ({ph})
        """, tuple(case_id_list))

        sections = query(f"""
            SELECT DISTINCT a.ShortName || ' ' || asa.SectionID as section
            FROM ActSectionAssociation asa
            JOIN Act a ON asa.ActID = a.ActCode
            WHERE asa.CaseMasterID IN ({ph})
        """, tuple(case_id_list))

        # Syndicate membership
        acc_ids_rows = query(
            "SELECT AccusedMasterID FROM Accused WHERE AccusedName = ? LIMIT 10",
            (row["name"],)
        )
        acc_ids = [r["AccusedMasterID"] for r in acc_ids_rows]
        syndicate = []
        if acc_ids:
            ph2 = ",".join("?" * len(acc_ids))
            syndicate = query(f"""
                SELECT cs.syndicate_name, sm.role
                FROM syndicate_members sm
                JOIN crime_syndicates cs ON sm.syndicate_id = cs.syndicate_id
                WHERE sm.accused_master_id IN ({ph2})
            """, tuple(acc_ids))

        enriched.append({
            **row,
            "crime_types": [c["CrimeGroupName"] for c in crime_types],
            "districts": [d["DistrictName"] for d in districts],
            "sections": [s["section"] for s in sections],
            "syndicate": syndicate,
        })

    return enriched


@router.get("/search")
async def search_persons(q: str = Query(..., min_length=2)):
    """Search accused by name."""
    rows = query("""
        SELECT AccusedName as name,
               COUNT(DISTINCT CaseMasterID) as case_count,
               MIN(AgeYear) as age, GenderID as gender_id
        FROM Accused
        WHERE AccusedName LIKE ?
        GROUP BY AccusedName
        ORDER BY case_count DESC
        LIMIT 20
    """, (f"%{q}%",))
    return rows


@router.get("/{accused_id}/profile")
async def accused_profile(accused_id: int):
    """Full accused profile with all case appearances and connections."""
    person = query_one(
        "SELECT * FROM Accused WHERE AccusedMasterID = ?", (accused_id,)
    )
    if not person:
        return {"error": "Accused not found"}

    name = person["AccusedName"]

    # All case appearances
    cases = query("""
        SELECT DISTINCT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
               ch.CrimeGroupName, cs.CaseStatusName, d.DistrictName
        FROM Accused a
        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE a.AccusedName = ?
        ORDER BY cm.CrimeRegisteredDate DESC
    """, (name,))

    # Arrest history
    acc_ids = query(
        "SELECT AccusedMasterID FROM Accused WHERE AccusedName = ?", (name,)
    )
    arrest_count = 0
    if acc_ids:
        ph = ",".join("?" * len(acc_ids))
        ids = [r["AccusedMasterID"] for r in acc_ids]
        arrest_row = query_one(f"""
            SELECT COUNT(*) as cnt FROM ArrestSurrender
            WHERE AccusedMasterID IN ({ph})
        """, tuple(ids))
        arrest_count = arrest_row["cnt"] if arrest_row else 0

    # Financial transactions
    transactions = query("""
        SELECT * FROM financial_transactions
        WHERE linked_accused_id = ?
        ORDER BY txn_date DESC
        LIMIT 20
    """, (accused_id,))

    return {
        "person": person,
        "cases": cases,
        "arrest_count": arrest_count,
        "transactions": transactions,
    }
