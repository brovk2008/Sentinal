import importlib.util
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND_MAIN = ROOT / "backend" / "main.py"

if not BACKEND_MAIN.exists():
    raise FileNotFoundError(f"Backend entrypoint not found: {BACKEND_MAIN}")

backend_dir = ROOT / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

spec = importlib.util.spec_from_file_location("sentinal_backend_main", BACKEND_MAIN)
if spec is None or spec.loader is None:
    raise ImportError(f"Unable to load backend entrypoint: {BACKEND_MAIN}")

backend_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend_module)
app = backend_module.app

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT", os.environ.get("PORT", 9000)))
    print(f"[Sentinal AppSail Wrapper] Listening on 0.0.0.0:{port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
