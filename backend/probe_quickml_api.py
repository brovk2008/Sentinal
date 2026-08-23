"""
probe_quickml_api.py — Probe Catalyst QuickML API endpoints for dataset creation and AutoML
"""

import httpx
import json
import os
from pathlib import Path
from services.quickml_service import _get_catalyst_token, PROJECT_ID, ORG_ID

QUICKML_BASE = f"https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}"

def probe():
    token = _get_catalyst_token()
    if not token:
        print("No catalyst token found.")
        return

    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "CATALYST-ORG": ORG_ID,
        "x-ziahub-catalyst-project-id": str(PROJECT_ID),
    }

    print(f"Token obtained: {token[:10]}... | Project: {PROJECT_ID} | Org: {ORG_ID}")

    # 1. GET datasets
    with httpx.Client(timeout=15) as client:
        r = client.get(f"{QUICKML_BASE}/dataset", headers=headers)
        print(f"GET /dataset -> {r.status_code}: {r.text[:300]}")

        r_pipe = client.get(f"{QUICKML_BASE}/pipeline", headers=headers)
        print(f"GET /pipeline -> {r_pipe.status_code}: {r_pipe.text[:300]}")

if __name__ == "__main__":
    probe()
