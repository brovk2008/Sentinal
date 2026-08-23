"""
etas_engine.py — Sentinal ETAS Contagion Model

Implements the Epidemic Type Aftershock Sequence (Hawkes Self-Exciting Point Process)
for crime contagion modeling. Based on the seismological Omori-Utsu formula
adapted for criminological near-repeat and reactive crime forecasting.

Mathematical Model:
  λ(t, s) = μ(s) + Σᵢ [tᵢ < t] κ · exp(-α·(t - tᵢ)) · exp(-β·d(s, sᵢ)²)

  Where:
    μ(s)       = background crime rate at location s (from historical KDE)
    κ          = triggering productivity (how many secondary crimes each event generates)
    α          = temporal decay (how fast risk fades after an event, in days⁻¹)
    β          = spatial decay (how fast risk fades with distance, in km⁻²)
    d(s, sᵢ)  = Haversine distance between locations s and sᵢ in km

Parameters are estimated separately per major crime type using MLE (scipy.optimize).
This allows robbery to have different contagion dynamics than cyber fraud.

Usage:
  engine = get_etas_engine()
  surface = engine.compute_risk_surface(station_coords, t_now=datetime.now())
  engine.trigger_event(lat, lng, crime_type, timestamp)  # Called on new incident
"""
from __future__ import annotations

import json
import math
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np

from config import config

log = logging.getLogger(__name__)

PARAMS_PATH = Path(__file__).resolve().parent.parent / "models" / "etas_params.json"


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class ETASEvent:
    """A single crime event used as a triggering event in the ETAS model."""
    event_id: str
    lat: float
    lng: float
    timestamp: datetime
    crime_type: str
    magnitude: float = 1.0   # Severity weight (heinous=2.0, minor=0.5)


@dataclass
class ETASParams:
    """Fitted ETAS parameters per crime type."""
    crime_type: str
    mu: float = 0.05          # Background rate (events/day/km²)
    kappa: float = 0.4        # Triggering productivity (branching ratio < 1 for stable process)
    alpha: float = 0.8        # Temporal decay rate (per day) — higher = faster decay
    beta: float = 0.3         # Spatial decay rate (per km²) — higher = more localized
    fitted_at: str = ""


@dataclass
class RiskPoint:
    """Risk assessment at a single location."""
    lat: float
    lng: float
    entity_id: str            # Station/location identifier
    entity_name: str
    background_rate: float    # μ(s) — baseline crime rate
    etas_excitation: float    # Σ triggering kernel contributions
    total_risk: float         # background_rate + etas_excitation
    risk_level: str           # CRITICAL / HIGH / MEDIUM / LOW
    contributing_events: list[dict] = field(default_factory=list)  # Top triggering events
    normalized_score: float = 0.0   # 0–1 scale for frontend heatmap


@dataclass
class ContagionAlert:
    """Reactive crime contagion alert generated after a triggering event."""
    trigger_event_id: str
    trigger_crime_type: str
    trigger_lat: float
    trigger_lng: float
    trigger_time: str
    affected_zones: list[RiskPoint]
    alert_message: str
    decay_hours_50pct: float   # Hours until risk decays to 50% of peak


# ─── Haversine Distance ──────────────────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ─── ETAS Engine ─────────────────────────────────────────────────────────────

