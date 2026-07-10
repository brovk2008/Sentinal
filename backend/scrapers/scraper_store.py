"""
scraper_store.py
Storage layer for scraped FIR data.
  - Metadata → sentinal.db (SQLite) via fir_scrape_index table
  - PDFs     → Catalyst Stratus (S3-style blob storage)
"""

import os
import sqlite3
import logging

log = logging.getLogger(__name__)

DB_PATH        = os.getenv("DB_PATH", "data/sentinal.db")
STRATUS_BUCKET = os.getenv("STRATUS_BUCKET", "sentinal-fir-pdfs")


# ── DB init ───────────────────────────────────────────────────────────────────

def init_scrape_table():
    """
    Creates fir_scrape_index table if it doesn't exist.
    Call once at startup from main.py lifespan.
    """
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS fir_scrape_index (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            district_id     INTEGER,
            district        TEXT,
            police_station  TEXT,
            station_id      TEXT,
            fir_number      TEXT,
            year            TEXT,
            status          TEXT,           -- found | found_no_pdf | not_found | error
            pdf_stratus_key TEXT,           -- e.g. "2024/5/PS001/0023.pdf"
            scraped_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    con.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fir_unique
        ON fir_scrape_index(district_id, station_id, fir_number, year)
    """)
    con.commit()
    con.close()
    log.info("fir_scrape_index table initialised")


def fir_already_scraped(district_id, station_id, fir_number, year) -> bool:
    con = sqlite3.connect(DB_PATH)
    row = con.execute(
        "SELECT status FROM fir_scrape_index "
        "WHERE district_id=? AND station_id=? AND fir_number=? AND year=?",
        (district_id, station_id, fir_number, year)
    ).fetchone()
    con.close()
    return row is not None and row[0] != "error"


def save_fir_metadata(district_id, district, police_station, station_id,
                      fir_number, year, status, pdf_stratus_key=""):
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        INSERT OR REPLACE INTO fir_scrape_index
        (district_id, district, police_station, station_id,
         fir_number, year, status, pdf_stratus_key)
        VALUES (?,?,?,?,?,?,?,?)
    """, (district_id, district, police_station, station_id,
          fir_number, year, status, pdf_stratus_key))
    con.commit()
    con.close()


def query_firs(year=None, district=None, station=None,
               status=None, limit=100) -> list:
    """
    Flexible query used by AI agent and UI search.
    All params optional — pass what you have.
    """
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    sql  = "SELECT * FROM fir_scrape_index WHERE 1=1"
    args = []
    if year:     sql += " AND year=?";                  args.append(year)
    if district: sql += " AND district LIKE ?";         args.append(f"%{district}%")
    if station:  sql += " AND police_station LIKE ?";   args.append(f"%{station}%")
    if status:   sql += " AND status=?";                args.append(status)
    sql += " ORDER BY scraped_at DESC LIMIT ?"
    args.append(limit)
    rows = [dict(r) for r in con.execute(sql, args).fetchall()]
    con.close()
    return rows


# ── Stratus (PDF storage) ─────────────────────────────────────────────────────

def upload_pdf_to_stratus(pdf_bytes: bytes, district_id, station_id,
                           fir_number, year):
    """
    Uploads PDF bytes to Catalyst Stratus.
    Returns the object key on success, None on failure.
    Object key format: "YEAR/DISTRICT_ID/STATION_ID/FIRNUMBER.pdf"
    e.g. "2024/5/PS001/0023.pdf"
    """
    key = f"{year}/{district_id}/{station_id}/{fir_number}.pdf"
    try:
        import zcatalyst_sdk as catalyst
        app     = catalyst.initialize()
        stratus = app.stratus()
        bucket  = stratus.bucket(STRATUS_BUCKET)
        bucket.upload_object(key, pdf_bytes, content_type="application/pdf")
        log.info(f"Stratus upload OK: {key}")
        return key
    except Exception as e:
        log.error(f"Stratus upload failed for {key}: {e}")
        return None


def get_pdf_download_url(stratus_key: str):
    """
    Returns a signed/direct URL to a stored FIR PDF from Stratus.
    """
    try:
        import zcatalyst_sdk as catalyst
        app     = catalyst.initialize()
        stratus = app.stratus()
        bucket  = stratus.bucket(STRATUS_BUCKET)
        url     = bucket.get_object_url(stratus_key)
        return url
    except Exception as e:
        log.error(f"Failed to get Stratus URL for {stratus_key}: {e}")
        return None
