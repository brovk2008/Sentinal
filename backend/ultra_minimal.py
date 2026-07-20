"""
ultra_minimal.py — Diagnostic HTTP server to test loading pre-bundled lib/
"""
import sys, os, json, traceback

HERE = os.path.dirname(__file__)
LIB_PATH = os.path.join(HERE, "lib")
if LIB_PATH not in sys.path:
    sys.path.insert(0, LIB_PATH)

DIAG = {
    "python": sys.version,
    "here": HERE,
    "lib_exists": os.path.exists(LIB_PATH),
    "lib_contents": os.listdir(LIB_PATH)[:10] if os.path.exists(LIB_PATH) else [],
    "fastapi_import": "untested",
    "uvicorn_import": "untested",
    "error": None
}

try:
    import fastapi
    DIAG["fastapi_import"] = f"OK ({fastapi.__file__})"
except Exception as e:
    DIAG["fastapi_import"] = f"FAIL: {e}"
    DIAG["fastapi_traceback"] = traceback.format_exc()

try:
    import uvicorn
    DIAG["uvicorn_import"] = f"OK ({uvicorn.__file__})"
except Exception as e:
    DIAG["uvicorn_import"] = f"FAIL: {e}"
    DIAG["uvicorn_traceback"] = traceback.format_exc()


from http.server import HTTPServer, BaseHTTPRequestHandler

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(DIAG, indent=2).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    port = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("PORT") or 9000)
    print(f"[diag] Starting stdlib server on port {port}...", flush=True)
    server = HTTPServer(("0.0.0.0", port), Handler)
    server.serve_forever()
