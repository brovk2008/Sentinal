"""
Feature engineering pipeline for all prediction models.
Reads sentinel.db and builds structured feature matrices.
Output: backend/data/features.pkl (dict of DataFrames)
"""
import sqlite3
import pandas as pd
import numpy as np
import pickle
from pathlib import Path

# Absolute path resolution
ROOT_DIR = Path(__file__).resolve().parent.parent
DB_PATH = str(ROOT_DIR / "backend" / "data" / "sentinel.db")
OUT_PATH = str(ROOT_DIR / "backend" / "data" / "features.pkl")

print(f"Reading database from: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)

# ─── Base case dataframe ────────────────────────────────────────────
cases = pd.read_sql("""
    SELECT
        cm.CaseMasterID,
        cm.CrimeRegisteredDate,
        cm.PoliceStationID,
        cm.CaseCategoryID,
        cm.GravityOffenceID,
        cm.CrimeMajorHeadID,
        cm.CrimeMinorHeadID,
        cm.CaseStatusID,
        cm.latitude,
        cm.longitude,
        u.DistrictID,
        d.DistrictName,
        u.UnitName as StationName
    FROM CaseMaster cm
    JOIN Unit u ON cm.PoliceStationID = u.UnitID
    JOIN District d ON u.DistrictID = d.DistrictID
    WHERE cm.latitude IS NOT NULL AND cm.longitude IS NOT NULL
""", conn)

cases['CrimeRegisteredDate'] = pd.to_datetime(cases['CrimeRegisteredDate'])
cases['year']       = cases['CrimeRegisteredDate'].dt.year
cases['month']      = cases['CrimeRegisteredDate'].dt.month
cases['dayofweek']  = cases['CrimeRegisteredDate'].dt.dayofweek
cases['dayofyear']  = cases['CrimeRegisteredDate'].dt.dayofyear
cases['quarter']    = cases['CrimeRegisteredDate'].dt.quarter
cases['is_weekend'] = (cases['dayofweek'] >= 5).astype(int)

# ─── Station-level rolling features ────────────────────────────────
# For each station: cases in last 7 days, 30 days, 90 days
cases = cases.sort_values('CrimeRegisteredDate')
station_groups = cases.groupby('PoliceStationID')

rolling_7  = station_groups['CaseMasterID'].transform(
    lambda x: x.rolling(7, min_periods=1).count()
)
rolling_30 = station_groups['CaseMasterID'].transform(
    lambda x: x.rolling(30, min_periods=1).count()
)
cases['cases_last_7d']  = rolling_7
cases['cases_last_30d'] = rolling_30

# ─── Accused features ───────────────────────────────────────────────
accused = pd.read_sql("""
    SELECT CaseMasterID, COUNT(*) as accused_count,
           AVG(AgeYear) as avg_accused_age
    FROM Accused GROUP BY CaseMasterID
""", conn)
cases = cases.merge(accused, on='CaseMasterID', how='left')
cases['accused_count']   = cases['accused_count'].fillna(1)
cases['avg_accused_age'] = cases['avg_accused_age'].fillna(30)

# ─── Financial features ─────────────────────────────────────────────
fin = pd.read_sql("""
    SELECT linked_case_id as CaseMasterID,
           SUM(amount) as total_amount,
           COUNT(*) as txn_count,
           SUM(is_suspicious) as suspicious_txn_count
    FROM financial_transactions
    WHERE linked_case_id IS NOT NULL
    GROUP BY linked_case_id
""", conn)
cases = cases.merge(fin, on='CaseMasterID', how='left')
cases['total_amount']         = cases['total_amount'].fillna(0)
cases['txn_count']            = cases['txn_count'].fillna(0)
cases['suspicious_txn_count'] = cases['suspicious_txn_count'].fillna(0)

# ─── CDR features ────────────────────────────────────────___________
cdr = pd.read_sql("""
    SELECT linked_case_id as CaseMasterID,
           COUNT(*) as call_count,
           AVG(call_duration_seconds) as avg_call_duration
    FROM cdr_records
    WHERE linked_case_id IS NOT NULL
    GROUP BY linked_case_id
""", conn)
cases = cases.merge(cdr, on='CaseMasterID', how='left')
cases['call_count']        = cases['call_count'].fillna(0)
cases['avg_call_duration'] = cases['avg_call_duration'].fillna(0)

# ─── Save ───────────────────────────────────────────────────────────
features = {
    'cases': cases,
    'feature_cols': [
        'PoliceStationID', 'DistrictID', 'CaseCategoryID',
        'GravityOffenceID', 'CrimeMajorHeadID', 'CrimeMinorHeadID',
        'month', 'dayofweek', 'dayofyear', 'quarter', 'is_weekend',
        'cases_last_7d', 'cases_last_30d',
        'accused_count', 'avg_accused_age',
        'total_amount', 'txn_count', 'suspicious_txn_count',
        'call_count', 'avg_call_duration'
    ]
}

# Ensure parent directories exist
Path(OUT_PATH).parent.mkdir(parents=True, exist_ok=True)

with open(OUT_PATH, 'wb') as f:
    pickle.dump(features, f)

print(f"Feature matrix built: {len(cases)} rows, {len(features['feature_cols'])} features")
print(f"Saved to: {OUT_PATH}")
conn.close()
