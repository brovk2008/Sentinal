import os
import sqlite3
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional

from services.criminology_engine import (
    analyze_mo_clusters,
    calculate_near_repeat_risk,
    analyze_syndicate_intersect,
    detect_spree_alerts
)

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sentinal.db")

@router.get("/mo-clusters")
async def get_mo_clusters():
    """
    Returns Modus Operandi (MO) series linking clusters across FIRs.
    """
    try:
        data = analyze_mo_clusters(DB_PATH)
        return {"status": "ok", "total_series": len(data), "mo_clusters": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/near-repeat-risk")
async def get_near_repeat_risk():
    """
    Returns Bowers & Johnson Near Repeat Spatial-Temporal Risk Forecasting zones.
    """
    try:
        data = calculate_near_repeat_risk(DB_PATH)
        return {"status": "ok", "total_zones": len(data), "risk_zones": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/syndicate-graph")
async def get_syndicate_graph():
    """
    Returns cross-FIR entity matching and criminal syndicate rosters.
    """
    try:
        data = analyze_syndicate_intersect(DB_PATH)
        return {"status": "ok", "total_syndicates": len(data), "syndicates": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/spree-alerts")
async def get_spree_alerts():
    """
    Detects active crime sprees and repeat victimization patterns.
    """
    try:
        data = detect_spree_alerts(DB_PATH)
        return {"status": "ok", "total_alerts": len(data), "spree_alerts": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
