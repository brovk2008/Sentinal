import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

class Config:
    DB_PATH = str(DATA_DIR / "sentinal.db")
    EMBEDDINGS_PATH = str(DATA_DIR / "embeddings.npy")
    CHUNK_METADATA_PATH = str(DATA_DIR / "chunk_metadata.json")
    NARRATIVES_PATH = str(DATA_DIR / "investigation_narratives.json")
    FIR_RAG_PATH = str(DATA_DIR / "fir_records_rag.jsonl")

    # Optional HuggingFace fallback for embeddings only
    HF_TOKEN = os.getenv("HF_TOKEN", "")
    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    HF_INFERENCE_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{EMBEDDING_MODEL}"

    # Catalyst QuickML / Zia
    CATALYST_PROJECT_ID = os.getenv("CATALYST_PROJECT_ID", "50170000000065001")
    CATALYST_QUICKML_KEY = os.getenv("ZCAT_QUICKML_KEY") or os.getenv("CATALYST_QUICKML_KEY") or ""
    CATALYST_LLM_MODEL = os.getenv("CATALYST_LLM_MODEL", "GLM-4.7-Flash")
    CATALYST_VISION_MODEL = os.getenv("CATALYST_VISION_MODEL", "VL-Qwen3.6-35B-A3B")

    USE_CATALYST_DB = os.getenv("USE_CATALYST_DB", "false").lower() == "true"

config = Config()
