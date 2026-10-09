import datetime
import pytest
from sqlalchemy.exc import IntegrityError
from backend.app.database.models import (
    DataSource,
    WeatherObservation,
    TrafficObservation,
    GovernmentNotice,
    IntelligenceInsight,
    IntelligenceSignal,
)


def test_data_source_creation(db_session):
    src = DataSource(id="weatherapi", name="WeatherAPI.com", is_active=True)
    db_session.add(src)
    db_session.commit()

    saved = db_session.query(DataSource).filter(DataSource.id == "weatherapi").first()
    assert saved is not None
    assert saved.name == "WeatherAPI.com"


def test_unique_constraint_weather_observations(db_session):
    src = DataSource(id="weatherapi", name="WeatherAPI.com")
    db_session.add(src)
    db_session.commit()

    obs1 = WeatherObservation(
        source_id="weatherapi",
        source_record_id="dup-key-1",
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=datetime.datetime.utcnow(),
        temperature_c=25.0,
        precipitation_mm=5.0,
        condition_text="Rain",
    )
    db_session.add(obs1)
    db_session.commit()

    obs2 = WeatherObservation(
        source_id="weatherapi",
        source_record_id="dup-key-1",  # duplicate record id
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=datetime.datetime.utcnow(),
        temperature_c=25.0,
        precipitation_mm=5.0,
        condition_text="Rain",
    )
    db_session.add(obs2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_insight_and_signals_persistence(db_session):
    now = datetime.datetime.utcnow()
    insight = IntelligenceInsight(
        insight_type="weather_traffic_correlation",
        area_label="Delhi AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        radius_km=5.0,
        headline="Monsoon Congestion",
        summary="High congestion with heavy rain",
        potential_impact="Delays",
        recommendation="Reroute",
        evidence_quality="supported",
        composite_severity="high",
        dedup_hash="test-hash-12345",
        is_active=True,
        created_at=now,
        expires_at=now + datetime.timedelta(hours=2),
    )
    db_session.add(insight)
    db_session.flush()

    sig = IntelligenceSignal(
        insight_id=insight.id,
        signal_type="weather",
        source_name="weatherapi",
        observation_table="weather_observations",
        observation_id=1,
        observed_at=now,
        metric_summary="Rain 12 mm/hr",
    )
    db_session.add(sig)
    db_session.commit()

    saved = db_session.query(IntelligenceInsight).filter(IntelligenceInsight.id == insight.id).first()
    assert saved is not None
    assert len(saved.signals) == 1
    assert saved.signals[0].signal_type == "weather"
