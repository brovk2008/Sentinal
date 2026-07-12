"""
alert_service.py
Sends Catalyst Mail + Push Notifications when:
- A crime hotspot spikes beyond threshold
- A new CRITICAL severity FIR is ingested
- Pattern engine detects an active spree
Triggered by Catalyst Signals from data ingestion events.
"""

import os
import logging
import zcatalyst_sdk as catalyst

log = logging.getLogger(__name__)

# Fallback email if environment variable is not defined
ALERT_EMAIL = os.getenv("SENTINAL_ALERT_EMAIL", "techp.sentinal.alerts@gmail.com")


def send_hotspot_alert(district: str, crime_type: str, spike_pct: float, station: str):
    """Send email + push when hotspot spikes >30% above historical average."""
    subject = f"🚨 SENTINAL ALERT: Crime Spike in {district}"
    body = f"""
PROJECT SENTINAL — INTELLIGENCE ALERT
======================================
District:   {district}
Station:    {station}
Crime Type: {crime_type}
Spike:      +{spike_pct:.0f}% above 30-day average

Recommended Action: Increase patrol presence in {station} jurisdiction.

This is an automated alert from the Sentinal Pattern Intelligence Engine.
    """.strip()

    _send_mail(subject, body)
    _send_push(f"Crime spike in {district}", f"{crime_type} +{spike_pct:.0f}% — {station}")


def send_critical_fir_alert(fir_number: str, district: str, crime_head: str):
    """Send alert when a CRITICAL severity FIR is ingested."""
    subject = f"🔴 SENTINAL: Critical FIR Ingested — {district}"
    body = f"""
CRITICAL FIR ALERT
==================
FIR Number: {fir_number}
District:   {district}
Crime:      {crime_head}

Review immediately in Sentinal → Cases & Timeline.
    """.strip()

    _send_mail(subject, body)
    _send_push(f"Critical FIR: {fir_number}", f"{crime_head} in {district}")


def _send_mail(subject: str, body: str):
    if not ALERT_EMAIL:
        log.warning("SENTINAL_ALERT_EMAIL not set — skipping mail alert")
        return
    try:
        app = catalyst.initialize()
        mail = app.mail()
        mail.send_mail(
            from_email="sentinal-alerts@sentinal.ksp",
            to_email=[ALERT_EMAIL],
            subject=subject,
            content=body,
        )
        log.info(f"Alert mail sent to {ALERT_EMAIL}: {subject}")
    except Exception as e:
        log.error(f"Mail send failed: {e}")


def _send_push(title: str, message: str):
    try:
        app = catalyst.initialize()
        push = app.push_notification()
        push.send({
            "title": title,
            "message": message,
            "data": {"source": "sentinal_pattern_engine"},
        })
        log.info(f"Push sent: {title}")
    except Exception as e:
        log.error(f"Push send failed: {e}")
