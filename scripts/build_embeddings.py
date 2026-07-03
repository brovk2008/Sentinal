import json
import numpy as np
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
NARRATIVES_PATH = BASE_DIR / "backend" / "data" / "investigation_narratives.json"
EMBEDDINGS_PATH = BASE_DIR / "backend" / "data" / "embeddings.npy"
METADATA_PATH = BASE_DIR / "backend" / "data" / "chunk_metadata.json"

def build():
    print("Building embeddings for RAG system...")

    if not NARRATIVES_PATH.exists():
        print(f"[ERROR] Narratives file not found at {NARRATIVES_PATH}")
        sys.exit(1)

    with open(NARRATIVES_PATH, "r", encoding="utf-8") as f:
        narratives = json.load(f)

    print(f"Loaded {len(narratives)} narratives.")

    # We will try to load sentence_transformers, if not available, we use random embeddings as mock
    # so the app doesn't crash, or users can run it without dependencies.
    try:
        from sentence_transformers import SentenceTransformer
        print("Using SentenceTransformer model locally...")
        model = SentenceTransformer("all-MiniLM-L6-v2")
        texts = [f"{n['title']}\n{n['summary']}" for n in narratives]
        embeddings = model.encode(texts, show_progress_bar=True)
    except ImportError:
        print("[WARN] sentence-transformers package not installed. Generating dummy mock embeddings...")
        # 384 dimensions for all-MiniLM-L6-v2
        embeddings = np.random.rand(len(narratives), 384).astype(np.float32)

    # Save embeddings
    np.save(str(EMBEDDINGS_PATH), embeddings)
    print(f"[SUCCESS] Saved embeddings to {EMBEDDINGS_PATH}")

    # Save chunk metadata for lookup
    metadata = []
    for idx, n in enumerate(narratives):
        metadata.append({
            "index": idx,
            "title": n["title"],
            "summary": n["summary"],
            "type": n.get("type", "General Case"),
        })

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"[SUCCESS] Saved chunk metadata to {METADATA_PATH}")

if __name__ == "__main__":
    build()
