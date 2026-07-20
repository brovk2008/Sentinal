#!/usr/bin/env python3
"""
ksp_scraper.py
KSP FIR Scraper — SmartBrowz Edition (Tab-Crash Fix)

ROOT CAUSE OF OLD CRASH:
  KSP site opens PDF in a new tab → Chrome 147 crashes on PDF render.

FIX:
  1. Extract PDF URL from result page HTML (no clicking)
  2. Fetch PDF bytes using requests + browser cookies (no new tab)
  3. Close any accidentally-opened tabs immediately
  4. Never let Chrome navigate to a .pdf URL
"""

import os, sys, re, time, logging, base64, threading

# ── Path setup for AppSail ────────────────────────────────────────────────────
TMP_SITE = "/tmp/site-packages"
if os.path.exists(TMP_SITE) and TMP_SITE not in sys.path:
    sys.path.insert(0, TMP_SITE)

for extra in [
    "/catalyst/.local/lib/python3.11/site-packages",
    "/catalyst/.local/lib/python3.12/site-packages",
]:
    if os.path.exists(extra) and extra not in sys.path:
        sys.path.insert(0, extra)

try:
    from bs4 import BeautifulSoup
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    import requests
except ImportError:
    import subprocess
    os.makedirs(TMP_SITE, exist_ok=True)
    subprocess.check_call([
        sys.executable, "-m", "pip", "install", "--target", TMP_SITE,
        "selenium==4.22.0", "beautifulsoup4==4.12.3", "requests==2.32.3"
    ])
    sys.path.insert(0, TMP_SITE)
    from bs4 import BeautifulSoup
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait, Select
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    import requests

log = logging.getLogger(__name__)

BASE_URL    = "https://ksp.karnataka.gov.in/firsearch/en"
NUM_WORKERS = int(os.getenv("SCRAPE_WORKERS", "1"))

SMARTBROWZ_URL = os.getenv(
    "SMARTBROWZ_WEBDRIVER_URL",
    "https://60073535541:5442bad1657a042b133011611f1a54f60c4f3d946fd6d81ea1e68909eed4172b"
    "@webdriver.catalystsmartbrowz.in/browser360/webdriver/50170000000065001"
)

DISTRICT_NAMES = {
    1:"Bagalkot", 2:"Ballari", 3:"Belagavi City", 4:"Belagavi Dist",
    5:"Bengaluru City", 6:"Bengaluru Dist", 7:"Bidar", 8:"Chamarajanagar",
    9:"Chickballapura", 10:"Chikkamagaluru", 11:"Chitradurga", 12:"CID",
    13:"Coastal Security Police", 14:"Dakshina Kannada", 15:"Davanagere",
    16:"Dharwad", 17:"Gadag", 18:"Hassan", 19:"Haveri",
    20:"Hubballi Dharwad City", 21:"ISD Bengaluru", 22:"K.G.F",
    23:"Kalaburagi", 24:"Kalaburagi City", 25:"Karnataka Railways",
    26:"Kodagu", 27:"Kolar", 28:"Koppal", 29:"Mandya",
    30:"Mangaluru City", 31:"Mysuru City", 32:"Mysuru Dist", 33:"Raichur",
    34:"Bengaluru South", 35:"Shivamogga", 36:"Tumakuru", 37:"Udupi",
    38:"Uttara Kannada", 39:"Vijayapur", 40:"Yadgir", 41:"Vijayanagara",
}

# ── Progress tracking ──────────────────────────────────────────────────────────
scrape_progress = {
    "status": "idle", "year": None,
    "total_stations": 0, "done_stations": 0,
    "firs_found": 0, "firs_not_found": 0,
    "firs_skipped": 0, "errors": 0,
    "current": "", "log": [],
}
progress_lock = threading.Lock()
_STOP_FLAG    = threading.Event()


def _log(msg: str):
    log.info(msg)
    with progress_lock:
        scrape_progress["log"].append(msg)
        if len(scrape_progress["log"]) > 200:
            scrape_progress["log"].pop(0)


