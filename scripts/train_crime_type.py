"""
Crime Type Prediction Model
Predicts the most likely crime type for a given station/time.
Model: RandomForest Classifier (multi-class)
"""
import pickle
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
from pathlib import Path

# Absolute paths
ROOT_DIR = Path(__file__).resolve().parent.parent
FEATURES_PATH = str(ROOT_DIR / "backend" / "data" / "features.pkl")
OUT_PATH = str(ROOT_DIR / "backend" / "models" / "ml" / "saved" / "crime_type_predictor.joblib")

print(f"Loading features from: {FEATURES_PATH}")
with open(FEATURES_PATH, 'rb') as f:
    data = pickle.load(f)

cases = data['cases'].dropna(subset=['CrimeMajorHeadID'])

# Features and target
X = cases[['PoliceStationID', 'month', 'dayofweek', 'quarter', 'is_weekend']]
y = cases['CrimeMajorHeadID'].astype(int)

le = LabelEncoder()
y_encoded = le.fit_transform(y)

X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42
)

model = RandomForestClassifier(
    n_estimators=150, max_depth=10, random_state=42, n_jobs=-1
)
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")

# Ensure output path exists
Path(OUT_PATH).parent.mkdir(parents=True, exist_ok=True)

joblib.dump({
    'model': model,
    'label_encoder': le,
    'feature_cols': list(X.columns),
    'train_date': pd.Timestamp.now().isoformat()
}, OUT_PATH)
print(f"Saved to {OUT_PATH}")
