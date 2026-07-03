import joblib
import numpy as np
from pathlib import Path
from config import config

MODEL_PATH = Path(config.DB_PATH).parent.parent / "models" / "ml" / "saved" / "risk_model.joblib"

class MLService:
    def __init__(self):
        self.model = None
        self.load_model()

    def load_model(self):
        if MODEL_PATH.exists():
            try:
                self.model = joblib.load(str(MODEL_PATH))
                print(f"[ML] Risk model loaded from {MODEL_PATH}")
            except Exception as e:
                print(f"[ML] Error loading model: {e}")
        else:
            print(f"[ML] Model file not found at {MODEL_PATH}. Prediction fallback active.")

    def predict_risk(self, age: int, gender_id: int, gravity_id: int, major_head_id: int, station_id: int) -> float:
        """Predict risk score/probability between 0.0 and 1.0."""
        if self.model:
            try:
                # Features: AgeYear, GenderID, GravityOffenceID, CrimeMajorHeadID, PoliceStationID
                features = np.array([[age, gender_id, gravity_id, major_head_id, station_id]])
                prob = self.model.predict_proba(features)[0][1]
                return float(prob)
            except Exception as e:
                print(f"[ML] Prediction error: {e}")
        
        # Fallback heuristic logic if model is not trained/loaded
        score = 0.3
        if gravity_id == 1:
            score += 0.4
        if age < 30:
            score += 0.15
        return min(0.95, max(0.05, score))

ml_service = MLService()
