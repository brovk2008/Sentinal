"""
build_embeddings.py  — Sentinal v2
Fast, streaming RAG embedding pipeline.

Sources:
  1. investigation_narratives.json  (existing rich narratives)
  2. master_dataset.jsonl           (FIR OCR data, first HALF_LIMIT records)

Embedding:
  - Uses sentence-transformers all-MiniLM-L6-v2 locally (384-dim float32)
  - Batched, progress-reporting, resumable

Output:
  backend/data/embeddings.npy
  backend/data/chunk_metadata.json
"""

import json
import numpy as np
from pathlib import Path
import sys
import re
import time

BASE_DIR = Path(__file__).parent.parent

NARRATIVES_PATH   = BASE_DIR / "backend" / "data" / "investigation_narratives.json"
MASTER_FIR_PATH   = Path("C:/Users/techp/Downloads/more projects/FIR ocr/master_dataset.jsonl")
EMBEDDINGS_PATH   = BASE_DIR / "backend" / "data" / "embeddings.npy"
METADATA_PATH     = BASE_DIR / "backend" / "data" / "chunk_metadata.json"

HALF_LIMIT        = 93_755   # first half of 187,510
EMBED_BATCH_SIZE  = 512
MODEL_NAME        = "all-MiniLM-L6-v2"

# ─────────────────────────────────────────────────────────────────
# Text helpers
# ─────────────────────────────────────────────────────────────────
def _clean(s) -> str:
    if not s:
        return ""
    return str(s).replace("\n", " ").replace("\r", " ").strip()


def fir_to_chunk(rec: dict, idx: int) -> dict | None:
    """Convert a master_dataset.jsonl record into a single RAG chunk."""
    # Pull the most useful English fields
    crime_info   = rec.get("crime_info", {})
    location     = rec.get("location", {})
    complainant  = rec.get("complainant", {})
    accused_list = rec.get("accused", [])
    victims      = rec.get("victims", [])
    timeline     = rec.get("timeline", {})
    officer      = rec.get("officer", {})
    narrative    = rec.get("narrative", {})

    act          = _clean(crime_info.get("act"))
    section      = _clean(crime_info.get("section"))
    crime_no     = _clean(rec.get("fir_no") or rec.get("crime_no") or "")
    district     = _clean(location.get("district") or "")
    village      = _clean(location.get("village") or "")
    date         = _clean(timeline.get("info_received_date") or timeline.get("occurrence_date") or "")
    complainant_name = _clean(complainant.get("name") or "")
    sho          = _clean(officer.get("sho_name") or "")
    action       = _clean(officer.get("action_taken") or "")

    # Accused summary (top 3)
    accused_texts = []
    for a in (accused_list or [])[:3]:
        if isinstance(a, dict):
            name = _clean(a.get("name") or "")
            age  = a.get("age", "")
            if name:
                accused_texts.append(f"{name} (age {age})" if age else name)
    accused_str = ", ".join(accused_texts) if accused_texts else "Unknown"

    # Use English raw_text snippet if narrative is Kannada
    lang = (narrative.get("language") or "").lower()
    narr_text = ""
    if lang not in ("kannada", "telugu", "tamil", "malayalam"):
        narr_text = _clean(narrative.get("raw_text") or "")[:300]

    # Build searchable text
    parts = []
    if crime_no:  parts.append(f"FIR {crime_no}")
    if act:       parts.append(f"Act: {act}")
    if section:   parts.append(f"Section: {section}")
    if district:  parts.append(f"District: {district}")
    if village:   parts.append(f"Village: {village}")
    if date:      parts.append(f"Date: {date}")
    if complainant_name: parts.append(f"Complainant: {complainant_name}")
    if accused_str != "Unknown": parts.append(f"Accused: {accused_str}")
    if sho:       parts.append(f"SHO: {sho}")
    if action:    parts.append(f"Action: {action}")
    if narr_text: parts.append(narr_text)

    if not parts:
        return None

    text = " | ".join(parts)
    title = f"FIR {crime_no} — {district or village or 'Karnataka'}"

    return {
        "text":  text,
        "title": title,
        "type":  "fir_record",
        "meta": {
            "source":   "master_dataset",
            "fir_index": idx,
            "district": district,
            "act":      act,
            "section":  section,
            "date":     date,
        }
    }


# ─────────────────────────────────────────────────────────────────
# Loaders
# ─────────────────────────────────────────────────────────────────
def load_narratives() -> list[dict]:
    chunks = []
    if NARRATIVES_PATH.exists():
        with open(NARRATIVES_PATH, "r", encoding="utf-8") as f:
            recs = json.load(f)
        for i, n in enumerate(recs):
            text = n.get("summary", "")
            if not text:
                continue
            chunks.append({
                "text":  text[:600],
                "title": n.get("title", f"Narrative {i}"),
                "type":  n.get("type", "Case Narrative"),
                "meta":  {"source": "narratives", "narrative_id": n.get("narrative_id", i)},
            })
        print(f"  Loaded {len(chunks)} investigation narratives.", flush=True)
    return chunks


