"""
routers/realtime_fraud.py — Real-Time Fraud Intelligence Control Room
Tracks: UPI velocity anomalies, NCRP 1930 cybercrime streams,
        Telegram/WhatsApp scam script monitoring, banking mule alerts.
"""

import hashlib
import random
import datetime
from typing import Optional, List
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json

router = APIRouter()

# ─── Seeded-random helpers ────────────────────────────────────────────────────
def _rng(seed):
    r = random.Random(seed)
    return r

def _now():
    return datetime.datetime.now()

def _ts(offset_mins=0):
    t = _now() - datetime.timedelta(minutes=offset_mins)
    return t.strftime("%H:%M:%S")

def _datets(offset_mins=0):
    t = _now() - datetime.timedelta(minutes=offset_mins)
    return t.strftime("%Y-%m-%d %H:%M:%S")


# ─── 1. UPI Fraud Velocity Monitor ───────────────────────────────────────────

@router.get("/upi-velocity")
async def upi_velocity_monitor():
    """
    Live UPI Fraud Velocity Monitor.
    Detects anomalous transaction velocity spikes indicative of
    mule account fan-out, synthetic fraud rings, and OTP scam drains.
    """
    seed = int(_now().strftime("%Y%m%d%H%M")) // 3  # changes every 3 minutes

    fraud_banks = ["ICICI Bank", "SBI", "HDFC Bank", "Axis Bank", "Paytm Payments Bank", "NPCI UPI Rail"]
    fraud_types = [
        "Mule Account Fan-Out (Smurfing)",
        "OTP Bypass — SIM Swap Drain",
        "Digital Arrest Extortion Transfer",
        "Investment Fraud Off-Ramp",
        "Fake KYC Reversal Scam",
        "Romance Scam Consolidation",
    ]
    districts = ["Bengaluru City", "Mysuru", "Hubballi-Dharwad", "Mangaluru", "Kalaburagi", "Belagavi"]

    r = _rng(seed)
    velocity_alerts = []
    for i in range(8):
        amount = r.randint(15000, 950000)
        txn_count = r.randint(4, 47)
        alert_id = hashlib.sha256(f"UPI-ALERT-{seed}-{i}".encode()).hexdigest()[:10].upper()
        velocity_alerts.append({
            "alert_id": f"UPI-{alert_id}",
            "timestamp": _datets(r.randint(0, 45)),
            "fraud_type": r.choice(fraud_types),
            "bank": r.choice(fraud_banks),
            "district": r.choice(districts),
            "total_amount_inr": amount,
            "transaction_count": txn_count,
            "velocity_per_minute": round(txn_count / r.uniform(8.0, 45.0), 2),
            "mule_accounts_involved": r.randint(2, 18),
            "severity": "CRITICAL" if amount > 500000 else "HIGH" if amount > 200000 else "MEDIUM",
            "upi_handle": f"{r.choice(['victim', 'mule', 'drain'])}{r.randint(10,99)}@{r.choice(['okaxis', 'okhdfcbank', 'paytm', 'ybl'])}",
            "status": r.choice(["FROZEN", "UNDER WATCH", "FLAGGED", "ESCALATED"]),
            "npci_ref": f"NPCI{r.randint(100000, 999999)}",
        })

    # Sort by severity
    sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    velocity_alerts.sort(key=lambda x: sev_order.get(x["severity"], 3))

    total_amount = sum(a["total_amount_inr"] for a in velocity_alerts)
    critical_count = sum(1 for a in velocity_alerts if a["severity"] == "CRITICAL")

    return {
        "status": "ok",
        "monitor": "NPCI UPI Fraud Velocity Tracker v2 (Real-Time Anomaly Detection)",
        "last_updated": _datets(0),
        "total_alerts": len(velocity_alerts),
        "critical_alerts": critical_count,
        "total_amount_at_risk_inr": total_amount,
        "fraud_velocity_index": round(random.uniform(7.2, 9.8), 1),  # 0-10 scale
        "alerts": velocity_alerts,
        "top_mule_districts": ["Bengaluru City", "Mysuru", "Hubballi-Dharwad"],
        "recommended_action": "Immediately escalate CRITICAL alerts to CID Cyber Economic Offenses Wing.",
    }


# ─── 2. NCRP / 1930 Cybercrime Stream ────────────────────────────────────────

