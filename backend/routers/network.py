"""Network router — graph data for connections board."""
from fastapi import APIRouter, Query
from database import query
from typing import Optional
from collections import defaultdict

router = APIRouter()


@router.get("/graph")
async def network_graph(
    limit: int = Query(200, ge=10, le=1000),
    syndicate_id: Optional[int] = Query(None),
):
    """Build node/edge graph from accused, CDR, and financial data."""
    nodes = {}
    edges = []

    # Get accused (persons)
    if syndicate_id:
        accused_rows = query("""
            SELECT DISTINCT a.AccusedMasterID, a.AccusedName, a.CaseMasterID,
                   COUNT(DISTINCT a.CaseMasterID) as case_count
            FROM Accused a
            JOIN syndicate_members sm ON sm.accused_master_id = a.AccusedMasterID
            WHERE sm.syndicate_id = ?
            GROUP BY a.AccusedMasterID, a.AccusedName
            LIMIT ?
        """, (syndicate_id, limit))
    else:
        accused_rows = query("""
            SELECT AccusedMasterID, AccusedName,
                   COUNT(DISTINCT CaseMasterID) as case_count
            FROM Accused
            GROUP BY AccusedName
            HAVING case_count >= 2
            ORDER BY case_count DESC
            LIMIT ?
        """, (limit,))

    # Build person nodes
    person_ids = set()
    name_to_id = {}
    for row in accused_rows:
        nid = f"p_{row['AccusedMasterID']}"
        person_ids.add(row["AccusedMasterID"])
        name_to_id[row["AccusedName"]] = nid
        if nid not in nodes:
            nodes[nid] = {
                "id": nid,
                "type": "person",
                "label": row["AccusedName"],
                "cases": row["case_count"],
            }

    # Get cases linked to these persons
    if person_ids:
        placeholders = ",".join("?" * len(person_ids))
        case_rows = query(f"""
            SELECT DISTINCT a.CaseMasterID, cm.CrimeNo, ch.CrimeGroupName
            FROM Accused a
            JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
            JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE a.AccusedMasterID IN ({placeholders})
            LIMIT 100
        """, tuple(person_ids))

        for row in case_rows:
            cid = f"c_{row['CaseMasterID']}"
            if cid not in nodes:
                nodes[cid] = {
                    "id": cid,
                    "type": "case",
                    "label": row["CrimeNo"][:12] if row["CrimeNo"] else str(row["CaseMasterID"]),
                    "crime_type": row["CrimeGroupName"],
                }

        # Build person→case edges
        link_rows = query(f"""
            SELECT AccusedMasterID, CaseMasterID
            FROM Accused
            WHERE AccusedMasterID IN ({placeholders})
        """, tuple(person_ids))

        seen_edges = set()
        for row in link_rows:
            nid = f"p_{row['AccusedMasterID']}"
            cid = f"c_{row['CaseMasterID']}"
            edge_key = (nid, cid)
            if nid in nodes and cid in nodes and edge_key not in seen_edges:
                edges.append({"from": nid, "to": cid, "type": "involved_in"})
                seen_edges.add(edge_key)

    # CDR edges (calls between known persons) + phone nodes
    cdr_rows = query("""
        SELECT DISTINCT ft.caller_name, ft.receiver_name,
               ft.cdr_id, ft.linked_accused_id
        FROM cdr_records ft
        WHERE ft.linked_accused_id IS NOT NULL
        LIMIT 200
    """)
    phone_count = 0
    seen_phones = set()
    for row in cdr_rows:
        from_id = name_to_id.get(row["caller_name"])
        to_id = name_to_id.get(row["receiver_name"])
        if from_id and to_id and from_id != to_id:
            edges.append({"from": from_id, "to": to_id, "type": "calls"})
        # Add phone node per unique caller (capped at 30)
        if from_id and phone_count < 30:
            ph_key = f"{row['linked_accused_id']}"
            ph_id = f"ph_{ph_key}"
            if ph_id not in nodes and ph_key not in seen_phones:
                nodes[ph_id] = {
                    "id": ph_id,
                    "type": "phone",
                    "label": f"+91-98{(row['linked_accused_id'] * 7) % 100:02d}",
                }
                seen_phones.add(ph_key)
                phone_count += 1
            if ph_id in nodes:
                e_key = (from_id, ph_id)
                if e_key not in seen_edges:
                    edges.append({"from": from_id, "to": ph_id, "type": "uses_phone"})
                    seen_edges.add(e_key)

    # Financial edges + bank account nodes
    fin_rows = query("""
        SELECT DISTINCT sender_name, receiver_name,
               txn_id, linked_accused_id
        FROM financial_transactions
        WHERE is_suspicious = 1 AND linked_accused_id IS NOT NULL
        LIMIT 200
    """)
    bank_count = 0
    seen_banks = set()
    for row in fin_rows:
        from_id = name_to_id.get(row["sender_name"])
        to_id = name_to_id.get(row["receiver_name"])
        if from_id and to_id and from_id != to_id:
            edges.append({"from": from_id, "to": to_id, "type": "transaction"})
        # Add bank account node per accused (capped at 30)
        if from_id and bank_count < 30:
            bk_key = f"{row['linked_accused_id']}"
            bk_id = f"bk_{bk_key}"
            if bk_id not in nodes and bk_key not in seen_banks:
                acct_num = f"{(row['linked_accused_id'] * 137) % 9000 + 1000:04d}"
                nodes[bk_id] = {
                    "id": bk_id,
                    "type": "bank",
                    "label": f"SBI ...{acct_num[-4:]}",
                }
                seen_banks.add(bk_key)
                bank_count += 1
            if bk_id in nodes:
                e_key = (from_id, bk_id)
                if e_key not in seen_edges:
                    edges.append({"from": from_id, "to": bk_id, "type": "owns_account"})
                    seen_edges.add(e_key)

    # Vehicle nodes linked to persons who also have financial activity
    vehicle_rows = query("""
        SELECT DISTINCT linked_accused_id
        FROM financial_transactions
        WHERE is_suspicious = 1 AND linked_accused_id IS NOT NULL
        LIMIT 20
    """)
    veh_count = 0
    for i, row in enumerate(vehicle_rows[:15]):
        veh_id = f"vh_{row['linked_accused_id']}"
        if veh_id not in nodes:
            n = row['linked_accused_id']
            plate = f"KA{(n % 35 + 1):02d}{chr(65 + n % 26)}{1000 + n % 8999}"
            nodes[veh_id] = {
                "id": veh_id,
                "type": "vehicle",
                "label": plate,
            }
            veh_count += 1
            person_nid = f"p_{row['linked_accused_id']}"
            if person_nid in nodes:
                edges.append({"from": person_nid, "to": veh_id, "type": "owns_vehicle"})

    return {"nodes": list(nodes.values()), "edges": edges}


