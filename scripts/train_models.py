import sqlite3
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import joblib
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "backend" / "data" / "sentinel.db"
MODEL_SAVE_DIR = BASE_DIR / "backend" / "models" / "ml" / "saved"

def train():
    print("Starting model training...")
    MODEL_SAVE_DIR.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    # Query accused features: join CaseMaster to get crime heads, gravity, and unit
    df = pd.read_sql_query("""
        SELECT a.AgeYear, a.GenderID, cm.GravityOffenceID, cm.CrimeMajorHeadID,
               cm.PoliceStationID, cm.CaseStatusID
        FROM Accused a
        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
    """, conn)
    conn.close()

    if df.empty:
        print("[WARN] No data in database to train model.")
        return

    # Create target: recidivism/high risk indicator (e.g. CaseStatusID is 4/5 or high gravity)
    df['high_risk'] = ((df['GravityOffenceID'] == 1) | (df['CaseStatusID'] == 4)).astype(int)

    # Features and labels
    X = df[['AgeYear', 'GenderID', 'GravityOffenceID', 'CrimeMajorHeadID', 'PoliceStationID']].fillna(0)
    y = df['high_risk']

    # Train a simple Random Forest
    clf = RandomForestClassifier(n_estimators=50, random_state=42)
    clf.fit(X, y)

    # Save model
    model_path = MODEL_SAVE_DIR / "risk_model.joblib"
    joblib.dump(clf, str(model_path))
    print(f"[SUCCESS] Trained risk model and saved to {model_path}")

if __name__ == "__main__":
    train()
