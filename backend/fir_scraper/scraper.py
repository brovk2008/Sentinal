"""
Selenium-based FIR scraper for ksp.karnataka.gov.in
Uses SmartBrowz remote WebDriver (no local Chrome binary needed).

Set env var:
  SMARTBROWZ_WEBDRIVER_URL = https://<projectId>:<apiKey>@webdriver.catalystsmartbrowz.in/browser360/webdriver/<projectId>
"""
import os
import re
import logging
import base64

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

BASE_URL = "https://ksp.karnataka.gov.in/firsearch/en"
log = logging.getLogger(__name__)

# ── SmartBrowz endpoint — set this in AppSail env vars ───────────────────────
# Format: https://<projectId>:<apiKey>@webdriver.catalystsmartbrowz.in/browser360/webdriver/<projectId>
SMARTBROWZ_URL = os.environ.get(
    "SMARTBROWZ_WEBDRIVER_URL",
    "https://60073535541:5442bad1657a042b133011611f1a54f60c4f3d946fd6d81ea1e68909eed4172b@webdriver.catalystsmartbrowz.in/browser360/webdriver/50170000000065001"
)


# ── Driver Factory ────────────────────────────────────────────────────────────
def make_driver():
    """
    Create a SmartBrowz remote Chrome session.
    SmartBrowz manages browser isolation — do NOT pass headless or local Chrome options.
    """
    if not SMARTBROWZ_URL:
        raise RuntimeError(
            "SMARTBROWZ_WEBDRIVER_URL env var is not set. "
            "Set it in AppSail → Environment Variables."
        )

    opts = Options()
    opts.page_load_strategy = 'eager'
    opts.add_argument("--disable-extensions")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--headless")
    opts.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Remote(
        command_executor=SMARTBROWZ_URL,
        options=opts,
    )
    # Mask automation flag
    try:
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
    except Exception:
        pass
    driver.set_page_load_timeout(25)
    log.info("SmartBrowz browser session created (eager mode)")
    return driver


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_captcha(driver) -> str:
    """Extract inline captcha value from page (text-based, not image)."""
    # Try hidden input with the actual captcha value
    try:
        val = driver.find_element(
            By.CSS_SELECTOR, "input[name='random_captcha']"
        ).get_attribute("value")
        if val and val.strip():
            return val.strip()
    except Exception:
        pass
    # Try label with class captcah-font (KSP typo intentional)
    try:
        return driver.find_element(By.CSS_SELECTOR, "label.captcah-font").text.strip()
    except Exception:
        pass
    # Try any visible math captcha span
    try:
        return driver.find_element(By.CSS_SELECTOR, ".captcha-text").text.strip()
    except Exception:
        pass
    return ""


def make_pdf_url(href: str) -> str:
    href = href.strip()
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return f"https://ksp.karnataka.gov.in{href}"
    return f"https://ksp.karnataka.gov.in/firsearch/{href}"