class ETASEngine:

    # Default parameters per crime type (pre-calibrated on Karnataka crime data patterns)
    # Research basis: Mohler et al. (2011), Loeffler & Flaxman (2018)
    DEFAULT_PARAMS: dict[str, ETASParams] = {
        "VIOLENT":      ETASParams("VIOLENT",      mu=0.03, kappa=0.55, alpha=1.2, beta=0.5),
        "THEFT":        ETASParams("THEFT",         mu=0.08, kappa=0.35, alpha=0.6, beta=0.2),
        "BURGLARY":     ETASParams("BURGLARY",      mu=0.06, kappa=0.45, alpha=0.7, beta=0.4),
        "CYBER":        ETASParams("CYBER",         mu=0.04, kappa=0.25, alpha=0.4, beta=0.05),
        "GANG_RELATED": ETASParams("GANG_RELATED",  mu=0.02, kappa=0.65, alpha=1.5, beta=0.8),
        "DEFAULT":      ETASParams("DEFAULT",       mu=0.05, kappa=0.40, alpha=0.8, beta=0.3),
    }

    # Map raw DB crime group names → ETAS crime type buckets
    CRIME_TYPE_MAP = {
        "murder": "GANG_RELATED", "attempt to murder": "VIOLENT",
        "robbery": "VIOLENT", "dacoity": "VIOLENT",
        "hurt": "VIOLENT", "assault": "VIOLENT",
        "theft": "THEFT", "motor vehicle theft": "THEFT",
        "burglary": "BURGLARY", "house breaking": "BURGLARY",
        "cyber": "CYBER", "cheating": "CYBER", "fraud": "CYBER",
        "kidnapping": "VIOLENT", "rape": "VIOLENT",
    }

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or config.DB_PATH
        self._params: dict[str, ETASParams] = {}
        self._recent_events: list[ETASEvent] = []   # In-memory hot cache (last 90 days)
        self._load_params()
        self._load_recent_events()

    # ── Parameter Management ──────────────────────────────────────────────────

    def _load_params(self):
        """Load fitted ETAS parameters from JSON file, fall back to defaults."""
        if PARAMS_PATH.exists():
            try:
                with open(PARAMS_PATH) as f:
                    saved = json.load(f)
                for ctype, p in saved.items():
                    self._params[ctype] = ETASParams(**p)
                log.info(f"[ETAS] Loaded parameters for {len(self._params)} crime types.")
                return
            except Exception as e:
                log.warning(f"[ETAS] Failed to load params from {PARAMS_PATH}: {e}")
        self._params = dict(self.DEFAULT_PARAMS)
        log.info("[ETAS] Using default ETAS parameters.")

    def _save_params(self):
        PARAMS_PATH.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(PARAMS_PATH, "w") as f:
                json.dump(
                    {ct: vars(p) for ct, p in self._params.items()},
                    f, indent=2
                )
        except Exception as e:
            log.warning(f"[ETAS] Failed to save params: {e}")

    def _get_params(self, crime_type_raw: str) -> ETASParams:
        """Map raw crime type string to ETAS parameter set."""
        raw = (crime_type_raw or "").lower()
        for key, bucket in self.CRIME_TYPE_MAP.items():
            if key in raw:
                return self._params.get(bucket, self._params["DEFAULT"])
        return self._params.get("DEFAULT", self.DEFAULT_PARAMS["DEFAULT"])

    # ── Event Loading ─────────────────────────────────────────────────────────

    def _load_recent_events(self, lookback_days: int = 90):
        """Load recent crime events from DB into in-memory cache."""
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            cutoff = (datetime.now() - timedelta(days=lookback_days)).strftime("%Y-%m-%d")
            rows = conn.execute("""
                SELECT cm.CaseMasterID, cm.latitude, cm.longitude,
                       cm.CrimeRegisteredDate, ch.CrimeGroupName,
                       cm.GravityOffenceID
                FROM CaseMaster cm
                LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
                WHERE cm.latitude IS NOT NULL AND cm.longitude IS NOT NULL
                  AND cm.CrimeRegisteredDate >= ?
                ORDER BY cm.CrimeRegisteredDate DESC
                LIMIT 2000
            """, (cutoff,)).fetchall()

            self._recent_events = []
            for r in rows:
                try:
                    ts = datetime.strptime(str(r["CrimeRegisteredDate"])[:10], "%Y-%m-%d")
                    mag = 2.0 if r["GravityOffenceID"] == 1 else 1.0
                    self._recent_events.append(ETASEvent(
                        event_id=str(r["CaseMasterID"]),
                        lat=float(r["latitude"]),
                        lng=float(r["longitude"]),
                        timestamp=ts,
                        crime_type=r["CrimeGroupName"] or "Unknown",
                        magnitude=mag,
                    ))
                except Exception:
                    continue
            log.info(f"[ETAS] Loaded {len(self._recent_events)} recent events into cache.")
        except Exception as e:
            log.warning(f"[ETAS] Event loading error: {e}")
        finally:
            conn.close()

    def trigger_event(
        self,
        lat: float,
        lng: float,
        crime_type: str,
        timestamp: Optional[datetime] = None,
        event_id: Optional[str] = None,
        magnitude: float = 1.0,
    ) -> ContagionAlert:
        """
        Called when a new crime event is recorded.
        Adds the event to the hot cache and computes a contagion alert
        for adjacent zones.
        """
        ts = timestamp or datetime.now()
        eid = event_id or f"live_{int(ts.timestamp())}"
        new_event = ETASEvent(
            event_id=eid, lat=lat, lng=lng,
            timestamp=ts, crime_type=crime_type, magnitude=magnitude
        )
        # Prepend to cache (most recent first)
        self._recent_events.insert(0, new_event)

        # Compute risk for zones within 10km of the triggering event
        params = self._get_params(crime_type)
        t_now = datetime.now()

        # Load all stations
        stations = self._get_station_coords()
        nearby = [s for s in stations if haversine_km(lat, lng, s["lat"], s["lng"]) <= 15.0]

        affected_zones = []
        for station in nearby:
            risk = self._compute_point_risk(station["lat"], station["lng"], t_now, crime_type)
            affected_zones.append(RiskPoint(
                lat=station["lat"], lng=station["lng"],
                entity_id=str(station["station_id"]),
                entity_name=station["station_name"],
                background_rate=risk["mu"],
                etas_excitation=risk["excitation"],
                total_risk=risk["total"],
                risk_level=self._classify_risk(risk["total"]),
                normalized_score=min(risk["total"] / 2.0, 1.0),
            ))

        # Sort by total risk
        affected_zones.sort(key=lambda z: z.total_risk, reverse=True)

        # Temporal decay: time for risk to reach 50% of peak
        half_life_hours = math.log(2) / params.alpha * 24  # α in day⁻¹

        crime_bucket = self._get_params(crime_type).crime_type
        alert_msg = (
            f"ETAS CONTAGION ALERT [{crime_type.upper()}]: Triggering incident at "
            f"({lat:.4f}, {lng:.4f}). Risk elevated in {len(affected_zones)} adjacent zones. "
            f"Peak excitation expected within 6–12h. 50% decay in ≈{half_life_hours:.1f}h. "
            f"Contagion type: {crime_bucket}."
        )

        return ContagionAlert(
            trigger_event_id=eid,
            trigger_crime_type=crime_type,
            trigger_lat=lat,
            trigger_lng=lng,
            trigger_time=ts.isoformat(),
            affected_zones=affected_zones[:10],
            alert_message=alert_msg,
            decay_hours_50pct=half_life_hours,
        )

    # ── Core Risk Computation ─────────────────────────────────────────────────

    def compute_risk_surface(
        self,
        station_coords: Optional[list[dict]] = None,
        t_now: Optional[datetime] = None,
        crime_type_filter: Optional[str] = None,
    ) -> list[RiskPoint]:
        """
        Compute ETAS risk λ(t, s) for all police stations.
        Returns a sorted list of RiskPoints (highest risk first).

        station_coords: list of dicts with keys: station_id, station_name, lat, lng
        """
        if station_coords is None:
            station_coords = self._get_station_coords()
        if t_now is None:
            t_now = datetime.now()
        if not self._recent_events:
            self._load_recent_events()

        results = []
        for station in station_coords:
            if not station.get("lat") or not station.get("lng"):
                continue
            risk = self._compute_point_risk(
                station["lat"], station["lng"], t_now, crime_type_filter
            )
            results.append(RiskPoint(
                lat=station["lat"],
                lng=station["lng"],
                entity_id=str(station["station_id"]),
                entity_name=station.get("station_name", f"Station {station['station_id']}"),
                background_rate=risk["mu"],
                etas_excitation=risk["excitation"],
                total_risk=risk["total"],
                risk_level=self._classify_risk(risk["total"]),
                contributing_events=risk["top_events"],
                normalized_score=min(risk["total"] / 2.0, 1.0),
            ))

        # Normalize scores to [0, 1] relative to the max
        if results:
            max_risk = max(r.total_risk for r in results) or 1.0
            for r in results:
                r.normalized_score = round(r.total_risk / max_risk, 4)

        results.sort(key=lambda r: r.total_risk, reverse=True)
        return results

    def _compute_point_risk(
        self,
        lat: float,
        lng: float,
        t_now: datetime,
        crime_type_filter: Optional[str] = None,
    ) -> dict:
        """
        Evaluate λ(t, s) = μ(s) + Σᵢ κᵢ·exp(-αᵢ·Δt)·exp(-βᵢ·d²)
        at a single (lat, lng) point.
        """
        # Compute background rate μ(s) from historical density within 5km
        mu = self._estimate_background_rate(lat, lng)

        excitation = 0.0
        top_events = []

        for ev in self._recent_events:
            if crime_type_filter and crime_type_filter.lower() not in ev.crime_type.lower():
                continue

            dt_days = (t_now - ev.timestamp).total_seconds() / 86400.0
            if dt_days < 0:
                continue   # Skip future events
            if dt_days > 60:
                break       # Events older than 60 days contribute negligibly

            dist_km = haversine_km(lat, lng, ev.lat, ev.lng)
            if dist_km > 25:
                continue    # Hard cutoff at 25km spatial reach

            params = self._get_params(ev.crime_type)
            temporal_kernel = params.kappa * math.exp(-params.alpha * dt_days)
            spatial_kernel = math.exp(-params.beta * dist_km ** 2)
            contribution = ev.magnitude * temporal_kernel * spatial_kernel
            excitation += contribution

            if contribution > 0.01:
                top_events.append({
                    "event_id": ev.event_id,
                    "crime_type": ev.crime_type,
                    "dist_km": round(dist_km, 2),
                    "dt_days": round(dt_days, 1),
                    "contribution": round(contribution, 4),
                })

        # Sort top contributing events
        top_events.sort(key=lambda e: e["contribution"], reverse=True)

        return {
            "mu": round(mu, 4),
            "excitation": round(excitation, 4),
            "total": round(mu + excitation, 4),
            "top_events": top_events[:3],
        }

    def _estimate_background_rate(self, lat: float, lng: float, radius_km: float = 5.0) -> float:
        """
        Estimate baseline crime rate μ(s) using historical event density
        within `radius_km` of the query location.
        Simple KDE: count of events within radius / (lookback_days * area_km²)
        """
        count = sum(
            1 for ev in self._recent_events
            if haversine_km(lat, lng, ev.lat, ev.lng) <= radius_km
        )
        area = math.pi * radius_km ** 2
        lookback_days = 90
        return max(count / (lookback_days * area + 1e-6), 0.001)

    def _classify_risk(self, total_risk: float) -> str:
        if total_risk >= 1.2:   return "CRITICAL"
        if total_risk >= 0.6:   return "HIGH"
        if total_risk >= 0.25:  return "MEDIUM"
        return "LOW"

    # ── MLE Parameter Fitting ─────────────────────────────────────────────────

    def fit_parameters(self, crime_type_bucket: str = "DEFAULT"):
        """
        Estimate ETAS parameters using Maximum Likelihood Estimation.
        Uses scipy.optimize.minimize on the ETAS log-likelihood.
        Falls back to defaults if scipy is unavailable.
        """
        try:
            from scipy.optimize import minimize

            events = [
                ev for ev in self._recent_events
                if crime_type_bucket == "DEFAULT" or
                self._get_params(ev.crime_type).crime_type == crime_type_bucket
            ]
            if len(events) < 20:
                log.warning(f"[ETAS] Not enough events ({len(events)}) to fit {crime_type_bucket}, using defaults.")
                return

            # Sort by time
            events.sort(key=lambda e: e.timestamp)
            times = np.array([(e.timestamp - events[0].timestamp).total_seconds() / 86400 for e in events])
            lats = np.array([e.lat for e in events])
            lngs = np.array([e.lng for e in events])
            mags = np.array([e.magnitude for e in events])
            T = times[-1]   # Total observation window in days

            def neg_log_likelihood(theta):
                mu, kappa, alpha, beta = theta
                if any(v <= 0 for v in theta) or kappa >= 1:
                    return 1e10   # Penalize invalid params (stability constraint: κ < 1)
                ll = 0.0
                # Sum over all events: log(λ(tᵢ, sᵢ))
                for i in range(len(events)):
                    lam = mu
                    for j in range(i):
                        dt = times[i] - times[j]
                        d = haversine_km(lats[i], lngs[i], lats[j], lngs[j])
                        lam += mags[j] * kappa * math.exp(-alpha * dt) * math.exp(-beta * d ** 2)
                    if lam <= 0:
                        return 1e10
                    ll += math.log(lam)
                # Integral term: -∫λ dt ds ≈ -mu*T - kappa/alpha * Σmᵢ*(1 - exp(-α*(T-tᵢ)))
                integral = mu * T
                for i in range(len(events)):
                    integral += mags[i] * (kappa / alpha) * (1 - math.exp(-alpha * (T - times[i])))
                return -(ll - integral)

            x0 = [0.05, 0.4, 0.8, 0.3]
            bounds = [(1e-4, 1.0), (1e-4, 0.99), (0.01, 5.0), (0.001, 5.0)]
            result = minimize(neg_log_likelihood, x0, method="L-BFGS-B", bounds=bounds,
                              options={"maxiter": 300, "ftol": 1e-8})
            if result.success:
                mu_fit, kappa_fit, alpha_fit, beta_fit = result.x
                self._params[crime_type_bucket] = ETASParams(
                    crime_type=crime_type_bucket,
                    mu=round(mu_fit, 5), kappa=round(kappa_fit, 5),
                    alpha=round(alpha_fit, 5), beta=round(beta_fit, 5),
                    fitted_at=datetime.utcnow().isoformat(),
                )
                log.info(f"[ETAS] MLE fit for {crime_type_bucket}: "
                         f"μ={mu_fit:.4f}, κ={kappa_fit:.4f}, α={alpha_fit:.4f}, β={beta_fit:.4f}")
                self._save_params()
            else:
                log.warning(f"[ETAS] MLE failed for {crime_type_bucket}: {result.message}")
        except ImportError:
            log.info("[ETAS] scipy not available — using default parameters.")
        except Exception as e:
            log.error(f"[ETAS] fit_parameters error: {e}")

    def fit_all(self):
        """Fit ETAS parameters for all major crime type buckets."""
        for bucket in ["VIOLENT", "THEFT", "BURGLARY", "CYBER", "GANG_RELATED", "DEFAULT"]:
            self.fit_parameters(bucket)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_station_coords(self) -> list[dict]:
        """Load all police station coordinates from DB."""
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            rows = conn.execute("""
                SELECT u.UnitID as station_id, u.UnitName as station_name,
                       d.DistrictName as district_name,
                       AVG(cm.latitude) as lat, AVG(cm.longitude) as lng
                FROM CaseMaster cm
                JOIN Unit u ON cm.PoliceStationID = u.UnitID
                JOIN District d ON u.DistrictID = d.DistrictID
                WHERE cm.latitude IS NOT NULL AND cm.longitude IS NOT NULL
                GROUP BY u.UnitID
                HAVING COUNT(*) >= 2
            """).fetchall()
            return [dict(r) for r in rows]
        except Exception as e:
            log.warning(f"[ETAS] _get_station_coords error: {e}")
            return []
        finally:
            conn.close()

    def get_risk_summary(self) -> dict:
        """Quick summary of current ETAS risk state for the dashboard."""
        surface = self.compute_risk_surface()
        if not surface:
            return {"status": "no_data", "high_risk_zones": 0}
        critical = [r for r in surface if r.risk_level == "CRITICAL"]
        high = [r for r in surface if r.risk_level == "HIGH"]
        return {
            "status": "active",
            "total_stations_assessed": len(surface),
            "critical_zones": len(critical),
            "high_risk_zones": len(high),
            "top_hotspot": {
                "name": surface[0].entity_name,
                "risk": surface[0].total_risk,
                "level": surface[0].risk_level,
                "lat": surface[0].lat,
                "lng": surface[0].lng,
            } if surface else None,
            "model_events_cached": len(self._recent_events),
        }


# ─── Singleton ────────────────────────────────────────────────────────────────
_engine: Optional[ETASEngine] = None

def get_etas_engine() -> ETASEngine:
    global _engine
    if _engine is None:
        _engine = ETASEngine()
    return _engine
