"""
routers/criminology.py — Criminology, MO Series, and Near-Repeat Analysis API
"""
import os
import sqlite3
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional

from services.criminology_engine import (
    analyze_mo_clusters,
    compute_near_repeat_risk,
    find_similar_cases,
    detect_crime_sprees,
    detect_repeat_victimization,
    build_escalation_matrix,
)

router = APIRouter()


@router.get("/mo-clusters")
async def get_mo_clusters(limit: int = Query(200, ge=10, le=1000)):
    """
    Returns Modus Operandi (MO) series linking clusters across FIRs using TF-IDF n-grams
    and single-linkage agglomerative clustering.
    """
    try:
        clusters = analyze_mo_clusters(limit=limit)
        return {
            "status": "ok",
            "total_series": len(clusters),
            "mo_clusters": clusters
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/near-repeat-risk")
async def get_near_repeat_risk(
    target_lat: float = Query(12.9716, ge=-90.0, le=90.0),
    target_lng: float = Query(77.5946, ge=-180.0, le=180.0),
    radius_km: float = Query(2.0, ge=0.2, le=20.0),
    days_window: int = Query(30, ge=1, le=180)
):
    """
    Evaluates Bowers-Johnson Near-Repeat crime risk surface.
    """
    try:
        result = compute_near_repeat_risk(
            target_lat=target_lat,
            target_lng=target_lng,
            radius_km=radius_km,
            days_window=days_window
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/similar-cases/{case_id}")
async def get_similar_cases(case_id: int, top_k: int = Query(5, ge=1, le=20)):
    """
    Finds top-k MO-similar cases using TF-IDF cosine similarity.
    """
    try:
        return find_similar_cases(case_id=case_id, top_k=top_k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/spree-detection")
@router.get("/spree-alerts")
async def get_spree_detection(
    days_window: int = Query(14, ge=1, le=60),
    min_events: int = Query(3, ge=2, le=10)
):
    """
    Detects rapid crime sprees: clusters of 3+ crimes by the same accused.
    """
    try:
        sprees = detect_crime_sprees(days_window=days_window, min_events=min_events)
        return {"status": "ok", "sprees_detected": len(sprees), "sprees": sprees, "alerts": sprees}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/syndicate-graph")
@router.get("/syndicates")
async def get_syndicate_graph(limit: int = Query(200, ge=10, le=1000)):
    """
    Returns syndicate graph and clusters for criminological pattern intelligence.
    """
    try:
        from database import query
        clusters = query("""
            SELECT s.SyndicateID, s.SyndicateName, s.Specialization, s.ThreatLevel,
                   COUNT(DISTINCT sm.AccusedMasterID) as member_count
            FROM Syndicates s
            LEFT JOIN SyndicateMembers sm ON s.SyndicateID = sm.SyndicateID
            GROUP BY s.SyndicateID
            LIMIT ?
        """, (limit,))
        return {"status": "ok", "syndicates": clusters, "total": len(clusters)}
    except Exception:
        return {"status": "ok", "syndicates": [], "total": 0}


@router.get("/repeat-victims")
async def get_repeat_victims(days_window: int = Query(90, ge=7, le=365)):
    """
    Finds repeat victimizations with exponential temporal risk decay.
    """
    try:
        victims = detect_repeat_victimization(days_window=days_window)
        return {"status": "ok", "repeat_victims_count": len(victims), "victims": victims}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/escalation-matrix")
async def get_escalation_matrix(limit: int = Query(5000, ge=100, le=10000)):
    """
    Returns Markov crime escalation transition probabilities and high-risk trajectories.
    """
    try:
        return build_escalation_matrix(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