def load_fir_dataset(limit: int = HALF_LIMIT) -> list[dict]:
    if not MASTER_FIR_PATH.exists():
        print(f"  [WARN] FIR dataset not found at {MASTER_FIR_PATH}", flush=True)
        return []

    chunks = []
    skipped = 0
    t0 = time.time()

    with open(MASTER_FIR_PATH, "r", encoding="utf-8", errors="ignore") as f:
        for raw_idx, line in enumerate(f):
            if raw_idx >= limit:
                break
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
                chunk = fir_to_chunk(rec, raw_idx)
                if chunk:
                    chunks.append(chunk)
                else:
                    skipped += 1
            except (json.JSONDecodeError, Exception):
                skipped += 1
                continue

            if (raw_idx + 1) % 10_000 == 0:
                elapsed = time.time() - t0
                print(f"  Parsed {raw_idx+1:,} / {limit:,} FIR records "
                      f"({len(chunks):,} chunks, {skipped:,} skipped) "
                      f"[{elapsed:.0f}s]", flush=True)

    elapsed = time.time() - t0
    print(f"  Loaded {len(chunks):,} FIR chunks from {raw_idx+1:,} records "
          f"({skipped:,} skipped) [{elapsed:.0f}s]", flush=True)
    return chunks


# ─────────────────────────────────────────────────────────────────
# Embedding
# ─────────────────────────────────────────────────────────────────
def embed_batched(texts: list[str], model) -> np.ndarray:
    all_vecs = []
    total = len(texts)
    t0 = time.time()
    for i in range(0, total, EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        vecs  = model.encode(batch, show_progress_bar=False, batch_size=EMBED_BATCH_SIZE)
        all_vecs.append(vecs)
        done = min(i + EMBED_BATCH_SIZE, total)
        elapsed = time.time() - t0
        eta = (elapsed / done) * (total - done) if done else 0
        print(f"  Embedded {done:,}/{total:,}  [{elapsed:.0f}s elapsed, ETA {eta:.0f}s]",
              flush=True)
    return np.vstack(all_vecs).astype(np.float32)


# ─────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────
def build():
    print("=" * 60, flush=True)
    print("Sentinal v2 — Embedding Pipeline", flush=True)
    print("=" * 60, flush=True)

    # 1. Gather all chunks
    print("\n[1/4] Loading narratives...", flush=True)
    chunks = load_narratives()

    print(f"\n[2/4] Loading FIR dataset (first {HALF_LIMIT:,} records)...", flush=True)
    fir_chunks = load_fir_dataset(limit=HALF_LIMIT)
    chunks.extend(fir_chunks)

    if not chunks:
        print("[ERROR] No chunks to embed. Aborting.", flush=True)
        sys.exit(1)

    print(f"\n  Total chunks: {len(chunks):,}", flush=True)

    # 2. Build text strings to embed
    texts = [f"{c['title']}: {c['text']}" for c in chunks]

    # 3. Load sentence-transformer and embed
    print("\n[3/4] Loading sentence-transformer model...", flush=True)
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(MODEL_NAME)
        print(f"  Model '{MODEL_NAME}' loaded.", flush=True)
    except ImportError:
        print("[ERROR] sentence-transformers not installed. Run: pip install sentence-transformers", flush=True)
        sys.exit(1)

    print(f"\n  Embedding {len(texts):,} chunks in batches of {EMBED_BATCH_SIZE}...", flush=True)
    t_embed = time.time()
    embeddings = embed_batched(texts, model)
    print(f"  Embedding done in {time.time() - t_embed:.0f}s. Shape: {embeddings.shape}", flush=True)

    # 4. Save
    print("\n[4/4] Saving outputs...", flush=True)
    np.save(str(EMBEDDINGS_PATH), embeddings)
    print(f"  embeddings.npy -> {EMBEDDINGS_PATH}  ({embeddings.nbytes / 1e6:.1f} MB)", flush=True)


    metadata_list = []
    for i, c in enumerate(chunks):
        metadata_list.append({
            "index":       i,
            "title":       c["title"],
            "summary":     c["text"],
            "type":        c["type"],
            "meta_details": c.get("meta", {}),
        })

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata_list, f, ensure_ascii=False)
    print(f"  chunk_metadata.json → {METADATA_PATH}  ({len(metadata_list):,} entries)", flush=True)

    print("\n✅ Done!", flush=True)


if __name__ == "__main__":
    build()
