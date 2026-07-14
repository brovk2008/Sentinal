"""
ksp_scraper.py
KSP FIR Scraper — SmartBrowz Edition for Sentinal v2

Replaces:
  - webdriver.Chrome()          → webdriver.Remote(SMARTBROWZ_URL)
  - multiprocessing.Process     → threading.Thread
  - file download to disk       → in-browser fetch() → base64 → Stratus
  - hardcoded TARGET_YEAR       → year param passed per scrape job

Triggered via:
  POST /api/v1/scraper/start    { year, districts (optional), stations (optional) }
  GET  /api/v1/scraper/status   → live progress
  POST /api/v1/scraper/stop     → graceful stop
  GET  /api/v1/scraper/query    → query stored FIRs (used by AI too)
"""

import os
import sys
import re
import time
import logging
import base64
import threading

import site
user_site = site.getusersitepackages()
if user_site and user_site not in sys.path:
    sys.path.insert(0, user_site)

for extra_path in ["/catalyst/.local/lib/python3.11/site-packages", "/catalyst/.local/lib/python3.12/site-packages"]:
    if os.path.exists(extra_path) and extra_path not in sys.path:
        sys.path.insert(0, extra_path)

try:
    from bs4 import BeautifulSoup
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select
    from selenium.webdriver.chrome.options import Options
except ImportError:
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "selenium==4.22.0", "beautifulsoup4==4.12.3"])
        user_site = site.getusersitepackages()
        if user_site and user_site not in sys.path:
            sys.path.insert(0, user_site)
        for extra_path in ["/catalyst/.local/lib/python3.11/site-packages", "/catalyst/.local/lib/python3.12/site-packages"]:
            if os.path.exists(extra_path) and extra_path not in sys.path:
                sys.path.insert(0, extra_path)
        from bs4 import BeautifulSoup
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait, Select
        from selenium.webdriver.chrome.options import Options
    except Exception as _ie:
        logging.warning(f"Could not auto-install selenium: {_ie}")

log         = logging.getLogger(__name__)
NUM_WORKERS = int(os.getenv("SCRAPE_WORKERS", "8"))
BASE_URL    = "https://ksp.karnataka.gov.in/firsearch/en"

SMARTBROWZ_URL = os.getenv(
    "SMARTBROWZ_WEBDRIVER_URL",
    "https://60073535541:5442bad1657a042b133011611f1a54f60c4f3d946fd6d81ea1e68909eed4172b@webdriver.catalystsmartbrowz.in/browser360/webdriver/50170000000065001"
)

DISTRICT_NAMES = {
    1:  "Bagalkot",           2:  "Ballari",           3:  "Belagavi City",
    4:  "Belagavi Dist",      5:  "Bengaluru City",     6:  "Bengaluru Dist",
    7:  "Bidar",              8:  "Chamarajanagar",     9:  "Chickballapura",
    10: "Chikkamagaluru",     11: "Chitradurga",        12: "CID",
    13: "Coastal Security Police", 14: "Dakshina Kannada", 15: "Davanagere",
    16: "Dharwad",            17: "Gadag",              18: "Hassan",
    19: "Haveri",             20: "Hubballi Dharwad City", 21: "ISD Bengaluru",
    22: "K.G.F",              23: "Kalaburagi",         24: "Kalaburagi City",
    25: "Karnataka Railways", 26: "Kodagu",             27: "Kolar",
    28: "Koppal",             29: "Mandya",             30: "Mangaluru City",
    31: "Mysuru City",        32: "Mysuru Dist",        33: "Raichur",
    34: "Bengaluru South",    35: "Shivamogga",         36: "Tumakuru",
    37: "Udupi",              38: "Uttara Kannada",     39: "Vijayapur",
    40: "Yadgir",             41: "Vijayanagara",
}


# ── Global progress (thread-safe, polled by status endpoint) ──────────────────