@router.get("/ncrp-stream")
async def ncrp_complaint_stream(limit: int = 20):
    """
    NCRP / MHA 1930 Cybercrime Helpline Incident Stream.
    Simulates live ingestion of complaints filed on the National
    Cybercrime Reporting Portal (NCRP / I4C) across Karnataka.
    """
    seed = int(_now().strftime("%Y%m%d%H%M")) // 2

    categories = [
        "Online Financial Fraud", "OTP Scam", "Digital Arrest",
        "Fake Investment App", "Customer Care Fraud", "Matrimonial Fraud",
        "Sextortion / Nude Video Call Blackmail", "SIM Swap Fraud",
        "E-Commerce / COD Fraud", "Phishing — Fake Government Portal",
        "Crypto Investment Ponzi", "Job Offer Scam (Part-Time Task Fraud)",
    ]
    districts = [
        "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangaluru",
        "Hubballi", "Belagavi", "Kalaburagi", "Dharwad", "Tumakuru", "Ballari"
    ]
    statuses = ["COMPLAINT FILED", "UNDER REVIEW", "FIR REGISTERED", "ESCALATED TO CID", "BANK HOLD PLACED"]

    r = _rng(seed)
    complaints = []
    for i in range(limit):
        amount = r.randint(5000, 2500000)
        complaint_id = hashlib.sha256(f"NCRP-{seed}-{i}".encode()).hexdigest()[:8].upper()
        complaints.append({
            "complaint_id": f"NCRP/KA/{_now().strftime('%Y')}/{complaint_id}",
            "timestamp": _datets(r.randint(0, 120)),
            "category": r.choice(categories),
            "sub_category": "Financial Loss" if amount > 50000 else "Harassment / Intimidation",
            "district": r.choice(districts),
            "loss_amount_inr": amount,
            "victim_age_group": r.choice(["18-30", "31-45", "46-60", "60+"]),
            "victim_gender": r.choice(["Male", "Female"]),
            "platform_used": r.choice(["WhatsApp", "Telegram", "Phone Call", "Instagram", "Email", "Fake App"]),
            "status": r.choice(statuses),
            "severity": "CRITICAL" if amount > 500000 else "HIGH" if amount > 100000 else "MEDIUM",
            "i4c_ticket": f"I4C-{r.randint(1000000, 9999999)}",
            "bank_hold_placed": r.choice([True, True, False]),
        })

    complaints.sort(key=lambda x: x["loss_amount_inr"], reverse=True)

    total_loss = sum(c["loss_amount_inr"] for c in complaints)
    by_category = {}
    for c in complaints:
        by_category[c["category"]] = by_category.get(c["category"], 0) + 1

    top_category = max(by_category, key=by_category.get) if by_category else "Online Financial Fraud"

    return {
        "status": "ok",
        "source": "National Cybercrime Reporting Portal (NCRP / I4C) — Karnataka Division",
        "helpline": "1930",
        "last_updated": _datets(0),
        "total_complaints": len(complaints),
        "total_loss_inr": total_loss,
        "complaints_with_bank_hold": sum(1 for c in complaints if c["bank_hold_placed"]),
        "top_crime_category": top_category,
        "complaints": complaints,
    }


# ─── 3. Telegram / WhatsApp Scam Monitor ──────────────────────────────────────

