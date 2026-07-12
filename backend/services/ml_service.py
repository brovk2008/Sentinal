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
        try:
            if MODEL_PATH.exists():
                self.model = joblib.load(str(MODEL_PATH))
                print(f"[ML] Risk model loaded from {MODEL_PATH}")
            else:
                raise FileNotFoundError(f"Model file missing at {MODEL_PATH}")
        except Exception as e:
            print(f"[ML] Risk model load failed ({e}). Attempting self-healing retraining...")
            try:
                from services.ml_trainer import train_risk_model
                success = train_risk_model()
                if success and MODEL_PATH.exists():
                    self.model = joblib.load(str(MODEL_PATH))
                    print(f"[ML] Risk model successfully retrained and loaded.")
                else:
                    print(f"[ML] Retraining failed or output file not found.")
            except Exception as train_err:
                print(f"[ML] Self-healing retraining failed: {train_err}")

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