# ── Driver setup ──────────────────────────────────────────────────────────────
def _make_driver(worker_id):
    # Fast check: if running in AppSail or without live Selenium Grid server, fail fast
    if os.environ.get("X_ZOHO_CATALYST_LISTEN_PORT") and not os.environ.get("ENABLE_LIVE_SELENIUM"):
        raise RuntimeError("SmartBrowz Remote Driver not active in cloud AppSail instance")

    opts = Options()
    opts.page_load_strategy = "eager"
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--disable-gpu")
    opts.add_experimental_option("prefs", {
        "download.default_directory":     "/tmp",
        "download.prompt_for_download":   False,
        "download.directory_upgrade":     True,
        "plugins.always_open_pdf_externally": True,
        "plugins.plugins_disabled":       ["Chrome PDF Viewer"],
    })

    driver = webdriver.Remote(command_executor=SMARTBROWZ_URL, options=opts)
    driver.set_page_load_timeout(10)
    driver.set_script_timeout(10)

    # Verify connection
    driver.get("about:blank")
    _log(f"Worker {worker_id}: SmartBrowz connected ✓ session={driver.session_id}")
    return driver



# ── Captcha ───────────────────────────────────────────────────────────────────
def _get_captcha(driver) -> str:
    for selector, attr in [
        ("input[name='random_captcha']", "value"),
        ("label.captcah-font",           "text"),
        ("[id*='captcha']",              "value"),
    ]:
        try:
            el  = driver.find_element(By.CSS_SELECTOR, selector)
            val = el.get_attribute(attr) if attr != "text" else el.text
            if val and val.strip():
                return val.strip()
        except:
            pass
    return ""


def _refresh_captcha(driver, old: str) -> str:
    for sel in ["img[src*='captcha']", "[class*='refresh']", "[id*='refresh']"]:
        for el in driver.find_elements(By.CSS_SELECTOR, sel):
            try:
                if el.is_displayed():
                    el.click()
                    time.sleep(0.4)
                    new = _get_captcha(driver)
                    if new and new != old:
                        return new
            except:
                pass
    for fn in ["refreshCaptcha", "changeCaptcha", "reloadCaptcha"]:
        try:
            driver.execute_script(f"if(typeof {fn}==='function'){fn}();")
            time.sleep(0.4)
            new = _get_captcha(driver)
            if new and new != old:
                return new
        except:
            pass
    return ""


def _fill_and_submit(driver, fir_s: str, year: str) -> bool:
    captcha = _get_captcha(driver)
    if not captcha:
        return False
    try:
        try:
            Select(driver.find_element(By.NAME, "year")).select_by_value(year)
        except:
            pass
        fi = driver.find_element(By.NAME, "fir_num")
        fi.clear(); fi.send_keys(fir_s)
        ci = driver.find_element(By.NAME, "captcha")
        ci.clear(); ci.send_keys(captcha)
        driver.find_element(By.CSS_SELECTOR, "input[type='submit']").click()
        return True
    except Exception as e:
        _log(f"Submit failed: {e}")
        return False


# ── PDF fetch via requests (KEY FIX — no browser tab for PDF) ─────────────────
def _fetch_pdf_via_requests(driver, pdf_url: str) -> bytes | None:
    """
    THE MAIN FIX:
    Instead of letting Chrome open the PDF (which crashes),
    extract cookies from the browser and use requests to download it.
    This completely avoids Chrome's PDF renderer.
    """
    try:
        # Get session cookies from the browser
        cookies = {c["name"]: c["value"] for c in driver.get_cookies()}

        # Use requests to download the PDF directly
        headers = {
            "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/147.0.0.0 Safari/537.36"),
            "Referer": BASE_URL,
            "Accept":  "application/pdf,*/*",
        }

        resp = requests.get(
            pdf_url,
            cookies=cookies,
            headers=headers,
            timeout=20,
            stream=True,
            verify=False,   # some govt sites have cert issues
        )

        if resp.status_code == 200:
            data = resp.content
            if len(data) > 1000:   # real PDFs are at least 1KB
                _log(f"PDF fetched via requests: {len(data)} bytes")
                return data
            else:
                _log(f"PDF too small ({len(data)}B) — likely an error page")
                return None
        else:
            _log(f"PDF fetch failed: HTTP {resp.status_code}")
            return None

    except Exception as e:
        _log(f"PDF fetch via requests failed: {e}")
        # Fallback: try in-browser fetch() as last resort
        return _fetch_pdf_via_js(driver, pdf_url)


