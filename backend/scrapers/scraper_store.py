"""
scraper_store.py
Storage layer for scraped FIR data.
  - Metadata → sentinal.db (fir_scrape_index table)
  - PDFs     → Catalyst Stratus
"""

import os, sqlite3, logging

log            = logging.getLogger(__name__)
DB_PATH        = os.getenv("DB_PATH", "data/sentinal.db")
STRATUS_BUCKET = os.getenv("STRATUS_BUCKET", "sentinal-fir-pdfs")


def init_scrape_table():
    """Create fir_scrape_index if it doesn't exist. Call at startup."""
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
            status          TEXT,
            pdf_stratus_key TEXT DEFAULT '',
            scraped_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    con.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fir_unique
        ON fir_scrape_index(district_id, station_id, fir_number, year)
    """)
    con.commit()
    con.close()
    log.info("fir_scrape_index ready")


def fir_already_scraped(district_id, station_id, fir_number, year) -> bool:
    try:
        con = sqlite3.connect(DB_PATH)
        row = con.execute(
            "SELECT status FROM fir_scrape_index "
            "WHERE district_id=? AND station_id=? AND fir_number=? AND year=?",
            (district_id, station_id, fir_number, year)
        ).fetchone()
        con.close()
        return row is not None and row[0] != "error"
    except:
        return False


def save_fir_metadata(district_id, district, police_station, station_id,
                      fir_number, year, status, pdf_stratus_key=""):
    try:
        con = sqlite3.connect(DB_PATH)
        con.execute("""
            INSERT OR REPLACE INTO fir_scrape_index
            (district_id, district, police_station, station_id,
             fir_number, year, status, pdf_stratus_key)
            VALUES (?,?,?,?,?,?,?,?)
        """, (district_id, district, police_station, station_id,
              fir_number, year, status, pdf_stratus_key or ""))
        con.commit()
        con.close()
    except Exception as e:
        log.error(f"save_fir_metadata failed: {e}")


def query_firs(year=None, district=None, station=None,
               status=None, limit=100) -> list:
    try:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row
        sql  = "SELECT * FROM fir_scrape_index WHERE 1=1"
        args = []
        if year:     sql += " AND year=?";                args.append(year)
        if district: sql += " AND district LIKE ?";       args.append(f"%{district}%")
        if station:  sql += " AND police_station LIKE ?"; args.append(f"%{station}%")
        if status:   sql += " AND status=?";              args.append(status)
        sql += " ORDER BY scraped_at DESC LIMIT ?"
        args.append(limit)
        rows = [dict(r) for r in con.execute(sql, args).fetchall()]
        con.close()
        return rows
    except Exception as e:
        log.error(f"query_firs failed: {e}")
        return []


def upload_pdf_to_stratus(pdf_bytes: bytes, district_id,
                           station_id, fir_number, year) -> str | None:
    """Upload PDF to Catalyst Stratus. Returns object key or None."""
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
        log.error(f"Stratus upload failed ({key}): {e}")
        # Save to /tmp as fallback so we don't lose the PDF
        try:
            tmp_path = f"/tmp/fir_{district_id}_{station_id}_{fir_number}_{year}.pdf"
            with open(tmp_path, "wb") as f:
                f.write(pdf_bytes)
            log.info(f"PDF saved to /tmp fallback: {tmp_path}")
        except:
            pass
        return None


def get_pdf_download_url(stratus_key: str) -> str | None:
    try:
        import zcatalyst_sdk as catalyst
        app     = catalyst.initialize()
        stratus = app.stratus()
        bucket  = stratus.bucket(STRATUS_BUCKET)
        return bucket.get_object_url(stratus_key)
    except Exception as e:
        log.error(f"Stratus URL failed ({stratus_key}): {e}")
        return None