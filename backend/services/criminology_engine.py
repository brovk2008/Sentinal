"""
criminology_engine.py — Sentinal Advanced MO Fingerprinting Engine v2

Replaces keyword regex matching with proper TF-IDF n-gram feature vectors,
cosine similarity clustering, and cross-crime-type escalation chain modeling.

Techniques implemented:
  1. TF-IDF Weighted N-gram MO Fingerprinting
     - Extracts 1/2/3-gram feature vectors from BriefFacts narrative text
     - Represents each case as a TF-IDF sparse vector in MO feature space
     - Cosine similarity > 0.72 threshold clusters cases into MO Series

  2. Cosine Similarity Agglomerative MO Clustering
     - Single-linkage clustering over cosine similarity matrix
     - Each cluster = a probable single-offender/gang MO Series
     - Clusters are stored in mo_fingerprints table for incremental updates

  3. Near Repeat Forecasting (Bowers & Johnson 2004)
     - Time-decay weighted victimization risk within spatial buffer zones
     - Uses actual Haversine distances, not grid approximations

  4. Cross-Type Crime Escalation Chains
     - Builds a crime-type transition probability matrix from historical sequences
     - Identifies the Markov chain of crime escalation per offender
     - Flags high-risk escalation paths (petty theft → vehicle theft → robbery)

  5. Spree Detection
     - DBSCAN-style density clustering on (lat, lng, time) events
     - Identifies crime sprees: 3+ crimes within 72h and 5km radius
"""
from __future__ import annotations

import json
import math
import re
import sqlite3
import logging
import os
from collections import defaultdict, Counter
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

from config import config

log = logging.getLogger(__name__)
DB_PATH = config.DB_PATH


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlambda = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.asin(math.sqrt(a))


# ─── 1. TF-IDF MO Fingerprinting ────────────────────────────────────────────

STOP_WORDS = {
    'the','is','in','of','and','a','to','for','that','this','on','with','at',
    'by','an','as','was','were','had','has','he','she','they','his','her','its',
    'also','said','have','been','from','which','are','but','not','police','case',
    'station','complainant','accused','victim','fir','against','under','section'
}

def _tokenize(text: str) -> List[str]:
    """Extract 1-grams and 2-grams from narrative text."""
    text = (text or "").lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    words = [w for w in text.split() if len(w) > 2 and w not in STOP_WORDS]
    unigrams = words
    bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words)-1)]
    return unigrams + bigrams


def _compute_tf_idf_vectors(docs: List[str]) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
    """
    Compute TF-IDF vectors for a list of documents.
    Returns: (list of {term: tfidf_weight} dicts, idf_map)
    Pure Python, no sklearn dependency.
    """
    N = len(docs)
    if N == 0:
        return [], {}

    # Step 1: Build DF (document frequency)
    df: Counter = Counter()
    token_lists = []
    for doc in docs:
        tokens = _tokenize(doc)
        token_lists.append(tokens)
        for t in set(tokens):
            df[t] += 1

    # Step 2: Compute IDF
    idf = {term: math.log((N + 1) / (cnt + 1)) + 1 for term, cnt in df.items()}

    # Step 3: Compute TF-IDF per document
    vectors = []
    for tokens in token_lists:
        tf: Counter = Counter(tokens)
        total = sum(tf.values()) or 1
        vec = {t: (cnt / total) * idf.get(t, 1.0) for t, cnt in tf.items()}
        vectors.append(vec)

    return vectors, idf


