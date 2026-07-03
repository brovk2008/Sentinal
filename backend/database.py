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