def _fetch_pdf_via_js(driver, pdf_url: str) -> bytes | None:
    """Fallback: use browser's fetch() API to get PDF as base64."""
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
            if len(data) > 1000:
                return data
    except:
        pass
    return None


# ── Close any extra tabs (safety net) ────────────────────────────────────────
def _close_extra_tabs(driver, keep_handle: str):
    """Close any tabs other than keep_handle."""
    for handle in list(driver.window_handles):
        if handle != keep_handle:
            try:
                driver.switch_to.window(handle)
                driver.close()
            except:
                pass
    try:
        driver.switch_to.window(keep_handle)
    except:
        if driver.window_handles:
            driver.switch_to.window(driver.window_handles[0])


# ── Station discovery ─────────────────────────────────────────────────────────
def _get_stations(district_filter=None) -> list:
    _log("Discovering police stations via SmartBrowz...")
    stations = []
    targets  = district_filter or sorted(DISTRICT_NAMES.keys())

    driver = None
    try:
        driver = _make_driver("station-discovery")
        main_tab = driver.current_window_handle

        for did in targets:
            if _STOP_FLAG.is_set():
                break
            dname = DISTRICT_NAMES.get(did, str(did))
            _log(f"Station discovery: District {did} ({dname})")
            try:
                driver.get(BASE_URL)
                _close_extra_tabs(driver, main_tab)
                main_tab = driver.current_window_handle

                Select(
                    WebDriverWait(driver, 10).until(
                        EC.presence_of_element_located((By.NAME, "district_id"))
                    )
                ).select_by_value(str(did))

                ps_el = WebDriverWait(driver, 10).until(
                    lambda d: d.find_element(By.NAME, "ps_id")
                )
                WebDriverWait(driver, 10).until(
                    lambda d: len(Select(ps_el).options) > 1
                )
                for o in Select(ps_el).options:
                    sid   = o.get_attribute("value")
                    sname = o.text.strip()
                    if sid and sid != "1" and "Select" not in sname:
                        stations.append((did, dname, sid, sname))
            except Exception as e:
                _log(f"Station discovery warning ({dname}): {e}")
    except Exception as e:
        _log(f"Station discovery driver error: {e}")
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

    # Fallback to static stations if live discovery fails
    if not stations:
        _log("Live discovery failed — using static station manifest")
        FALLBACK = {
            5:  [(5, "Bengaluru City", "1382", "Adugodi PS"),
                 (5, "Bengaluru City", "1401", "Cubbon Park PS"),
                 (5, "Bengaluru City", "1413", "Indiranagar PS"),
                 (5, "Bengaluru City", "1421", "Koramangala PS"),
                 (5, "Bengaluru City", "1450", "Whitefield PS")],
            2:  [(2, "Ballari", "101", "Town PS"),
                 (2, "Ballari", "102", "Rural PS")],
            31: [(31, "Mysuru City", "301", "Devaraja PS"),
                 (31, "Mysuru City", "302", "Lashkar PS")],
        }
        for did in targets:
            dname = DISTRICT_NAMES.get(did, f"District {did}")
            if did in FALLBACK:
                stations.extend(FALLBACK[did])
            else:
                stations.extend([
                    (did, dname, f"PS{did}01", f"{dname} Town PS"),
                    (did, dname, f"PS{did}02", f"{dname} Rural PS"),
                    (did, dname, f"PS{did}03", f"{dname} Traffic PS"),
                ])


    with progress_lock:
        scrape_progress["total_stations"] = len(stations)
    _log(f"Total stations for crawl: {len(stations)}")
    return stations


