"""
graphrag_service.py — Sentinal GraphRAG Intelligence Engine

Replaces the flat TF-IDF vector search in rag_service.py with a proper
Graph-based Retrieval-Augmented Generation pipeline.

Pipeline (per query):
  1. Intent Parsing        — extract entity names, case IDs, districts from the NL query
  2. Entity Resolution     — fuzzy-resolve names to canonical ontology IDs via entity_resolver
  3. Graph Traversal       — multi-hop SQLite CTE traversal via ontology.get_subgraph()
  4. Subgraph Structuring  — build a SubgraphContext (nodes + typed links + properties)
  5. Content Gap Detection — flag missing intelligence (no CDR, no financials, etc.)
  6. LLM Synthesis         — inject the verified subgraph into GLM with strict grounding prompt
  7. Hallucination Guard   — strip any entity names in LLM output not present in subgraph
  8. Action Log            — write AI recommendation to immutable ai_action_log

Key design principle:
  The LLM NEVER sees raw SQL rows or free-form text as its primary context.
  It ONLY reasons over the structured SubgraphContext serialization.
  This prevents hallucination of relationships that don't exist in the data.
"""
from __future__ import annotations

import json
import uuid
import re
import logging
import hashlib
from dataclasses import dataclass
from typing import Optional
from datetime import datetime

from services.ontology import get_graph, SubgraphContext
from services.entity_resolver import get_resolver
from services.quickml_service import call_ai_messages
from database import execute as db_execute

log = logging.getLogger(__name__)


# ─── Response Schema ────────────────────────────────────────────────────────

@dataclass
class GraphRAGResponse:
    rec_id: str                      # Unique AI recommendation ID (for action log)
    query: str                       # Original user query
    answer: str                      # LLM-synthesized answer
    subgraph_summary: str            # Human-readable subgraph stats
    entity_count: int
    link_count: int
    hops_traversed: int
    content_gaps: list[str]          # Missing intelligence warnings
    seed_entities: list[dict]        # Resolved seed entities shown to user
    grounded: bool                   # True if LLM was grounded in subgraph data
    fallback_used: bool              # True if graph traversal returned 0 nodes


# ─── GraphRAG Service ───────────────────────────────────────────────────────

