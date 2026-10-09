import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import json
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from backend.app.database.session import Base, get_db
from backend.app.main import app

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def fixtures_dir():
    return FIXTURES_DIR


@pytest.fixture(scope="function")
def db_session():
    """Provides a fresh, isolated in-memory SQLite database session for each test with StaticPool."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client(db_session):
    """Provides FastAPI test client overriding database dependency with the test session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def heavy_rain_fixture(fixtures_dir):
    with open(fixtures_dir / "weather_rain_heavy.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def light_rain_fixture(fixtures_dir):
    with open(fixtures_dir / "weather_rain_light.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def heavy_traffic_fixture(fixtures_dir):
    with open(fixtures_dir / "here_traffic_heavy.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def normal_traffic_fixture(fixtures_dir):
    with open(fixtures_dir / "here_traffic_normal.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def valid_cap_xml(fixtures_dir):
    with open(fixtures_dir / "sachet_cap_valid.xml", "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture
def expired_cap_xml(fixtures_dir):
    with open(fixtures_dir / "sachet_cap_expired.xml", "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture
def malformed_cap_xml():
    return "<alert><invalid>This is not a valid CAP XML structure</alert>"


@pytest.fixture
def tomtom_heavy_traffic_fixture(fixtures_dir):
    with open(fixtures_dir / "tomtom_traffic_heavy.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def tomtom_normal_traffic_fixture(fixtures_dir):
    with open(fixtures_dir / "tomtom_traffic_normal.json", "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def tomtom_sparse_traffic_fixture(fixtures_dir):
    with open(fixtures_dir / "tomtom_traffic_missing_metrics.json", "r", encoding="utf-8") as f:
        return json.load(f)

