"""
retrain_all.py
Pre-trains all ML models inside the target environment (scikit-learn 1.5.0)
during the Docker build phase. This eliminates unpickling version warnings and
BitGenerator errors.
"""
import sys
from pathlib import Path

# Add current directory to path
sys.path.append(str(Path(__file__).resolve().parent))

from services.ml_trainer import (
    train_risk_model,
    train_reoffend_model,
    train_hotspot_model,
    train_crime_type_model,
    train_case_resolution_model
)

def main():
    print("=== STARTING SENTINAL ML PRE-TRAINING ===")
    
    success = True
    
    if not train_risk_model():
        print("[-] Failed to train risk model")
        success = False
        
    if not train_reoffend_model():
        print("[-] Failed to train reoffend model")
        success = False
        
    if not train_hotspot_model():
        print("[-] Failed to train hotspot model")
        success = False
        
    if not train_crime_type_model():
        print("[-] Failed to train crime type model")
        success = False
        
    if not train_case_resolution_model():
        print("[-] Failed to train case resolution model")
        success = False
        
    if success:
        print("=== ALL MODELS PRE-TRAINED SUCCESSFULLY ===")
    else:
        print("=== SOME MODELS FAILED TO TRAIN ===")
        sys.exit(1)

if __name__ == "__main__":
    main()