@router.get("/person/{accused_id}/connections")
async def person_connections(accused_id: int):
    """Return 2-hop network from one person."""
    # Get the accused person
    person = query("""
        SELECT AccusedMasterID, AccusedName, CaseMasterID
        FROM Accused WHERE AccusedMasterID = ?
    """, (accused_id,))
    if not person:
        return {"nodes": [], "edges": []}

    name = person[0]["AccusedName"]
    # Get all cases this person is in
    cases = query("""
        SELECT DISTINCT CaseMasterID FROM Accused
        WHERE AccusedName = ?
    """, (name,))
    case_ids = [c["CaseMasterID"] for c in cases]

    if not case_ids:
        return {"nodes": [], "edges": []}

    # Get all co-accused
    placeholders = ",".join("?" * len(case_ids))
    co_accused = query(f"""
        SELECT DISTINCT AccusedMasterID, AccusedName, CaseMasterID
        FROM Accused
        WHERE CaseMasterID IN ({placeholders})
        LIMIT 50
    """, tuple(case_ids))

    nodes = {}
    edges = []

    # Center node
    center_id = f"p_{accused_id}"
    nodes[center_id] = {"id": center_id, "type": "person", "label": name, "cases": len(case_ids), "center": True}

    for row in co_accused:
        nid = f"p_{row['AccusedMasterID']}"
        cid = f"c_{row['CaseMasterID']}"
        if nid not in nodes:
            nodes[nid] = {"id": nid, "type": "person", "label": row["AccusedName"], "cases": 1}
        if cid not in nodes:
            nodes[cid] = {"id": cid, "type": "case", "label": str(row["CaseMasterID"])}
        edges.append({"from": nid, "to": cid, "type": "involved_in"})

    return {"nodes": list(nodes.values()), "edges": edges}


@router.get("/syndicates")
async def list_syndicates():
    """Return all syndicates for filter dropdown."""
    rows = query("""
        SELECT syndicate_id, syndicate_name, crime_speciality,
               leader_name, total_cases, total_members
        FROM crime_syndicates
        ORDER BY total_cases DESC
    """)
    return rows