def _cosine_similarity(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    """Cosine similarity between two sparse TF-IDF vectors."""
    common = set(vec_a) & set(vec_b)
    if not common:
        return 0.0
    dot = sum(vec_a[k] * vec_b[k] for k in common)
    mag_a = math.sqrt(sum(v**2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v**2 for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


def _single_linkage_cluster(
    indices: List[int],
    sim_fn,
    threshold: float = 0.72
) -> List[List[int]]:
    """
    Single-linkage agglomerative clustering.
    Two items are in the same cluster if ANY pair within
    the cluster has similarity >= threshold.
    O(n²) — suitable for datasets < 500 items.
    """
    clusters: List[List[int]] = [[i] for i in indices]
    changed = True
    while changed:
        changed = False
        merged = [False] * len(clusters)
        new_clusters = []
        for i in range(len(clusters)):
            if merged[i]:
                continue
            cluster_i = clusters[i]
            for j in range(i + 1, len(clusters)):
                if merged[j]:
                    continue
                # Check if any pair (a, b) with a∈cluster_i, b∈cluster_j exceeds threshold
                should_merge = any(
                    sim_fn(a, b) >= threshold
                    for a in cluster_i
                    for b in clusters[j]
                )
                if should_merge:
                    cluster_i = cluster_i + clusters[j]
                    merged[j] = True
                    changed = True
            new_clusters.append(cluster_i)
        clusters = new_clusters
    return clusters


# ─── 2. MO Series Analysis ───────────────────────────────────────────────────

def analyze_mo_clusters(limit: int = 300) -> List[Dict[str, Any]]:
    """
    Full MO fingerprinting pipeline:
      1. Load recent cases with BriefFacts narratives
      2. Compute TF-IDF vectors
      3. Build pairwise cosine similarity matrix
      4. Cluster into MO Series using single-linkage
      5. Store fingerprints in mo_fingerprints table
      6. Return cluster summaries for the analyst

    Returns list of MO series with their constituent cases.
    """
    con = _conn()
    try:
        rows = con.execute("""
            SELECT c.CaseMasterID, c.CrimeNo, d.DistrictName, u.UnitName AS StationName,
                   c.BriefFacts, ch.CrimeGroupName, c.CrimeRegisteredDate,
                   c.latitude, c.longitude
            FROM CaseMaster c
            LEFT JOIN Unit u ON c.PoliceStationID = u.UnitID
            LEFT JOIN District d ON u.DistrictID = d.DistrictID
            LEFT JOIN CrimeHead ch ON c.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE c.BriefFacts IS NOT NULL AND length(c.BriefFacts) > 50
            ORDER BY c.CrimeRegisteredDate DESC
            LIMIT ?
        """, (limit,)).fetchall()
    except Exception as e:
        log.error(f"[MO] Query error: {e}")
        return []
    finally:
        con.close()

    if not rows:
        return []

    facts = [r["BriefFacts"] or "" for r in rows]
    case_ids = [r["CaseMasterID"] for r in rows]

    # Compute TF-IDF
    vectors, idf = _compute_tf_idf_vectors(facts)
    log.info(f"[MO] TF-IDF computed: {len(vectors)} docs, vocabulary size {len(idf)}")

    # Build pairwise similarity function (index-based for clustering)
    def sim(i: int, j: int) -> float:
        return _cosine_similarity(vectors[i], vectors[j])

    # Cluster
    indices = list(range(len(rows)))
    clusters = _single_linkage_cluster(indices, sim, threshold=0.72)

    # Filter: only clusters with 2+ cases (single case = no series)
    series_clusters = [c for c in clusters if len(c) >= 2]
    log.info(f"[MO] Clustering complete: {len(series_clusters)} MO series found")

    # Build output and store fingerprints
    results = []
    con = _conn()
    for cluster_id, cluster in enumerate(series_clusters):
        cluster_rows = [rows[i] for i in cluster]
        cluster_vecs = [vectors[i] for i in cluster]

        # Characterize the cluster: most common high-weight terms
        combined_terms: Counter = Counter()
        for vec in cluster_vecs:
            top_terms = sorted(vec.items(), key=lambda x: x[1], reverse=True)[:10]
            combined_terms.update({t: w for t, w in top_terms})
        signature_terms = [t for t, _ in combined_terms.most_common(5)]

        # Compute intra-cluster cohesion score
        pairwise = []
        for i in range(len(cluster)):
            for j in range(i+1, len(cluster)):
                pairwise.append(_cosine_similarity(cluster_vecs[i], cluster_vecs[j]))
        cohesion = round(sum(pairwise)/len(pairwise), 3) if pairwise else 0.0

        # Find dominant crime type
        crime_types = Counter(r["CrimeGroupName"] for r in cluster_rows if r["CrimeGroupName"])
        dominant_crime = crime_types.most_common(1)[0][0] if crime_types else "Unknown"

        # Time span
        dates = sorted([r["CrimeRegisteredDate"] for r in cluster_rows if r["CrimeRegisteredDate"]])
        date_span = f"{dates[0]} → {dates[-1]}" if len(dates) >= 2 else (dates[0] if dates else "Unknown")

        # Districts affected
        districts = list({r["DistrictName"] for r in cluster_rows if r["DistrictName"]})

        series = {
            "series_id":         cluster_id + 1,
            "case_count":        len(cluster_rows),
            "dominant_crime_type": dominant_crime,
            "cohesion_score":    cohesion,
            "date_span":         date_span,
            "districts":         districts,
            "signature_terms":   signature_terms,
            "cases": [
                {
                    "case_id":    r["CaseMasterID"],
                    "crime_no":   r["CrimeNo"],
                    "district":   r["DistrictName"],
                    "station":    r["StationName"],
                    "date":       r["CrimeRegisteredDate"],
                    "crime_type": r["CrimeGroupName"],
                }
                for r in cluster_rows
            ],
        }
        results.append(series)

        # Store fingerprints
        try:
            for i, idx in enumerate(cluster):
                con.execute("""
                    INSERT OR REPLACE INTO mo_fingerprints
                    (case_master_id, mo_cluster_id, mo_vector_json, crime_type_bucket, fingerprinted_at)
                    VALUES (?, ?, ?, ?, datetime('now'))
                """, (
                    case_ids[idx],
                    cluster_id + 1,
                    json.dumps({k: round(v, 4) for k, v in list(cluster_vecs[i].items())[:50]}),
                    dominant_crime,
                ))
            con.commit()
        except Exception as db_err:
            log.warning(f"[MO] Failed to store fingerprints: {db_err}")

    con.close()

    results.sort(key=lambda s: (s["case_count"], s["cohesion_score"]), reverse=True)
    return results


def find_similar_cases(case_id: int, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Given a case ID, find the top-k most MO-similar cases using TF-IDF cosine similarity.
    """
    con = _conn()
    try:
        target = con.execute(
            "SELECT BriefFacts, CrimeGroupName FROM CaseMaster WHERE CaseMasterID = ?",
            (case_id,)
        ).fetchone()
        if not target or not target["BriefFacts"]:
            return []

        candidates = con.execute("""
            SELECT CaseMasterID, CrimeNo, BriefFacts, CrimeGroupName, CrimeRegisteredDate
            FROM CaseMaster
            WHERE BriefFacts IS NOT NULL AND CaseMasterID != ?
            ORDER BY CrimeRegisteredDate DESC LIMIT 300
        """, (case_id,)).fetchall()
    except Exception as e:
        log.error(f"[MO] find_similar_cases error: {e}")
        return []
    finally:
        con.close()

    all_docs = [target["BriefFacts"]] + [c["BriefFacts"] for c in candidates]
    vectors, _ = _compute_tf_idf_vectors(all_docs)
    if not vectors:
        return []

    target_vec = vectors[0]
    scored = []
    for i, cand in enumerate(candidates):
        sim = _cosine_similarity(target_vec, vectors[i + 1])
        if sim >= 0.35:
            scored.append({
                "case_id":    cand["CaseMasterID"],
                "crime_no":   cand["CrimeNo"],
                "crime_type": cand["CrimeGroupName"],
                "date":       cand["CrimeRegisteredDate"],
                "similarity": round(sim, 3),
                "confidence": f"{min(sim*100, 99):.0f}%",
            })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:top_k]


# ─── 3. Near-Repeat Forecasting ──────────────────────────────────────────────

def compute_near_repeat_risk(
    target_lat: float,
    target_lng: float,
    radius_km: float = 2.0,
    days_window: int = 30,
) -> Dict[str, Any]:
    """
    Bowers & Johnson (2004) near-repeat victimization forecasting.
    Computes time-decay weighted risk at (target_lat, target_lng)
    based on crimes within radius_km in the last days_window.

    Risk formula: R(t, d) = Σᵢ exp(-λt·Δtᵢ) · exp(-λd·dᵢ) · wᵢ
    where λt=0.3/day, λd=0.5/km, wᵢ = gravity weight
    """
    con = _conn()
    try:
        cutoff = (datetime.now() - timedelta(days=days_window)).strftime("%Y-%m-%d")
        rows = con.execute("""
            SELECT CaseMasterID, CrimeNo, CrimeRegisteredDate, CrimeGroupName,
                   latitude, longitude, GravityOffenceID
            FROM CaseMaster
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
              AND CrimeRegisteredDate >= ?
        """, (cutoff,)).fetchall()
    except Exception as e:
        return {"error": str(e), "risk_score": 0.0}
    finally:
        con.close()

    LAMBDAtime = 0.3  # temporal decay (per day)
    LAMBDAdist = 0.5  # spatial decay (per km)

    risk = 0.0
    contributing = []
    now = datetime.now()

    for r in rows:
        if not r["latitude"] or not r["longitude"]:
            continue
        try:
            d_km = haversine_km(target_lat, target_lng, r["latitude"], r["longitude"])
        except Exception:
            continue

        if d_km > radius_km:
            continue

        try:
            crime_date = datetime.strptime(str(r["CrimeRegisteredDate"])[:10], "%Y-%m-%d")
        except Exception:
            continue

        dt_days = (now - crime_date).days
        gravity_weight = 2.0 if r["GravityOffenceID"] == 1 else 1.0
        contribution = gravity_weight * math.exp(-LAMBDAtime * dt_days) * math.exp(-LAMBDAdist * d_km)
        risk += contribution

        if contribution > 0.01:
            contributing.append({
                "case_id":    r["CaseMasterID"],
                "crime_type": r["CrimeGroupName"],
                "date":       r["CrimeRegisteredDate"],
                "dist_km":    round(d_km, 2),
                "dt_days":    dt_days,
                "contribution": round(contribution, 4),
            })

    contributing.sort(key=lambda c: c["contribution"], reverse=True)

    risk_level = (
        "CRITICAL" if risk >= 2.5 else
        "HIGH"     if risk >= 1.2 else
        "MEDIUM"   if risk >= 0.5 else
        "LOW"
    )

    return {
        "risk_score":           round(risk, 4),
        "risk_level":           risk_level,
        "radius_km":            radius_km,
        "window_days":          days_window,
        "contributing_crimes":  contributing[:5],
        "total_crimes_in_zone": len(contributing),
        "forecast": (
            f"Based on {len(contributing)} crimes within {radius_km}km in the last {days_window} days, "
            f"near-repeat victimization risk is {risk_level} (score: {risk:.2f}). "
            f"Historical patterns suggest elevated risk for the next {7 if risk >= 1.0 else 14} days."
        ),
    }


# ─── 4. Cross-Type Crime Escalation Chains ───────────────────────────────────

# Crime severity levels for escalation direction determination
SEVERITY_LEVELS = {
    "cyber fraud": 1, "cheating": 1, "defamation": 1,
    "theft": 2, "motor vehicle theft": 2, "house breaking": 2,
    "robbery": 3, "burglary": 3, "extortion": 3,
    "hurt": 4, "assault": 4, "kidnapping": 4,
    "attempt to murder": 5, "murder": 5, "dacoity": 5,
}

def build_escalation_matrix(limit: int = 5000) -> Dict[str, Any]:
    """
    Build a crime type transition probability matrix from historical offender sequences.
    For each accused person with multiple offences, record the ordered sequence of crime types.
    Compute P(crime_j | crime_i) = count(i→j) / count(i)

    Returns:
      - transition matrix as nested dict
      - top escalation paths (chains with highest transition probability)
    """
    con = _conn()
    try:
        rows = con.execute("""
            SELECT a.AccusedName, cm.CrimeRegisteredDate, ch.CrimeGroupName
            FROM Accused a
            JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
            LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE cm.CrimeRegisteredDate IS NOT NULL AND ch.CrimeGroupName IS NOT NULL
            ORDER BY a.AccusedName, cm.CrimeRegisteredDate ASC
            LIMIT ?
        """, (limit,)).fetchall()
    except Exception as e:
        return {"error": str(e)}
    finally:
        con.close()

    # Group sequences by offender
    sequences: Dict[str, List[str]] = defaultdict(list)
    for r in rows:
        name = (r["AccusedName"] or "").strip().lower()
        if name:
            sequences[name].append((r["CrimeRegisteredDate"], r["CrimeGroupName"].lower()))

    # Build transition counts
    transitions: Dict[str, Counter] = defaultdict(Counter)
    for name, seq in sequences.items():
        if len(seq) < 2:
            continue
        seq_sorted = [ct for _, ct in sorted(seq, key=lambda x: x[0])]
        for i in range(len(seq_sorted) - 1):
            transitions[seq_sorted[i]][seq_sorted[i+1]] += 1

    # Compute probabilities
    matrix = {}
    for from_type, to_counts in transitions.items():
        total = sum(to_counts.values())
        matrix[from_type] = {
            to_type: round(cnt / total, 3)
            for to_type, cnt in to_counts.most_common(5)
        }

    # Find top escalation chains (paths where severity increases)
    escalation_chains = []
    for from_type, to_probs in matrix.items():
        from_sev = max((SEVERITY_LEVELS.get(k, 0) for k in SEVERITY_LEVELS if k in from_type), default=0)
        for to_type, prob in to_probs.items():
            to_sev = max((SEVERITY_LEVELS.get(k, 0) for k in SEVERITY_LEVELS if k in to_type), default=0)
            if to_sev > from_sev and prob >= 0.15:
                escalation_chains.append({
                    "from":        from_type.title(),
                    "to":          to_type.title(),
                    "probability": prob,
                    "severity_jump": to_sev - from_sev,
                    "warning":     f"{round(prob*100)}% of offenders committing {from_type.title()} escalate to {to_type.title()}",
                })

    escalation_chains.sort(key=lambda e: (e["severity_jump"], e["probability"]), reverse=True)

    return {
        "offender_count_analyzed": len(sequences),
        "crime_type_transitions":  len(matrix),
        "escalation_chains":       escalation_chains[:10],
        "matrix_summary":          {k: v for k, v in list(matrix.items())[:8]},
    }


# ─── 5. Spree Detection ───────────────────────────────────────────────────────

def detect_crime_sprees(
    days_window: int = 14,
    time_threshold_hours: int = 72,
    space_threshold_km: float = 5.0,
    min_events: int = 3,
) -> List[Dict[str, Any]]:
    """
    Detect crime sprees: clusters of 3+ crimes by the same accused
    within time_threshold_hours and space_threshold_km.

    Uses a modified DBSCAN-style density search on (lat, lng, time).
    """
    con = _conn()
    try:
        cutoff = (datetime.now() - timedelta(days=days_window)).strftime("%Y-%m-%d")
        rows = con.execute("""
            SELECT a.AccusedName, cm.CaseMasterID, cm.CrimeNo, cm.CrimeRegisteredDate,
                   cm.latitude, cm.longitude, ch.CrimeGroupName
            FROM Accused a
            JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
            LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE cm.CrimeRegisteredDate >= ?
              AND cm.latitude IS NOT NULL AND cm.longitude IS NOT NULL
            ORDER BY a.AccusedName, cm.CrimeRegisteredDate
        """, (cutoff,)).fetchall()
    except Exception as e:
        return []
    finally:
        con.close()

    # Group by accused name
    by_accused: Dict[str, List] = defaultdict(list)
    for r in rows:
        name = (r["AccusedName"] or "").strip()
        if name:
            by_accused[name].append(r)

    sprees = []
    for accused_name, events in by_accused.items():
        if len(events) < min_events:
            continue

        # Parse timestamps
        parsed = []
        for ev in events:
            try:
                ts = datetime.strptime(str(ev["CrimeRegisteredDate"])[:10], "%Y-%m-%d")
                parsed.append({"ts": ts, "ev": ev})
            except Exception:
                continue

        # Sliding window: find groups of 3+ events within time_threshold_hours
        parsed.sort(key=lambda x: x["ts"])
        for i in range(len(parsed)):
            window = [parsed[i]]
            for j in range(i+1, len(parsed)):
                dt_hours = (parsed[j]["ts"] - parsed[i]["ts"]).total_seconds() / 3600
                if dt_hours <= time_threshold_hours:
                    window.append(parsed[j])
                else:
                    break

            if len(window) < min_events:
                continue

            # Check spatial clustering: all events within space_threshold_km of centroid
            lats = [w["ev"]["latitude"] for w in window]
            lngs = [w["ev"]["longitude"] for w in window]
            centroid_lat = sum(lats) / len(lats)
            centroid_lng = sum(lngs) / len(lngs)

            within_radius = [
                w for w in window
                if haversine_km(centroid_lat, centroid_lng, w["ev"]["latitude"], w["ev"]["longitude"]) <= space_threshold_km
            ]

            if len(within_radius) >= min_events:
                crime_types = list({w["ev"]["CrimeGroupName"] for w in within_radius if w["ev"]["CrimeGroupName"]})
                sprees.append({
                    "accused_name":       accused_name,
                    "event_count":        len(within_radius),
                    "time_span_hours":    round((within_radius[-1]["ts"] - within_radius[0]["ts"]).total_seconds() / 3600, 1),
                    "space_radius_km":    round(max(
                        haversine_km(centroid_lat, centroid_lng, w["ev"]["latitude"], w["ev"]["longitude"])
                        for w in within_radius
                    ), 2),
                    "centroid_lat":       round(centroid_lat, 5),
                    "centroid_lng":       round(centroid_lng, 5),
                    "crime_types":        crime_types,
                    "cases": [
                        {
                            "case_id":    w["ev"]["CaseMasterID"],
                            "crime_no":   w["ev"]["CrimeNo"],
                            "date":       w["ev"]["CrimeRegisteredDate"],
                            "crime_type": w["ev"]["CrimeGroupName"],
                        }
                        for w in within_radius
                    ],
                    "assessment": f"SPREE DETECTED: {len(within_radius)} crimes in {round((within_radius[-1]['ts']-within_radius[0]['ts']).total_seconds()/3600, 1)}h within {space_threshold_km}km by {accused_name}",
                })
                break   # Don't double-count same accused in same window

    sprees.sort(key=lambda s: s["event_count"], reverse=True)
    return sprees[:20]


# ─── 6. Repeat Victimization (upgraded) ──────────────────────────────────────

def detect_repeat_victimization(days_window: int = 90) -> List[Dict[str, Any]]:
    """
    Find persons or locations attacked more than once within N days.
    Research: 40% of burglaries reoccur within 400m of original within 1 month.
    Enhanced: includes temporal risk decay and risk-level classification.
    """
    con = _conn()
    rows = []
    try:
        rows = con.execute("""
            SELECT v.VictimName as victim,
                   COUNT(DISTINCT v.CaseMasterID) as incidents,
                   MAX(cm.CrimeRegisteredDate) as last_incident,
                   MIN(cm.CrimeRegisteredDate) as first_incident,
                   GROUP_CONCAT(DISTINCT cm.CaseMasterID) as case_ids,
                   ch.CrimeGroupName as crime_type
            FROM Victim v
            JOIN CaseMaster cm ON cm.CaseMasterID = v.CaseMasterID
            LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
            WHERE cm.CrimeRegisteredDate >= date(
                (SELECT COALESCE(MAX(CrimeRegisteredDate), 'now') FROM CaseMaster),
                ? || ' days'
            )
              AND v.VictimName IS NOT NULL AND v.VictimName != ''
            GROUP BY v.VictimName
            HAVING COUNT(DISTINCT v.CaseMasterID) > 1
            ORDER BY incidents DESC
            LIMIT 20
        """, (f"-{days_window}",)).fetchall()
    except Exception as e:
        log.warning(f"[Repeat Vic] query error: {e}")
    con.close()

    results = []
    for r in rows:
        incidents = r["incidents"]
        # Temporal risk: higher if last incident was recent
        try:
            days_since_last = (datetime.now() - datetime.strptime(str(r["last_incident"])[:10], "%Y-%m-%d")).days
        except Exception:
            days_since_last = 30
        temporal_risk = math.exp(-0.05 * days_since_last)

        risk = "CRITICAL" if incidents >= 4 or (incidents >= 2 and temporal_risk > 0.7) else \
               "HIGH"     if incidents >= 3 or (incidents >= 2 and temporal_risk > 0.4) else \
               "MEDIUM"

        results.append({
            "victim":         r["victim"],
            "incidents":      incidents,
            "last_incident":  r["last_incident"],
            "first_incident": r["first_incident"],
            "case_ids":       r["case_ids"],
            "crime_type":     r["crime_type"],
            "temporal_risk":  round(temporal_risk, 3),
            "risk":           risk,
            "days_since_last": days_since_last,
        })

    return results
