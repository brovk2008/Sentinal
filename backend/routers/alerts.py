from fastapi import APIRouter, Query
from database import query
from datetime import datetime
import os
import httpx

router = APIRouter()

# In-memory alert store (max 100, FIFO)
_alerts = []
_alert_id = 0


def _generate_initial_alerts():
    """Generate sample alerts from data on first call."""
    global _alert_id, _alerts
    if _alerts:
        return

    # High-value suspicious transactions
    txns = query("""
        SELECT txn_id, sender_name, receiver_name, amount, txn_date, linked_case_id
        FROM financial_transactions
        WHERE is_suspicious = 1 AND amount > 500000
        ORDER BY amount DESC
        LIMIT 10
    """)
    for txn in txns:
        _alert_id += 1
        _alerts.append({
            "id": _alert_id,
            "type": "HIGH_VALUE_TXN",
            "title": f"Suspicious Transaction: Rs.{txn['amount']:,.0f}",
            "description": f"{txn['sender_name']} → {txn['receiver_name']}",
            "case_id": txn.get("linked_case_id"),
            "severity": "high",
            "timestamp": txn["txn_date"],
        })

    # District crime spikes (top 5 districts by case count)
    spikes = query("""
        SELECT d.DistrictName, COUNT(*) as cnt
        FROM CaseMaster cm
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        WHERE cm.CrimeRegisteredDate >= '2024-10-01'
        GROUP BY d.DistrictName
        ORDER BY cnt DESC
        LIMIT 5
    """)
    for spike in spikes:
        _alert_id += 1
        _alerts.append({
            "id": _alert_id,
            "type": "CRIME_SPIKE",
            "title": f"Crime Spike: {spike['DistrictName']}",
            "description": f"{spike['cnt']} cases registered in Q4 2024",
            "case_id": None,
            "severity": "medium",
            "timestamp": "2024-12-01",
        })

    # Syndicate activity alerts
    synd = query("""
        SELECT cs.syndicate_name, cs.total_cases, cs.crime_speciality
        FROM crime_syndicates cs
        ORDER BY cs.total_cases DESC
        LIMIT 5
    """)
    for s in synd:
        _alert_id += 1
        _alerts.append({
            "id": _alert_id,
            "type": "SYNDICATE_ACTIVITY",
            "title": f"Active Syndicate: {s['syndicate_name']}",
            "description": f"{s['total_cases']} linked cases — {s['crime_speciality']}",
            "case_id": None,
            "severity": "critical",
            "timestamp": "2024-11-15",
        })

    _alerts.sort(key=lambda x: x["id"], reverse=True)


@router.get("/recent")
async def recent_alerts(limit: int = Query(10, ge=1, le=50)):
    """Return recent alerts."""
    _generate_initial_alerts()
    return _alerts[:limit]


@router.get("/stats")
async def alert_stats():
    """Return alert count by type and severity."""
    _generate_initial_alerts()
    by_type = {}
    by_severity = {}
    for a in _alerts:
        by_type[a["type"]] = by_type.get(a["type"], 0) + 1
        by_severity[a["severity"]] = by_severity.get(a["severity"], 0) + 1
    return {"total": len(_alerts), "by_type": by_type, "by_severity": by_severity}


async def push_to_catalyst_signals(alert: dict):
    url = os.getenv("CATALYST_SIGNALS_URL")
    key = os.getenv("CATALYST_SIGNALS_KEY")
    if url and key:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    url,
                    headers={"Authorization": f"Bearer {key}"},
                    json=alert,
                    timeout=5
                )
        except Exception as e:
            print(f"[Catalyst Signals] Pushing alert failed: {e}")


@router.post("/cron/run-anomaly-scan")
async def run_anomaly_scan():
    global _alert_id, _alerts
    _generate_initial_alerts()
    
    txns = query("""
        SELECT txn_id, sender_name, receiver_name, amount, txn_date, linked_case_id
        FROM financial_transactions
        WHERE amount > 500000
        LIMIT 10
    """)
    
    new_alerts_count = 0
    existing_titles = set(a['title'] for a in _alerts)
    
    for txn in txns:
        title = f"CRITICAL TRANSACTION: Rs.{txn['amount']:,.0f}"
        if title not in existing_titles:
            _alert_id += 1
            alert = {
                "id": _alert_id,
                "type": "SUSPICIOUS_TRANSFER",
                "title": title,
                "description": f"Large transfer: {txn['sender_name']} to {txn['receiver_name']}",
                "case_id": txn.get("linked_case_id"),
                "severity": "critical",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            _alerts.insert(0, alert)
            new_alerts_count += 1
            await push_to_catalyst_signals(alert)
            
    return {
        "status": "success",
        "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "new_alerts_detected": new_alerts_count
    }