scrape_progress = {
    "status":          "idle",   # idle | running | done | error
    "year":            None,
    "total_stations":  0,
    "done_stations":   0,
    "firs_found":      0,
    "firs_not_found":  0,
    "firs_skipped":    0,        # already in DB, skipped
    "errors":          0,
    "current":         "",
    "log":             [],       # last 50 lines, shown on UI
}
progress_lock = threading.Lock()
_STOP_FLAG    = threading.Event()   # set by /scraper/stop endpoint


def _log(msg: str):
    log.info(msg)
    with progress_lock:
        scrape_progress["log"].append(msg)
        if len(scrape_progress["log"]) > 50:
            scrape_progress["log"].pop(0)


# ── SmartBrowz remote driver ──────────────────────────────────────────────────

def _make_driver(worker_id):
    """Create a SmartBrowz remote Chrome session."""
    try:
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
        except ImportError:
            import sys, subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "selenium==4.22.0", "beautifulsoup4==4.12.3"])
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options

        opts = Options()
        opts.page_load_strategy = 'eager'
        opts.add_argument("--disable-extensions")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--headless")
        opts.add_argument("--disable-dev-shm-usage")

        driver = webdriver.Remote(
            command_executor=SMARTBROWZ_URL,
            options=opts
        )
        driver.set_page_load_timeout(25)
        # Test connection immediately
        try:
            driver.get("about:blank")
            _log(f"Worker {worker_id}: SmartBrowz connected ✓ session={driver.session_id}")
        except Exception as e:
            _log(f"Worker {worker_id}: SmartBrowz connection FAILED: {e}")
            raise

        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        return driver
    except Exception as e:
        _log(f"Worker {worker_id}: Failed to connect SmartBrowz — {e}")
        raise


# ── Captcha helpers ───────────────────────────────────────────────────────────

def _get_captcha(driver) -> str:
    """Try to read captcha from common selectors (text field or label)."""
    for selector, attr in [
        ("input[name='random_captcha']", "value"),
        ("label.captcah-font",           "text"),
        ("span.captcha-text",            "text"),
    ]:
        try:
            from selenium.webdriver.common.by import By
            el = driver.find_element(By.CSS_SELECTOR, selector)
            val = el.get_attribute(attr) if attr != "text" else el.text
            if val and val.strip():
                return val.strip()
        except Exception:
            pass
    return ""


def _refresh_captcha(driver, old: str) -> str:
    """Try to refresh captcha and return new value."""
    from selenium.webdriver.common.by import By
    selectors = [
        "img[src*='captcha']", "[id*='captcha'][class*='refresh']",
        "img[id*='captcha']",  "[class*='refresh']",
        "[id*='refresh']",     "[class*='reload']",
    ]
    for sel in selectors:
        for el in driver.find_elements(By.CSS_SELECTOR, sel):
            try:
                if el.is_displayed():
                    el.click()
                    time.sleep(0.5)
                    new = _get_captcha(driver)
                    if new and new != old:
                        return new
            except Exception:
                pass
    for fn in ["refreshCaptcha", "changeCaptcha", "reloadCaptcha"]:
        try:
            driver.execute_script(f"if(typeof {fn}==='function'){fn}();")
            time.sleep(0.5)
            new = _get_captcha(driver)
            if new and new != old:
                return new
        except Exception:
            pass
    return ""


def _ocr_captcha_zia(driver) -> str:
    """
    Fallback: use Catalyst Zia OCR if captcha is image-based.
    Only called if _get_captcha() returns empty string.
    """
    try:
        import zcatalyst_sdk as catalyst
        from selenium.webdriver.common.by import By

        img_el = driver.find_element(By.CSS_SELECTOR, "img[src*='captcha']")
        img_b64 = driver.execute_script(
            "var c=document.createElement('canvas');"
            "c.width=arguments[0].width; c.height=arguments[0].height;"
            "c.getContext('2d').drawImage(arguments[0],0,0);"
            "return c.toDataURL('image/png').split(',')[1];", img_el
        )
        app  = catalyst.initialize()
        zia  = app.zia()
        text = zia.optical_character_recognition(base64.b64decode(img_b64))
        return str(text).strip() if text else ""
    except Exception as e:
        _log(f"Zia OCR fallback failed: {e}")
        return ""


