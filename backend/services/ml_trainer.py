"""
Unified ML Model Training Service
Used for training and self-healing prediction models in the active environment.
"""
import os
import sqlite3
import pickle
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(BASE_DIR / "data" / "sentinal.db")
FEATURES_PATH = str(BASE_DIR / "data" / "features.pkl")
MODEL_DIR = BASE_DIR / "models" / "ml" / "saved"

def train_risk_model():
    """Trains risk_model.joblib (RandomForest)"""
    print("[ML Trainer] Training risk model...")
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query("""
        SELECT a.AgeYear, a.GenderID, cm.GravityOffenceID, cm.CrimeMajorHeadID,
               cm.PoliceStationID, cm.CaseStatusID
        FROM Accused a
        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
    """, conn)
    conn.close()

    if df.empty:
        print("[ML Trainer] Warning: Empty dataset for risk model.")
        return False

    df['high_risk'] = ((df['GravityOffenceID'] == 1) | (df['CaseStatusID'] == 4)).astype(int)
    X = df[['AgeYear', 'GenderID', 'GravityOffenceID', 'CrimeMajorHeadID', 'PoliceStationID']].fillna(0)
    y = df['high_risk']

    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODEL_DIR / "risk_model.joblib"
    joblib.dump(clf, str(out_path))
    print(f"[ML Trainer] Successfully saved risk model to {out_path}")
    return True

def train_reoffend_model():
    """Trains reoffend_risk.joblib (GradientBoosting)"""
    print("[ML Trainer] Training reoffend risk model...")
    conn = sqlite3.connect(DB_PATH)
    accused_history = pd.read_sql("""
        SELECT
            a.AccusedName,
            AVG(a.AgeYear) as age,
            COUNT(DISTINCT a.CaseMasterID) as total_cases,
            COUNT(DISTINCT cm.CrimeMajorHeadID) as crime_type_diversity,
            AVG(cm.GravityOffenceID) as avg_gravity,
            COUNT(DISTINCT arr.ArrestSurrenderID) as arrest_count,
            COUNT(DISTINCT cs.CSID) as chargesheet_count,
            MIN(cm.CrimeRegisteredDate) as first_case,
            MAX(cm.CrimeRegisteredDate) as last_case
        FROM Accused a
        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
        LEFT JOIN ArrestSurrender arr ON arr.AccusedMasterID = a.AccusedMasterID
        LEFT JOIN ChargesheetDetails cs ON cs.CaseMasterID = cm.CaseMasterID
        GROUP BY a.AccusedName
        HAVING total_cases >= 2
    """, conn)
    conn.close()

    if accused_history.empty:
        print("[ML Trainer] Warning: Empty dataset for reoffend model.")
        return False

    accused_history['first_case'] = pd.to_datetime(accused_history['first_case'])
    accused_history['last_case'] = pd.to_datetime(accused_history['last_case'])
    accused_history['days_active'] = (
        accused_history['last_case'] - accused_history['first_case']
    ).dt.days.clip(lower=1)
    accused_history['cases_per_year'] = (
        accused_history['total_cases'] / (accused_history['days_active'] / 365)
    ).clip(upper=50)
    accused_history['escaped_chargesheet'] = (
        accused_history['arrest_count'] > accused_history['chargesheet_count']
    ).astype(int)
    accused_history['is_reoffender'] = (accused_history['total_cases'] >= 3).astype(int)

    feature_cols = [
        'total_cases', 'crime_type_diversity', 'avg_gravity',
        'arrest_count', 'chargesheet_count', 'age',
        'cases_per_year', 'escaped_chargesheet'
    ]
    accused_history = accused_history.dropna(subset=feature_cols)
    if accused_history.empty:
        print("[ML Trainer] Warning: Features dataset empty post-dropna.")
        return False

    X = accused_history[feature_cols]
    y = accused_history['is_reoffender']

    model = GradientBoostingClassifier(
        n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
    )
    model.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODEL_DIR / "reoffend_risk.joblib"
    joblib.dump({
        'model': model,
        'feature_cols': feature_cols,
        'train_date': pd.Timestamp.now().isoformat()
    }, str(out_path))
    print(f"[ML Trainer] Successfully saved reoffend risk model to {out_path}")
    return True

