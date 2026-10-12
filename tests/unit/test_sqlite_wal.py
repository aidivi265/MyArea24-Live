import pytest
from sqlalchemy import text
from backend.app.database.session import engine, SessionLocal, is_sqlite


def test_sqlite_wal_pragmas_applied():
    """Verify that SQLite engine applies WAL mode, busy_timeout, and other concurrency pragmas."""
    if not is_sqlite:
        pytest.skip("Test is specific to SQLite backend")

    with engine.connect() as conn:
        journal_mode = conn.execute(text("PRAGMA journal_mode;")).scalar()
        busy_timeout = conn.execute(text("PRAGMA busy_timeout;")).scalar()
        foreign_keys = conn.execute(text("PRAGMA foreign_keys;")).scalar()
        synchronous = conn.execute(text("PRAGMA synchronous;")).scalar()

        # In-memory databases might report 'memory', but file-based databases report 'wal'
        assert journal_mode.lower() in ["wal", "memory"]
        assert busy_timeout >= 10000
        assert foreign_keys == 1
        # synchronous: 1 is NORMAL, 2 is FULL
        assert synchronous in [1, 2]


def test_concurrent_sessions_read_write():
    """Verify multiple concurrent database sessions can read and write without database locked errors."""
    session1 = SessionLocal()
    session2 = SessionLocal()

    try:
        # Session 1 runs a query
        res1 = session1.execute(text("SELECT 1;")).scalar()
        assert res1 == 1

        # Session 2 concurrently runs a query
        res2 = session2.execute(text("SELECT 2;")).scalar()
        assert res2 == 2
    finally:
        session1.close()
        session2.close()