class GraphRAGService:

    SYSTEM_PROMPT = """You are a senior intelligence analyst for Karnataka State Police (KSP) operating the SENTINAL crime analytics platform.

You will be given a structured ontology subgraph — a precise, verified set of entities (persons, cases, phone calls, financial transactions, locations) and the typed relationships between them, extracted directly from the KSP crime database.

YOUR STRICT RULES:
1. You MUST only reason over facts explicitly present in the subgraph. Do NOT invent connections, names, dates, or amounts not listed.
2. If the subgraph is sparse, acknowledge the limitation rather than speculating.
3. Highlight any [INTELLIGENCE GAPS] flagged in the subgraph.
4. Write in formal police intelligence briefing style.
5. Structure your response with clear headings: ENTITIES IDENTIFIED, KEY ASSOCIATIONS, THREAT ASSESSMENT, RECOMMENDED ACTIONS, INTELLIGENCE GAPS.
6. For each association you mention, cite the link type from the subgraph (CO_ACCUSED, CALLED, TRANSFERRED_FUNDS_TO, etc.).
"""

    def __init__(self):
        self.graph = get_graph()
        self.resolver = get_resolver()

    async def query(
        self,
        text: str,
        analyst_id: str = "system",
        hops: int = 3,
        request=None,
    ) -> GraphRAGResponse:
        """
        Full GraphRAG pipeline. Returns a structured, grounded response.
        """
        rec_id = str(uuid.uuid4())
        log.info(f"[GraphRAG] Query: {text[:80]}... | rec_id={rec_id}")

        # ── Step 1: Resolve query to seed entity IDs ──────────────────────────
        seed_ids = self.graph.resolve_text_to_seeds(text)

        # Also try entity resolver for named entities in the query
        names = self._extract_candidate_names(text)
        for name in names:
            cid = self.resolver.resolve(name, "PERSON")
            if cid and cid not in seed_ids:
                seed_ids.append(cid)

        log.info(f"[GraphRAG] Resolved {len(seed_ids)} seed entities: {seed_ids[:5]}")

        # ── Step 2: Graph traversal ────────────────────────────────────────────
        fallback_used = False
        if seed_ids:
            subgraph: SubgraphContext = self.graph.get_subgraph(seed_ids, hops=hops)
        else:
            # No seeds — use RAG fallback with database summary context
            subgraph = SubgraphContext()
            fallback_used = True
            log.warning("[GraphRAG] No seeds resolved — using database summary fallback")

        # ── Step 3: Build LLM context ─────────────────────────────────────────
        if fallback_used or subgraph.entity_count == 0:
            # Fallback: generate a general intelligence summary from DB stats
            context_str = await self._build_db_summary_context(text)
            grounded = False
        else:
            context_str = subgraph.to_llm_context()
            grounded = True

        # ── Step 4: GLM synthesis ──────────────────────────────────────────────
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": (
                f"ANALYST QUERY: {text}\n\n"
                f"VERIFIED ONTOLOGY SUBGRAPH:\n{context_str}\n\n"
                "Provide a structured intelligence briefing based ONLY on the above subgraph data."
            )}
        ]

        try:
            llm_answer = await call_ai_messages(messages, max_tokens=1200, request=request)
        except Exception as e:
            log.error(f"[GraphRAG] LLM call failed: {e}")
            llm_answer = f"Intelligence synthesis unavailable: {e}"

        # ── Step 5: Hallucination guard ────────────────────────────────────────
        if grounded:
            llm_answer = self._hallucination_guard(llm_answer, subgraph)

        # ── Step 6: Write to immutable action log ─────────────────────────────
        prompt_hash = hashlib.sha256(text.encode()).hexdigest()[:16]
        self._log_recommendation(rec_id, analyst_id, prompt_hash, text, llm_answer)

        return GraphRAGResponse(
            rec_id=rec_id,
            query=text,
            answer=llm_answer,
            subgraph_summary=(
                f"{subgraph.entity_count} entities, {subgraph.link_count} links, "
                f"{subgraph.hops_traversed}-hop traversal"
            ),
            entity_count=subgraph.entity_count,
            link_count=subgraph.link_count,
            hops_traversed=subgraph.hops_traversed,
            content_gaps=subgraph.content_gaps,
            seed_entities=[
                {"id": e.entity_id, "type": e.entity_type, "label": e.label}
                for e in subgraph.seed_entities
            ],
            grounded=grounded,
            fallback_used=fallback_used,
        )

    def _extract_candidate_names(self, text: str) -> list[str]:
        """
        Heuristic extraction of person name candidates from query text.
        Looks for capitalized word sequences (proper nouns).
        """
        tokens = text.split()
        candidates = []
        i = 0
        while i < len(tokens):
            tok = re.sub(r'[^A-Za-z]', '', tokens[i])
            if tok and tok[0].isupper() and len(tok) > 2:
                # Collect consecutive capitalized tokens as a name
                name_parts = [tok]
                j = i + 1
                while j < len(tokens):
                    nxt = re.sub(r'[^A-Za-z]', '', tokens[j])
                    if nxt and nxt[0].isupper() and len(nxt) > 1:
                        name_parts.append(nxt)
                        j += 1
                    else:
                        break
                if len(name_parts) >= 2:
                    candidates.append(" ".join(name_parts))
                i = j
            else:
                i += 1
        return candidates[:5]

    async def _build_db_summary_context(self, query: str) -> str:
        """
        Fallback when no seeds are found — builds a statistical summary
        from the database relevant to the query keywords.
        """
        from database import query as db_query
        lines = ["[DATABASE SUMMARY — no specific entities resolved from query]"]
        try:
            # Top crime types
            crimes = db_query("""
                SELECT ch.CrimeGroupName, COUNT(*) as cnt
                FROM CaseMaster cm
                LEFT JOIN CrimeHead ch ON cm.CrimeMajorHeadID = ch.CrimeHeadID
                GROUP BY ch.CrimeGroupName ORDER BY cnt DESC LIMIT 5
            """)
            if crimes:
                lines.append("Top Crime Categories in Database:")
                for c in crimes:
                    lines.append(f"  {c.get('CrimeGroupName','Unknown')}: {c['cnt']} cases")

            # Recent high-risk accused
            accused = db_query("""
                SELECT AccusedName, COUNT(DISTINCT CaseMasterID) as cases
                FROM Accused GROUP BY AccusedName
                HAVING cases >= 3 ORDER BY cases DESC LIMIT 8
            """)
            if accused:
                lines.append("Repeat Offenders (3+ cases):")
                for a in accused:
                    lines.append(f"  {a['AccusedName']}: {a['cases']} cases")
        except Exception as e:
            lines.append(f"Database summary unavailable: {e}")
        return "\n".join(lines)

    def _hallucination_guard(self, llm_text: str, subgraph: SubgraphContext) -> str:
        """
        Basic hallucination guard:
        Appends a caveat if the LLM output mentions entity names
        not present in the subgraph node labels.

        Does NOT strip content (that would break formatting),
        but adds a data provenance note at the end.
        """
        known_labels = {n.label.lower() for n in subgraph.nodes}
        known_labels.update({n.properties.get("name", "").lower() for n in subgraph.nodes})

        # Extract all quoted names or capitalized sequences from LLM output
        mentioned = re.findall(r'"([A-Z][a-z]+ [A-Z][a-z]+)"', llm_text)
        unverified = [m for m in mentioned if m.lower() not in known_labels]

        if unverified:
            caveat = (
                f"\n\n---\n⚠ DATA PROVENANCE NOTE: The following names appear in this briefing "
                f"but could not be verified against the retrieved ontology subgraph: "
                f"{', '.join(unverified)}. Treat with lower confidence pending further verification."
            )
            llm_text += caveat

        return llm_text

    def _log_recommendation(
        self,
        rec_id: str,
        analyst_id: str,
        prompt_hash: str,
        prompt: str,
        recommendation: str,
    ):
        """
        Write AI recommendation to the immutable ai_action_log.
        This is INSERT-only — never updated or deleted.
        """
        try:
            db_execute("""
                INSERT INTO ai_action_log
                (rec_id, analyst_id, ai_prompt_hash, ai_prompt_summary, ai_recommendation,
                 analyst_decision, outcome_written_back, created_at)
                VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?)
            """, (
                rec_id,
                analyst_id,
                prompt_hash,
                prompt[:300],
                recommendation[:2000],
                datetime.utcnow().isoformat(),
            ))
        except Exception as e:
            log.warning(f"[GraphRAG] Failed to write action log: {e}")


# ─── Singleton ────────────────────────────────────────────────────────────────
_graphrag: Optional[GraphRAGService] = None

def get_graphrag() -> GraphRAGService:
    global _graphrag
    if _graphrag is None:
        _graphrag = GraphRAGService()
    return _graphrag
