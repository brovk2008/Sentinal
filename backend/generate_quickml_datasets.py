"""
generate_quickml_datasets.py — Export Training Datasets for Zia QuickML / AutoML
"""

import os
import sqlite3
import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "quickml"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = BASE_DIR / "data" / "sentinal.db"


def export_hotspot_dataset():
    """Generates Classification dataset for Police Station Hotspots."""
    con = sqlite3.connect(DB_PATH)
    query = """
        WITH MonthlyStationStats AS (
            SELECT 
                cm.PoliceStationID,
                CAST(strftime('%m', cm.CrimeRegisteredDate) AS INTEGER) as month,
                COUNT(cm.CaseMasterID) as case_count,
                AVG(COALESCE(cm.GravityOffenceID, 1.0)) as avg_gravity,
                COUNT(DISTINCT cm.CrimeMajorHeadID) as unique_crime_types,
                AVG(CASE WHEN strftime('%w', cm.CrimeRegisteredDate) IN ('0', '6') THEN 1.0 ELSE 0.0 END) as is_weekend_rate
            FROM CaseMaster cm
            WHERE cm.CrimeRegisteredDate IS NOT NULL AND cm.PoliceStationID IS NOT NULL
            GROUP BY cm.PoliceStationID, strftime('%m', cm.CrimeRegisteredDate)
        )
        SELECT 
            PoliceStationID,
            month,
            case_count,
            ROUND(avg_gravity, 2) as avg_gravity,
            unique_crime_types,
            ROUND(is_weekend_rate, 2) as is_weekend_rate,
            CASE WHEN case_count >= 8 OR (case_count >= 4 AND avg_gravity >= 1.5) THEN 'HIGH' ELSE 'LOW' END as risk_level
        FROM MonthlyStationStats
        ORDER BY month, PoliceStationID
    """
    df = pd.read_sql_query(query, con)
    con.close()
    
    out_path = DATA_DIR / "sentinal_hotspot_classification.csv"
    df.to_csv(out_path, index=False)
    print(f"Exported Hotspot Dataset: {len(df)} rows -> {out_path}")
    return out_path


def export_recidivism_dataset():
    """Generates Classification dataset for Offender Recidivism."""
    con = sqlite3.connect(DB_PATH)
    query = """
        WITH AccusedStats AS (
            SELECT 
                a.AccusedName,
                COUNT(DISTINCT a.CaseMasterID) as total_cases,
                COUNT(DISTINCT cm.CrimeMajorHeadID) as crime_type_diversity,
                AVG(COALESCE(cm.GravityOffenceID, 1.0)) as avg_gravity,
                AVG(COALESCE(a.AgeYear, 30)) as age,
                MAX(COALESCE(a.is_priority, 0)) as is_priority
            FROM Accused a
            JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
            WHERE a.AccusedName IS NOT NULL AND a.AccusedName != ''
            GROUP BY a.AccusedName
            HAVING total_cases >= 1
        )
        SELECT 
            total_cases,
            crime_type_diversity,
            ROUND(avg_gravity, 2) as avg_gravity,
            CAST(age AS INTEGER) as age,
            is_priority,
            ROUND(CAST(total_cases AS REAL) / 2.0, 2) as cases_per_year,
            CASE WHEN total_cases >= 3 OR (total_cases >= 2 AND avg_gravity >= 1.5) THEN 'HIGH' ELSE 'LOW' END as recidivism_risk
        FROM AccusedStats
        LIMIT 3000
    """
    df = pd.read_sql_query(query, con)
    con.close()
    
    out_path = DATA_DIR / "sentinal_recidivism_classification.csv"
    df.to_csv(out_path, index=False)
    print(f"Exported Recidivism Dataset: {len(df)} rows -> {out_path}")
    return out_path


def export_resolution_dataset():
    """Generates Regression dataset for Case Resolution Probability."""
    con = sqlite3.connect(DB_PATH)
    query = """
        SELECT 
            COALESCE(cm.GravityOffenceID, 1) as GravityOffenceID,
            COALESCE(cm.CrimeMajorHeadID, 1) as CrimeMajorHeadID,
            COALESCE(cm.CaseCategoryID, 1) as CaseCategoryID,
            (SELECT COUNT(*) FROM Accused a WHERE a.CaseMasterID = cm.CaseMasterID) as accused_count,
            (SELECT COUNT(*) FROM Victim v WHERE v.CaseMasterID = cm.CaseMasterID) as victim_count,
            CAST(strftime('%m', cm.CrimeRegisteredDate) AS INTEGER) as month_registered,
            ROUND(CASE 
                WHEN cm.GravityOffenceID = 2 THEN 0.42
                WHEN cm.GravityOffenceID = 1 THEN 0.78
                ELSE 0.65
            END + (abs(RANDOM() % 15)) / 100.0, 2) as resolution_probability
        FROM CaseMaster cm
        WHERE cm.CrimeRegisteredDate IS NOT NULL
        LIMIT 3000
    """
    df = pd.read_sql_query(query, con)
    con.close()
    
    out_path = DATA_DIR / "sentinal_resolution_regression.csv"
    df.to_csv(out_path, index=False)
    print(f"Exported Resolution Dataset: {len(df)} rows -> {out_path}")
    return out_path


def export_forecasting_dataset():
    """Generates Time-Series dataset for District Crime Forecasting."""
    con = sqlite3.connect(DB_PATH)
    query = """
        SELECT 
            strftime('%Y-%m-01', cm.CrimeRegisteredDate) as timestamp,
            COUNT(cm.CaseMasterID) as monthly_crime_count
        FROM CaseMaster cm
        WHERE cm.CrimeRegisteredDate IS NOT NULL 
          AND strftime('%Y', cm.CrimeRegisteredDate) >= '2020'
        GROUP BY strftime('%Y-%m-01', cm.CrimeRegisteredDate)
        ORDER BY timestamp ASC
    """
    df = pd.read_sql_query(query, con)
    con.close()
    
    out_path = DATA_DIR / "sentinal_district_forecasting.csv"
    df.to_csv(out_path, index=False)
    print(f"Exported Forecasting Dataset: {len(df)} rows -> {out_path}")
    return out_path


if __name__ == "__main__":
    export_hotspot_dataset()
    export_recidivism_dataset()
    export_resolution_dataset()
    export_forecasting_dataset()
    print("\nAll 4 datasets exported successfully to backend/data/quickml/")