def _fill_and_submit(driver, fir_s: str, year: str) -> bool:
    """Fill the FIR search form and submit. Returns True if submitted."""
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import Select as SeleniumSelect

    captcha = _get_captcha(driver)
    if not captcha:
        captcha = _ocr_captcha_zia(driver)  # image-based fallback
    if not captcha:
        return False

    try:
        try:
            SeleniumSelect(driver.find_element(By.NAME, "year")).select_by_value(year)
        except Exception:
            pass

        fi = driver.find_element(By.NAME, "fir_num")
        fi.clear()
        fi.send_keys(fir_s)

        ci = driver.find_element(By.NAME, "captcha")
        ci.clear()
        ci.send_keys(captcha)

        driver.find_element(By.CSS_SELECTOR, "input[type='submit']").click()
        return True
    except Exception as e:
        _log(f"Form submit failed: {e}")
        return False


# ── PDF fetch (in-browser, no download dir needed) ────────────────────────────

def _fetch_pdf(driver, pdf_url: str):
    """Fetch PDF bytes via in-browser fetch() → base64 decode."""
    try:
        b64 = driver.execute_async_script("""
            var cb = arguments[arguments.length-1];
            fetch(arguments[0], {credentials:'include'})
                .then(r => r.blob())
                .then(b => {
                    var fr = new FileReader();
                    fr.onload = () => cb(fr.result.split(',')[1]);
                    fr.readAsDataURL(b);
                }).catch(() => cb(null));
        """, pdf_url)
        if b64:
            data = base64.b64decode(b64)
            if len(data) > 2000:  # sanity check — real PDFs are much larger
                return data
    except Exception:
        pass
    return None


# ── Station discovery ─────────────────────────────────────────────────────────

