"""
full_hackathon_audit.py — Comprehensive End-to-End API Audit (28 Endpoints)
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
    print("=" * 80)
    print("      PROJECT SENTINAL — HACKATHON ZERO-DEFECT 39-ENDPOINT AUDIT       ")
    print("=" * 80)

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
        ("POST", "/api/v1/criminology/biometric-face-morph", {"suspect_name": "Imran Pasha"}),
        ("POST", "/api/v1/criminology/interrogation-copilot", {"suspect_name": "Imran Pasha"}),
        ("POST", "/api/v1/criminology/rossmo-geographic-profiling", {"target_area": "Bengaluru"}),
        ("POST", "/api/v1/cdr/imei-switcher-tracker", {"target_imei": "864920049182741"}),
        ("POST", "/api/v1/darkweb/analyze-cyber-scam-script", {"transcript_sample": "Digital Arrest"}),
        ("POST", "/api/v1/financial/detect-smurfing-rings", {"primary_account": "HDFC-MULE-991204821"}),
        ("POST", "/api/v1/web-scraper/ecourts/search", {"query_term": "Imran Pasha"}),
        ("POST", "/api/v1/web-scraper/vahan/lookup", {"plate_number": "KA-04-MB-1234"}),
        ("POST", "/api/v1/web-scraper/fugitives/search", {"query_term": "all"}),
        ("POST", "/api/v1/web-scraper/cyber/lookup", {"indicator": "cbi-portal-verify-court.online"}),
        ("POST", "/api/v1/web-scraper/osint/news", {"district": "All Districts"}),
        ("GET",  "/api/v1/nlp/status"),
        ("GET",  "/api/v1/analytics/kpis"),
        # ── 5 New Forensic Intelligence Features ──
        ("POST", "/api/v1/financial/crypto-trace-unmixer", {"wallet_address": "0xd4A5f9E3C7b2A1082BC6019d3F77e4c8b09E2A00", "blockchain": "ETH"}),
        ("POST", "/api/v1/criminology/weapon-ballistics-classify", {"description": "9mm pistol", "crime_scene_location": "Bengaluru"}),
        ("POST", "/api/v1/criminology/bail-flight-risk-assessor", {"accused_name": "Imran Pasha", "passport_status": "Active", "prior_bail_violations": 2}),
        ("POST", "/api/v1/criminology/cold-case-mo-linker", {"modus_operandi_query": "gas torch jewelry shop"}),
        ("POST", "/api/v1/criminology/digital-panchnama-custody", {"case_reference": "FIR/2026/BLR/0091", "seizing_officer": "PSI Rakesh Nair", "evidence_type": "Mobile Phone", "evidence_description": "iPhone 13"}),
        # ── Real-Time Fraud Intelligence (6 new endpoints) ──
        ("GET",  "/api/v1/fraud/upi-velocity"),
        ("GET",  "/api/v1/fraud/ncrp-stream"),
        ("GET",  "/api/v1/fraud/telegram-scam-monitor"),
        ("GET",  "/api/v1/fraud/mule-alert-feed"),
        ("GET",  "/api/v1/fraud/dashboard"),
        ("GET",  "/api/v1/fraud/stream"),
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
                print(f"[PASS] {method:4s} {url:52s} -> HTTP {res.status_code}")
                passed += 1
            else:
                print(f"[FAIL] {method:4s} {url:52s} -> HTTP {res.status_code} ({res.text[:150]})")
                failed += 1
        except Exception as e:
            print(f"[EXCP] {method:4s} {url:52s} -> Exception: {e}")
            failed += 1

    print("=" * 80)
    print(f"AUDIT RESULT: {passed} Passed, {failed} Failed out of {len(endpoints_to_test)} endpoints.")
    print("=" * 80)
    return failed == 0

if __name__ == "__main__":
    success = run_audit()
    if not success:
        sys.exit(1)
