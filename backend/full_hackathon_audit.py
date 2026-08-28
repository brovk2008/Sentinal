"""
full_hackathon_audit.py — Comprehensive End-to-End API Audit (18 Endpoints)
"""

import sys
import os
import requests
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def run_audit():
    print("=" * 75)
    print("      PROJECT SENTINAL — HACKATHON ZERO-DEFECT 18-ENDPOINT AUDIT       ")
    print("=" * 75)

    endpoints_to_test = [
        ("GET",  "/api/v1/cases/"),
        ("GET",  "/api/v1/persons/repeat-offenders"),
        ("GET",  "/api/v1/heatmap/grid"),
        ("GET",  "/api/v1/network/graph"),
        ("GET",  "/api/v1/predict/hotspots"),
        ("POST", "/api/v1/predict/custom-ai-inference", {"station_id": 1, "case_count": 10, "avg_gravity": 1.8, "is_weekend": 0}),
        ("GET",  "/api/v1/board/canvas/list"),
        ("POST", "/api/v1/board/canvas/detective", {"canvas_id": "CANVAS-VEHICLE-THEFT-01", "query": "Who stole the car?"}),
        ("POST", "/api/v1/criminology/solve-case", {"case_id": 1}),
        ("GET",  "/api/v1/criminology/escalation-matrix"),
        ("POST", "/api/v1/criminology/match-face", {"image_base64": "test_data", "top_k": 5}),
        ("POST", "/api/v1/criminology/generate-chargesheet", {"case_id": "CANVAS-VEHICLE-THEFT-01"}),
        ("POST", "/api/v1/criminology/anpr-convoy-analysis", {"target_vehicle": "KA-04-MB-1234"}),
        ("POST", "/api/v1/criminology/audio-forensic-profile", {"sample_id": "112-TEST"}),
        ("POST", "/api/v1/criminology/plan-sting-intercept", {"incident_location": "Indiranagar 100ft Road"}),
        ("POST", "/api/v1/financial/detect-smurfing-rings", {"primary_account": "HDFC-MULE-991204821"}),
        ("GET",  "/api/v1/nlp/status"),
        ("GET",  "/api/v1/analytics/kpis"),
    ]

    passed = 0
    failed = 0

    for item in endpoints_to_test:
        method = item[0]
        url = item[1]
        payload = item[2] if len(item) > 2 else None

        try:
            if method == "GET":
                res = client.get(url)
            else:
                res = client.post(url, json=payload)

            if res.status_code in (200, 201):
                print(f"[PASS] {method:4s} {url:48s} -> HTTP {res.status_code}")
                passed += 1
            else:
                print(f"[FAIL] {method:4s} {url:48s} -> HTTP {res.status_code} ({res.text[:150]})")
                failed += 1
        except Exception as e:
            print(f"[EXCP] {method:4s} {url:48s} -> Exception: {e}")
            failed += 1

    print("=" * 75)
    print(f"AUDIT RESULT: {passed} Passed, {failed} Failed out of {len(endpoints_to_test)} endpoints.")
    print("=" * 75)
    return failed == 0

if __name__ == "__main__":
    success = run_audit()
    if not success:
        sys.exit(1)
