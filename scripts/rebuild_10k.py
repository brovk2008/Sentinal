"""
Rebuild RAG embeddings using only the first 10,000 FIR records
PLUS all investigation_narratives.json (synthetic case data).
Uses the same lightweight hash-based vectorizer as rag_service.py — no
sentence-transformers needed. Output is gzipped to minimise deployment size.
"""
import json
import os
import gzip
import numpy as np

DATASET_PATH    = r"C:\Users\techp\Downloads\more projects\FIR ocr\master_dataset.jsonl"
NARRATIVES_PATH = r"backend\data\investigation_narratives.json"
MAX_RECORDS     = 10_000
EMB_OUT_GZ      = r"backend\data\embeddings.npy.gz"
META_OUT_GZ     = r"backend\data\chunk_metadata.json.gz"
DIM             = 384

def hash_embed(text: str, dim: int = DIM) -> np.ndarray:
    """Lightweight TF-IDF-style hash embedding (matches rag_service._embed_query)."""
    vec = np.zeros(dim, dtype=np.float32)
    for word in text.lower().split():
        vec[hash(word) % dim] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec

embeddings = []
metadata   = []

# ── 1. Read first 10k FIR records ─────────────────────────────────────────────
print(f"Reading first {MAX_RECORDS:,} records from master_dataset.jsonl …")
fir_records = []
with open(DATASET_PATH, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        if len(fir_records) >= MAX_RECORDS:
            break
        line = line.strip()
        if not line:
            continue
        try:
            fir_records.append(json.loads(line))
        except Exception:
            pass

print(f"  Loaded {len(fir_records):,} FIR records")

for i, rec in enumerate(fir_records):
    text = " ".join(filter(None, [
        str(rec.get("FIR_Number",        "")),
        str(rec.get("act",               "")),
        str(rec.get("section_desc",      "")),
        str(rec.get("Crime_Head",        "")),
        str(rec.get("District_Name",     "")),
        str(rec.get("Village_Area_Name", "")),
        str(rec.get("FIR_Date",          "")),
        str(rec.get("Complainant_Name",  "")),
        str(rec.get("Accused_Name",      "")),
    ]))
    embeddings.append(hash_embed(text))
    metadata.append({
        "text":   text[:600],
        "source": "fir_dataset",
        **{k: str(v) for k, v in rec.items() if isinstance(v, (str, int, float))}
    })
    if (i + 1) % 2_000 == 0:
        print(f"  Embedded FIR {i+1:,} / {len(fir_records):,}")

print(f"  FIR embeddings done ({len(embeddings):,} chunks)")

# ── 2. Add investigation_narratives.json (synthetic Karnataka data) ────────────
if os.path.exists(NARRATIVES_PATH):
    print(f"\nReading investigation_narratives.json …")
    with open(NARRATIVES_PATH, "r", encoding="utf-8") as f:
        narratives = json.load(f)
    print(f"  Loaded {len(narratives):,} narratives")

    for n in narratives:
        text = " ".join(filter(None, [
            str(n.get("title",       "")),
            str(n.get("summary",     "")),
            str(n.get("content",     "")),
            str(n.get("type",        "")),
            str(n.get("district",    "")),
            str(n.get("crime_type",  "")),
            str(n.get("accused",     "")),
        ]))
        embeddings.append(hash_embed(text))
        metadata.append({
            "text":   text[:600],
            "source": "synthetic_narrative",
            **{k: str(v) for k, v in n.items() if isinstance(v, (str, int, float))}
        })
    print(f"  Narrative embeddings done")
else:
    print(f"  [WARN] {NARRATIVES_PATH} not found — skipping narratives")

# ── 3. Save gzipped ───────────────────────────────────────────────────────────
emb_array = np.array(embeddings, dtype=np.float32)
print(f"\nTotal chunks : {emb_array.shape[0]:,}  |  shape: {emb_array.shape}")

os.makedirs(os.path.dirname(EMB_OUT_GZ), exist_ok=True)

with gzip.open(EMB_OUT_GZ, "wb") as f:
    np.save(f, emb_array)

with gzip.open(META_OUT_GZ, "wt", encoding="utf-8") as f:
    json.dump(metadata, f, ensure_ascii=False)

emb_mb  = os.path.getsize(EMB_OUT_GZ)  / 1024 / 1024
meta_mb = os.path.getsize(META_OUT_GZ) / 1024 / 1024
print(f"\nDone!")
print(f"  embeddings.npy.gz      : {emb_mb:.2f} MB")
print(f"  chunk_metadata.json.gz : {meta_mb:.2f} MB")
print(f"  Total RAG data         : {emb_mb + meta_mb:.2f} MB")