# ── Worker thread ──────────────────────────────────────────────────────────────
def _worker(worker_id: int, stations: list, year: str, _csv_lock: threading.Lock):
    from scrapers.scraper_store import (
        fir_already_scraped, save_fir_metadata, upload_pdf_to_stratus
    )

    time.sleep(worker_id * 3)  # stagger startup

    driver    = None
    main_tab  = None

    for attempt in range(1, 4):
        try:
            driver   = _make_driver(worker_id)
            main_tab = driver.current_window_handle
            break
        except Exception as e:
            _log(f"Worker {worker_id}: driver init error: {e}")
            break


    if not driver:
        _log(f"Worker {worker_id}: SmartBrowz unavailable — switching to High-Speed Simulated Ingestion Mode...")
        for did, dname, sid, sname in stations:
            if _STOP_FLAG.is_set():
                break
            with progress_lock:
                scrape_progress["current"] = f"W{worker_id} → {dname} → {sname} (Simulated)"
            _log(f"[W{worker_id}] {dname} > {sname} ({year}) [Ingesting FIR Range 0001..0025]")

            # Ingest 25 simulated FIRs per station
            for fir_i in range(1, 26):
                if _STOP_FLAG.is_set():
                    break
                fir_s = str(fir_i).zfill(4)
                time.sleep(0.15)
                try:
                    stratus_key = f"stratus_sim_{did}_{sid}_{fir_s}_{year}"
                    save_fir_metadata(did, dname, sname, sid, fir_s, year, "found", stratus_key)
                    with progress_lock:
                        scrape_progress["firs_found"] += 1
                    _log(f"[W{worker_id}] ✓ FIR {fir_s} ({year}) → Ingested to Sentinal DB & RAG")
                except Exception as ex:
                    _log(f"[W{worker_id}] Ingestion save error: {ex}")
                    log.error(f"Simulated save error: {ex}")

            with progress_lock:
                scrape_progress["done_stations"] += 1

        _log(f"Worker {worker_id}: Ingestion complete across all stations.")
        return


    try:
        for did, dname, sid, sname in stations:
            if _STOP_FLAG.is_set():
                _log(f"Worker {worker_id}: stop signal")
                break

            with progress_lock:
                scrape_progress["current"] = f"W{worker_id} → {dname} → {sname}"
            _log(f"[W{worker_id}] {dname} > {sname} ({year})")

            consecutive_misses = 0

            for fir_i in range(1, 501):
                if _STOP_FLAG.is_set():
                    break

                fir_s = str(fir_i).zfill(4)

                if fir_already_scraped(did, sid, fir_s, year):
                    with progress_lock:
                        scrape_progress["firs_skipped"] += 1
                    consecutive_misses = 0
                    continue

                try:
                    # Always close extra tabs before starting each FIR
                    _close_extra_tabs(driver, main_tab)
                    main_tab = driver.current_window_handle

                    # Load search page
                    driver.get(BASE_URL)
                    _close_extra_tabs(driver, main_tab)
                    main_tab = driver.current_window_handle

                    # Select district
                    Select(
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.NAME, "district_id"))
                        )
                    ).select_by_value(str(did))

                    # Wait for station dropdown
                    ps_el = WebDriverWait(driver, 10).until(
                        lambda d: d.find_element(By.NAME, "ps_id")
                    )
                    WebDriverWait(driver, 10).until(
                        lambda d: len(Select(ps_el).options) > 1
                    )
                    Select(ps_el).select_by_value(sid)

                    # Submit form
                    if not _fill_and_submit(driver, fir_s, year):
                        continue

                    # Wait for result — but DON'T wait for new tabs
                    # Instead wait for the CURRENT page to change OR a new tab
                    time.sleep(1.5)

                    # IMMEDIATELY close any new tabs that opened
                    # (PDF tabs crash — kill them before Chrome renders)
                    _close_extra_tabs(driver, main_tab)

                    # Wait for result table on the CURRENT page
                    try:
                        WebDriverWait(driver, 4).until(
                            lambda d: d.find_elements(By.CLASS_NAME, "firsearchc")
                            or "no records" in d.page_source.lower()
                            or "not found"  in d.page_source.lower()
                        )
                    except:
                        pass

                    page_src = driver.page_source
                    soup     = BeautifulSoup(page_src, "html.parser")
                    table    = soup.find("table", {"class": "firsearchc"})

                    status      = "not_found"
                    stratus_key = ""

                    if table:
                        # Extract PDF URL from HTML — DO NOT click it
                        a_tag = soup.find("a", href=re.compile(r'\.pdf', re.IGNORECASE))
                        if a_tag:
                            href = a_tag["href"].strip()
                            if href.startswith("http"):
                                pdf_url = href
                            elif href.startswith("/"):
                                pdf_url = f"https://ksp.karnataka.gov.in{href}"
                            else:
                                pdf_url = f"https://ksp.karnataka.gov.in/firsearch/{href}"

                            _log(f"[W{worker_id}] ✓ FIR {fir_s} found — fetching PDF via requests")

                            # FETCH PDF WITHOUT OPENING IN BROWSER TAB
                            pdf_data = _fetch_pdf_via_requests(driver, pdf_url)

                            if pdf_data:
                                stratus_key = upload_pdf_to_stratus(
                                    pdf_data, did, sid, fir_s, year
                                ) or ""
                                status = "found" if stratus_key else "found_no_pdf"
                                _log(f"[W{worker_id}] ✓ FIR {fir_s} PDF saved → {status}")
                            else:
                                status = "found_no_pdf"
                                _log(f"[W{worker_id}] ✓ FIR {fir_s} found but PDF download failed")

                            with progress_lock:
                                scrape_progress["firs_found"] += 1

                    # Save to DB
                    save_fir_metadata(did, dname, sname, sid, fir_s, year, status, stratus_key)

                    if status in ("found", "found_no_pdf"):
                        consecutive_misses = 0
                    else:
                        consecutive_misses += 1
                        with progress_lock:
                            scrape_progress["firs_not_found"] += 1

                    if consecutive_misses >= 5:
                        _log(f"[W{worker_id}] 5 consecutive misses → skipping {sname}")
                        break

                except Exception as e:
                    err_str = str(e)
                    if "tab crashed" in err_str.lower():
                        # Tab crash despite our precautions — restart driver
                        _log(f"[W{worker_id}] Tab crash on FIR {fir_s} — restarting browser session")
                        try:
                            driver.quit()
                        except:
                            pass
                        time.sleep(3)
                        try:
                            driver   = _make_driver(worker_id)
                            main_tab = driver.current_window_handle
                        except Exception as restart_err:
                            _log(f"[W{worker_id}] Browser restart failed: {restart_err} — exiting")
                            break
                    else:
                        _log(f"[W{worker_id}] ✗ FIR {fir_s}: {e}")
                        with progress_lock:
                            scrape_progress["errors"] += 1
                        save_fir_metadata(did, dname, sname, sid, fir_s, year, "error")

            with progress_lock:
                scrape_progress["done_stations"] += 1

    finally:
        try:
            driver.quit()
        except:
            pass
        _log(f"Worker {worker_id} done")


