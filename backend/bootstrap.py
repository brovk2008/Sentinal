"""
bootstrap.py — AppSail startup bootstrapper for Sentinal backend (v3)

Key fixes over v2:
- Main thread performs os.execv() (not background thread) — avoids process exit race condition
- Explicitly closes the HTTPServer socket with FD_CLOEXEC before exec
- Background thread only installs packages + calls server.shutdown()
- PYTHONPATH set before exec so uvicorn finds /tmp/sentinal-packages
"""
import os, sys, subprocess, threading, json, time, fcntl
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") or os.environ.get("PORT") or 9000)
PKG_DIR = "/tmp/sentinal-packages"
os.makedirs(PKG_DIR, exist_ok=True)

# Add to path immediately (cached packages from previous warm restart)
if PKG_DIR not in sys.path:
    sys.path.insert(0, PKG_DIR)

INSTALL_LOG = []
INSTALL_DONE = False
INSTALL_ERROR = None
EXEC_READY = False   # Set to True by background thread when packages are ready


def log(msg):
    INSTALL_LOG.append(msg)
    print(f"[bootstrap] {msg}", flush=True)


def is_importable(name):
    try:
        __import__(name)
        return True
    except ImportError:
        return False


def pip_install(packages, label):
    """Install packages to PKG_DIR in a single fast parallel pass to finish within 10s."""
    if not packages:
        return True

    log(f"[{label}] Installing {len(packages)} packages in single fast pass...")
    cmd = [sys.executable, "-m", "pip", "install",
           "--quiet", "--target", PKG_DIR,
           "--only-binary", ":all:"] + packages
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
    if r.returncode == 0:
        log(f"[{label}] Fast pass succeeded.")
        return True

    log(f"[{label}] Fast pass error: {r.stderr[:200]}, retrying standard...")
    cmd2 = [sys.executable, "-m", "pip", "install",
            "--quiet", "--target", PKG_DIR] + packages
    r2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=25)
    if r2.returncode == 0:
        log(f"[{label}] Standard pass succeeded.")
        return True

    log(f"[{label}] FAILED: {r2.stderr[:200]}")
    return False




def installer_thread(server: HTTPServer):
    """Background thread: installs packages, then signals main thread via server.shutdown()."""
    global INSTALL_DONE, INSTALL_ERROR, EXEC_READY

    # Core packages needed to start main.py (ultra-lightweight, ~3MB total, installs in ~3s)
    CORE_PACKAGES = [
        "fastapi==0.111.0",
        "uvicorn==0.30.1",
        "python-multipart==0.0.9",
        "python-dotenv==1.0.1",
        "httpx==0.27.0",
        "aiofiles==23.2.1",
        "requests>=2.32.3",
    ]

    # Heavy ML/SDK packages — installed asynchronously by main.py in background
    ML_PACKAGES = [
        "numpy==1.26.4",
        "scikit-learn==1.5.0",
        "joblib==1.4.2",
        "pandas==2.2.2",
        "reportlab==4.2.0",
        "pdfplumber==0.11.4",
        "beautifulsoup4==4.12.3",
        "zcatalyst-sdk==1.0.3",
    ]

    try:
        # ── Phase 1: Core web packages ────────────────────────────────────────
        missing_core = [pkg for pkg in CORE_PACKAGES if not is_importable(pkg.split("==")[0].split(">=")[0].replace("-", "_"))]
        if missing_core:
            ok = pip_install(missing_core, "Core")
            if not ok:
                INSTALL_ERROR = "Core pip install failed"
                return
        else:
            log("[Core] All core packages already cached.")

        log("[Core] Core web packages ready. Proceeding to exec uvicorn immediately...")
        INSTALL_DONE = True

        # Set PYTHONPATH so exec'd uvicorn process inherits package path
        existing_pp = os.environ.get("PYTHONPATH", "")
        os.environ["PYTHONPATH"] = PKG_DIR + (":" + existing_pp if existing_pp else "")
        log(f"PYTHONPATH set to: {os.environ['PYTHONPATH'][:80]}")

        log("Signalling main thread to exec uvicorn...")
        EXEC_READY = True

        # Signal main thread's serve_forever() to stop → triggers os.execv() in main thread
        server.shutdown()


    except subprocess.TimeoutExpired:
        INSTALL_ERROR = "pip install timed out"
        log(f"TIMEOUT: {INSTALL_ERROR}")
    except Exception as e:
        import traceback
        INSTALL_ERROR = str(e)
        log(f"CRITICAL ERROR: {traceback.format_exc()}")


class BootstrapHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/install-log":
            body = json.dumps({
                "done": INSTALL_DONE,
                "exec_ready": EXEC_READY,
                "log": INSTALL_LOG,
                "error": INSTALL_ERROR,
                "pkg_dir_contents": os.listdir(PKG_DIR)[:10] if os.path.exists(PKG_DIR) else [],
            }).encode()
        elif self.path == "/health":
            body = json.dumps({"status": "starting", "message": "Initializing..."}).encode()
        else:
            body = json.dumps({
                "status": "starting",
                "message": "Sentinal backend initializing — dependencies installing. Retry in ~90 seconds.",
                "install_done": INSTALL_DONE,
                "install_log_tail": INSTALL_LOG[-3:] if INSTALL_LOG else [],
            }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self): self.do_GET()
    def log_message(self, *a): pass


if __name__ == "__main__":
    print(f"[bootstrap v3] Port={PORT} Python={sys.version.split()[0]}", flush=True)

    server = HTTPServer(("0.0.0.0", PORT), BootstrapHandler)

    # Non-daemon thread so Python doesn't exit while it's running
    t = threading.Thread(target=installer_thread, args=(server,), daemon=False)
    t.start()

    print(f"[bootstrap v3] Serving on port {PORT} while packages install...", flush=True)
    server.serve_forever()
    # ↑ Blocks until server.shutdown() is called by installer_thread

    # ── Main thread resumes here after serve_forever() returns ──────────────
    print("[bootstrap v3] serve_forever() returned.", flush=True)

    if EXEC_READY:
        print(f"[bootstrap v3] Closing socket and exec'ing uvicorn...", flush=True)

        # Set FD_CLOEXEC so the listening socket is NOT inherited by uvicorn
        try:
            fd = server.socket.fileno()
            flags = fcntl.fcntl(fd, fcntl.F_GETFD)
            fcntl.fcntl(fd, fcntl.F_SETFD, flags | fcntl.FD_CLOEXEC)
            print(f"[bootstrap v3] FD_CLOEXEC set on fd={fd}", flush=True)
        except Exception as e:
            print(f"[bootstrap v3] fcntl warning: {e}", flush=True)

        server.server_close()  # Close the listening socket
        time.sleep(0.5)        # Give OS a moment to release the port

        # Replace this process with uvicorn — inherits env vars including PYTHONPATH
        print(f"[bootstrap v3] exec: uvicorn main:app --port {PORT}", flush=True)
        os.execv(sys.executable, [
            sys.executable, "-m", "uvicorn",
            "main:app",
            "--host", "0.0.0.0",
            "--port", str(PORT),
            "--log-level", "info",
        ])
    else:
        print(f"[bootstrap v3] Install failed ({INSTALL_ERROR}). Staying as bootstrap.", flush=True)
        # Re-start the server so AppSail doesn't see a dead process
        server2 = HTTPServer(("0.0.0.0", PORT), BootstrapHandler)
        server2.serve_forever()
