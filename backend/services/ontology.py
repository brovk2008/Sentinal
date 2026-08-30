"""
ontology.py — Sentinal ELP Ontology Graph Engine

Implements an Entity-Link-Property (ELP) model backed by the existing SQLite database.
No external graph database required. All traversal is done via recursive CTEs.

Entity Types:  PERSON, CASE, VEHICLE, PHONE, BANK_ACCOUNT, LOCATION, ORGANIZATION
Link Types:    CO_ACCUSED, CALLED, OWNS, TRANSFERRED_FUNDS_TO, APPEARED_AT,
               VICTIM_OF, FILED_BY, CHARGED_UNDER, LINKED_TO_CASE
"""
from __future__ import annotations

import json
import sqlite3
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional
from config import config

log = logging.getLogger(__name__)

# ─── Entity & Link Type Registries ──────────────────────────────────────────

ENTITY_TYPES = {
    "PERSON", "CASE", "VEHICLE", "PHONE",
    "BANK_ACCOUNT", "LOCATION", "ORGANIZATION",
}

LINK_TYPES = {
    "CO_ACCUSED",           # Person  Person (co-accused in same case)
    "CALLED",               # Person → Phone (CDR call)
    "OWNS",                 # Person → Vehicle | Phone | BankAccount
    "TRANSFERRED_FUNDS_TO", # BankAccount → BankAccount
    "APPEARED_AT",          # Person → Location
    "VICTIM_OF",            # Person → Case
    "FILED_BY",             # Case → Person (complainant)
    "CHARGED_UNDER",        # Case → IPC Section (as location-type node)
    "LINKED_TO_CASE",       # Any entity → Case
}


# ─── Data Classes ────────────────────────────────────────────────────────────

@dataclass
class OntologyEntity:
    entity_id: str          # e.g. "person:1234", "case:5678"
    entity_type: str        # PERSON | CASE | etc.
    label: str              # Display name
    properties: dict = field(default_factory=dict)
    canonical_id: Optional[str] = None   # For resolved duplicates


@dataclass
class OntologyLink:
    src_id: str
    dst_id: str
    link_type: str
    weight: float = 1.0
    properties: dict = field(default_factory=dict)


@dataclass
class SubgraphContext:
    """
    Structured result of a multi-hop ontology traversal.
    This is what gets injected into the GraphRAG LLM prompt —
    NOT raw SQL rows or free-form text.
    """
    seed_entities: list[OntologyEntity] = field(default_factory=list)
    nodes: list[OntologyEntity] = field(default_factory=list)
    links: list[OntologyLink] = field(default_factory=list)
    hops_traversed: int = 0
    content_gaps: list[str] = field(default_factory=list)   # missing expected link types
    entity_count: int = 0
    link_count: int = 0

    def to_llm_context(self) -> str:
        """
        Serialize the subgraph into a structured, concise string
        safe for LLM injection. Groups facts by entity.
        """
        lines = []
        lines.append(f"[ONTOLOGY SUBGRAPH — {self.hops_traversed}-hop traversal]")
        lines.append(f"Entities: {self.entity_count} | Links: {self.link_count}")
        lines.append("")

        # Index nodes by id for quick lookup
        node_map = {n.entity_id: n for n in self.nodes}

        # Group links by source entity
        by_src: dict[str, list[OntologyLink]] = {}
        for lnk in self.links:
            by_src.setdefault(lnk.src_id, []).append(lnk)

        for ent in self.nodes:
            props_str = ", ".join(
                f"{k}={v}" for k, v in ent.properties.items()
                if v is not None and str(v).strip()
            )
            lines.append(f"[{ent.entity_type}] {ent.label} (id={ent.entity_id})"
                         + (f" | {props_str}" if props_str else ""))
            for lnk in by_src.get(ent.entity_id, []):
                dst = node_map.get(lnk.dst_id)
                dst_label = dst.label if dst else lnk.dst_id
                prop_str = ""
                if lnk.properties:
                    prop_str = " | " + ", ".join(f"{k}={v}" for k, v in lnk.properties.items() if v)
                lines.append(f"  ──[{lnk.link_type}]──▶ {dst_label}{prop_str}")

        if self.content_gaps:
            lines.append("")
            lines.append("[INTELLIGENCE GAPS — no data found for:]")
            for gap in self.content_gaps:
                lines.append(f"   {gap}")

        return "\n".join(lines)


# ─── OntologyGraph ───────────────────────────────────────────────────────────

