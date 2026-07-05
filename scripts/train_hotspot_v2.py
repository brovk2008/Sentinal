"""
Hotspot Prediction Model v2
Predicts probability that a police station zone will be a hotspot
in the next 7 days.

Model: XGBoost Classifier
Target: is_hotspot (1 if case_count > 75th percentile for that station)
Features: temporal, station history, crime type, financial signals
"""
import pickle
import numpy as np
import sqlite3
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, roc_auc_score
from sklearn.preprocessing import LabelEncoder
import joblib
from pathlib import Path

# Absolute paths
ROOT_DIR = Path(__file__).resolve().parent.parent
FEATURES_PATH = str(ROOT_DIR / "backend" / "data" / "features.pkl")
OUT_PATH = str(ROOT_DIR / "backend" / "models" / "ml" / "saved" / "hotspot_v2.joblib")

print(f"Loading features from: {FEATURES_PATH}")
with open(FEATURES_PATH, 'rb') as f:
    data = pickle.load(f)
    
cases = data['cases']
feature_cols = data['feature_cols']

# ─── Build station-month aggregates ────────────────────────────────
agg = cases.groupby(['PoliceStationID', 'year', 'month']).agg(
    case_count=('CaseMasterID', 'count'),
    avg_gravity=('GravityOffenceID', 'mean'),
    unique_crime_types=('CrimeMajorHeadID', 'nunique'),
    avg_accused=('accused_count', 'mean'),
    total_amount=('total_amount', 'sum'),
    avg_calls=('call_count', 'mean'),
    is_weekend_rate=('is_weekend', 'mean')
).reset_index()

# ─── Target: is this station-month in the top 25% of crime volume? ─
threshold = agg['case_count'].quantile(0.75)
agg['is_hotspot'] = (agg['case_count'] >= threshold).astype(int)

print(f"Hotspot threshold (75th percentile): {threshold} cases/month")
print(f"Hotspot rate: {agg['is_hotspot'].mean():.1%}")

X = agg[[
    'PoliceStationID', 'month', 'case_count',
    'avg_gravity', 'unique_crime_types', 'avg_accused',
    'total_amount', 'avg_calls', 'is_weekend_rate'
]]
y = agg['is_hotspot']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=(y == 0).sum() / (y == 1).sum(),
    random_state=42,
    eval_metric='logloss'
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]
print(f"F1: {f1_score(y_test, y_pred):.4f}")
print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")

# ─── Feature importance ────────────────────────────────────────────
importances = pd.Series(model.feature_importances_, index=X.columns)
print("\nTop features:")
print(importances.sort_values(ascending=False).head(8))

# Ensure output path exists
Path(OUT_PATH).parent.mkdir(parents=True, exist_ok=True)

joblib.dump({
    'model': model,
    'feature_cols': list(X.columns),
    'threshold': float(threshold),
    'train_date': pd.Timestamp.now().isoformat()
}, OUT_PATH)
print(f"\nModel saved to {OUT_PATH}")
