import sqlite3
from contextlib import contextmanager
from config import config


@contextmanager
def get_db():
    """Context manager for SQLite connections."""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def query(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a query and return all rows as dicts."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    """Execute a query and return a single row as dict."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None


def query_scalar(sql: str, params: tuple = ()):
    """Execute a query and return a single scalar value."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        return row[0] if row else None


def execute(sql: str, params: tuple = ()) -> int:
    """Execute a write/update query and return the last row ID (if INSERT) or rowcount."""
    with get_db() as conn:
        cursor = conn.execute(sql, params)
        conn.commit()
        result = cursor.lastrowid if cursor.lastrowid else cursor.rowcount

    # Trigger async/background backup of the database to Catalyst File Store
    try:
        from services.catalyst_db_sync import upload_db_to_catalyst
        upload_db_to_catalyst()
    except Exception as sync_err:
        print(f"[DB Sync] Warning: failed to backup SQLite to Catalyst: {sync_err}")

    return result

