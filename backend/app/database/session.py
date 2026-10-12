import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# Normalize database URL (e.g. postgres:// -> postgresql:// for SQLAlchemy compatibility)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

engine_kwargs: dict = {
    "echo": False,
    "pool_pre_ping": True,
}

if is_sqlite:
    # check_same_thread=False allows FastAPI multi-threading; timeout=15 waits on locks
    engine_kwargs["connect_args"] = {
        "check_same_thread": False,
        "timeout": 15,
    }
else:
    # Production PostgreSQL connection pool configuration
    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
    engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE

engine = create_engine(db_url, **engine_kwargs)

# For SQLite: enable Write-Ahead Logging (WAL) and concurrency pragmas on connection
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            # WAL allows multiple readers and one writer concurrently without blocking readers
            cursor.execute("PRAGMA journal_mode = WAL;")
            # busy_timeout: wait up to 10000ms for busy locks before failing
            cursor.execute("PRAGMA busy_timeout = 10000;")
            # synchronous=NORMAL balances performance and durability safely in WAL mode
            cursor.execute("PRAGMA synchronous = NORMAL;")
            # Enforce foreign key constraints
            cursor.execute("PRAGMA foreign_keys = ON;")
            # Allocate 64MB memory cache for SQLite queries
            cursor.execute("PRAGMA cache_size = -64000;")
        except Exception as e:
            logger.warning(f"Could not set SQLite PRAGMA: {e}")
        finally:
            cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
