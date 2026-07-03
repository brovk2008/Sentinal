#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║  PROJECT SENTINEL v2 — RAG Investigation Narratives Generator       ║
║  Reads sentinel.db → Generates 500 investigation_narratives.json    ║
╚══════════════════════════════════════════════════════════════════════╝

Author : Project Sentinel Team
Version: 2.0.0
Python : 3.9+
Usage  : python generate_rag_stories.py
Input  : ./output/sentinel.db
Output : ./output/investigation_narratives.json
"""

import os
import json
import random
import sqlite3
import time
from datetime import datetime
from collections import defaultdict

random.seed(42)
START_TIME = time.time()

# ═══════════════════════════════════════════════════════════════════
# PATHS
# ═══════════════════════════════════════════════════════════════════
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR  = os.path.join(SCRIPT_DIR, "output")
DB_PATH     = os.path.join(OUTPUT_DIR, "sentinel.db")
OUTPUT_JSON = os.path.join(OUTPUT_DIR, "investigation_narratives.json")


# ═══════════════════════════════════════════════════════════════════
# DATABASE HELPERS
# ═══════════════════════════════════════════════════════════════════

def dict_factory(cursor, row):
    """Convert sqlite3 rows to dicts."""
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


def get_conn():
    """Return a connection with dict row factory."""
    if not os.path.exists(DB_PATH):
        print(f"ERROR: {DB_PATH} not found. Run generate_sentinel_data.py first.")
        raise SystemExit(1)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = dict_factory
    return conn


# ═══════════════════════════════════════════════════════════════════
# DATA LOADERS
# ═══════════════════════════════════════════════════════════════════

def load_syndicates(conn):
    """Load all syndicates with their members and linked cases."""
    c = conn.cursor()
    syndicates = c.execute("SELECT * FROM crime_syndicates").fetchall()

    for synd in syndicates:
        sid = synd["syndicate_id"]

        # Members
        members = c.execute("""
            SELECT sm.role, a.AccusedName, a.AccusedMasterID, a.CaseMasterID
            FROM syndicate_members sm
            JOIN Accused a ON sm.accused_master_id = a.AccusedMasterID
            WHERE sm.syndicate_id = ?
        """, (sid,)).fetchall()
        synd["members"] = members

        # All cases involving syndicate members
        member_acc_ids = [m["AccusedMasterID"] for m in members]
        if member_acc_ids:
            placeholders = ",".join("?" * len(member_acc_ids))
            cases = c.execute(f"""
                SELECT DISTINCT cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
                       cm.BriefFacts, cm.latitude, cm.longitude,
                       ch.CrimeGroupName, cs.CaseStatusName,
                       d.DistrictName
                FROM CaseMaster cm
                JOIN Accused a ON a.CaseMasterID = cm.CaseMasterID
                JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
                JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
                JOIN Unit u ON cm.PoliceStationID = u.UnitID
                JOIN District d ON u.DistrictID = d.DistrictID
                WHERE a.AccusedMasterID IN ({placeholders})
                ORDER BY cm.CrimeRegisteredDate
            """, member_acc_ids).fetchall()
            synd["cases"] = cases
        else:
            synd["cases"] = []

        # Financial transactions
        if member_acc_ids:
            txns = c.execute(f"""
                SELECT SUM(amount) as total_amount, COUNT(*) as txn_count,
                       SUM(CASE WHEN is_suspicious = 1 THEN 1 ELSE 0 END) as suspicious_count
                FROM financial_transactions
                WHERE linked_accused_id IN ({placeholders})
            """, member_acc_ids).fetchone()
            synd["financials"] = txns
        else:
            synd["financials"] = {"total_amount": 0, "txn_count": 0, "suspicious_count": 0}

    return syndicates


def load_random_cases(conn, n=200):
    """Load n random cases with full details."""
    c = conn.cursor()
    cases = c.execute(f"""
        SELECT cm.*, ch.CrimeGroupName, cs.CaseStatusName,
               d.DistrictName, e.FirstName as OfficerName,
               u.UnitName as StationName
        FROM CaseMaster cm
        JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        JOIN Employee e ON cm.PolicePersonID = e.EmployeeID
        ORDER BY RANDOM()
        LIMIT {n}
    """).fetchall()

    for case in cases:
        cid = case["CaseMasterID"]
        # Accused
        case["accused"] = c.execute(
            "SELECT AccusedName, PersonID FROM Accused WHERE CaseMasterID = ?",
            (cid,)
        ).fetchall()
        # Victims
        case["victims"] = c.execute(
            "SELECT VictimName FROM Victim WHERE CaseMasterID = ?",
            (cid,)
        ).fetchall()
        # Complainant
        case["complainants"] = c.execute(
            "SELECT ComplainantName FROM ComplainantDetails WHERE CaseMasterID = ?",
            (cid,)
        ).fetchall()
        # Sections
        case["sections"] = c.execute("""
            SELECT asa.ActID, asa.SectionID, a.ShortName
            FROM ActSectionAssociation asa
            JOIN Act a ON asa.ActID = a.ActCode
            WHERE asa.CaseMasterID = ?
        """, (cid,)).fetchall()

    return cases


def load_top_accused(conn, n=100):
    """Load top n most wanted accused by case count."""
    c = conn.cursor()
    accused = c.execute("""
        SELECT AccusedName, COUNT(DISTINCT CaseMasterID) as case_count,
               GROUP_CONCAT(DISTINCT CaseMasterID) as case_ids
        FROM Accused
        GROUP BY AccusedName
        ORDER BY case_count DESC
        LIMIT ?
    """, (n,)).fetchall()

    for acc in accused:
        case_ids = [int(x) for x in acc["case_ids"].split(",")][:10]
        placeholders = ",".join("?" * len(case_ids))

        # Crime types
        acc["crime_types"] = c.execute(f"""
            SELECT DISTINCT ch.CrimeGroupName
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE cm.CaseMasterID IN ({placeholders})
        """, case_ids).fetchall()

        # Districts
        acc["districts"] = c.execute(f"""
            SELECT DISTINCT d.DistrictName
            FROM CaseMaster cm
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            WHERE cm.CaseMasterID IN ({placeholders})
        """, case_ids).fetchall()

        # Sections
        acc["sections"] = c.execute(f"""
            SELECT DISTINCT a.ShortName || ' ' || asa.SectionID as sec
            FROM ActSectionAssociation asa
            JOIN Act a ON asa.ActID = a.ActCode
            WHERE asa.CaseMasterID IN ({placeholders})
        """, case_ids).fetchall()

        # Arrest history
        acc_names_rows = c.execute(
            "SELECT AccusedMasterID FROM Accused WHERE AccusedName = ?",
            (acc["AccusedName"],)
        ).fetchall()
        acc_ids = [r["AccusedMasterID"] for r in acc_names_rows]
        if acc_ids:
            ph = ",".join("?" * len(acc_ids))
            acc["arrests"] = c.execute(f"""
                SELECT COUNT(*) as arrest_count
                FROM ArrestSurrender
                WHERE AccusedMasterID IN ({ph})
            """, acc_ids).fetchone()
        else:
            acc["arrests"] = {"arrest_count": 0}

        # Syndicate membership
        if acc_ids:
            ph = ",".join("?" * len(acc_ids))
            acc["syndicate"] = c.execute(f"""
                SELECT cs.syndicate_name, sm.role
                FROM syndicate_members sm
                JOIN crime_syndicates cs ON sm.syndicate_id = cs.syndicate_id
                WHERE sm.accused_master_id IN ({ph})
            """, acc_ids).fetchall()
        else:
            acc["syndicate"] = []

    return accused


def load_district_stats(conn):
    """Load crime statistics by district."""
    c = conn.cursor()

    districts = c.execute("""
        SELECT d.DistrictID, d.DistrictName, COUNT(cm.CaseMasterID) as total_cases
        FROM District d
        LEFT JOIN Unit u ON d.DistrictID = u.DistrictID
        LEFT JOIN CaseMaster cm ON cm.PoliceStationID = u.UnitID
        GROUP BY d.DistrictID, d.DistrictName
        ORDER BY total_cases DESC
    """).fetchall()

    for dist in districts:
        did = dist["DistrictID"]

        # Crime type breakdown
        dist["crime_breakdown"] = c.execute("""
            SELECT ch.CrimeGroupName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            WHERE u.DistrictID = ?
            GROUP BY ch.CrimeGroupName
            ORDER BY cnt DESC
        """, (did,)).fetchall()

        # Status breakdown
        dist["status_breakdown"] = c.execute("""
            SELECT cs.CaseStatusName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            WHERE u.DistrictID = ?
            GROUP BY cs.CaseStatusName
        """, (did,)).fetchall()

        # Arrests count
        dist["arrest_count"] = c.execute("""
            SELECT COUNT(*) as cnt FROM ArrestSurrender
            WHERE ArrestSurrenderDistrictId = ?
        """, (did,)).fetchone()["cnt"]

        # Chargesheet count
        dist["cs_count"] = c.execute("""
            SELECT COUNT(*) as cnt
            FROM ChargesheetDetails cd
            JOIN CaseMaster cm ON cd.CaseMasterID = cm.CaseMasterID
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            WHERE u.DistrictID = ?
        """, (did,)).fetchone()["cnt"]

    return districts


# ═══════════════════════════════════════════════════════════════════
# NARRATIVE GENERATORS
# ═══════════════════════════════════════════════════════════════════

def generate_syndicate_narrative(synd, narrative_id):
    """Generate a deep-dive narrative for a syndicate."""
    members = synd.get("members", [])
    cases = synd.get("cases", [])
    financials = synd.get("financials", {})
    leader = synd["leader_name"]
    name = synd["syndicate_name"]
    specialty = synd["crime_speciality"]
    districts = synd["operating_districts"]

    member_names = list(set(m["AccusedName"] for m in members))[:8]
    case_ids = [c_item["CaseMasterID"] for c_item in cases][:15]

    crime_types = list(set(c_item.get("CrimeGroupName", "") for c_item in cases))
    statuses = list(set(c_item.get("CaseStatusName", "") for c_item in cases))
    district_names = list(set(c_item.get("DistrictName", "") for c_item in cases if c_item.get("DistrictName")))

    total_amount = financials.get("total_amount") or 0
    suspicious_txns = financials.get("suspicious_count") or 0

    # Date range
    dates = [c_item.get("CrimeRegisteredDate", "") for c_item in cases if c_item.get("CrimeRegisteredDate")]
    date_range = f"{min(dates)[:7]} to {max(dates)[:7]}" if dates else "2023-01 to 2024-12"

    # Build narrative
    para1 = (
        f"The {name}, led by {leader}, is a {specialty.lower()} syndicate operating "
        f"across {districts}. Intelligence analysis has linked this network to "
        f"{len(cases)} registered cases spanning {date_range}. The syndicate comprises "
        f"{len(member_names)} identified members including "
        f"{', '.join(member_names[:4])}"
        f"{f' and {len(member_names) - 4} others' if len(member_names) > 4 else ''}. "
        f"Primary criminal activities include {', '.join(crime_types[:3]).lower()}."
    )

    para2 = (
        f"Financial surveillance has flagged {suspicious_txns} suspicious transactions "
        f"totalling approximately Rs.{total_amount:,.0f}. "
        f"Current case status breakdown: {'; '.join(f'{s}' for s in statuses[:4])}. "
        f"Investigating officers are coordinating across {', '.join(district_names[:3])} "
        f"district jurisdictions. CDR analysis reveals significant call traffic between "
        f"identified members 24-72 hours before each incident, indicating pre-planned "
        f"operations. The syndicate has been active since {synd.get('active_from', '2023-01-01')} "
        f"and continues to pose a significant law and order challenge."
    )

    sections = []
    for c_item in cases[:5]:
        sections.extend(
            [f"{ct}" for ct in crime_types[:3]]
        )

    return {
        "narrative_id": narrative_id,
        "type": "syndicate_investigation",
        "title": f"Investigation into {name}",
        "summary": f"{para1}\n\n{para2}",
        "entities": {
            "accused": member_names[:10],
            "cases": case_ids[:15],
            "districts": district_names if district_names else districts.split(", "),
            "sections": list(set(sections))[:6],
            "amount_involved": round(total_amount, 2),
        },
        "metadata": {
            "date_range": date_range,
            "crime_head": specialty,
            "status": ", ".join(statuses[:3]) if statuses else "Under Investigation",
        },
    }


def generate_case_narrative(case, narrative_id):
    """Generate a case summary narrative."""
    accused_names = [a["AccusedName"] for a in case.get("accused", [])]
    victim_names = [v["VictimName"] for v in case.get("victims", [])]
    complainant_names = [c_item["ComplainantName"] for c_item in case.get("complainants", [])]
    sections = [f"{s['ShortName']} {s['SectionID']}" for s in case.get("sections", [])]
    district = case.get("DistrictName", "Unknown")
    crime_type = case.get("CrimeGroupName", "Unknown")
    status = case.get("CaseStatusName", "Under Investigation")
    officer = case.get("OfficerName", "Unknown")
    station = case.get("StationName", "Unknown")

    reg_date = case.get("CrimeRegisteredDate", "2023-01-01")
    crime_no = case.get("CrimeNo", "")
    case_no = case.get("CaseNo", "")

    brief = case.get("BriefFacts", "")

    para1 = (
        f"Case No. {case_no} (Crime No. {crime_no}) was registered on {reg_date} "
        f"at {station}, {district} district under sections {', '.join(sections) if sections else 'IPC'}. "
        f"The case pertains to {crime_type.lower()} and involves "
        f"accused {', '.join(accused_names[:3]) if accused_names else 'unknown persons'}. "
        f"The investigating officer {officer} is handling this case."
    )

    para2 = (
        f"{brief} "
        f"Current status: {status}. "
        f"{'Victims include ' + ', '.join(victim_names[:3]) + '.' if victim_names else ''} "
        f"{'Complaint filed by ' + complainant_names[0] + '.' if complainant_names else ''}"
    )

    return {
        "narrative_id": narrative_id,
        "type": "case_summary",
        "title": f"Case Summary: {crime_type} in {district} ({case_no})",
        "summary": f"{para1}\n\n{para2}",
        "entities": {
            "accused": accused_names[:5],
            "cases": [case["CaseMasterID"]],
            "districts": [district],
            "sections": sections[:5],
            "amount_involved": random.randint(10000, 5000000) if crime_type in [
                "Cheating & Fraud", "Cyber Crime", "Economic Offences"
            ] else 0,
        },
        "metadata": {
            "date_range": reg_date[:7],
            "crime_head": crime_type,
            "status": status,
        },
    }


def generate_accused_profile(acc, narrative_id):
    """Generate an accused profile narrative."""
    name = acc["AccusedName"]
    case_count = acc["case_count"]
    crime_types = [ct["CrimeGroupName"] for ct in acc.get("crime_types", [])]
    districts = [d["DistrictName"] for d in acc.get("districts", [])]
    sections = [s["sec"] for s in acc.get("sections", [])]
    arrest_count = acc.get("arrests", {}).get("arrest_count", 0)
    syndicate_info = acc.get("syndicate", [])
    case_ids = [int(x) for x in acc["case_ids"].split(",")][:10]

    syndicate_text = ""
    if syndicate_info:
        synd_names = [s["syndicate_name"] for s in syndicate_info]
        roles = [s["role"] for s in syndicate_info]
        syndicate_text = (
            f"{name} is identified as a {roles[0].lower()} in the "
            f"{synd_names[0]}. "
        )

    para1 = (
        f"{name} is a person of interest linked to {case_count} criminal cases "
        f"across {', '.join(districts[:3]) if districts else 'multiple'} district(s). "
        f"Criminal activities span {', '.join(crime_types[:4]).lower() if crime_types else 'various offences'}. "
        f"{syndicate_text}"
        f"Sections invoked include {', '.join(sections[:5]) if sections else 'various IPC sections'}."
    )

    para2 = (
        f"Arrest history shows {arrest_count} recorded arrest(s)/surrender(s). "
        f"Intelligence assessment indicates {'high' if case_count >= 5 else 'moderate' if case_count >= 3 else 'low'} "
        f"recidivism risk. Operating primarily in {districts[0] if districts else 'Karnataka'} "
        f"jurisdiction. Cross-referencing with financial intelligence and CDR records "
        f"reveals {'extensive' if case_count >= 5 else 'some'} network connections with "
        f"other accused persons in the database."
    )

    return {
        "narrative_id": narrative_id,
        "type": "accused_profile",
        "title": f"Accused Profile: {name}",
        "summary": f"{para1}\n\n{para2}",
        "entities": {
            "accused": [name],
            "cases": case_ids[:10],
            "districts": districts[:5],
            "sections": sections[:6],
            "amount_involved": 0,
        },
        "metadata": {
            "date_range": "2023-01 to 2024-12",
            "crime_head": crime_types[0] if crime_types else "General",
            "status": f"{case_count} active cases",
        },
    }


def generate_district_report(dist, narrative_id):
    """Generate a district crime report."""
    name = dist["DistrictName"]
    total = dist["total_cases"]
    crime_bd = dist.get("crime_breakdown", [])
    status_bd = dist.get("status_breakdown", [])
    arrests = dist.get("arrest_count", 0)
    cs_count = dist.get("cs_count", 0)

    top_crimes = ", ".join(
        f"{c_item['CrimeGroupName']} ({c_item['cnt']})"
        for c_item in crime_bd[:4]
    ) if crime_bd else "various offences"

    status_summary = ", ".join(
        f"{s['CaseStatusName']}: {s['cnt']}"
        for s in status_bd
    ) if status_bd else "N/A"

    detection_rate = round((arrests / total * 100), 1) if total > 0 else 0
    chargesheet_rate = round((cs_count / total * 100), 1) if total > 0 else 0

    para1 = (
        f"{name} district recorded {total} criminal cases during 2023-2024. "
        f"The crime profile is dominated by {top_crimes}. "
        f"Case status distribution: {status_summary}. "
        f"The district registered {arrests} arrests/surrenders with a detection rate "
        f"of approximately {detection_rate}%."
    )

    para2 = (
        f"Chargesheet filing rate stands at {chargesheet_rate}% with {cs_count} "
        f"chargesheets submitted. Analysis of temporal patterns indicates "
        f"{'higher crime incidence during festival seasons and weekends' if total > 200 else 'relatively stable crime patterns'}. "
        f"Intelligence units have identified "
        f"{'multiple active syndicates' if total > 300 else 'some organized crime elements'} "
        f"operating within the jurisdiction. Resource allocation recommendations: "
        f"{'increase patrol deployment and cyber cell capacity' if total > 300 else 'maintain current deployment with focus on prevention'}."
    )

    return {
        "narrative_id": narrative_id,
        "type": "district_report",
        "title": f"District Crime Report: {name} (2023-2024)",
        "summary": f"{para1}\n\n{para2}",
        "entities": {
            "accused": [],
            "cases": [],
            "districts": [name],
            "sections": [],
            "amount_involved": 0,
        },
        "metadata": {
            "date_range": "2023-01 to 2024-12",
            "crime_head": crime_bd[0]["CrimeGroupName"] if crime_bd else "General",
            "status": f"{total} total cases",
        },
    }


def generate_thematic_report(theme, conn, narrative_id):
    """Generate a thematic report on crime trends."""
    c = conn.cursor()

    theme_configs = {
        "cyber_trends": {
            "title": "Cyber Crime Trends Analysis: Karnataka 2023-2024",
            "crime_head_id": 6,
            "description": "cyber crime",
        },
        "narcotics_patterns": {
            "title": "Narcotics Trafficking Patterns: Karnataka 2023-2024",
            "crime_head_id": 7,
            "description": "narcotics",
        },
        "women_safety": {
            "title": "Crimes Against Women: Statistical Review 2023-2024",
            "crime_head_id": 8,
            "description": "crimes against women",
        },
        "property_crime": {
            "title": "Property Crime Analysis: Karnataka 2023-2024",
            "crime_head_id": 4,
            "description": "property crime",
        },
        "murder_analysis": {
            "title": "Murder & Homicide Patterns: Karnataka 2023-2024",
            "crime_head_id": 1,
            "description": "murder and homicide",
        },
        "robbery_trends": {
            "title": "Robbery & Dacoity Trends: Karnataka 2023-2024",
            "crime_head_id": 3,
            "description": "robbery and dacoity",
        },
        "fraud_investigation": {
            "title": "Cheating & Fraud Investigation Trends: Karnataka 2023-2024",
            "crime_head_id": 5,
            "description": "cheating and fraud",
        },
        "pocso_cases": {
            "title": "POCSO Cases Review: Karnataka 2023-2024",
            "crime_head_id": 9,
            "description": "crimes against children under POCSO",
        },
        "scst_atrocities": {
            "title": "SC/ST Atrocities Status Report: Karnataka 2023-2024",
            "crime_head_id": 10,
            "description": "SC/ST atrocity cases",
        },
        "motor_vehicle": {
            "title": "Motor Vehicle Offences: Road Safety Report 2023-2024",
            "crime_head_id": 12,
            "description": "motor vehicle offences",
        },
        "financial_crime": {
            "title": "Financial Intelligence Report: Suspicious Transactions 2023-2024",
            "crime_head_id": 14,
            "description": "economic and financial crime",
        },
        "arms_offences": {
            "title": "Arms Act Violations: Karnataka 2023-2024",
            "crime_head_id": 11,
            "description": "arms act violations",
        },
        "kidnapping_trends": {
            "title": "Kidnapping & Abduction Cases: Karnataka 2023-2024",
            "crime_head_id": 15,
            "description": "kidnapping and abduction",
        },
        "arrest_efficiency": {
            "title": "Arrest Efficiency & Detection Rate Analysis 2023-2024",
            "crime_head_id": None,
            "description": "arrest efficiency and detection rates",
        },
        "syndicate_network": {
            "title": "Organized Crime Network Analysis: Karnataka 2023-2024",
            "crime_head_id": None,
            "description": "organized crime networks and syndicate operations",
        },
        "seasonal_crime": {
            "title": "Seasonal Crime Pattern Analysis: Karnataka 2023-2024",
            "crime_head_id": None,
            "description": "seasonal and temporal crime patterns",
        },
    }

    config = theme_configs.get(theme, theme_configs["cyber_trends"])
    chid = config["crime_head_id"]
    desc = config["description"]

    # Get stats
    if chid:
        stats = c.execute("""
            SELECT COUNT(*) as total, 
                   COUNT(DISTINCT u.DistrictID) as dist_count
            FROM CaseMaster cm
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            WHERE cm.CrimeMajorHeadID = ?
        """, (chid,)).fetchone()

        top_districts = c.execute("""
            SELECT d.DistrictName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            WHERE cm.CrimeMajorHeadID = ?
            GROUP BY d.DistrictName
            ORDER BY cnt DESC LIMIT 5
        """, (chid,)).fetchall()

        status_dist = c.execute("""
            SELECT cs.CaseStatusName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
            WHERE cm.CrimeMajorHeadID = ?
            GROUP BY cs.CaseStatusName
        """, (chid,)).fetchall()
    else:
        stats = c.execute("SELECT COUNT(*) as total FROM CaseMaster").fetchone()
        stats["dist_count"] = 30
        top_districts = c.execute("""
            SELECT d.DistrictName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN Unit u ON cm.PoliceStationID = u.UnitID
            JOIN District d ON u.DistrictID = d.DistrictID
            GROUP BY d.DistrictName
            ORDER BY cnt DESC LIMIT 5
        """).fetchall()
        status_dist = c.execute("""
            SELECT cs.CaseStatusName, COUNT(*) as cnt
            FROM CaseMaster cm
            JOIN CaseStatusMaster cs ON cm.CaseStatusID = cs.CaseStatusID
            GROUP BY cs.CaseStatusName
        """).fetchall()

    total = stats["total"]
    dist_count = stats["dist_count"]
    top_dist_text = ", ".join(
        f"{d['DistrictName']} ({d['cnt']})" for d in top_districts[:4]
    )
    status_text = ", ".join(
        f"{s['CaseStatusName']}: {s['cnt']}" for s in status_dist
    )

    para1 = (
        f"Analysis of {desc} across Karnataka for 2023-2024 reveals {total} "
        f"registered cases spanning {dist_count} districts. The highest concentration "
        f"of cases was observed in {top_dist_text}. This thematic report consolidates "
        f"intelligence from case records, financial transaction monitoring, and CDR "
        f"analysis to present actionable insights for law enforcement leadership."
    )

    para2 = (
        f"Case resolution status: {status_text}. "
        f"{'Digital forensics and cyber cell investigations have been instrumental in cracking complex cases. ' if chid == 6 else ''}"
        f"{'NDPS raids and inter-state coordination have yielded significant seizures. ' if chid == 7 else ''}"
        f"{'Women helpdesk and fast-track court mechanisms are being leveraged for quicker resolution. ' if chid == 8 else ''}"
        f"Trend analysis suggests {'an upward trajectory' if total > 500 else 'stable patterns'} "
        f"in {desc} cases. Recommended interventions include enhanced surveillance, "
        f"community policing initiatives, and inter-district intelligence sharing "
        f"to improve detection and prevention rates."
    )

    districts_list = [d["DistrictName"] for d in top_districts[:5]]

    return {
        "narrative_id": narrative_id,
        "type": "thematic_report",
        "title": config["title"],
        "summary": f"{para1}\n\n{para2}",
        "entities": {
            "accused": [],
            "cases": [],
            "districts": districts_list,
            "sections": [],
            "amount_involved": 0,
        },
        "metadata": {
            "date_range": "2023-01 to 2024-12",
            "crime_head": desc.title(),
            "status": f"{total} total cases analysed",
        },
    }


# ═══════════════════════════════════════════════════════════════════
# MAIN GENERATION
# ═══════════════════════════════════════════════════════════════════

def main():
    print("╔══════════════════════════════════════════════════════════════════╗")
    print("║  PROJECT SENTINEL v2 — RAG Narrative Generation                ║")
    print("╚══════════════════════════════════════════════════════════════════╝")
    print(f"  Input:  {DB_PATH}")
    print(f"  Output: {OUTPUT_JSON}")
    print()

    conn = get_conn()
    narratives = []
    nid = 1

    # ── 1. Syndicate Deep-Dives (20) ──
    print("  Generating syndicate deep-dives...")
    syndicates = load_syndicates(conn)
    for synd in syndicates:
        narratives.append(generate_syndicate_narrative(synd, nid))
        nid += 1
    print(f"  ✓ {len(syndicates)} syndicate narratives")

    # ── 2. Individual Case Summaries (200) ──
    print("  Generating case summaries...")
    cases = load_random_cases(conn, 200)
    for case in cases:
        narratives.append(generate_case_narrative(case, nid))
        nid += 1
    print(f"  ✓ {len(cases)} case summaries")

    # ── 3. Accused Profiles (100) ──
    print("  Generating accused profiles...")
    accused = load_top_accused(conn, 100)
    for acc in accused:
        narratives.append(generate_accused_profile(acc, nid))
        nid += 1
    print(f"  ✓ {len(accused)} accused profiles")

    # ── 4. District Reports (100 — cycles through districts multiple times) ──
    print("  Generating district reports...")
    districts = load_district_stats(conn)
    dist_count = 0
    dist_idx = 0
    while dist_count < 100:
        dist = districts[dist_idx % len(districts)]
        narratives.append(generate_district_report(dist, nid))
        nid += 1
        dist_count += 1
        dist_idx += 1
    print(f"  ✓ {dist_count} district reports")

    # ── 5. Thematic Reports (80) ──
    print("  Generating thematic reports...")
    themes = [
        "cyber_trends", "narcotics_patterns", "women_safety",
        "property_crime", "murder_analysis", "robbery_trends",
        "fraud_investigation", "pocso_cases", "scst_atrocities",
        "motor_vehicle", "financial_crime", "arms_offences",
        "kidnapping_trends", "arrest_efficiency", "syndicate_network",
        "seasonal_crime",
    ]
    theme_count = 0
    theme_idx = 0
    while theme_count < 80:
        theme = themes[theme_idx % len(themes)]
        narratives.append(generate_thematic_report(theme, conn, nid))
        nid += 1
        theme_count += 1
        theme_idx += 1
    print(f"  ✓ {theme_count} thematic reports")

    conn.close()

    # ── Write JSON ──
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(narratives, f, indent=2, ensure_ascii=False, default=str)

    elapsed = time.time() - START_TIME
    print(f"\n  ✅ Generated {len(narratives)} narratives in {elapsed:.1f}s")
    print(f"  📁 Output: {OUTPUT_JSON}")

    # Summary by type
    type_counts = defaultdict(int)
    for n in narratives:
        type_counts[n["type"]] += 1
    print("\n  Breakdown:")
    for t, c_val in sorted(type_counts.items()):
        print(f"    {t:<30s} {c_val:>4}")
    print()


if __name__ == "__main__":
    main()
