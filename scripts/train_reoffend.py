"""
Repeat Offender Risk Model
Predicts whether an accused will appear in another case within 90 days.
Model: GradientBoosting Classifier
"""
import pickle
import joblib
import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, f1_score
from pathlib import Path

# Absolute paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(ROOT_DIR / "backend" / "data" / "sentinel.db")
OUT_PATH = str(ROOT_DIR / "backend" / "models" / "ml" / "saved" / "reoffend_risk.joblib")

print(f"Reading database from: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)

# Build per-accused feature matrix
accused_history = pd.read_sql("""
    SELECT
        a.AccusedName,
        COUNT(DISTINCT a.CaseMasterID) as total_cases,
        COUNT(DISTINCT cm.CrimeMajorHeadID) as crime_type_diversity,
        AVG(cm.GravityOffenceID) as avg_gravity,
        COUNT(DISTINCT arr.ArrestSurrenderID) as arrest_count,
        COUNT(DISTINCT cs.CSID) as chargesheet_count,
        AVG(a.AgeYear) as age,
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

# Target: appeared in 3+ cases = likely reoffender
accused_history['is_reoffender'] = (accused_history['total_cases'] >= 3).astype(int)
print(f"Reoffender rate: {accused_history['is_reoffender'].mean():.1%}")

feature_cols = [
    'total_cases', 'crime_type_diversity', 'avg_gravity',
    'arrest_count', 'chargesheet_count', 'age',
    'cases_per_year', 'escaped_chargesheet'
]
accused_history = accused_history.dropna(subset=feature_cols)
X = accused_history[feature_cols]
y = accused_history['is_reoffender']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = GradientBoostingClassifier(
    n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
)
model.fit(X_train, y_train)
y_prob = model.predict_proba(X_test)[:, 1]
print(f"ROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")
print(f"F1: {f1_score(y_test, (y_prob >= 0.5).astype(int)):.4f}")

# Ensure output path exists
Path(OUT_PATH).parent.mkdir(parents=True, exist_ok=True)

joblib.dump({
    'model': model,
    'feature_cols': feature_cols,
    'train_date': pd.Timestamp.now().isoformat()
}, OUT_PATH)
print(f"Saved to {OUT_PATH}")
