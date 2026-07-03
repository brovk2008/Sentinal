"""Financial intelligence router — suspicious transactions, mule accounts."""
from fastapi import APIRouter, Query
from database import query

router = APIRouter()


@router.get("/suspicious-transactions")
async def suspicious_transactions(limit: int = Query(100, ge=1, le=500)):
    """Transactions flagged as suspicious."""
    rows = query("""
        SELECT ft.*, a.AccusedName
        FROM financial_transactions ft
        LEFT JOIN Accused a ON ft.linked_accused_id = a.AccusedMasterID
        WHERE ft.is_suspicious = 1
        ORDER BY ft.amount DESC
        LIMIT ?
    """, (limit,))
    return rows


@router.get("/network")
async def financial_network():
    """Transaction graph for vis-network."""
    nodes = {}
    edges = []

    rows = query("""
        SELECT sender_name, receiver_name, SUM(amount) as total,
               COUNT(*) as txn_count
        FROM financial_transactions
        WHERE is_suspicious = 1
        GROUP BY sender_name, receiver_name
        HAVING txn_count >= 2
        ORDER BY total DESC
        LIMIT 100
    """)

    for row in rows:
        s = row["sender_name"]
        r = row["receiver_name"]
        if s not in nodes:
            nodes[s] = {"id": s, "label": s, "type": "person"}
        if r not in nodes:
            nodes[r] = {"id": r, "label": r, "type": "person"}
        edges.append({
            "from": s, "to": r,
            "label": f"Rs.{row['total']:,.0f}",
            "value": row["total"],
            "count": row["txn_count"],
        })

    return {"nodes": list(nodes.values()), "edges": edges}


@router.get("/mule-accounts")
async def mule_accounts():
    """Accounts receiving from many different senders — potential mules."""
    rows = query("""
        SELECT receiver_name as name,
               COUNT(DISTINCT sender_name) as unique_senders,
               SUM(amount) as total_received,
               COUNT(*) as txn_count,
               SUM(CASE WHEN is_suspicious = 1 THEN 1 ELSE 0 END) as suspicious_count
        FROM financial_transactions
        GROUP BY receiver_name
        HAVING unique_senders >= 3
        ORDER BY unique_senders DESC
        LIMIT 20
    """)
    return rows


@router.get("/summary")
async def financial_summary():
    """Aggregate financial intelligence summary."""
    total = query("""
        SELECT COUNT(*) as total_txns,
               SUM(amount) as total_amount,
               AVG(amount) as avg_amount,
               SUM(CASE WHEN is_suspicious = 1 THEN 1 ELSE 0 END) as suspicious_count,
               SUM(CASE WHEN is_suspicious = 1 THEN amount ELSE 0 END) as suspicious_amount
        FROM financial_transactions
    """)
    by_type = query("""
        SELECT txn_type, COUNT(*) as count, SUM(amount) as total
        FROM financial_transactions
        GROUP BY txn_type
        ORDER BY total DESC
    """)
    return {"summary": total[0] if total else {}, "by_type": by_type}
