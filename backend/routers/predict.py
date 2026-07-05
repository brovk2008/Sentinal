"""
Prediction API Router
All ML-powered crime prediction endpoints.
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from database import query, query_one
import os
import json
from datetime import datetime, timedelta

router = APIRouter()

# Dynamic absolute models directory
MODELS_DIR = Path(__file__).resolve().parent.parent / "models" / "ml" / "saved"

# ─── Load all models at startup ─────────────────────────────────────
_models = {}

def load_models():
    global _models
    model_files = {
        'hotspot':        'hotspot_v2.joblib',
        'crime_type':     'crime_type_predictor.joblib',
        'reoffend':       'reoffend_risk.joblib',
        'resolution':     'case_resolution.joblib',
    }
    for name, filename in model_files.items():
        path = MODELS_DIR / filename
        if path.exists():
            try:
                _models[name] = joblib.load(path)
                print(f"  Loaded prediction model: {name}")
            except Exception as e:
                print(f"  ERROR: Failed to load prediction model {name} ({filename}): {e}")
        else:
            print(f"  WARNING: Model file not found: {filename} — train it first")


# ─── 1. HOTSPOT PREDICTION ──────────────────────────────────────────
@router.get("/hotspots")
def predict_hotspots(
    days_ahead: int = Query(7, ge=1, le=30),
    district_id: Optional[int] = None
):
    """
    Predict which police station zones will be crime hotspots
    in the next N days. Returns geospatial points with risk scores.
    """
    if 'hotspot' not in _models:
        raise HTTPException(503, "Hotspot model not loaded — run train_hotspot_v2.py first")

    model_bundle = _models['hotspot']
    model = model_bundle['model']

    district_filter = "WHERE u.DistrictID = ?" if district_id else ""
    params = (district_id,) if district_id else ()

    stations = query(f"""
        SELECT
            u.UnitID as station_id,
            u.UnitName as station_name,
            d.DistrictID as district_id,
            d.DistrictName as district_name,
            COUNT(cm.CaseMasterID) as recent_cases,
            AVG(cm.GravityOffenceID) as avg_gravity,
            COUNT(DISTINCT cm.CrimeMajorHeadID) as crime_type_diversity,
            (SELECT AVG(latitude) FROM CaseMaster WHERE PoliceStationID = u.UnitID) as center_lat,
            (SELECT AVG(longitude) FROM CaseMaster WHERE PoliceStationID = u.UnitID) as center_lng
        FROM Unit u
        JOIN District d ON u.DistrictID = d.DistrictID
        LEFT JOIN CaseMaster cm ON u.UnitID = cm.PoliceStationID
            AND cm.CrimeRegisteredDate >= date((SELECT MAX(CrimeRegisteredDate) FROM CaseMaster), '-30 days')
        {district_filter}
        GROUP BY u.UnitID, u.UnitName, d.DistrictID, d.DistrictName
        HAVING center_lat IS NOT NULL
    """, params)

    target_month = (datetime.now() + timedelta(days=days_ahead)).month

    results = []
    for s in stations:
        features = pd.DataFrame([{
            'PoliceStationID':    s['station_id'],
            'month':              target_month,
            'case_count':         s['recent_cases'] or 0,
            'avg_gravity':        s['avg_gravity'] or 1.0,
            'unique_crime_types': s['crime_type_diversity'] or 1,
            'avg_accused':        1.5,
            'total_amount':       0.0,
            'avg_calls':          0.0,
            'is_weekend_rate':    0.28
        }])

        prob = float(model.predict_proba(features)[0][1])
        risk_level = (
            'CRITICAL' if prob >= 0.80 else
            'HIGH'     if prob >= 0.60 else
            'MEDIUM'   if prob >= 0.40 else
            'LOW'
        )

        results.append({
            'station_id':     s['station_id'],
            'station_name':   s['station_name'],
            'district_id':    s['district_id'],
            'district_name':  s['district_name'],
            'lat':            s['center_lat'],
            'lng':            s['center_lng'],
            'hotspot_prob':   round(prob, 4),
            'risk_level':     risk_level,
            'recent_cases':   s['recent_cases'] or 0,
            'days_ahead':     days_ahead
        })

    results.sort(key=lambda x: x['hotspot_prob'], reverse=True)
    return {
        'predictions': results,
        'total_stations': len(results),
        'high_risk_count': sum(1 for r in results if r['hotspot_prob'] >= 0.60),
        'prediction_window': f"Next {days_ahead} days",
        'model_version': 'hotspot_v2'
    }


# ─── 2. CRIME TYPE PREDICTION ──────────────────────────────────────
@router.get("/crime-type")
def predict_crime_type(
    station_id: int,
    month: Optional[int] = None,
    dayofweek: Optional[int] = None
):
    """
    Given a police station, month, and day of week,
    predict the most likely crime types that will occur.
    Returns top 5 crime types with probabilities.
    """
    if 'crime_type' not in _models:
        raise HTTPException(503, "Crime type model not loaded")

    model_bundle = _models['crime_type']
    model = model_bundle['model']
    label_encoder = model_bundle['label_encoder']

    now = datetime.now()
    features = pd.DataFrame([{
        'PoliceStationID': station_id,
        'month':           month or now.month,
        'dayofweek':       dayofweek if dayofweek is not None else now.weekday(),
        'quarter':         ((month or now.month) - 1) // 3 + 1,
        'is_weekend':      int((dayofweek if dayofweek is not None else now.weekday()) >= 5)
    }])

    probs = model.predict_proba(features)[0]
    top5_indices = np.argsort(probs)[-5:][::-1]

    crime_heads = query("SELECT CrimeHeadID, CrimeGroupName FROM CrimeHead")
    head_map = {c['CrimeHeadID']: c['CrimeGroupName'] for c in crime_heads}

    predictions = []
    for idx in top5_indices:
        crime_head_id = int(label_encoder.inverse_transform([idx])[0])
        predictions.append({
            'crime_head_id':   crime_head_id,
            'crime_type':      head_map.get(crime_head_id, f'Type {crime_head_id}'),
            'probability':     round(float(probs[idx]), 4),
            'percentage':      f"{probs[idx]*100:.1f}%"
        })

    station = query_one(
        "SELECT UnitName FROM Unit WHERE UnitID = ?", (station_id,)
    )
    return {
        'station_id':     station_id,
        'station_name':   station['UnitName'] if station else 'Unknown',
        'predictions':    predictions,
        'top_prediction': predictions[0] if predictions else None
    }


# ─── 3. REPEAT OFFENDER RISK SCORE ────────────────────────────────
@router.get("/reoffend-risk/{accused_id}")
def predict_reoffend_risk(accused_id: int):
    """
    Score the probability that a specific accused person
    will appear in another case within the next 90 days.
    Returns risk score + contributing factors.
    """
    if 'reoffend' not in _models:
        raise HTTPException(503, "Reoffend model not loaded")

    accused = query_one(
        "SELECT * FROM Accused WHERE AccusedMasterID = ?", (accused_id,)
    )
    if not accused:
        raise HTTPException(404, "Accused not found")

    history = query("""
        SELECT
            COUNT(DISTINCT a.CaseMasterID) as total_cases,
            MIN(cm.CrimeRegisteredDate) as first_case,
            MAX(cm.CrimeRegisteredDate) as last_case,
            COUNT(DISTINCT cm.CrimeMajorHeadID) as crime_type_diversity,
            AVG(cm.GravityOffenceID) as avg_gravity,
            COUNT(DISTINCT arr.ArrestSurrenderID) as arrest_count,
            COUNT(DISTINCT cs.CSID) as chargesheet_count
        FROM Accused a
        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
        LEFT JOIN ArrestSurrender arr ON arr.CaseMasterID = cm.CaseMasterID
            AND arr.AccusedMasterID = a.AccusedMasterID
        LEFT JOIN ChargesheetDetails cs ON cs.CaseMasterID = cm.CaseMasterID
        WHERE a.AccusedName = (
            SELECT AccusedName FROM Accused WHERE AccusedMasterID = ?
        )
    """, (accused_id,))

    h = history[0] if history else {}

    total_cases = h.get('total_cases') or 1
    first_case = h.get('first_case') or '2023-01-01'
    last_case = h.get('last_case') or '2024-01-01'

    try:
        days_active = (pd.Timestamp(last_case) - pd.Timestamp(first_case)).days or 1
    except:
        days_active = 365

    features = pd.DataFrame([{
        'total_cases':           total_cases,
        'crime_type_diversity':  h.get('crime_type_diversity') or 1,
        'avg_gravity':           h.get('avg_gravity') or 1.0,
        'arrest_count':          h.get('arrest_count') or 0,
        'chargesheet_count':     h.get('chargesheet_count') or 0,
        'age':                   accused.get('AgeYear') or 30,
        'cases_per_year':        round(total_cases / max(days_active / 365, 0.1), 2),
        'escaped_chargesheet':   int((h.get('arrest_count') or 0) > (h.get('chargesheet_count') or 0))
    }])

    model_bundle = _models['reoffend']
    model = model_bundle['model']
    risk_score = float(model.predict_proba(features)[0][1])

    risk_factors = []
    if total_cases >= 5:
        risk_factors.append(f"Prior record: {total_cases} cases")
    if (h.get('crime_type_diversity') or 1) >= 3:
        risk_factors.append("Multi-category offender")
    if (h.get('avg_gravity') or 1.0) >= 2.0:
        risk_factors.append("History of heinous offences")
    if (h.get('arrest_count') or 0) > (h.get('chargesheet_count') or 0):
        risk_factors.append("Previously escaped chargesheet")
    if (accused.get('AgeYear') or 30) < 30:
        risk_factors.append("Young offender — higher recidivism rate")

    return {
        'accused_id':     accused_id,
        'accused_name':   accused.get('AccusedName'),
        'risk_score':     round(risk_score, 4),
        'risk_percent':   f"{risk_score * 100:.1f}%",
        'risk_level':     (
            'CRITICAL' if risk_score >= 0.80 else
            'HIGH'     if risk_score >= 0.60 else
            'MEDIUM'   if risk_score >= 0.40 else
            'LOW'
        ),
        'risk_factors':   risk_factors,
        'total_cases':    total_cases,
        'arrest_count':   h.get('arrest_count') or 0,
        'model_version':  'reoffend_v1'
    }


# ─── 4. CASE RESOLUTION PREDICTOR ─────────────────────────────────
@router.post("/case-resolution")
def predict_case_resolution(case_id: int):
    """
    Predict whether a registered/under-investigation case will
    be chargesheeted, go cold (undetected), or be marked false.
    Returns probability for each outcome.
    """
    if 'resolution' not in _models:
        raise HTTPException(503, "Resolution model not loaded")

    case = query_one("""
        SELECT cm.*, u.UnitName, d.DistrictName,
               COUNT(DISTINCT a.AccusedMasterID) as accused_count,
               COUNT(DISTINCT v.VictimMasterID) as victim_count,
               COUNT(DISTINCT arr.ArrestSurrenderID) as arrest_count
        FROM CaseMaster cm
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        JOIN District d ON u.DistrictID = d.DistrictID
        LEFT JOIN Accused a ON a.CaseMasterID = cm.CaseMasterID
        LEFT JOIN Victim v ON v.CaseMasterID = cm.CaseMasterID
        LEFT JOIN ArrestSurrender arr ON arr.CaseMasterID = cm.CaseMasterID
        WHERE cm.CaseMasterID = ?
        GROUP BY cm.CaseMasterID
    """, (case_id,))

    if not case:
        raise HTTPException(404, "Case not found")

    features = pd.DataFrame([{
        'GravityOffenceID':  case.get('GravityOffenceID') or 1,
        'CrimeMajorHeadID':  case.get('CrimeMajorHeadID') or 1,
        'CaseCategoryID':    case.get('CaseCategoryID') or 1,
        'accused_count':     case.get('accused_count') or 0,
        'victim_count':      case.get('victim_count') or 1,
        'arrest_count':      case.get('arrest_count') or 0,
        'has_arrest':        int((case.get('arrest_count') or 0) > 0),
        'month_registered':  pd.Timestamp(case.get('CrimeRegisteredDate') or '2024-01-01').month
    }])

    model_bundle = _models['resolution']
    model = model_bundle['model']
    probs = model.predict_proba(features)[0]
    labels = ['Chargesheeted', 'Undetected', 'False Case']

    outcomes = [
        {'outcome': label, 'probability': round(float(p), 4), 'percentage': f"{p*100:.1f}%"}
        for label, p in zip(labels, probs)
    ]
    outcomes.sort(key=lambda x: x['probability'], reverse=True)

    return {
        'case_id':          case_id,
        'crime_no':         case.get('CrimeNo'),
        'predicted_outcome': outcomes[0]['outcome'],
        'confidence':        outcomes[0]['percentage'],
        'all_outcomes':      outcomes,
        'key_signals': {
            'arrests_made':    case.get('arrest_count') or 0,
            'accused_count':   case.get('accused_count') or 0,
            'crime_gravity':   'Heinous' if case.get('GravityOffenceID') == 1 else 'Non-Heinous'
        }
    }


# ─── 5. TEMPORAL PATTERN ANALYSIS ─────────────────────────────────
@router.get("/temporal-patterns")
def get_temporal_patterns(
    district_id: Optional[int] = None,
    crime_head_id: Optional[int] = None
):
    """
    Returns statistical crime patterns by hour, day of week,
    and month. Identifies peak crime windows.
    No ML model needed — pure statistical analysis from DB.
    """
    district_filter = "AND u.DistrictID = ?" if district_id else ""
    crime_filter = "AND cm.CrimeMajorHeadID = ?" if crime_head_id else ""
    params = tuple(filter(None, [district_id, crime_head_id]))

    cases = query(f"""
        SELECT
            cm.CrimeRegisteredDate,
            cm.CrimeMajorHeadID,
            ch.CrimeGroupName
        FROM CaseMaster cm
        JOIN Unit u ON cm.PoliceStationID = u.UnitID
        LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
        WHERE cm.CrimeRegisteredDate IS NOT NULL
        {district_filter} {crime_filter}
    """, params)

    if not cases:
        return {'error': 'No data found for given filters'}

    df = pd.DataFrame(cases)
    df['date'] = pd.to_datetime(df['CrimeRegisteredDate'])
    df['month'] = df['date'].dt.month
    df['dayofweek'] = df['date'].dt.dayofweek
    df['month_name'] = df['date'].dt.strftime('%b')
    df['day_name'] = df['date'].dt.strftime('%a')

    by_month_raw = df.groupby(['month', 'month_name']).size().reset_index(name='count')
    by_day_raw   = df.groupby(['dayofweek', 'day_name']).size().reset_index(name='count')

    peak_month = by_month_raw.loc[by_month_raw['count'].idxmax()]
    peak_day   = by_day_raw.loc[by_day_raw['count'].idxmax()]

    by_crime = (
        df.groupby('CrimeGroupName').size()
        .sort_values(ascending=False)
        .head(5)
        .reset_index(name='count')
        .rename(columns={'CrimeGroupName': 'crime_type'})
        .to_dict('records')
    )

    return {
        'by_month': by_month_raw[['month_name', 'count']].to_dict('records'),
        'by_day_of_week': by_day_raw[['day_name', 'count']].to_dict('records'),
        'top_crime_types': by_crime,
        'insights': {
            'peak_month':      peak_month['month_name'],
            'peak_month_count': int(peak_month['count']),
            'peak_day':        peak_day['day_name'],
            'peak_day_count':  int(peak_day['count']),
            'total_cases_analyzed': len(df)
        }
    }


# ─── 6. PREDICTIVE ALERT ENGINE ────────────────────────────────────
@router.get("/live-risk-score")
def get_live_risk_scores():
    """
    Run all prediction models together and return a unified
    risk dashboard: top 5 hotspot stations, temporal warnings,
    and high-risk accused. Used by the dashboard alert panel.
    """
    now = datetime.now()

    # Top hotspot predictions
    try:
        hotspots_raw = predict_hotspots(days_ahead=7)
        top_hotspots = hotspots_raw['predictions'][:5]
    except Exception as e:
        print(f"[Predict Live Score] Hotspot query failed: {e}")
        top_hotspots = []

    # Temporal pattern for today
    try:
        temporal_raw = get_temporal_patterns()
        today_pattern = temporal_raw.get('insights', {})
    except Exception as e:
        print(f"[Predict Live Score] Temporal query failed: {e}")
        today_pattern = {}

    # High risk accused (appear in 5+ cases)
    high_risk_accused = query("""
        SELECT
            a.AccusedName,
            a.AccusedMasterID,
            COUNT(DISTINCT a.CaseMasterID) as case_count,
            MAX(cm.CrimeRegisteredDate) as last_seen
        FROM Accused a
        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
        GROUP BY a.AccusedName
        HAVING case_count >= 5
        ORDER BY case_count DESC
        LIMIT 5
    """)

    # Generate alerts
    alerts = []
    for h in top_hotspots:
        if h['hotspot_prob'] >= 0.70:
            alerts.append({
                'type':     'HOTSPOT_WARNING',
                'severity': 'HIGH' if h['hotspot_prob'] >= 0.80 else 'MEDIUM',
                'message':  f"{h['station_name']} ({h['district_name']}) — {h['hotspot_prob']*100:.0f}% hotspot probability next 7 days",
                'lat':       h['lat'],
                'lng':       h['lng'],
                'station_id': h['station_id']
            })

    return {
        'generated_at':      now.isoformat(),
        'top_hotspots':      top_hotspots,
        'temporal_insights': today_pattern,
        'high_risk_accused': [dict(a) for a in high_risk_accused],
        'alerts':            alerts,
        'summary': {
            'total_high_risk_zones': len([h for h in top_hotspots if h['hotspot_prob'] >= 0.60]),
            'total_critical_zones':  len([h for h in top_hotspots if h['hotspot_prob'] >= 0.80]),
            'high_risk_accused_count': len(high_risk_accused)
        }
    }
