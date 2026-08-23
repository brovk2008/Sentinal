"""
entity_resolver.py — Sentinal Entity Disambiguation & Canonical Merging

Problem: "Raju Kumar", "R. Kumar", "Raju", "RAJU KUMAR" are 4 separate Accused rows
         in the DB but represent the same physical person. This corrupts the graph.

Solution:
  1. Jaro-Winkler + token-sort ratio similarity (pure difflib — no external deps)
  2. Canonical entity table: one row per unique real-world person
  3. entity_aliases table maps all raw name variants → canonical_id
  4. Background sweep job merges duplicates across the Accused table

Similarity strategy:
  - Jaro-Winkler:   Good for typographical variants ("Raju" vs "Rajoo")
  - Token sort:     Good for word-order variants ("Kumar Raju" vs "Raju Kumar")
  - Combined score: max(jaro_winkler, token_sort) — take the more generous score
  - Threshold:      0.88 (balanced — reduces false merges while catching clear variants)
"""
from __future__ import annotations

import re
import math
import sqlite3
import logging
from difflib import SequenceMatcher
from typing import Optional
from config import config

log = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.88   # Merge if similarity >= this


# ─── Pure-Python String Similarity ──────────────────────────────────────────

def _jaro(s1: str, s2: str) -> float:
    """Jaro similarity — O(n²) but fine for short names."""
    if s1 == s2:
        return 1.0
    len_s1, len_s2 = len(s1), len(s2)
    if not len_s1 or not len_s2:
        return 0.0
    match_dist = max(len_s1, len_s2) // 2 - 1
    match_dist = max(0, match_dist)
    s1_matches = [False] * len_s1
    s2_matches = [False] * len_s2
    matches = transpositions = 0
    for i in range(len_s1):
        start = max(0, i - match_dist)
        end = min(i + match_dist + 1, len_s2)
        for j in range(start, end):
            if s2_matches[j] or s1[i] != s2[j]:
                continue
            s1_matches[i] = s2_matches[j] = True
            matches += 1
            break
    if not matches:
        return 0.0
    k = 0
    for i in range(len_s1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1
    return (matches / len_s1 + matches / len_s2 + (matches - transpositions / 2) / matches) / 3


def _jaro_winkler(s1: str, s2: str, p: float = 0.1) -> float:
    """Jaro-Winkler similarity — boosts score for common prefix."""
    jaro = _jaro(s1, s2)
    prefix = 0
    for c1, c2 in zip(s1[:4], s2[:4]):
        if c1 == c2:
            prefix += 1
        else:
            break
    return jaro + prefix * p * (1 - jaro)


def _token_sort_ratio(s1: str, s2: str) -> float:
    """Sort tokens, then compare — handles word-order variants."""
    t1 = " ".join(sorted(s1.split()))
    t2 = " ".join(sorted(s2.split()))
    return SequenceMatcher(None, t1, t2).ratio()


def _normalize_name(name: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name


def compute_similarity(a: str, b: str) -> float:
    """
    Combined similarity score between two name strings.
    Returns value in [0, 1]. Higher = more similar.
    """
    na, nb = _normalize_name(a), _normalize_name(b)
    if na == nb:
        return 1.0
    if not na or not nb:
        return 0.0
    jw = _jaro_winkler(na, nb)
    ts = _token_sort_ratio(na, nb)
    return max(jw, ts)


# ─── EntityResolver ──────────────────────────────────────────────────────────

class EntityResolver:

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or config.DB_PATH
        self._cache: dict[str, Optional[str]] = {}  # name_norm → canonical_id

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    # ── Primary API ──────────────────────────────────────────────────────────

    def resolve(self, raw_name: str, entity_type: str = "PERSON") -> Optional[str]:
        """
        Resolve a raw name to a canonical entity ID.
        Returns canonical_id string (e.g. "person:1234") or None.

        Resolution strategy:
          1. Exact match in entity_aliases table (cached)
          2. Fuzzy match against existing alias index
          3. Fallback: exact SQL match on Accused.AccusedName
        """
        if not raw_name or not raw_name.strip():
            return None

        cache_key = f"{entity_type}:{_normalize_name(raw_name)}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Step 1: Exact alias lookup
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT canonical_id FROM entity_aliases WHERE alias_normalized = ? AND entity_type = ?",
                (_normalize_name(raw_name), entity_type)
            ).fetchone()
            if row:
                self._cache[cache_key] = row["canonical_id"]
                return row["canonical_id"]
        except Exception:
            pass
        finally:
            conn.close()

        # Step 2: Fuzzy scan (only against existing alias index, not full DB — fast)
        result = self._fuzzy_alias_lookup(raw_name, entity_type)
        if result:
            self._register_alias(raw_name, result, entity_type, compute_similarity(raw_name, result[1]))
            self._cache[cache_key] = result[0]
            return result[0]

        # Step 3: Direct DB lookup (exact match or single initial abbreviation)
        canonical_id = self._db_exact_lookup(raw_name, entity_type)
        if canonical_id:
            self._register_alias(raw_name, canonical_id, entity_type, 1.0)
            self._cache[cache_key] = canonical_id
            return canonical_id

        self._cache[cache_key] = None
        return None

    def _fuzzy_alias_lookup(
        self, raw_name: str, entity_type: str
    ) -> Optional[tuple[str, str]]:
        """
        Compare raw_name against all existing aliases in the DB.
        Returns (canonical_id, matched_alias) if similarity >= threshold.
        Scans the entity_aliases table — limited to 2000 rows max.
        """
        conn = self._conn()
        try:
            aliases = conn.execute(
                "SELECT alias_normalized, canonical_id FROM entity_aliases WHERE entity_type = ? LIMIT 2000",
                (entity_type,)
            ).fetchall()
        except Exception:
            return None
        finally:
            conn.close()

        best_score = 0.0
        best_match = None
        norm = _normalize_name(raw_name)

        for alias in aliases:
            score = compute_similarity(norm, alias["alias_normalized"])
            if score > best_score and score >= SIMILARITY_THRESHOLD:
                best_score = score
                best_match = (alias["canonical_id"], alias["alias_normalized"])

        return best_match

    def _db_exact_lookup(self, raw_name: str, entity_type: str) -> Optional[str]:
        """Direct DB lookup by exact name."""
        conn = self._conn()
        try:
            if entity_type == "PERSON":
                row = conn.execute(
                    "SELECT AccusedMasterID FROM Accused WHERE AccusedName = ? LIMIT 1",
                    (raw_name.strip(),)
                ).fetchone()
                if row:
                    return f"person:{row['AccusedMasterID']}"
        except Exception as e:
            log.warning(f"[EntityResolver] _db_exact_lookup error: {e}")
        finally:
            conn.close()
        return None

    def _register_alias(
        self, raw_name: str, canonical_id, entity_type: str, similarity: float
    ):
        """Insert or ignore an alias record into entity_aliases."""
        if isinstance(canonical_id, tuple):
            canonical_id = canonical_id[0]
        conn = self._conn()
        try:
            conn.execute("""
                INSERT OR IGNORE INTO entity_aliases
                (alias_raw, alias_normalized, canonical_id, entity_type, similarity_score, merged_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            """, (raw_name.strip(), _normalize_name(raw_name), str(canonical_id), entity_type, round(similarity, 4)))
            conn.commit()
        except Exception as e:
            log.warning(f"[EntityResolver] _register_alias error: {e}")
        finally:
            conn.close()

    # ── Background Sweep ─────────────────────────────────────────────────────

    def build_alias_index(self, limit: int = 5000):
        """
        Sweep the Accused table and build the entity_aliases index.
        Groups name variants by Jaro-Winkler similarity.
        Call this once on startup (lazy) or as a background job.
        """
        log.info("[EntityResolver] Building alias index from Accused table...")
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT AccusedMasterID, AccusedName FROM Accused WHERE AccusedName IS NOT NULL LIMIT ?",
                (limit,)
            ).fetchall()
        except Exception as e:
            log.error(f"[EntityResolver] build_alias_index fetch error: {e}")
            conn.close()
            return
        finally:
            conn.close()

        # Build name→canonical_id mapping
        canonical_map: dict[str, str] = {}   # norm_name → canonical_id
        alias_records = []

        for row in rows:
            raw = row["AccusedName"]
            canon_id = f"person:{row['AccusedMasterID']}"
            norm = _normalize_name(raw)

            # Check if this name is already a variant of something we've seen
            matched = None
            for existing_norm, existing_id in canonical_map.items():
                score = compute_similarity(norm, existing_norm)
                if score >= SIMILARITY_THRESHOLD:
                    matched = existing_id
                    break

            if matched:
                # Register as alias of existing canonical
                alias_records.append((raw, norm, matched, "PERSON", round(
                    compute_similarity(norm, matched.replace("person:", "")), 4
                )))
            else:
                # This becomes a canonical entity
                canonical_map[norm] = canon_id
                alias_records.append((raw, norm, canon_id, "PERSON", 1.0))

        # Bulk insert
        conn = self._conn()
        try:
            conn.executemany("""
                INSERT OR IGNORE INTO entity_aliases
                (alias_raw, alias_normalized, canonical_id, entity_type, similarity_score, merged_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            """, alias_records)
            conn.commit()
            log.info(f"[EntityResolver] Alias index built: {len(alias_records)} records, "
                     f"{len(canonical_map)} canonical entities.")
        except Exception as e:
            log.error(f"[EntityResolver] bulk insert error: {e}")
        finally:
            conn.close()

    def get_all_aliases(self, canonical_id: str) -> list[str]:
        """Return all known name variants for a canonical entity."""
        conn = self._conn()
        try:
            rows = conn.execute(
                "SELECT alias_raw FROM entity_aliases WHERE canonical_id = ?",
                (canonical_id,)
            ).fetchall()
            return [r["alias_raw"] for r in rows]
        except Exception:
            return []
        finally:
            conn.close()

    def get_disambiguation_report(self, name: str) -> dict:
        """
        Return a full disambiguation report for a given name —
        shows canonical entity, all known aliases, and similarity scores.
        Useful for the analyst UI to audit merges.
        """
        norm = _normalize_name(name)
        conn = self._conn()
        try:
            rows = conn.execute("""
                SELECT alias_raw, canonical_id, similarity_score
                FROM entity_aliases
                WHERE alias_normalized LIKE ?
                ORDER BY similarity_score DESC
                LIMIT 20
            """, (f"%{norm}%",)).fetchall()
            return {
                "query": name,
                "normalized": norm,
                "matches": [
                    {"alias": r["alias_raw"], "canonical_id": r["canonical_id"], "score": r["similarity_score"]}
                    for r in rows
                ]
            }
        except Exception as e:
            return {"query": name, "error": str(e), "matches": []}
        finally:
            conn.close()


# ─── Singleton ────────────────────────────────────────────────────────────────
_resolver: Optional[EntityResolver] = None

def get_resolver() -> EntityResolver:
    global _resolver
    if _resolver is None:
        _resolver = EntityResolver()
    return _resolver