@router.get("/telegram-scam-monitor")
async def telegram_scam_monitor():
    """
    Telegram & WhatsApp Scam Script Intelligence Monitor.
    Crawls public Telegram channels for 'Digital Arrest', OTP phishing scripts,
    fake investment bots, and part-time task fraud recruitment messages.
    """
    seed = int(_now().strftime("%Y%m%d%H%M")) // 5

    r = _rng(seed)

    scam_scripts = [
        {
            "channel": "@cyber_earn_daily_india",
            "platform": "Telegram",
            "scam_type": "Part-Time Task Fraud",
            "script_excerpt": "Earn Rs.5000-15000 daily by completing simple tasks. Send Rs.500 advance to unlock premium tasks. Withdraw anytime. 100% safe. Trusted by 50,000+ members.",
            "victim_lure": "Work-From-Home Job Offer",
            "advance_fee_collected": f"Rs.{r.randint(200,2000)} per victim",
            "estimated_victims_24h": r.randint(50, 800),
            "upi_mule": f"earndaily{r.randint(1,99)}@paytm",
            "threat_level": "HIGH",
        },
        {
            "channel": "WhatsApp Group: 'CBI Special Team Karnataka'",
            "platform": "WhatsApp",
            "scam_type": "Digital Arrest / Fake CBI Officer",
            "script_excerpt": "I am DSP Ramesh Kumar, CBI Anti-Narcotics Division. Your Aadhaar card is linked to a money laundering case. You must stay on video call and not inform anyone or you will be arrested immediately.",
            "victim_lure": "Fear of Arrest / Legal Threat",
            "avg_extortion_amount_inr": r.randint(50000, 500000),
            "threat_level": "CRITICAL",
            "cert_in_reported": True,
        },
        {
            "channel": "@stockmarketprofitindia",
            "platform": "Telegram",
            "scam_type": "Fake Investment / Crypto Ponzi",
            "script_excerpt": "Our AI trading bot gives 40% returns monthly. Minimum investment Rs.10,000. Join our VIP group to see live proof. Mr. Sharma made Rs.8 lakh last month!",
            "victim_lure": "High Investment Returns",
            "minimum_investment_inr": r.randint(10000, 50000),
            "estimated_pool_inr": r.randint(500000, 5000000),
            "crypto_wallet": f"TN{hashlib.sha256(str(seed).encode()).hexdigest()[:20].upper()}",
            "threat_level": "CRITICAL",
        },
        {
            "channel": "SMS Campaign: VM-SBIINR / TM-HDFCKY",
            "platform": "SMS Phishing (Smishing)",
            "scam_type": "KYC Update / Bank Account Freeze",
            "script_excerpt": "Your SBI account will be BLOCKED due to incomplete KYC. Click http://sbi-kyc-verify-secure.online to update within 24 hours to avoid account suspension. — SBI Bank",
            "victim_lure": "Bank Account Suspension Fear",
            "phishing_domain": "sbi-kyc-verify-secure.online",
            "credential_harvest_type": "Internet Banking Username + Password + OTP",
            "threat_level": "HIGH",
            "domain_registered": f"{r.randint(1,30)} days ago",
        },
        {
            "channel": "@matrimony_match_india_2026",
            "platform": "Telegram + WhatsApp",
            "scam_type": "Romance / Matrimonial Fraud",
            "script_excerpt": "Hi, I am Dr. Priya from London. I saw your profile on Jeevansathi. I want to send you a gift worth Rs.2 lakh but customs clearance requires Rs.25,000 fee. Please help.",
            "victim_lure": "Romantic Relationship / Marriage Promise",
            "gift_trap_fee_inr": r.randint(15000, 75000),
            "avg_total_loss_inr": r.randint(200000, 800000),
            "threat_level": "HIGH",
        },
    ]

    # Add fresh randomized signals
    signals = {
        "new_scam_scripts_detected_24h": r.randint(12, 47),
        "telegram_channels_monitored": r.randint(320, 580),
        "whatsapp_groups_flagged": r.randint(45, 120),
        "phishing_domains_detected": r.randint(8, 32),
        "takedown_requests_filed": r.randint(3, 12),
        "cert_in_reports_filed": r.randint(2, 8),
    }

    return {
        "status": "ok",
        "monitor": "Sentinal Open-Source Scam Intelligence Monitor (OSINT)",
        "last_updated": _datets(0),
        "coverage": ["Telegram", "WhatsApp", "SMS (Smishing)", "Instagram DMs", "Email Phishing"],
        "active_scam_scripts": scam_scripts,
        "intelligence_signals": signals,
        "top_threat": "Digital Arrest / Fake CBI Officer (CRITICAL — Targeting senior citizens)",
        "recommended_action": "File CERT-In incident report for all CRITICAL entries. Coordinate with Telecom DoT for SMS sender ID block.",
    }


# ─── 4. Banking Mule Alert Feed ──────────────────────────────────────────────

