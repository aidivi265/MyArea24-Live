import datetime
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import settings
from backend.app.database.models import (
    Base,
    AirQualityObservation,
    IntelligenceInsight,
    IntelligenceSignal,
    DataSource,
)
from backend.app.intelligence.rules import evaluate_scenario_e_aqi_rule
from backend.app.intelligence.correlation import CorrelationEngine


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Add openaq data source
    src = DataSource(id="openaq", name="OpenAQ CPCB Aggregator", is_active=True)
    session.add(src)
    session.commit()

    yield session
    session.close()


def test_scenario_e_severe_aqi_matched():
    now = datetime.datetime.utcnow()
    obs = AirQualityObservation(
        id=1,
        source_id="openaq",
        source_record_id="openaq:delhi_anand_vihar:1",
        station_id="8118",
        station_name="Anand Vihar, Delhi - DPCC",
        city="Delhi",
        latitude=28.6508,
        longitude=77.3152,
        observed_at=now - datetime.timedelta(minutes=30),
        aqi_value=435.0,
        aqi_category="Severe",
        prominent_pollutant="PM2.5",
        pm25=285.0,
        pm10=410.0,
    )

    res = evaluate_scenario_e_aqi_rule(
        aqi_obs=obs,
        area_label="Delhi Connaught Place",
        area_lat=28.6304,
        area_lon=77.2177,
        reference_time_utc=now,
    )

    # Anand Vihar to CP is ~9.7 km (within default 15 km)
    assert res.matched is True
    assert res.insight is not None
    assert res.insight.composite_severity == "severe"
    assert "Severe Air Quality Alert" in res.insight.headline
    assert res.insight.rule_identifier == "SCENARIO_E_AIR_QUALITY_ADVISORY"
    assert len(res.insight.signals) == 1
    assert res.insight.signals[0].type == "air_quality"
    assert "Anand Vihar" in res.insight.signals[0].metric_summary


def test_scenario_e_very_poor_aqi_matched():
    now = datetime.datetime.utcnow()
    obs = AirQualityObservation(
        id=2,
        source_id="openaq",
        source_record_id="openaq:delhi_mandir_marg:1",
        station_id="8120",
        station_name="Mandir Marg, Delhi - DPCC",
        city="Delhi",
        latitude=28.6360,
        longitude=77.2010,
        observed_at=now - datetime.timedelta(minutes=45),
        aqi_value=340.0,
        aqi_category="Very Poor",
        prominent_pollutant="PM2.5",
        pm25=165.0,
        pm10=290.0,
    )

    res = evaluate_scenario_e_aqi_rule(
        aqi_obs=obs,
        area_label="Delhi Connaught Place",
        area_lat=28.6304,
        area_lon=77.2177,
        reference_time_utc=now,
    )

    # Mandir Marg to CP is ~1.7 km
    assert res.matched is True
    assert res.insight is not None
    assert res.insight.composite_severity == "high"
    assert "Very Poor Air Quality Advisory" in res.insight.headline


def test_scenario_e_moderate_aqi_rejected():
    now = datetime.datetime.utcnow()
    obs = AirQualityObservation(
        id=3,
        source_id="openaq",
        source_record_id="openaq:blr_silk_board:1",
        station_id="7890",
        station_name="Silk Board, Bengaluru",
        city="Bengaluru",
        latitude=12.9176,
        longitude=77.6233,
        observed_at=now - datetime.timedelta(minutes=20),
        aqi_value=125.0,
        aqi_category="Moderate",
        prominent_pollutant="PM10",
    )

    res = evaluate_scenario_e_aqi_rule(
        aqi_obs=obs,
        area_label="Bengaluru Silk Board",
        area_lat=12.9176,
        area_lon=77.6233,
        reference_time_utc=now,
    )

    assert res.matched is False
    assert "below advisory threshold" in res.reason


def test_scenario_e_stale_telemetry_rejected():
    now = datetime.datetime.utcnow()
    obs = AirQualityObservation(
        id=4,
        source_id="openaq",
        source_record_id="openaq:delhi_stale:1",
        station_id="8118",
        station_name="Anand Vihar, Delhi",
        city="Delhi",
        latitude=28.6508,
        longitude=77.3152,
        observed_at=now - datetime.timedelta(minutes=240),  # 4 hours old (> 180 min max)
        aqi_value=450.0,
        aqi_category="Severe",
    )

    res = evaluate_scenario_e_aqi_rule(
        aqi_obs=obs,
        area_label="Delhi Connaught Place",
        area_lat=28.6304,
        area_lon=77.2177,
        reference_time_utc=now,
    )

    assert res.matched is False
    assert "Stale air quality telemetry" in res.reason


def test_scenario_e_distant_station_rejected():
    now = datetime.datetime.utcnow()
    # Station in Bengaluru evaluated against Delhi locality (> 1700 km away)
    obs = AirQualityObservation(
        id=5,
        source_id="openaq",
        source_record_id="openaq:blr_remote:1",
        station_id="7890",
        station_name="Silk Board, Bengaluru",
        city="Bengaluru",
        latitude=12.9176,
        longitude=77.6233,
        observed_at=now - datetime.timedelta(minutes=30),
        aqi_value=450.0,
        aqi_category="Severe",
    )

    res = evaluate_scenario_e_aqi_rule(
        aqi_obs=obs,
        area_label="Delhi Connaught Place",
        area_lat=28.6304,
        area_lon=77.2177,
        reference_time_utc=now,
    )

    assert res.matched is False
    assert "exceeds max allowable radius" in res.reason


def test_correlation_engine_runs_scenario_e(db_session):
    now = datetime.datetime.utcnow()
    obs = AirQualityObservation(
        source_id="openaq",
        source_record_id="openaq:delhi_cp_severe:1",
        station_id="8118",
        station_name="Mandir Marg CAAQMS",
        city="Delhi",
        latitude=28.6360,
        longitude=77.2010,
        observed_at=now - datetime.timedelta(minutes=25),
        aqi_value=420.0,
        aqi_category="Severe",
        prominent_pollutant="PM2.5",
        pm25=265.0,
        pm10=390.0,
    )
    db_session.add(obs)
    db_session.commit()

    engine = CorrelationEngine(db_session)
    insights = engine.run_correlation(
        reference_time_utc=now,
        run_scenario_a=False,
        run_scenario_b=False,
        run_scenario_c=False,
        run_scenario_e=True,
    )

    assert len(insights) >= 1
    aqi_insight = next((i for i in insights if i.insight_type == "air_quality_alert"), None)
    assert aqi_insight is not None
    assert aqi_insight.composite_severity == "severe"
    assert len(aqi_insight.signals) == 1
    assert aqi_insight.signals[0].signal_type == "air_quality"

    # Running correlation again: deduplication prevents double creation
    second_run = engine.run_correlation(
        reference_time_utc=now,
        run_scenario_a=False,
        run_scenario_b=False,
        run_scenario_c=False,
        run_scenario_e=True,
    )
    assert len(second_run) == 0