# ── Core Functions ────────────────────────────────────────────────────────────
def fetch_single_fir(district_id: str, station_id: str, fir_num: str, year: str) -> dict:
    """
    Fetch a single FIR PDF from the KSP portal via SmartBrowz.

    Returns one of:
      {"status": "found", "pdf_b64": "...", "pdf_url": "...", "fir_metadata": {...}}
      {"status": "not_found"}
      {"status": "error", "message": "..."}
    """
    driver = make_driver()
    try:
        log.info(f"KSP FIR lookup: district={district_id} station={station_id} fir={fir_num} year={year}")
        try:
            driver.get(BASE_URL)
        except Exception as te:
            log.warning(f"driver.get initial navigation warning/timeout: {te}")

        # ── Select District ──────────────────────────────────────────────────
        dist_sel = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.NAME, "district_id"))
        )
        Select(dist_sel).select_by_value(str(district_id))
        log.info("District selected")

        # ── Wait for Station Dropdown to populate ────────────────────────────
        WebDriverWait(driver, 25).until(
            lambda d: len(Select(d.find_element(By.NAME, "ps_id")).options) > 1
        )
        ps_elem = driver.find_element(By.NAME, "ps_id")
        ps_select = Select(ps_elem)

        # Resilient station selection: try value first, then fallback to first valid station
        try:
            ps_select.select_by_value(str(station_id))
        except Exception:
            log.warning(f"Station ID '{station_id}' not found in dropdown, falling back to first available station")
            valid_opts = [opt for opt in ps_select.options if opt.get_attribute("value") not in ("", "1")]
            if valid_opts:
                ps_select.select_by_value(valid_opts[0].get_attribute("value"))
            else:
                ps_select.select_by_index(1)

        log.info("Station selected")

        # Grab station name for metadata
        station_name = ""
        try:
            station_name = ps_select.first_selected_option.text.strip()
        except Exception:
            pass

        # ── Select Year ──────────────────────────────────────────────────────
        try:
            year_sel = driver.find_element(By.NAME, "year")
            Select(year_sel).select_by_value(str(year))
        except Exception:
            log.warning("Year dropdown not found — proceeding without year selection")

        # ── FIR Number ───────────────────────────────────────────────────────
        fir_input = driver.find_element(By.NAME, "fir_num")
        fir_input.clear()
        fir_input.send_keys(str(fir_num).zfill(4))

        # ── CAPTCHA ──────────────────────────────────────────────────────────
        captcha = get_captcha(driver)
        if not captcha:
            log.error("Could not read CAPTCHA from KSP page")
            return {"status": "error", "message": "Could not read CAPTCHA from KSP page"}

        cap_input = driver.find_element(By.NAME, "captcha")
        cap_input.clear()
        cap_input.send_keys(captcha)
        log.info(f"CAPTCHA filled: {captcha}")

        # ── Submit ───────────────────────────────────────────────────────────
        before_handles = set(driver.window_handles)
        submit_btn = driver.find_element(
            By.CSS_SELECTOR, "input[type='submit'], button[type='submit']"
        )
        submit_btn.click()

        # Wait for result: new tab OR results on same page
        try:
            WebDriverWait(driver, 15).until(
                lambda d: len(d.window_handles) > len(before_handles)
                or "no records" in d.page_source.lower()
                or d.find_elements(By.CLASS_NAME, "firsearchc")
            )
        except Exception:
            pass  # proceed and parse whatever is there

        # Switch to new tab if opened
        after_handles = set(driver.window_handles)
        new_tabs = after_handles - before_handles
        if new_tabs:
            driver.switch_to.window(new_tabs.pop())

        # ── Parse Result Page ────────────────────────────────────────────────
        html = driver.page_source
        soup = BeautifulSoup(html, "html.parser")

        if "no records" in html.lower() or "no fir" in html.lower():
            log.info("KSP returned no records")
            return {"status": "not_found"}

        # Find PDF link
        a_tag = soup.find("a", href=re.compile(r'\.pdf', re.I))
        if not a_tag:
            table = soup.find("table", {"class": "firsearchc"})
            if not table:
                log.info("No PDF link and no result table — FIR not found")
                return {"status": "not_found"}
            log.warning("Result table found but no PDF link — possible CAPTCHA failure")
            return {"status": "error", "message": "Result found but PDF link missing. Possible CAPTCHA failure."}

        pdf_url = make_pdf_url(a_tag["href"])
        log.info(f"PDF URL: {pdf_url}")

        # ── Fetch PDF via JS (preserves session cookies) ─────────────────────
        b64 = driver.execute_async_script("""
            var done = arguments[arguments.length - 1];
            fetch(arguments[0], { credentials: 'include' })
              .then(function(r) { return r.blob(); })
              .then(function(blob) {
                var reader = new FileReader();
                reader.onload = function() {
                  done(reader.result.split(',')[1]);
                };
                reader.readAsDataURL(blob);
              })
              .catch(function(err) { done(null); });
        """, pdf_url)

        if not b64:
            return {"status": "error", "message": "PDF download failed (fetch returned null)"}

        log.info(f"PDF fetched, b64 length={len(b64)}")
        return {
            "status": "found",
            "pdf_b64": b64,
            "pdf_url": pdf_url,
            "fir_metadata": {
                "district_id": district_id,
                "station_id": station_id,
                "station_name": station_name,
                "fir_number": str(fir_num).zfill(4),
                "year": year,
            },
        }

    except Exception as e:
        log.error(f"fetch_single_fir unhandled error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
    finally:
        try:
            driver.quit()
        except Exception:
            pass


def fetch_stations_for_district(district_id: str) -> list:
    """Return list of {'id': ..., 'name': ...} for a given district."""
    driver = make_driver()
    stations = []
    try:
        try:
            driver.get(BASE_URL)
        except Exception as te:
            log.warning(f"driver.get initial navigation warning/timeout: {te}")

        dist_sel = WebDriverWait(driver, 25).until(
            EC.presence_of_element_located((By.NAME, "district_id"))
        )
        Select(dist_sel).select_by_value(str(district_id))

        WebDriverWait(driver, 20).until(
            lambda d: len(Select(d.find_element(By.NAME, "ps_id")).options) > 1
        )
        ps_elem = driver.find_element(By.NAME, "ps_id")
        sel_obj = Select(ps_elem)
        for opt in sel_obj.options:
            sid = opt.get_attribute("value")
            sname = opt.text.strip()
            if sid and sid not in ("", "1") and "Select" not in sname:
                stations.append({"id": sid, "name": sname})
        log.info(f"Loaded {len(stations)} stations for district {district_id}")
    except Exception as e:
        log.error(f"fetch_stations_for_district error: {e}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass
    return stations
