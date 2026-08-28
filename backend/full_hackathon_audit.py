"""
full_hackathon_audit.py — Comprehensive End-to-End API Audit
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
    print("=" * 70)
    print("      PROJECT SENTINAL — HACKATHON ZERO-DEFECT COMPREHENSIVE AUDIT      ")
    print("=" * 70)

    endpoints_to_test = [
        ("GET",  "/api/v1/cases/"),
        ("GET",  "/api/v1/persons/repeat-offenders"),
        ("GET",  "/api/v1/heatmap/grid"),
        ("GET",  "/api/v1/network/graph"),
        ("GET",  "/api/v1/predict/hotspots"),
        ("POST", "/api/v1/predict/custom-ai-inference", {"station_id": 1, "case_count": 10, "avg_gravity": 1.8, "is_weekend": 0}),
        ("POST", "/api/v1/criminology/solve-case", {"case_id": 1}),
        ("GET",  "/api/v1/criminology/escalation-matrix"),
        ("POST", "/api/v1/criminology/match-face", {"image_base64": "test_data", "top_k": 5}),
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
                print(f"[PASS] {method:4s} {url:45s} -> HTTP {res.status_code}")
                passed += 1
            else:
                print(f"[FAIL] {method:4s} {url:45s} -> HTTP {res.status_code} ({res.text[:150]})")
                failed += 1
        except Exception as e:
            print(f"[EXCP] {method:4s} {url:45s} -> Exception: {e}")
            failed += 1

    print("=" * 70)
    print(f"AUDIT RESULT: {passed} Passed, {failed} Failed out of {len(endpoints_to_test)} endpoints.")
    print("=" * 70)
    return failed == 0

if __name__ == "__main__":
    success = run_audit()
    if not success:
        sys.exit(1)
