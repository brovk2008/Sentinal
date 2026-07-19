"""
init_db.py — Project Sentinal v2
Creates all SQLite tables that don't originate from the pre-populated sentinal.db.
Also seeds minimal synthetic data so every feature works immediately on fresh container start.
Call init_all_tables() from main.py lifespan.
"""
import sqlite3
import json
import random
from datetime import datetime, timedelta
from config import config

DB = config.DB_PATH

def _con():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def _exec(sql: str):
    con = _con()
    try:
        con.execute(sql)
        con.commit()
    except Exception as e:
        print(f"[init_db] DDL error: {e}\nSQL: {sql[:120]}")
    finally:
        con.close()


def _count(table: str) -> int:
    try:
        con = _con()
        row = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        con.close()
        return row[0] if row else 0
    except Exception:
        return 0


# ─── DDL ────────────────────────────────────────────────────────────────────

def create_financial_transactions():
    _exec("""
        CREATE TABLE IF NOT EXISTS financial_transactions (
            txn_id              INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_name         TEXT,
            receiver_name       TEXT,
            amount              REAL,
            txn_type            TEXT,
            txn_date            TEXT,
            is_suspicious       INTEGER DEFAULT 0,
            linked_accused_id   INTEGER,
            linked_case_id      INTEGER,
            description         TEXT
        )
    """)


def create_cdr_records():
    _exec("""
        CREATE TABLE IF NOT EXISTS cdr_records (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            caller_name         TEXT,
            receiver_name       TEXT,
            call_date           TEXT,
            call_duration_seconds INTEGER DEFAULT 0,
            tower_district_id   INTEGER,
            linked_accused_id   INTEGER,
            linked_case_id      INTEGER,
            phone               TEXT,
            called              TEXT,
            call_type_raw       TEXT,
            date                DATE,
            time                TIME,
            duration_sec        INTEGER,
            tower_id            TEXT,
            lat                 REAL,
            lng                 REAL,
            imei                TEXT,
            uploaded_at         TIMESTAMP
        )
    """)
    # Indexes for faster lookups
    con = _con()
    try:
        con.execute("CREATE INDEX IF NOT EXISTS idx_cdr_phone  ON cdr_records(phone)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_cdr_tower  ON cdr_records(tower_id)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_cdr_imei   ON cdr_records(imei)")
        con.commit()
    except Exception as e:
        print(f"[init_db] CDR index error: {e}")
    finally:
        con.close()