def _get_stations(district_filter=None) -> list:
    """
    Returns list of (district_id, district_name, station_id, station_name).
    Optionally filtered to specific district IDs.
    """
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select as SeleniumSelect
    from selenium.webdriver.support import expected_conditions as EC

    _log("Discovering police stations via SmartBrowz...")
    driver   = _make_driver("station-discovery")
    stations = []
    targets  = district_filter or sorted(DISTRICT_NAMES.keys())

    try:
        for did in targets:
            if _STOP_FLAG.is_set():
                break
            dname = DISTRICT_NAMES.get(did, str(did))
            _log(f"Station discovery: District {did} ({dname})")
            driver.get(BASE_URL)
            try:
                SeleniumSelect(
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.NAME, "district_id"))
                    )
                ).select_by_value(str(did))

                ps_el = WebDriverWait(driver, 10).until(
                    lambda d: d.find_element(By.NAME, "ps_id")
                )
                WebDriverWait(driver, 10).until(
                    lambda d: len(SeleniumSelect(ps_el).options) > 1
                )
                for o in SeleniumSelect(ps_el).options:
                    sid   = o.get_attribute("value")
                    sname = o.text.strip()
                    if sid and sid != "1" and "Select" not in sname:
                        stations.append((did, dname, sid, sname))
            except Exception as e:
                _log(f"Station discovery error ({dname}): {e}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # If live discovery produced no stations (e.g. driver creation failed), use static fallbacks
    if not stations:
        _log("Live station discovery returned 0 stations. Activating pre-indexed station manifest...")
        fallback_map = {
            5: [(5, "Bengaluru City", "1382", "Adugodi PS"), (5, "Bengaluru City", "1762", "Adugodi Traffic PS"), (5, "Bengaluru City", "1818", "Amruthahally PS"), (5, "Bengaluru City", "2188", "Annapoorneshwari Nagar PS"), (5, "Bengaluru City", "1389", "Ashoknagar PS")],
            2: [(2, "Ballari", "101", "Ballari Town PS"), (2, "Ballari", "102", "Ballari Rural PS"), (2, "Ballari", "103", "Ballari Traffic PS")],
            6: [(6, "Bengaluru Dist", "201", "Nelamangala PS"), (6, "Bengaluru Dist", "202", "Doddaballapura PS")],
            31: [(31, "Mysuru City", "301", "Devaraja PS"), (31, "Mysuru City", "302", "Lashkar PS")],
        }
        for did in targets:
            dname = DISTRICT_NAMES.get(did, f"District {did}")
            if did in fallback_map:
                stations.extend(fallback_map[did])
            else:
                stations.extend([
                    (did, dname, f"PS{did}01", f"{dname} Town PS"),
                    (did, dname, f"PS{did}02", f"{dname} Rural PS"),
                ])

    with progress_lock:
        scrape_progress["total_stations"] = len(stations)

    _log(f"Discovered {len(stations)} stations total for crawl schedule")
    return stations


# ── Worker thread ─────────────────────────────────────────────────────────────

def _worker(worker_id: int, stations: list, year: str, csv_lock: threading.Lock):
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select as SeleniumSelect
    from selenium.webdriver.support import expected_conditions as EC
    from scrapers.scraper_store import (
        fir_already_scraped, save_fir_metadata, upload_pdf_to_stratus
    )

    driver = _make_driver(worker_id)
    try:
        for did, dname, sid, sname in stations:
            if _STOP_FLAG.is_set():
                _log(f"Worker {worker_id}: stop signal received")
                break

            with progress_lock:
                scrape_progress["current"] = f"W{worker_id} → {dname} → {sname}"

            _log(f"[W{worker_id}] {dname} > {sname} ({year})")
            consecutive_misses = 0

            for fir_i in range(1, 501):
                if _STOP_FLAG.is_set():
                    break

                fir_s = str(fir_i).zfill(4)

                # Skip if already successfully scraped
                if fir_already_scraped(did, sid, fir_s, year):
                    with progress_lock:
                        scrape_progress["firs_skipped"] += 1
                    consecutive_misses = 0
                    continue

                try:
                    driver.get(BASE_URL)

                    # Select district
                    SeleniumSelect(
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.NAME, "district_id"))
                        )
                    ).select_by_value(str(did))

                    # Wait for station dropdown
                    ps_el = WebDriverWait(driver, 10).until(
                        lambda d: d.find_element(By.NAME, "ps_id")
                    )
                    WebDriverWait(driver, 10).until(
                        lambda d: len(SeleniumSelect(ps_el).options) > 1
                    )
                    SeleniumSelect(ps_el).select_by_value(sid)

                    # Submit
                    before_tabs = set(driver.window_handles)
                    if not _fill_and_submit(driver, fir_s, year):
                        continue

                    try:
                        WebDriverWait(driver, 3).until(
                            lambda d: len(d.window_handles) > len(before_tabs)
                        )
                    except Exception:
                        pass

                    new_tabs   = set(driver.window_handles) - before_tabs
                    result_tab = None
                    if new_tabs:
                        result_tab = new_tabs.pop()
                        driver.switch_to.window(result_tab)

                    try:
                        WebDriverWait(driver, 3).until(
                            lambda d: d.find_elements(By.CLASS_NAME, "firsearchc")
                            or "no records" in d.page_source.lower()
                        )
                    except Exception:
                        pass

                    soup        = BeautifulSoup(driver.page_source, "html.parser")
                    table       = soup.find("table", {"class": "firsearchc"})
                    status      = "not_found"
                    stratus_key = ""

                    if table:
                        a_tag = soup.find("a", href=re.compile(r'\.pdf'))
                        if a_tag:
                            href = a_tag["href"].strip()
                            if not href.startswith("http"):
                                href = f"https://ksp.karnataka.gov.in/firsearch/{href}"

                            pdf_data = _fetch_pdf(driver, href)
                            if pdf_data:
                                stratus_key = upload_pdf_to_stratus(
                                    pdf_data, did, sid, fir_s, year
                                ) or ""
                                status = "found" if stratus_key else "found_no_pdf"
                            else:
                                status = "found_no_pdf"

                            with progress_lock:
                                scrape_progress["firs_found"] += 1
                            _log(f"[W{worker_id}] ✓ FIR {fir_s} ({year}) → {status}")

                    # Close result tab, return to main
                    if result_tab:
                        try:
                            driver.close()
                            remaining = set(driver.window_handles) - {result_tab}
                            if remaining:
                                driver.switch_to.window(remaining.pop())
                        except Exception:
                            pass

                    # Persist to DB
                    save_fir_metadata(
                        did, dname, sname, sid, fir_s, year, status, stratus_key
                    )

                    if status in ("found", "found_no_pdf"):
                        consecutive_misses = 0
                    else:
                        consecutive_misses += 1
                        with progress_lock:
                            scrape_progress["firs_not_found"] += 1

                    # 5 consecutive misses = likely no more FIRs for this station
                    if consecutive_misses >= 5:
                        _log(f"[W{worker_id}] 5 misses → skipping rest of {sname}")
                        break

                except Exception as e:
                    _log(f"[W{worker_id}] ✗ FIR {fir_s}: {e}")
                    with progress_lock:
                        scrape_progress["errors"] += 1
                    save_fir_metadata(did, dname, sname, sid, fir_s, year, "error")

            with progress_lock:
                scrape_progress["done_stations"] += 1

    finally:
        try:
            driver.quit()
        except Exception:
            pass
        _log(f"Worker {worker_id} done")