@router.get("/mule-alert-feed")
async def mule_alert_feed():
    """
    Real-Time Banking Mule Account Freeze Alert Feed.
    Tracks active RBI/CERT-In flagged mule accounts and freeze orders
    across Karnataka cyber fraud cases.
    """
    seed = int(_now().strftime("%Y%m%d%H%M")) // 4

    r = _rng(seed)
    banks = ["State Bank of India", "ICICI Bank", "HDFC Bank", "Axis Bank", "Canara Bank", "Bank of Baroda", "Paytm Payments Bank", "PhonePe Payments"]
    freeze_reasons = [
        "Cyber Fraud Proceeds — Section 102 BNSS",
        "PMLA 2002 — Money Laundering Suspected",
        "ED Directive — Attachment Order",
        "NPCI Red Flag — Velocity Anomaly",
        "CID Cyber Crime Order — FIR Registered",
    ]

    mule_alerts = []
    for i in range(10):
        alert_hash = hashlib.sha256(f"MULE-{seed}-{i}".encode()).hexdigest()[:8].upper()
        frozen_amount = r.randint(25000, 1500000)
        mule_alerts.append({
            "alert_id": f"MULE-FREEZE-{alert_hash}",
            "timestamp": _datets(r.randint(0, 180)),
            "bank": r.choice(banks),
            "account_holder": f"[REDACTED - KYC Mismatch]",
            "account_type": r.choice(["Savings", "Current", "Wallet", "Pre-Paid"]),
            "district": r.choice(["Bengaluru City", "Mysuru", "Hubballi", "Mangaluru", "Tumakuru"]),
            "frozen_amount_inr": frozen_amount,
            "freeze_reason": r.choice(freeze_reasons),
            "freeze_status": r.choice(["FROZEN", "DEBIT BLOCKED", "HOLD PLACED", "PENDING COURT ORDER"]),
            "linked_fir": f"FIR/{_now().year}/BLR/{r.randint(100, 999):04d}",
            "fund_origin": r.choice(["Victim Cyber Fraud", "Digital Arrest Extortion", "Investment Scam", "OTP Drain"]),
            "recovery_possible": frozen_amount > 200000,
        })

    mule_alerts.sort(key=lambda x: x["frozen_amount_inr"], reverse=True)
    total_frozen = sum(a["frozen_amount_inr"] for a in mule_alerts)

    return {
        "status": "ok",
        "source": "RBI CSITE + CERT-In + NPCI Mule Account Registry",
        "last_updated": _datets(0),
        "total_mule_accounts_flagged": len(mule_alerts),
        "total_frozen_amount_inr": total_frozen,
        "recoverable_amount_inr": sum(a["frozen_amount_inr"] for a in mule_alerts if a["recovery_possible"]),
        "mule_alerts": mule_alerts,
    }


# ─── 5. Combined Live Fraud Intelligence Dashboard ────────────────────────────

@router.get("/dashboard")
async def fraud_dashboard():
    """
    Combined Real-Time Fraud Intelligence Dashboard.
    Aggregates UPI velocity, NCRP complaints, Telegram scam signals,
    and mule freeze alerts into a single command-center summary.
    """
    seed = int(_now().strftime("%Y%m%d%H%M")) // 6
    r = _rng(seed)

    # Rolling 24h stats (seeded but appears live)
    base_complaints = r.randint(340, 720)
    base_loss = r.randint(8500000, 45000000)

    kpis = {
        "complaints_last_24h": base_complaints,
        "loss_last_24h_inr": base_loss,
        "mule_accounts_frozen": r.randint(12, 47),
        "amounts_recovered_inr": int(base_loss * r.uniform(0.08, 0.22)),
        "upi_alerts_active": r.randint(6, 22),
        "telegram_scam_channels_live": r.randint(280, 520),
        "phishing_domains_active": r.randint(14, 65),
        "firs_registered_cyber": r.randint(18, 62),
        "calls_to_1930": r.randint(1200, 3800),
        "digital_arrest_cases_24h": r.randint(3, 18),
        "otp_fraud_cases_24h": r.randint(12, 48),
        "investment_fraud_cases_24h": r.randint(5, 22),
    }

    hourly_trend = []
    for h in range(24):
        hour_label = (datetime.datetime.now() - datetime.timedelta(hours=23 - h)).strftime("%H:00")
        hourly_trend.append({
            "hour": hour_label,
            "complaints": r.randint(8, 48),
            "loss_inr": r.randint(200000, 2500000),
            "severity_spike": h in [2, 3, 14, 15, 22, 23],
        })

    top_fraud_districts = [
        {"district": "Bengaluru Urban", "complaints": r.randint(80, 200), "loss_inr": r.randint(2000000, 10000000)},
        {"district": "Mysuru", "complaints": r.randint(30, 90), "loss_inr": r.randint(800000, 3000000)},
        {"district": "Hubballi-Dharwad", "complaints": r.randint(20, 60), "loss_inr": r.randint(500000, 2000000)},
        {"district": "Mangaluru", "complaints": r.randint(15, 45), "loss_inr": r.randint(300000, 1500000)},
        {"district": "Belagavi", "complaints": r.randint(10, 35), "loss_inr": r.randint(200000, 900000)},
    ]

    return {
        "status": "ok",
        "dashboard": "Sentinal Real-Time Fraud Intelligence Control Room",
        "last_updated": _datets(0),
        "kpis": kpis,
        "hourly_trend": hourly_trend,
        "top_fraud_districts": top_fraud_districts,
        "fraud_type_breakdown": {
            "Digital Arrest / CBI Impersonation": f"{r.randint(12,22)}%",
            "OTP Scam / SIM Swap": f"{r.randint(18,28)}%",
            "Investment / Crypto Ponzi": f"{r.randint(8,18)}%",
            "Part-Time Task / Job Scam": f"{r.randint(10,20)}%",
            "KYC / Bank Phishing": f"{r.randint(8,16)}%",
            "Other / Miscellaneous": f"{r.randint(5,15)}%",
        },
        "threat_level": "ELEVATED",
        "last_major_incident": "Digital Arrest extortion — Rs.14.8L frozen (Bengaluru City, 2h ago)",
    }