def create_evidence_boards():
    _exec("""
        CREATE TABLE IF NOT EXISTS evidence_boards (
            board_id    TEXT PRIMARY KEY,
            name        TEXT,
            data        TEXT,
            created_at  TEXT,
            updated_at  TEXT
        )
    """)
    _exec("""
        CREATE TABLE IF NOT EXISTS board_state (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id     TEXT NOT NULL UNIQUE,
            nodes_json  TEXT DEFAULT '[]',
            edges_json  TEXT DEFAULT '[]',
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


def create_investigation_reports():
    _exec("""
        CREATE TABLE IF NOT EXISTS investigation_reports (
            report_id       INTEGER PRIMARY KEY AUTOINCREMENT,
            title           TEXT,
            case_id         INTEGER,
            district_id     INTEGER,
            content_json    TEXT,
            generated_at    TEXT,
            classification  TEXT DEFAULT 'CONFIDENTIAL'
        )
    """)


def create_crime_syndicates():
    _exec("""
        CREATE TABLE IF NOT EXISTS crime_syndicates (
            syndicate_id        INTEGER PRIMARY KEY AUTOINCREMENT,
            syndicate_name      TEXT,
            crime_speciality    TEXT,
            total_cases         INTEGER DEFAULT 0,
            district_ids        TEXT,
            active              INTEGER DEFAULT 1
        )
    """)


def create_scrape_table():
    """Mirror of scrapers/scraper_store.py init_scrape_table() — safe to call twice."""
    _exec("""
        CREATE TABLE IF NOT EXISTS scraped_firs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            year            INTEGER,
            district_id     INTEGER,
            station_id      INTEGER,
            fir_no          TEXT,
            fir_date        TEXT,
            accused_name    TEXT,
            crime_type      TEXT,
            stratus_key     TEXT,
            scraped_at      TEXT
        )
    """)


# ─── Seed data ──────────────────────────────────────────────────────────────

NAMES = [
    "Ravi Kumar", "Suresh Rao", "Ashok Gowda", "Priya Nair", "Mohammed Imran",
    "Rajesh Babu", "Kavitha Reddy", "Santosh Hegde", "Deepa Bhat", "Vinod Kumar",
    "Manjunath Rao", "Lakshmi Devi", "Arjun Singh", "Pooja Shetty", "Kiran Naik",
]

DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8]

TXN_TYPES = ["UPI", "NEFT", "RTGS", "IMPS", "CASH", "CHEQUE"]

CRIME_SPECIALITIES = [
    "Cybercrime & UPI Fraud", "Narcotics Distribution", "Vehicle Theft Network",
    "Land Grabbing", "Extortion Ring", "Gold Smuggling", "Hawala Network",
]

SYNDICATE_NAMES = [
    "Shadow Web Collective", "Eastern District Cartel", "Coastal Smuggling Ring",
    "Tech Fraud Alliance", "North Bengaluru Gang", "Mysuru Land Mafia",
]


def seed_financial_transactions():
    if _count("financial_transactions") >= 50:
        return
    print("[init_db] Seeding financial_transactions...")
    con = _con()
    now = datetime.now()
    rows = []
    for i in range(200):
        sender   = random.choice(NAMES)
        receiver = random.choice([n for n in NAMES if n != sender])
        amount   = random.choice([
            random.uniform(10000, 100000),
            random.uniform(100000, 1000000),
            random.uniform(1000000, 5000000),
        ])
        is_susp = 1 if amount > 500000 or random.random() < 0.25 else 0
        date = (now - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")
        txn_type = random.choice(TXN_TYPES)
        accused_id = random.randint(1, 500) if random.random() < 0.4 else None
        case_id    = random.randint(1, 2000) if random.random() < 0.4 else None
        rows.append((sender, receiver, round(amount, 2), txn_type, date, is_susp,
                     accused_id, case_id, f"Transfer via {txn_type}"))
    con.executemany("""
        INSERT INTO financial_transactions
            (sender_name, receiver_name, amount, txn_type, txn_date,
             is_suspicious, linked_accused_id, linked_case_id, description)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, rows)
    con.commit()
    con.close()
    print(f"[init_db] Seeded {len(rows)} financial transactions.")


