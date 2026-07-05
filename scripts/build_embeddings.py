import json
import numpy as np
from pathlib import Path
import sys
import re

BASE_DIR = Path(__file__).parent.parent
NARRATIVES_PATH = BASE_DIR / "backend" / "data" / "investigation_narratives.json"
EMBEDDINGS_PATH = BASE_DIR / "backend" / "data" / "embeddings.npy"
METADATA_PATH = BASE_DIR / "backend" / "data" / "chunk_metadata.json"

def extract_names(text: str) -> list[str]:
    # Match capitalized names like Ashok Kumar, Ramesh K
    matches = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-zA-Z]+)*\b', text)
    stop_phrases = {"Investigation", "Bengaluru", "Karnataka", "Police", "Crime", "Financial", "UPI", "Case", "Registered", "Under"}
    filtered = [m for m in matches if m not in stop_phrases and len(m.split()) >= 2]
    return list(set(filtered))

def extract_districts(text: str) -> list[str]:
    districts = ["Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Kolar", "Shivamogga", "Tumakuru", "Mandya"]
    found = []
    for d in districts:
        if d.lower() in text.lower():
            found.append(d)
    return found

def extract_dates(text: str) -> list[str]:
    return re.findall(r'\b\d{4}-\d{2}-\d{2}\b', text)

def semantic_chunk(text: str, source_title: str, metadata: dict) -> list[dict]:
    # Split by paragraphs
    paragraphs = [p.strip() for p in text.split('\n\n') if len(p.strip()) > 30]
    chunks = []
    
    for idx, para in enumerate(paragraphs):
        words = para.split()
        if len(words) <= 150:
            chunks.append({
                'text': para,
                'title': source_title,
                'type': metadata.get('type', 'Case Note'),
                'metadata': {
                    **metadata,
                    'paragraph_index': idx,
                    'word_count': len(words),
                    'accused_mentioned': extract_names(para),
                    'districts_mentioned': extract_districts(para),
                    'dates_mentioned': extract_dates(para)
                }
            })
        else:
            # Overlap split (130 words step, 150 words window)
            for i in range(0, len(words), 130):
                chunk_words = words[i:i+150]
                chunk_text = ' '.join(chunk_words)
                chunks.append({
                    'text': chunk_text,
                    'title': source_title,
                    'type': metadata.get('type', 'Case Note'),
                    'metadata': {
                        **metadata,
                        'paragraph_index': f"{idx}_split_{i}",
                        'word_count': len(chunk_words),
                        'accused_mentioned': extract_names(chunk_text),
                        'districts_mentioned': extract_districts(chunk_text),
                        'dates_mentioned': extract_dates(chunk_text)
                    }
                })
    return chunks

def build():
    print("Building semantic embeddings for RAG system...")

    if not NARRATIVES_PATH.exists():
        print(f"[ERROR] Narratives file not found at {NARRATIVES_PATH}")
        sys.exit(1)

    with open(NARRATIVES_PATH, "r", encoding="utf-8") as f:
        narratives = json.load(f)

    print(f"Loaded {len(narratives)} narratives.")

    # Flatten chunking
    all_chunks = []
    for idx, n in enumerate(narratives):
        meta = {
            "narrative_id": n.get("narrative_id", idx),
            "type": n.get("type", "General Case")
        }
        chunks = semantic_chunk(n["summary"], n["title"], meta)
        all_chunks.extend(chunks)

    print(f"Split {len(narratives)} narratives into {len(all_chunks)} semantic chunks.")

    # Generate embeddings
    try:
        from sentence_transformers import SentenceTransformer
        print("Using local SentenceTransformer model...")
        model = SentenceTransformer("all-MiniLM-L6-v2")
        
        texts_to_encode = [f"{c['title']}\n{c['text']}" for c in all_chunks]
        embeddings = model.encode(texts_to_encode, show_progress_bar=True)
    except ImportError:
        print("[WARN] sentence-transformers package not installed. Generating dummy mock embeddings...")
        embeddings = np.random.rand(len(all_chunks), 384).astype(np.float32)

    # Save embeddings matrix
    np.save(str(EMBEDDINGS_PATH), embeddings)
    print(f"[SUCCESS] Saved embeddings to {EMBEDDINGS_PATH}")

    # Compile chunk metadata list
    metadata_list = []
    for i, c in enumerate(all_chunks):
        metadata_list.append({
            "index": i,
            "title": c["title"],
            "summary": c["text"],
            "type": c["type"],
            "meta_details": c["metadata"]
        })

    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata_list, f, indent=2)
    print(f"[SUCCESS] Saved chunk metadata to {METADATA_PATH}")

if __name__ == "__main__":
    build()
