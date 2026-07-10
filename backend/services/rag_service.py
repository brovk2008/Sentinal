import numpy as np
import json
import os
import re
from pathlib import Path
from config import config


class RAGService:
    def __init__(self):
        self.embeddings = None
        self.metadata = []
        self.model = None
        self.load_data()

    def load_data(self):
        emb_path = config.EMBEDDINGS_PATH
        meta_path = config.CHUNK_METADATA_PATH

        emb_path_gz = str(emb_path) + ".gz"
        meta_path_gz = str(meta_path) + ".gz"

        if os.path.exists(emb_path_gz):
            try:
                import gzip
                with gzip.open(emb_path_gz, "rb") as f:
                    self.embeddings = np.load(f)
                print(f"[RAG] Loaded compressed embeddings from {emb_path_gz}")
            except Exception as e:
                print(f"[RAG] Error loading compressed embeddings: {e}")
        elif os.path.exists(emb_path):
            try:
                self.embeddings = np.load(emb_path)
                print(f"[RAG] Loaded embeddings from {emb_path}")
            except Exception as e:
                print(f"[RAG] Error loading embeddings: {e}")

        if os.path.exists(meta_path_gz):
            try:
                import gzip
                with gzip.open(meta_path_gz, "rt", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                print(f"[RAG] Loaded compressed metadata from {meta_path_gz}")
            except Exception as e:
                print(f"[RAG] Error loading compressed metadata: {e}")
        elif os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                print(f"[RAG] Loaded metadata from {meta_path}")
            except Exception as e:
                print(f"[RAG] Error loading metadata: {e}")

        # Eagerly load sentence-transformers model to avoid first-query delay
        # NOTE: On the production server (AppSail) sentence-transformers is NOT
        # installed (too heavy). We use a lightweight TF-IDF query vector instead,
        # which works well against the pre-built sentence-transformer embeddings.
        try:
            from sentence_transformers import SentenceTransformer
            print("[RAG] Loading local SentenceTransformer model...")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            print("[RAG] Model loaded successfully.")
        except Exception as e:
            print(f"[RAG] SentenceTransformer not available ({e}). Will use TF-IDF query vectors.")
            self.model = None

    async def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for a query text."""
        # Primary: local SentenceTransformer (available during local dev)
        if self.model is not None:
            try:
                return self.model.encode(text)
            except Exception as e:
                print(f"[RAG] Error using local model: {e}")

        # Production fallback: deterministic TF-IDF hash vector (384-dim)
        # Hash each word into a bucket and accumulate TF weights.
        # Gives stable, reproducible vectors — works for keyword-heavy FIR queries.
        vec = np.zeros(384, dtype=np.float32)
        words = re.findall(r'[a-zA-Z0-9]+', text.lower())
        for w in words:
            idx = hash(w) % 384
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec

    async def retrieve(self, query_text: str, top_k: int = 5) -> list:
        """Retrieve top_k most similar narratives using hybrid search (Keyword + Vector similarity)."""
        if self.embeddings is None or not self.metadata:
            return []

        # Step 1: Extract keywords
        query_words = set(query_text.lower().split())
        stop_words = {'the', 'is', 'in', 'of', 'and', 'a', 'to', 'for', 'that', 'this', 'on', 'with', 'at', 'by', 'an'}
        keywords = query_words - stop_words

        # Find candidate indices that contain at least one keyword
        candidate_indices = []
        for idx, meta in enumerate(self.metadata):
            text_to_search = f"{meta.get('title', '')} {meta.get('summary', '')}".lower()
            if any(kw in text_to_search for kw in keywords):
                candidate_indices.append(idx)

        # Step 2: Vector search
        query_vector = await self.get_embedding(query_text)
        norm_query = np.linalg.norm(query_vector)
        if norm_query == 0:
            return []

        # If keyword search returned enough candidates, restrict vector search to them
        if len(candidate_indices) >= top_k:
            filtered_embeddings = self.embeddings[candidate_indices]
            norm_filtered = np.linalg.norm(filtered_embeddings, axis=1)
            norm_filtered[norm_filtered == 0] = 1e-10
            
            similarities = np.dot(filtered_embeddings, query_vector) / (norm_filtered * norm_query)
            top_local_indices = np.argsort(similarities)[::-1][:top_k]
            
            results = []
            for local_idx in top_local_indices:
                global_idx = candidate_indices[local_idx]
                results.append({
                    "score": float(similarities[local_idx]),
                    "title": self.metadata[global_idx]["title"],
                    "summary": self.metadata[global_idx]["summary"],
                    "type": self.metadata[global_idx]["type"]
                })
            return results
        else:
            # Fall back to full vector search if candidate pool is too small
            norm_embeddings = np.linalg.norm(self.embeddings, axis=1)
            norm_embeddings[norm_embeddings == 0] = 1e-10

            similarities = np.dot(self.embeddings, query_vector) / (norm_embeddings * norm_query)
            top_indices = np.argsort(similarities)[::-1][:top_k]

            results = []
            for idx in top_indices:
                results.append({
                    "score": float(similarities[idx]),
                    "title": self.metadata[idx]["title"],
                    "summary": self.metadata[idx]["summary"],
                    "type": self.metadata[idx]["type"]
                })
            return results

    async def add_chunks(self, chunks: list[str], source_title: str):
        """Add new text chunks dynamically to the active in-memory embeddings and metadata."""
        if not chunks:
            return 0

        # Generate embeddings for new chunks
        new_embs = []
        for chunk in chunks:
            emb = await self.get_embedding(chunk)
            new_embs.append(emb)

        new_embs = np.array(new_embs).astype(np.float32)

        # Append to active variables
        if self.embeddings is None:
            self.embeddings = new_embs
        else:
            self.embeddings = np.vstack((self.embeddings, new_embs))

        start_idx = len(self.metadata)
        for i, chunk in enumerate(chunks):
            self.metadata.append({
                "index": start_idx + i,
                "title": source_title,
                "summary": chunk,
                "type": "Uploaded Intel File"
            })

        print(f"[RAG] Added {len(chunks)} chunks dynamically from {source_title}.")
        return len(chunks)

rag_service = RAGService()