class OntologyGraph:
    """
    ELP graph engine backed by SQLite.
    Uses:
      - Existing core tables: CaseMaster, Accused, Victim, ArrestSurrender,
        cdr_records, financial_transactions, Unit, District, CrimeHead
      - New tables added by init_db: ontology_links, entity_aliases
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or config.DB_PATH

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    # ── Entity Resolution ────────────────────────────────────────────────────

    def resolve_entity_id(self, raw_label: str, entity_type: str) -> Optional[str]:
        """
        Look up canonical entity id from raw label via entity_aliases table.
        Returns None if not found.
        """
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT canonical_id FROM entity_aliases WHERE alias_normalized = ? AND entity_type = ?",
                (raw_label.strip().lower(), entity_type)
            ).fetchone()
            return row["canonical_id"] if row else None
        except Exception as e:
            log.warning(f"[Ontology] resolve_entity_id error: {e}")
            return None
        finally:
            conn.close()

    # ── Core Graph Traversal ─────────────────────────────────────────────────

    def get_subgraph(
        self,
        seed_ids: list[str],   # e.g. ["person:1234", "case:5678"]
        hops: int = 3,
        max_nodes: int = 60,
    ) -> SubgraphContext:
        """
        Multi-hop graph traversal from seed entities.
        Uses SQLite recursive CTEs + joins against core tables.
        Returns a fully populated SubgraphContext.
        """
        ctx = SubgraphContext(hops_traversed=hops)
        all_nodes: dict[str, OntologyEntity] = {}
        all_links: list[OntologyLink] = []
        visited: set[str] = set()

        # Seed the traversal
        frontier = list(seed_ids)
        for hop in range(hops):
            next_frontier = []
            for eid in frontier:
                if eid in visited or len(all_nodes) >= max_nodes:
                    continue
                visited.add(eid)
                etype, _, raw_id = eid.partition(":")
                if not raw_id:
                    continue
                try:
                    raw_id_val = int(raw_id)
                except ValueError:
                    raw_id_val = raw_id

                # Expand this entity based on its type
                new_nodes, new_links = self._expand_entity(etype.upper(), raw_id_val, eid)
                for n in new_nodes:
                    if n.entity_id not in all_nodes:
                        all_nodes[n.entity_id] = n
                        if n.entity_id != eid:
                            next_frontier.append(n.entity_id)
                all_links.extend(new_links)

            frontier = [fid for fid in next_frontier if fid not in visited]
            if not frontier:
                ctx.hops_traversed = hop + 1
                break

        # Populate seed_entities
        ctx.seed_entities = [all_nodes[eid] for eid in seed_ids if eid in all_nodes]
        ctx.nodes = list(all_nodes.values())
        ctx.links = self._dedupe_links(all_links)
        ctx.entity_count = len(ctx.nodes)
        ctx.link_count = len(ctx.links)

        # Content gap detection
        ctx.content_gaps = self._detect_content_gaps(ctx)
        return ctx

    def _expand_entity(
        self,
        etype: str,
        raw_id,
        eid: str,
    ) -> tuple[list[OntologyEntity], list[OntologyLink]]:
        """Dispatch to type-specific expansion methods."""
        try:
            if etype == "PERSON":
                return self._expand_person(raw_id, eid)
            elif etype == "CASE":
                return self._expand_case(raw_id, eid)
            elif etype == "PHONE":
                return self._expand_phone(raw_id, eid)
            elif etype == "BANK_ACCOUNT":
                return self._expand_bank(raw_id, eid)
            else:
                return [], []
        except Exception as e:
            log.warning(f"[Ontology] _expand_entity({etype}, {raw_id}) failed: {e}")
            return [], []

    def _expand_person(self, accused_id, eid: str):
        nodes, links = [], []
        conn = self._conn()
        try:
            # The person node itself
            acc = conn.execute(
                "SELECT * FROM Accused WHERE AccusedMasterID = ? LIMIT 1", (accused_id,)
            ).fetchone()
            if acc:
                nodes.append(OntologyEntity(
                    entity_id=eid,
                    entity_type="PERSON",
                    label=acc["AccusedName"] or f"Accused #{accused_id}",
                    properties={
                        "age": acc["AgeYear"],
                        "address": acc["PermanentAddress"] if "PermanentAddress" in acc.keys() else None,
                    }
                ))

            # Cases this person is accused in
            cases = conn.execute("""
                SELECT DISTINCT a.CaseMasterID, cm.CrimeNo, ch.CrimeGroupName,
                       cm.CrimeRegisteredDate, d.DistrictName
                FROM Accused a
                JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
                LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
                LEFT JOIN Unit u ON cm.PoliceStationID = u.UnitID
                LEFT JOIN District d ON u.DistrictID = d.DistrictID
                WHERE a.AccusedMasterID = ?
                LIMIT 15
            """, (accused_id,)).fetchall()
            for c in cases:
                cid = f"case:{c['CaseMasterID']}"
                nodes.append(OntologyEntity(
                    entity_id=cid, entity_type="CASE",
                    label=f"Case {c['CrimeNo'] or c['CaseMasterID']}",
                    properties={"crime_type": c["CrimeGroupName"], "date": c["CrimeRegisteredDate"], "district": c["DistrictName"]}
                ))
                links.append(OntologyLink(src_id=eid, dst_id=cid, link_type="LINKED_TO_CASE",
                                          properties={"role": "ACCUSED"}))

            # Co-accused in same cases
            co = conn.execute("""
                SELECT DISTINCT a2.AccusedMasterID, a2.AccusedName, a1.CaseMasterID
                FROM Accused a1
                JOIN Accused a2 ON a1.CaseMasterID = a2.CaseMasterID
                WHERE a1.AccusedMasterID = ? AND a2.AccusedMasterID != ?
                LIMIT 20
            """, (accused_id, accused_id)).fetchall()
            for ca in co:
                co_eid = f"person:{ca['AccusedMasterID']}"
                nodes.append(OntologyEntity(
                    entity_id=co_eid, entity_type="PERSON",
                    label=ca["AccusedName"] or f"Accused #{ca['AccusedMasterID']}",
                ))
                links.append(OntologyLink(
                    src_id=eid, dst_id=co_eid, link_type="CO_ACCUSED",
                    properties={"via_case": ca["CaseMasterID"]}
                ))

            # CDR calls
            cdrs = conn.execute("""
                SELECT caller_name, called, phone, call_date, duration_sec
                FROM cdr_records
                WHERE linked_accused_id = ?
                LIMIT 10
            """, (accused_id,)).fetchall()
            for i, cdr in enumerate(cdrs):
                phone_eid = f"phone:{accused_id}_{i}"
                nodes.append(OntologyEntity(
                    entity_id=phone_eid, entity_type="PHONE",
                    label=cdr["called"] or cdr["phone"] or "Unknown Number",
                    properties={"call_date": cdr["call_date"], "duration_sec": cdr["duration_sec"]}
                ))
                links.append(OntologyLink(src_id=eid, dst_id=phone_eid, link_type="CALLED",
                                          properties={"date": cdr["call_date"]}))

            # Financial transactions
            txns = conn.execute("""
                SELECT sender_name, receiver_name, amount, txn_type, txn_date, is_suspicious
                FROM financial_transactions
                WHERE linked_accused_id = ?
                LIMIT 8
            """, (accused_id,)).fetchall()
            for i, txn in enumerate(txns):
                bank_eid = f"bank_account:{accused_id}_{i}"
                nodes.append(OntologyEntity(
                    entity_id=bank_eid, entity_type="BANK_ACCOUNT",
                    label=f"TXN: {txn['txn_type']} ₹{txn['amount']}",
                    properties={"date": txn["txn_date"], "suspicious": bool(txn["is_suspicious"]),
                                "receiver": txn["receiver_name"]}
                ))
                links.append(OntologyLink(src_id=eid, dst_id=bank_eid, link_type="TRANSFERRED_FUNDS_TO",
                                          properties={"amount": txn["amount"], "suspicious": bool(txn["is_suspicious"])}))

        except Exception as e:
            log.warning(f"[Ontology] _expand_person({accused_id}) error: {e}")
        finally:
            conn.close()
        return nodes, links

    def _expand_case(self, case_id, eid: str):
        nodes, links = [], []
        conn = self._conn()
        try:
            case = conn.execute("""
                SELECT cm.*, ch.CrimeGroupName, d.DistrictName, u.UnitName,
                       cm.latitude, cm.longitude
                FROM CaseMaster cm
                LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
                LEFT JOIN Unit u ON cm.PoliceStationID = u.UnitID
                LEFT JOIN District d ON u.DistrictID = d.DistrictID
                WHERE cm.CaseMasterID = ?
            """, (case_id,)).fetchone()
            if not case:
                return nodes, links

            nodes.append(OntologyEntity(
                entity_id=eid, entity_type="CASE",
                label=f"Case {case['CrimeNo'] or case_id}",
                properties={
                    "crime_type": case["CrimeGroupName"], "district": case["DistrictName"],
                    "station": case["UnitName"], "date": case["CrimeRegisteredDate"],
                    "brief": (case["BriefFacts"] or "")[:200],
                    "lat": case["latitude"], "lng": case["longitude"],
                }
            ))

            # Accused in this case
            accused = conn.execute("""
                SELECT AccusedMasterID, AccusedName FROM Accused WHERE CaseMasterID = ? LIMIT 12
            """, (case_id,)).fetchall()
            for a in accused:
                a_eid = f"person:{a['AccusedMasterID']}"
                nodes.append(OntologyEntity(entity_id=a_eid, entity_type="PERSON",
                                            label=a["AccusedName"] or f"Accused #{a['AccusedMasterID']}"))
                links.append(OntologyLink(src_id=a_eid, dst_id=eid, link_type="LINKED_TO_CASE",
                                          properties={"role": "ACCUSED"}))

            # Victims
            victims = conn.execute("""
                SELECT VictimMasterID, VictimName FROM Victim WHERE CaseMasterID = ? LIMIT 5
            """, (case_id,)).fetchall()
            for v in victims:
                v_eid = f"person:victim_{v['VictimMasterID']}"
                nodes.append(OntologyEntity(entity_id=v_eid, entity_type="PERSON",
                                            label=v["VictimName"] or "Unknown Victim",
                                            properties={"role": "VICTIM"}))
                links.append(OntologyLink(src_id=v_eid, dst_id=eid, link_type="VICTIM_OF"))

            # Location node
            if case["latitude"] and case["longitude"]:
                loc_eid = f"location:case_{case_id}"
                nodes.append(OntologyEntity(
                    entity_id=loc_eid, entity_type="LOCATION",
                    label=f"{case['UnitName']}, {case['DistrictName']}",
                    properties={"lat": case["latitude"], "lng": case["longitude"]}
                ))
                links.append(OntologyLink(src_id=eid, dst_id=loc_eid, link_type="APPEARED_AT"))

        except Exception as e:
            log.warning(f"[Ontology] _expand_case({case_id}) error: {e}")
        finally:
            conn.close()
        return nodes, links

    def _expand_phone(self, phone_id, eid: str):
        """Expand a phone node — find all CDR calls from/to this number."""
        nodes, links = [], []
        conn = self._conn()
        try:
            # phone_id may be "accused_123_0" format — parse accusedID
            parts = str(phone_id).split("_")
            if len(parts) >= 2:
                accused_id = parts[0]
                cdrs = conn.execute("""
                    SELECT DISTINCT called, phone, call_date, linked_accused_id
                    FROM cdr_records WHERE linked_accused_id = ? LIMIT 10
                """, (accused_id,)).fetchall()
                for i, c in enumerate(cdrs):
                    if c["linked_accused_id"]:
                        a_eid = f"person:{c['linked_accused_id']}"
                        nodes.append(OntologyEntity(entity_id=a_eid, entity_type="PERSON",
                                                    label=f"Accused #{c['linked_accused_id']}"))
                        links.append(OntologyLink(src_id=eid, dst_id=a_eid, link_type="CALLED",
                                                  properties={"date": c["call_date"]}))
        except Exception as e:
            log.warning(f"[Ontology] _expand_phone error: {e}")
        finally:
            conn.close()
        return nodes, links

    def _expand_bank(self, bank_id, eid: str):
        """Expand a bank account node — find transaction chains."""
        nodes, links = [], []
        conn = self._conn()
        try:
            parts = str(bank_id).split("_")
            if len(parts) >= 2:
                accused_id = parts[0]
                txns = conn.execute("""
                    SELECT receiver_name, sender_name, amount, txn_date, is_suspicious, linked_case_id
                    FROM financial_transactions WHERE linked_accused_id = ? AND is_suspicious = 1 LIMIT 5
                """, (accused_id,)).fetchall()
                for i, t in enumerate(txns):
                    if t["linked_case_id"]:
                        c_eid = f"case:{t['linked_case_id']}"
                        nodes.append(OntologyEntity(entity_id=c_eid, entity_type="CASE",
                                                    label=f"Case #{t['linked_case_id']}"))
                        links.append(OntologyLink(src_id=eid, dst_id=c_eid, link_type="LINKED_TO_CASE",
                                                  properties={"amount": t["amount"], "suspicious": True}))
        except Exception as e:
            log.warning(f"[Ontology] _expand_bank error: {e}")
        finally:
            conn.close()
        return nodes, links

    def _dedupe_links(self, links: list[OntologyLink]) -> list[OntologyLink]:
        """Remove exact duplicate links (same src, dst, type)."""
        seen: set[tuple] = set()
        deduped = []
        for lnk in links:
            key = (lnk.src_id, lnk.dst_id, lnk.link_type)
            if key not in seen:
                seen.add(key)
                deduped.append(lnk)
        return deduped

    def _detect_content_gaps(self, ctx: SubgraphContext) -> list[str]:
        """
        Identify expected link types that are absent from the subgraph.
        These become 'intelligence gap' warnings injected into the LLM prompt.
        """
        gaps = []
        person_ids = {n.entity_id for n in ctx.nodes if n.entity_type == "PERSON"}
        link_types_present = {lnk.link_type for lnk in ctx.links}

        if person_ids and "CALLED" not in link_types_present:
            gaps.append("No CDR / phone call data found for any person in this subgraph — CDR analysis recommended")
        if person_ids and "TRANSFERRED_FUNDS_TO" not in link_types_present:
            gaps.append("No financial transaction data found — financial intelligence gap")
        if len(person_ids) >= 2 and "CO_ACCUSED" not in link_types_present:
            gaps.append("Multiple persons present but no co-accused links found — possible alias obfuscation")

        return gaps

    # ── Seed Resolution Helpers ──────────────────────────────────────────────

    def resolve_text_to_seeds(self, text: str) -> list[str]:
        """
        Parse a natural language query for named entities and resolve them
        to ontology seed IDs using SQLite full-text search.
        Returns a list of entity IDs for graph traversal.
        """
        seeds = []
        conn = self._conn()
        try:
            # Resolve person names (accused)
            words = [w.strip() for w in text.split() if len(w) > 3]
            for word in words:
                rows = conn.execute(
                    "SELECT AccusedMasterID, AccusedName FROM Accused WHERE AccusedName LIKE ? LIMIT 3",
                    (f"%{word}%",)
                ).fetchall()
                for r in rows:
                    eid = f"person:{r['AccusedMasterID']}"
                    if eid not in seeds:
                        seeds.append(eid)

            # Resolve case numbers (FIR/Crime No)
            import re
            case_nums = re.findall(r'\b\d{1,6}/\d{4}\b|\bcase\s+#?\d+\b', text, re.IGNORECASE)
            for cn in case_nums:
                num = re.sub(r'[^\d]', '', cn)
                row = conn.execute(
                    "SELECT CaseMasterID FROM CaseMaster WHERE CrimeNo LIKE ? OR CaseMasterID = ? LIMIT 1",
                    (f"%{num}%", num)
                ).fetchone()
                if row:
                    eid = f"case:{row['CaseMasterID']}"
                    if eid not in seeds:
                        seeds.append(eid)

            # Resolve district names
            districts = conn.execute("SELECT DistrictID, DistrictName FROM District").fetchall()
            for d in districts:
                if d["DistrictName"] and d["DistrictName"].lower() in text.lower():
                    # Get top accused from this district as seeds
                    dist_accused = conn.execute("""
                        SELECT DISTINCT a.AccusedMasterID FROM Accused a
                        JOIN CaseMaster cm ON a.CaseMasterID = cm.CaseMasterID
                        JOIN Unit u ON cm.PoliceStationID = u.UnitID
                        WHERE u.DistrictID = ?
                        ORDER BY a.AccusedMasterID DESC LIMIT 5
                    """, (d["DistrictID"],)).fetchall()
                    for da in dist_accused:
                        eid = f"person:{da['AccusedMasterID']}"
                        if eid not in seeds:
                            seeds.append(eid)
                    break  # Only use first matched district

        except Exception as e:
            log.warning(f"[Ontology] resolve_text_to_seeds error: {e}")
        finally:
            conn.close()

        return seeds[:10]  # Cap at 10 seed entities

    def get_person_by_id(self, accused_id: int) -> Optional[OntologyEntity]:
        """Get a single person entity."""
        conn = self._conn()
        try:
            row = conn.execute(
                "SELECT * FROM Accused WHERE AccusedMasterID = ? LIMIT 1", (accused_id,)
            ).fetchone()
            if row:
                return OntologyEntity(
                    entity_id=f"person:{accused_id}",
                    entity_type="PERSON",
                    label=row["AccusedName"] or f"Accused #{accused_id}",
                    properties={"age": row["AgeYear"]}
                )
        finally:
            conn.close()
        return None


# ─── Singleton ───────────────────────────────────────────────────────────────
_graph: Optional[OntologyGraph] = None

def get_graph() -> OntologyGraph:
    global _graph
    if _graph is None:
        _graph = OntologyGraph()
    return _graph