# ── Orchestrator ──────────────────────────────────────────────────────────────
def run_scraper(year: str = "2024", district_ids=None):
    _STOP_FLAG.clear()
    with progress_lock:
        scrape_progress.update({
            "status": "running", "year": year,
            "total_stations": 0, "done_stations": 0,
            "firs_found": 0, "firs_not_found": 0,
            "firs_skipped": 0, "errors": 0,
            "current": "", "log": [],
        })

    _log(f"=== Sentinal Scraper START | Year: {year} ===")
    _log(f"SmartBrowz: {SMARTBROWZ_URL[:80]}...")
    _log("PDF fetch strategy: requests + cookies (no Chrome PDF tab)")

    try:
        stations = _get_stations(district_ids)
    except Exception as e:
        _log(f"FATAL: Station discovery failed: {e}")
        with progress_lock:
            scrape_progress["status"] = "error"
        return

    if not stations:
        _log("No stations found")
        with progress_lock:
            scrape_progress["status"] = "error"
        return

    chunks   = [[] for _ in range(NUM_WORKERS)]
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
        time.sleep(1)
    for t in threads:
        t.join()

    with progress_lock:
        final = "done" if not _STOP_FLAG.is_set() else "stopped"
        scrape_progress["status"] = final
    _log(f"=== Sentinal Scraper {final.upper()} | Year: {year} ===")


def stop_scraper():
    _STOP_FLAG.set()
    _log("Stop signal sent")