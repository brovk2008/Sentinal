"""
Case Resolution Predictor
Predicts outcome: Chargesheeted / Undetected / False Case
Model: RandomForest Classifier (3-class)
Only trains on CLOSED cases (we know the ground truth).
"""
import pickle
import joblib
import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import LabelEncoder
from pathlib import Path

# Absolute paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(ROOT_DIR / "backend" / "data" / "sentinal.db")
OUT_PATH = str(ROOT_DIR / "backend" / "models" / "ml" / "saved" / "case_resolution.joblib")

print(f"Reading database from: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)

# Only use resolved cases where we know the outcome
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

print(f"Class distribution:\n{y.value_counts()}")

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(
    n_estimators=200, max_depth=8, class_weight='balanced', random_state=42
)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred, target_names=['Chargesheeted', 'Undetected', 'False']))

# Ensure output path exists
Path(OUT_PATH).parent.mkdir(parents=True, exist_ok=True)

joblib.dump({
    'model': model,
    'feature_cols': feature_cols,
    'train_date': pd.Timestamp.now().isoformat()
}, OUT_PATH)
print(f"Saved to {OUT_PATH}")