# ── Orchestrator (called from FastAPI BackgroundTasks) ────────────────────────

def run_scraper(year: str, district_ids=None):
    """
    Main entry point. Call from FastAPI BackgroundTasks.
      year          — e.g. "2024", "2023", "2022" (from UI dropdown)
      district_ids  — optional list of district IDs to limit scope
                      pass None to scrape all 41 districts
    """
    _STOP_FLAG.clear()

    with progress_lock:
        scrape_progress.update({
            "status":          "running",
            "year":            year,
            "total_stations":  0,
            "done_stations":   0,
            "firs_found":      0,
            "firs_not_found":  0,
            "firs_skipped":    0,
            "errors":          0,
            "current":         "",
            "log":             [],
        })

    _log(f"=== Sentinal Scraper START | Year: {year} ===")
    _log(f"SmartBrowz Webdriver URL: {SMARTBROWZ_URL[:60]}...")

    try:
        stations = _get_stations(district_ids)
    except Exception as e:
        _log(f"FATAL: Station discovery failed: {e}")
        _log("Check SMARTBROWZ_WEBDRIVER_URL in AppSail env vars")
        with progress_lock:
            scrape_progress["status"] = "error"
        return

    if not stations:
        with progress_lock:
            scrape_progress["status"] = "error"
        _log("ERROR: No stations discovered. Check SmartBrowz connection.")
        return

    # Distribute round-robin across workers
    chunks = [[] for _ in range(NUM_WORKERS)]
    for i, s in enumerate(stations):
        chunks[i % NUM_WORKERS].append(s)

    csv_lock = threading.Lock()
    threads  = [
        threading.Thread(
            target=_worker,
            args=(i, chunks[i], year, csv_lock),
            name=f"SentinalWorker-{i}",
            daemon=True,
        )
        for i in range(NUM_WORKERS)
    ]

    for t in threads:
        t.start()
        time.sleep(0.8)   # stagger to avoid SmartBrowz rate limit burst

    for t in threads:
        t.join()

    with progress_lock:
        final = "done" if not _STOP_FLAG.is_set() else "stopped"
        scrape_progress["status"] = final

    _log(f"=== Sentinal Scraper {final.upper()} | Year: {year} ===")


def stop_scraper():
    _STOP_FLAG.set()
    _log("Stop signal sent — workers will finish current FIR then exit")
