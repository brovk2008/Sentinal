import numpy as np
import json
import os
import httpx
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

        if os.path.exists(emb_path):
            try:
                self.embeddings = np.load(emb_path)
                print(f"[RAG] Loaded embeddings from {emb_path}")
            except Exception as e:
                print(f"[RAG] Error loading embeddings: {e}")

        if os.path.exists(meta_path):
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                print(f"[RAG] Loaded metadata from {meta_path}")
            except Exception as e:
                print(f"[RAG] Error loading metadata: {e}")

        # Eagerly load sentence-transformers model to avoid first-query delay
        try:
            from sentence_transformers import SentenceTransformer
            print("[RAG] Loading local SentenceTransformer model...")
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
            print("[RAG] Model loaded successfully.")
        except Exception as e:
            print(f"[RAG] Could not load local SentenceTransformer: {e}")

    async def get_embedding(self, text: str) -> np.ndarray:
        """Get embedding for a query text."""
        # Use cached local sentence-transformers if available
        if self.model is not None:
            try:
                return self.model.encode(text)
            except Exception as e:
                print(f"[RAG] Error using local model: {e}")

        # Fallback to HF Inference API if token is configured
        if config.HF_TOKEN:
            try:
                headers = {"Authorization": f"Bearer {config.HF_TOKEN}"}
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        config.HF_INFERENCE_URL,
                        headers=headers,
                        json={"inputs": text},
                        timeout=10
                    )
                    if response.status_code == 200:
                        return np.array(response.json())
            except Exception as e:
                print(f"[RAG] HF API error: {e}")

        # Final fallback: mock random embedding vector (384 dimensions)
        print("[RAG] Using mock random query embedding vector")
        return np.random.rand(384).astype(np.float32)

    async def retrieve(self, query_text: str, top_k: int = 5) -> list:
        """Retrieve top_k most similar narratives using cosine similarity."""
        if self.embeddings is None or not self.metadata:
            return []

        query_vector = await self.get_embedding(query_text)
        
        # Normalize vectors for cosine similarity calculation
        norm_query = np.linalg.norm(query_vector)
        if norm_query == 0:
            return []
            
        norm_embeddings = np.linalg.norm(self.embeddings, axis=1)
        # Handle zero divisions
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
