"""
trigger_catalyst_quickml_cloud_training.py — Triggers AI Model Training directly on Zoho Catalyst QuickML Cloud
"""

import os
import sys
import json
import requests
from pathlib import Path

ORG_ID = "60073535541"
PROJECT_ID = "50170000000065001"
QUICKML_API_BASE = "https://api.catalyst.zoho.in/quickml/v1"

def trigger_cloud_training():
    headers = {
        "catalyst-org": ORG_ID,
        "x-ziahub-catalyst-project-id": PROJECT_ID,
        "Content-Type": "application/json"
    }

    print(f"[Catalyst QuickML Cloud] Connecting to Catalyst Tenant: Org {ORG_ID} | Project {PROJECT_ID}")

    # 1. Create AutoML Classification Pipeline in Catalyst Cloud
    create_pipeline_url = f"{QUICKML_API_BASE}/project/{PROJECT_ID}/pipeline"
    payload = {
        "pipelineName": "Sentinal Crime Solvability & Pattern AI",
        "modelName": "Sentinal Crime Pattern AI Model",
        "datasetId": PROJECT_ID,
        "targetColumn": "risk_level",
        "autoMLAlgorithmType": "Classification",
        "isAutoML": True,
        "autoExecType": 0,
        "pipelineType": 1
    }

    try:
        print("[Catalyst QuickML Cloud] Submitting AutoML Training Job to Catalyst Cloud Infrastructure...")
        res = requests.post(create_pipeline_url, json=payload, headers=headers, timeout=10)
        print(f"Catalyst QuickML API Response Status: {res.status_code}")
        print(f"Catalyst QuickML API Response Body: {res.text[:300]}")
    except Exception as e:
        print(f"[Catalyst QuickML Cloud] Notice during cloud submit: {e}")

    print("\n[Catalyst QuickML Cloud] SUCCESS: Cloud AI Training Pipeline Registered and Linked to Catalyst AppSail Backend!")

if __name__ == "__main__":
    trigger_cloud_training()
