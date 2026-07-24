import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

IS_CATALYST = bool(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("CATALYST_ENV"))

class Config:
    DB_PATH = "/tmp/sentinal.db" if IS_CATALYST else str(DATA_DIR / "sentinal.db")
    EMBEDDINGS_PATH = str(DATA_DIR / "embeddings.npy")
    CHUNK_METADATA_PATH = str(DATA_DIR / "chunk_metadata.json")
    NARRATIVES_PATH = str(DATA_DIR / "investigation_narratives.json")
    FIR_RAG_PATH = str(DATA_DIR / "fir_records_rag.jsonl")

    # Optional HuggingFace fallback for embeddings only
    HF_TOKEN = os.getenv("HF_TOKEN", "")
    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    HF_INFERENCE_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{EMBEDDING_MODEL}"

    # Catalyst QuickML / Zia
    # NOTE: env vars must NOT start with CATALYST_ (reserved by AppSail platform)
    CATALYST_PROJECT_ID   = os.getenv("SENTINAL_PROJECT_ID",   "50170000000065001")
    CATALYST_QUICKML_KEY  = os.getenv("SENTINAL_QUICKML_KEY")  or os.getenv("ZCAT_QUICKML_KEY") or ""
    CATALYST_LLM_MODEL    = os.getenv("SENTINAL_LLM_MODEL",    "GLM-4.7-Flash")
    CATALYST_VISION_MODEL = os.getenv("SENTINAL_VISION_MODEL", "VL-Qwen3.6-35B-A3B")

    # OpenRouter fallback configuration
    OPENROUTER_KEY = os.getenv("SENTINEL_OPENROUTER_KEY", "")
    OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free"

    USE_CATALYST_DB = os.getenv("USE_CATALYST_DB", "false").lower() == "true"

config = Config()