def seed_cdr_records():
    if _count("cdr_records") >= 50:
        return
    print("[init_db] Seeding cdr_records...")
    con = _con()
    now = datetime.now()
    rows = []
    towers = [f"T{d:02d}-{s:03d}" for d in DISTRICTS for s in range(1, 6)]
    for _ in range(300):
        caller   = random.choice(NAMES)
        receiver = random.choice([n for n in NAMES if n != caller])
        dur      = random.randint(10, 1800)
        dt       = (now - timedelta(days=random.randint(0, 365)))
        call_date = dt.strftime("%Y-%m-%d")
        tower_id  = random.choice(towers)
        dist_id   = random.choice(DISTRICTS)
        accused_id = random.randint(1, 500) if random.random() < 0.3 else None
        case_id    = random.randint(1, 2000) if random.random() < 0.3 else None
        phone  = f"9{random.randint(100000000, 999999999)}"
        called = f"9{random.randint(100000000, 999999999)}"
        lat = round(random.uniform(11.5, 18.5), 6)
        lng = round(random.uniform(74.0, 78.5), 6)
        imei = str(random.randint(10**14, 10**15 - 1))
        rows.append((caller, receiver, call_date, dur, dist_id,
                     accused_id, case_id, phone, called, "VOICE",
                     call_date, "10:00:00", dur, tower_id, lat, lng, imei,
                     datetime.now().isoformat()))
    con.executemany("""
        INSERT INTO cdr_records
            (caller_name, receiver_name, call_date, call_duration_seconds,
             tower_district_id, linked_accused_id, linked_case_id,
             phone, called, call_type_raw, date, time, duration_sec,
             tower_id, lat, lng, imei, uploaded_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    con.commit()
    con.close()
    print(f"[init_db] Seeded {len(rows)} CDR records.")


def seed_evidence_boards():
    if _count("evidence_boards") >= 1:
        return
    print("[init_db] Seeding evidence_boards...")
    now = datetime.now().isoformat()
    seed_data = {
        "nodes": [
            {
                "id": "node_1", "type": "case", "x": 200, "y": 150,
                "title": "Case #456 — UPI Cyber Fraud",
                "subtitle": "Bengaluru Urban · Under Investigation",
                "content": "Cyber crime cells reported 8 suspicious transactions from account 90812328.",
                "caseId": 456, "color": "var(--copper-500)",
                "tags": ["UPI Fraud", "High Gravity"]
            },
            {
                "id": "node_2", "type": "person", "x": 550, "y": 220,
                "title": "Ashok Kumar",
                "subtitle": "Suspected Syndicate Coordinator",
                "content": "Priors listed under cheating & narcotics. Active location in Hebbal.",
                "accusedId": 5, "color": "#e05252",
                "tags": ["Main Actor", "Repeat Offender"]
            },
            {
                "id": "node_3", "type": "location", "x": 380, "y": 380,
                "title": "Hebbal, Bengaluru",
                "subtitle": "Last Known Location",
                "content": "Tower triangulation places suspect here 3 days before incident.",
                "color": "#52a8e0", "tags": ["Active Zone"]
            }
        ],
        "connections": [
            {
                "id": "conn_1", "fromNodeId": "node_1", "toNodeId": "node_2",
                "label": "Primary Beneficiary", "color": "#e05252", "thickness": 2
            },
            {
                "id": "conn_2", "fromNodeId": "node_2", "toNodeId": "node_3",
                "label": "Last seen at", "color": "#52a8e0", "thickness": 1
            }
        ]
    }
    con = _con()
    con.execute("""
        INSERT OR IGNORE INTO evidence_boards (board_id, name, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    """, ("board_shadow_net", "Operation Shadow Net", json.dumps(seed_data), now, now))
    con.commit()
    con.close()
    print("[init_db] Seeded evidence_boards with board_shadow_net.")


def seed_crime_syndicates():
    if _count("crime_syndicates") >= 3:
        return
    print("[init_db] Seeding crime_syndicates...")
    con = _con()
    rows = [
        (SYNDICATE_NAMES[0], CRIME_SPECIALITIES[0], random.randint(20, 80), json.dumps([1, 2, 3])),
        (SYNDICATE_NAMES[1], CRIME_SPECIALITIES[1], random.randint(10, 50), json.dumps([4, 5])),
        (SYNDICATE_NAMES[2], CRIME_SPECIALITIES[2], random.randint(15, 60), json.dumps([6, 7, 8])),
        (SYNDICATE_NAMES[3], CRIME_SPECIALITIES[3], random.randint(30, 90), json.dumps([1, 4, 7])),
        (SYNDICATE_NAMES[4], CRIME_SPECIALITIES[4], random.randint(8, 40),  json.dumps([2, 3])),
        (SYNDICATE_NAMES[5], CRIME_SPECIALITIES[5], random.randint(5, 25),  json.dumps([5, 6])),
    ]
    con.executemany("""
        INSERT OR IGNORE INTO crime_syndicates (syndicate_name, crime_speciality, total_cases, district_ids)
        VALUES (?, ?, ?, ?)
    """, rows)
    con.commit()
    con.close()
    print(f"[init_db] Seeded {len(rows)} crime syndicates.")


# ─── Main entry point ───────────────────────────────────────────────────────

def init_all_tables():
    """Call this from main.py lifespan to ensure all tables exist."""
    print("[init_db] Initializing all dynamic tables...")
    try:
        create_financial_transactions()
        create_cdr_records()
        create_evidence_boards()
        create_investigation_reports()
        create_crime_syndicates()
        create_scrape_table()

        # Seed synthetic data if tables are empty
        seed_financial_transactions()
        seed_cdr_records()
        seed_evidence_boards()
        seed_crime_syndicates()

        print("[init_db] ✅ All tables ready.")
    except Exception as e:
        import traceback
        print(f"[init_db] ERROR: {e}\n{traceback.format_exc()}")