def train_hotspot_model():
    """Trains hotspot_v2.joblib (RandomForest) using features.pkl"""
    print("[ML Trainer] Training hotspot prediction model...")
    if not os.path.exists(FEATURES_PATH):
        print(f"[ML Trainer] Error: Features pickle not found at {FEATURES_PATH}")
        return False

    with open(FEATURES_PATH, 'rb') as f:
        data = pickle.load(f)
        
    cases = data['cases']
    agg = cases.groupby(['PoliceStationID', 'year', 'month']).agg(
        case_count=('CaseMasterID', 'count'),
        avg_gravity=('GravityOffenceID', 'mean'),
        unique_crime_types=('CrimeMajorHeadID', 'nunique'),
        avg_accused=('accused_count', 'mean'),
        total_amount=('total_amount', 'sum'),
        avg_calls=('call_count', 'mean'),
        is_weekend_rate=('is_weekend', 'mean')
    ).reset_index()

    threshold = agg['case_count'].quantile(0.75)
    agg['is_hotspot'] = (agg['case_count'] >= threshold).astype(int)

    X = agg[[
        'PoliceStationID', 'month', 'case_count',
        'avg_gravity', 'unique_crime_types', 'avg_accused',
        'total_amount', 'avg_calls', 'is_weekend_rate'
    ]]
    y = agg['is_hotspot']

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        class_weight='balanced',
        random_state=42
    )
    model.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODEL_DIR / "hotspot_v2.joblib"
    joblib.dump({
        'model': model,
        'feature_cols': list(X.columns),
        'threshold': float(threshold),
        'train_date': pd.Timestamp.now().isoformat()
    }, str(out_path))
    print(f"[ML Trainer] Successfully saved hotspot model to {out_path}")
    return True

def train_crime_type_model():
    """Trains crime_type_predictor.joblib (RandomForest) using features.pkl"""
    print("[ML Trainer] Training crime type predictor...")
    if not os.path.exists(FEATURES_PATH):
        print(f"[ML Trainer] Error: Features pickle not found at {FEATURES_PATH}")
        return False

    with open(FEATURES_PATH, 'rb') as f:
        data = pickle.load(f)

    cases = data['cases'].dropna(subset=['CrimeMajorHeadID'])
    X = cases[['PoliceStationID', 'month', 'dayofweek', 'quarter', 'is_weekend']]
    y = cases['CrimeMajorHeadID'].astype(int)

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    model = RandomForestClassifier(
        n_estimators=150, max_depth=10, random_state=42, n_jobs=-1
    )
    model.fit(X, y_encoded)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODEL_DIR / "crime_type_predictor.joblib"
    joblib.dump({
        'model': model,
        'label_encoder': le,
        'feature_cols': list(X.columns),
        'train_date': pd.Timestamp.now().isoformat()
    }, str(out_path))
    print(f"[ML Trainer] Successfully saved crime type predictor to {out_path}")
    return True

def train_case_resolution_model():
    """Trains case_resolution.joblib (RandomForest)"""
    print("[ML Trainer] Training case resolution predictor...")
    conn = sqlite3.connect(DB_PATH)
    closed_cases = pd.read_sql("""
        SELECT
            cm.CaseMasterID,
            cm.GravityOffenceID,
            cm.CrimeMajorHeadID,
            cm.CaseCategoryID,
            strftime('%m', cm.CrimeRegisteredDate) as month_registered,
            cs.cstype as resolution,
            COUNT(DISTINCT a.AccusedMasterID) as accused_count,
            COUNT(DISTINCT v.VictimMasterID) as victim_count,
            COUNT(DISTINCT arr.ArrestSurrenderID) as arrest_count
        FROM CaseMaster cm
        JOIN ChargesheetDetails cs ON cs.CaseMasterID = cm.CaseMasterID
        LEFT JOIN Accused a ON a.CaseMasterID = cm.CaseMasterID
        LEFT JOIN Victim v ON v.CaseMasterID = cm.CaseMasterID
        LEFT JOIN ArrestSurrender arr ON arr.CaseMasterID = cm.CaseMasterID
        GROUP BY cm.CaseMasterID, cs.cstype
    """, conn)
    conn.close()

    if closed_cases.empty:
        print("[ML Trainer] Warning: Empty dataset for resolution model.")
        return False

    closed_cases['has_arrest'] = (closed_cases['arrest_count'] > 0).astype(int)
    closed_cases['month_registered'] = closed_cases['month_registered'].astype(int)

    resolution_map = {'A': 0, 'B': 2, 'C': 1}
    closed_cases['resolution_encoded'] = closed_cases['resolution'].map(resolution_map)
    closed_cases = closed_cases.dropna(subset=['resolution_encoded'])

    feature_cols = [
        'GravityOffenceID', 'CrimeMajorHeadID', 'CaseCategoryID',
        'accused_count', 'victim_count', 'arrest_count',
        'has_arrest', 'month_registered'
    ]
    X = closed_cases[feature_cols].fillna(0)
    y = closed_cases['resolution_encoded'].astype(int)

    model = RandomForestClassifier(
        n_estimators=200, max_depth=8, class_weight='balanced', random_state=42
    )
    model.fit(X, y)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    out_path = MODEL_DIR / "case_resolution.joblib"
    joblib.dump({
        'model': model,
        'feature_cols': feature_cols,
        'train_date': pd.Timestamp.now().isoformat()
    }, str(out_path))
    print(f"[ML Trainer] Successfully saved resolution model to {out_path}")
    return True

def retrain_by_name(name):
    """Router to train a specific model by key"""
    if name == 'risk_model':
        return train_risk_model()
    elif name == 'reoffend':
        return train_reoffend_model()
    elif name == 'hotspot':
        return train_hotspot_model()
    elif name == 'crime_type':
        return train_crime_type_model()
    elif name == 'resolution':
        return train_case_resolution_model()
    return False
