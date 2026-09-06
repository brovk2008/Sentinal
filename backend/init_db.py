"""
init_db.py — Project Sentinal v2
Creates all SQLite tables that don't originate from the pre-populated sentinal.db.
Also seeds minimal synthetic data so every feature works immediately on fresh container start.
Call init_all_tables() from main.py lifespan.
"""
import sqlite3
import json
import random
import os
import shutil
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


def create_uploaded_files_table():
    _exec("""
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id          TEXT PRIMARY KEY,
            case_id     TEXT,
            filename    TEXT,
            label       TEXT,
            entity_type TEXT,
            file_type   TEXT,
            mime_type   TEXT,
            stratus_key TEXT,
            stratus_url TEXT,
            file_size   INTEGER,
            extracted_text TEXT,
            zia_metadata   TEXT,
            rag_synced     INTEGER DEFAULT 0,
            uploaded_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)


def create_scrape_table():
    try:
        from scrapers.scraper_store import init_scrape_table
        init_scrape_table()
    except Exception as e:
        _exec("""
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

def create_ocr_records_table():
    _exec("""
        CREATE TABLE IF NOT EXISTS ocr_records (
            id              TEXT PRIMARY KEY,
            fir_number      TEXT,
            year            TEXT,
            district_id     TEXT,
            district_name   TEXT,
            station_id      TEXT,
            station_name    TEXT,
            act_section     TEXT,
            crime_group     TEXT,
            extracted_text  TEXT,
            translated_text TEXT,
            parsed_data     TEXT,
            user_id         TEXT DEFAULT 'anonymous',
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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


# ─── Phase 1 Advanced Architecture Tables ───────────────────────────────────

def create_entity_aliases():
    """
    Entity disambiguation alias index.
    Maps all raw name variants → canonical entity IDs.
    This is the core deduplication table for the ELP ontology.
    """
    _exec("""
        CREATE TABLE IF NOT EXISTS entity_aliases (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            alias_raw           TEXT NOT NULL,
            alias_normalized    TEXT NOT NULL,
            canonical_id        TEXT NOT NULL,
            entity_type         TEXT NOT NULL DEFAULT 'PERSON',
            similarity_score    REAL DEFAULT 1.0,
            merged_at           TEXT DEFAULT (datetime('now')),
            UNIQUE(alias_normalized, entity_type)
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS idx_alias_norm ON entity_aliases(alias_normalized, entity_type)")
    _exec("CREATE INDEX IF NOT EXISTS idx_alias_canon ON entity_aliases(canonical_id)")


def create_ontology_links():
    """
    Explicit ELP link storage for graph edges that can't be derived
    purely from existing relational tables (e.g., analyst-asserted links,
    AI-inferred links, cross-source links).
    Core table traversal still uses SQLite recursive CTEs against CaseMaster,
    Accused, etc. This table supplements with explicit/inferred links.
    """
    _exec("""
        CREATE TABLE IF NOT EXISTS ontology_links (
            link_id             INTEGER PRIMARY KEY AUTOINCREMENT,
            src_entity_type     TEXT NOT NULL,
            src_entity_id       TEXT NOT NULL,
            link_type           TEXT NOT NULL,
            dst_entity_type     TEXT NOT NULL,
            dst_entity_id       TEXT NOT NULL,
            weight              REAL DEFAULT 1.0,
            confidence          REAL DEFAULT 1.0,
            properties_json     TEXT DEFAULT '{}',
            source              TEXT DEFAULT 'ANALYST',
            rec_id              TEXT,               -- AI recommendation that created this link
            created_at          TEXT DEFAULT (datetime('now')),
            created_by          TEXT DEFAULT 'system'
        )
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_ontology_src
        ON ontology_links(src_entity_type, src_entity_id)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_ontology_dst
        ON ontology_links(dst_entity_type, dst_entity_id)
    """)
    _exec("""
        CREATE INDEX IF NOT EXISTS idx_ontology_type
        ON ontology_links(link_type)
    """)


def create_ai_action_log():
    """
    Immutable append-only audit log for all AI recommendations and analyst decisions.
    This is the core accountability table — no rows are ever updated or deleted.

    Lifecycle:
      INSERT when: AI generates a recommendation (GraphRAG, predict, brain)
      UPDATE analyst_decision when: analyst confirms, rejects, or escalates
      INSERT outcome_written_back when: analyst action has a measurable result
    """
    _exec("""
        CREATE TABLE IF NOT EXISTS ai_action_log (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            rec_id                  TEXT NOT NULL UNIQUE,       -- UUID for this AI recommendation
            analyst_id              TEXT DEFAULT 'system',
            ai_prompt_hash          TEXT,                       -- SHA-256 of the original prompt
            ai_prompt_summary       TEXT,                       -- First 300 chars of prompt
            ai_recommendation       TEXT,                       -- Full AI output (capped 2000 chars)
            analyst_decision        TEXT DEFAULT 'PENDING',     -- PENDING | CONFIRMED | REJECTED | ESCALATED
            analyst_note            TEXT,
            outcome_written_back    INTEGER DEFAULT 0,          -- 1 if analyst action was applied to DB
            model_name              TEXT,                       -- Which model generated this
            entity_ids              TEXT DEFAULT '[]',          -- JSON array of affected entity IDs
            created_at              TEXT NOT NULL,
            decided_at              TEXT,
            expires_at              TEXT                        -- For time-boxed recommendations
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS idx_ailog_rec ON ai_action_log(rec_id)")
    _exec("CREATE INDEX IF NOT EXISTS idx_ailog_analyst ON ai_action_log(analyst_id)")
    _exec("CREATE INDEX IF NOT EXISTS idx_ailog_decision ON ai_action_log(analyst_decision)")
    _exec("CREATE INDEX IF NOT EXISTS idx_ailog_created ON ai_action_log(created_at)")


def create_etas_events_cache():
    """
    Persistent event cache for ETAS contagion model.
    Allows the ETAS engine to survive container restarts without re-loading from DB.
    Synced with CaseMaster via a background job on each new incident INSERT.
    """
    _exec("""
        CREATE TABLE IF NOT EXISTS etas_event_cache (
            event_id            TEXT PRIMARY KEY,
            lat                 REAL NOT NULL,
            lng                 REAL NOT NULL,
            timestamp           TEXT NOT NULL,
            crime_type          TEXT,
            magnitude           REAL DEFAULT 1.0,
            cached_at           TEXT DEFAULT (datetime('now'))
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS idx_etas_ts ON etas_event_cache(timestamp)")
    _exec("CREATE INDEX IF NOT EXISTS idx_etas_type ON etas_event_cache(crime_type)")


def create_mo_fingerprints():
    """
    Stores computed Modus Operandi TF-IDF fingerprint vectors for cases.
    Used by the MO clustering engine to find series linkages without
    re-computing vectors on every query.
    """
    _exec("""
        CREATE TABLE IF NOT EXISTS mo_fingerprints (
            case_master_id      INTEGER PRIMARY KEY,
            mo_cluster_id       INTEGER,                -- Which MO series this case belongs to
            mo_vector_json      TEXT,                   -- JSON-serialized sparse TF-IDF vector
            target_category     TEXT,
            execution_method    TEXT,
            time_window         TEXT,
            crime_type_bucket   TEXT,
            fingerprinted_at    TEXT DEFAULT (datetime('now'))
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS idx_mo_cluster ON mo_fingerprints(mo_cluster_id)")


def create_evidence_chain_of_custody():
    """
    Forensic proof & chain-of-custody table compliant with Sec 65B of Indian Evidence Act.
    Stores SHA-256 / SHA-512 cryptographic digests, Merkle leaf hashes, officer IDs,
    and storage URLs for every piece of uploaded evidence.
    """
    _exec("""
        CREATE TABLE IF NOT EXISTS evidence_chain_of_custody (
            certificate_id      TEXT PRIMARY KEY,
            file_id             TEXT NOT NULL,
            filename            TEXT NOT NULL,
            file_size_bytes     INTEGER NOT NULL,
            mime_type           TEXT NOT NULL,
            sha256_hash         TEXT NOT NULL,
            sha512_hash         TEXT NOT NULL,
            merkle_leaf_hash    TEXT NOT NULL,
            officer_id          TEXT DEFAULT 'system',
            case_id             TEXT,
            stratus_url         TEXT NOT NULL,
            evidence_category   TEXT DEFAULT 'DOCUMENT',
            created_at          TEXT NOT NULL,
            is_verified         INTEGER DEFAULT 1
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS idx_ev_sha256 ON evidence_chain_of_custody(sha256_hash)")
    _exec("CREATE INDEX IF NOT EXISTS idx_ev_file ON evidence_chain_of_custody(file_id)")
    _exec("CREATE INDEX IF NOT EXISTS idx_ev_case ON evidence_chain_of_custody(case_id)")


def seed_case_10042():
    """Seed synthetic FIR Case 10042 for Koramangala PS (Sneha Ramaiah Robbery)."""
    con = _con()
    try:
        # Check if CaseMaster 10042 exists
        row = con.execute("SELECT CaseMasterID FROM CaseMaster WHERE CaseMasterID = 10042").fetchone()
        if not row:
            con.execute("""
                INSERT OR REPLACE INTO CaseMaster (
                    CaseMasterID, CrimeNo, CaseNo, CrimeRegisteredDate,
                    PolicePersonID, PoliceStationID, CaseCategoryID, GravityOffenceID,
                    CrimeMajorHeadID, CrimeMinorHeadID, CaseStatusID, CourtID,
                    IncidentFromDate, IncidentToDate, InfoReceivedPSDate,
                    Latitude, Longitude, BriefFacts
                ) VALUES (
                    10042, '1044300062026 00001', '202600001', '2026-03-14',
                    'EMP-3817', 'PS-0006', 1, 2,
                    'CH-01', 'CSH-004', 3, 'CRT-011',
                    '2026-03-13 21:30', '2026-03-13 22:10', '2026-03-13 23:05',
                    12.934567, 77.610234,
                    'The complainant, Sneha Ramaiah, reported that while returning home from her workplace at approximately 21:30 hrs on 13-Mar-2026, two unknown male persons on a motorcycle (No. KA-05-EF-7823) forcibly snatched her handbag containing cash of Rs 18,500/-, one gold chain (approx 10 grams), and a Samsung Galaxy S23 mobile phone. The accused persons fled towards Outer Ring Road. A case of robbery u/s BNS 309 has been registered.'
                )
            """)
            con.execute("""
                INSERT OR REPLACE INTO Accused (AccusedMasterID, CaseMasterID, PersonID, AccusedName, AgeYear, GenderID)
                VALUES (7701, 10042, 'A1', 'Manjunath Gowda', 34, 'M'),
                       (7702, 10042, 'A2', 'Praveen Shetty', 28, 'M')
            """)
            con.execute("""
                INSERT OR REPLACE INTO Victim (VictimMasterID, CaseMasterID, VictimName, AgeYear, GenderID, VictimPolice)
                VALUES (5501, 10042, 'Sneha Ramaiah', 29, 'F', 0)
            """)
            con.execute("""
                INSERT OR REPLACE INTO ArrestSurrender (ArrestSurrenderID, CaseMasterID, Type, Date, StateID, DistrictID, PoliceStationID, IOID, CourtID, AccusedMasterID, IsAccused, IsComplainantAccused)
                VALUES (3301, 10042, 1, '2026-03-16', 'ST-29', 'DIST-443', 'PS-0006', 'EMP-3817', 'CRT-011', 7701, 1, 0),
                       (3302, 10042, 1, '2026-03-17', 'ST-29', 'DIST-443', 'PS-0006', 'EMP-3817', 'CRT-011', 7702, 1, 0)
            """)
            con.commit()
            print("[init_db] Seeded CaseMaster 10042 (Koramangala Robbery).")
    except Exception as e:
        print(f"[init_db] Notice seeding Case 10042: {e}")
    finally:
        con.close()


# ─── Main entry point ───────────────────────────────────────────────────────

def init_all_tables():
    """Call this from main.py lifespan to ensure all tables exist."""
    print("[init_db] Initializing all dynamic tables...")
    try:
        # If in AppSail production, copy bundled sentinal.db to /tmp/sentinal.db if needed
        if config.DB_PATH.startswith("/tmp/"):
            need_copy = not os.path.exists(config.DB_PATH) or os.path.getsize(config.DB_PATH) < 1000000
            if need_copy:
                bundled_db = os.path.join(os.path.dirname(__file__), "data", "sentinal.db")
                if os.path.exists(bundled_db):
                    print(f"[init_db] Copying pre-populated database ({os.path.getsize(bundled_db)} bytes) from {bundled_db} to {config.DB_PATH}...")
                    try:
                        shutil.copyfile(bundled_db, config.DB_PATH)
                        print("[init_db] Database copied successfully.")
                    except Exception as ce:
                        print(f"[init_db] Error copying database: {ce}")
                else:
                    print(f"[init_db] WARNING: Bundled database not found at {bundled_db}")

        # ── Core tables (pre-existing) ────────────────────────────────────
        create_financial_transactions()
        create_cdr_records()
        create_evidence_boards()
        create_investigation_reports()
        create_crime_syndicates()
        create_uploaded_files_table()
        create_scrape_table()
        create_ocr_records_table()

        # ── Advanced Architecture v2 tables (Phase 1 overhaul) ────────────
        create_entity_aliases()
        create_ontology_links()
        create_ai_action_log()
        create_etas_events_cache()
        create_mo_fingerprints()
        create_evidence_chain_of_custody()

        # Seed synthetic data if tables are empty
        seed_financial_transactions()
        seed_cdr_records()
        seed_evidence_boards()
        seed_crime_syndicates()
        seed_case_10042()

        # ── Lazy alias index build (background thread) ─────────────────────
        try:
            import threading
            def _build_alias_index():
                try:
                    from services.entity_resolver import get_resolver
                    resolver = get_resolver()
                    resolver.build_alias_index(limit=5000)
                    print("[init_db] Entity alias index built successfully.")
                except Exception as e:
                    print(f"[init_db] Alias index build error: {e}")
            threading.Thread(target=_build_alias_index, daemon=True).start()
        except Exception as bg_err:
            print(f"[init_db] Background alias index build failed to start: {bg_err}")

        # ── ETAS: Pre-warm event cache ─────────────────────────────────────
        try:
            import threading
            def _prewarm_etas():
                try:
                    from services.etas_engine import get_etas_engine
                    engine = get_etas_engine()
                    print(f"[init_db] ETAS engine pre-warmed: {len(engine._recent_events)} events cached.")
                except Exception as e:
                    print(f"[init_db] ETAS pre-warm error: {e}")
            threading.Thread(target=_prewarm_etas, daemon=True).start()
        except Exception as etas_err:
            print(f"[init_db] ETAS pre-warm failed to start: {etas_err}")

        print("[init_db] All tables ready (v2 advanced architecture).")
    except Exception as e:
        import traceback
        print(f"[init_db] ERROR: {e}\n{traceback.format_exc()}")
