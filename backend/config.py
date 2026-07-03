import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

class Config:
    DB_PATH = str(DATA_DIR / "sentinel.db")
    EMBEDDINGS_PATH = str(DATA_DIR / "embeddings.npy")
    CHUNK_METADATA_PATH = str(DATA_DIR / "chunk_metadata.json")
    NARRATIVES_PATH = str(DATA_DIR / "investigation_narratives.json")

    # API Keys — set via environment variables
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    HF_TOKEN = os.getenv("HF_TOKEN", "")

    GROQ_MODEL = "llama-3.3-70b-versatile"
    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    HF_INFERENCE_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{EMBEDDING_MODEL}"

    # Catalyst toggle
    USE_CATALYST_DB = os.getenv("USE_CATALYST_DB", "false").lower() == "true"

config = Config()