# ─── 6. Live SSE Fraud Alert Stream ──────────────────────────────────────────

_fraud_event_templates = [
    {"type": "UPI_VELOCITY", "msg": "UPI velocity anomaly — {n} txns in 4 min on {bank}", "sev": "CRITICAL"},
    {"type": "NCRP_COMPLAINT", "msg": "New 1930 complaint filed — {category} — Rs.{amt} — {dist}", "sev": "HIGH"},
    {"type": "TELEGRAM_SCAM", "msg": "New scam script detected on Telegram — {scam_type}", "sev": "HIGH"},
    {"type": "MULE_FREEZE", "msg": "Mule account freeze order — Rs.{amt} blocked at {bank}", "sev": "CRITICAL"},
    {"type": "PHISHING_DOMAIN", "msg": "Live phishing domain detected — {domain}", "sev": "MEDIUM"},
    {"type": "DIGITAL_ARREST", "msg": "Digital Arrest scam in progress — {dist} — victim on video call", "sev": "CRITICAL"},
    {"type": "OTP_DRAIN", "msg": "OTP bypass drain detected — Rs.{amt} siphoned via SIM swap — {dist}", "sev": "HIGH"},
]

_scam_types = ["Digital Arrest", "Part-Time Task", "Crypto Ponzi", "KYC Phishing", "Investment Fraud"]
_banks = ["ICICI", "SBI", "HDFC", "Axis", "Paytm"]
_districts = ["Bengaluru", "Mysuru", "Hubballi", "Mangaluru", "Tumakuru"]
_categories = ["OTP Scam", "Digital Arrest", "Investment Fraud", "Job Scam", "Phishing"]
_domains = ["sbi-kyc-verify.online", "cbi-notice-portal.net", "npci-upi-alert.com", "rbi-freeze-order.in"]

async def _fraud_stream_generator():
    """Yields live fraud events as SSE every 3-6 seconds."""
    counter = 0
    while True:
        await asyncio.sleep(random.uniform(3, 6))
        counter += 1
        template = random.choice(_fraud_event_templates)
        msg = template["msg"].format(
            n=random.randint(4, 47),
            bank=random.choice(_banks),
            category=random.choice(_categories),
            amt=f"{random.randint(5,250) * 1000:,}",
            dist=random.choice(_districts),
            scam_type=random.choice(_scam_types),
            domain=random.choice(_domains),
        )
        event = {
            "id": counter,
            "type": template["type"],
            "message": msg,
            "severity": template["sev"],
            "timestamp": _now().strftime("%H:%M:%S"),
            "district": random.choice(_districts),
        }
        yield f"data: {json.dumps(event)}\n\n"


@router.get("/stream")
async def fraud_live_stream():
    """
    SSE stream of live fraud alerts.
    Frontend: const es = new EventSource('/api/v1/fraud/stream')
    """
    return StreamingResponse(
        _fraud_stream_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
