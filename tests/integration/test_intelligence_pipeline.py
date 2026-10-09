import datetime
import pytest
from sqlalchemy.orm import Session

from backend.app.database.models import (
    WeatherObservation,
    TrafficObservation,
    GovernmentNotice,
    IntelligenceInsight,
    IntelligenceSignal,
)
from backend.app.intelligence.correlation import CorrelationEngine


def test_full_pipeline_multi_scenario_execution(db_session: Session):
    now = datetime.datetime.utcnow()

    # 1. Populate Weather: Heavy rain in Rohini
    weather_rohini = WeatherObservation(
        source_id="weatherapi",
        source_record_id="w-rohini-01",
        location_name="Rohini, Delhi",
        latitude=28.7041,
        longitude=77.1025,
        observed_at=now - datetime.timedelta(minutes=15),
        temperature_c=24.0,
        precipitation_mm=14.5,
        condition_text="Heavy rain and thunderstorm",
    )

    # 2. Populate Traffic: Congestion in Rohini (< 2 km away)
    traffic_rohini = TrafficObservation(
        source_id="tomtom_traffic",
        source_record_id="t-rohini-01",
        incident_type="CONGESTION",
        latitude=28.7090,
        longitude=77.1080,
        observed_at=now - datetime.timedelta(minutes=10),
        delay_seconds=1800,  # 30 mins
        criticality="major",
        road_name="Sector 10 Main Road",
    )

    # 3. Populate Standalone Critical Traffic (No weather in Connaught Place)
    traffic_cp = TrafficObservation(
        source_id="tomtom_traffic",
        source_record_id="t-cp-standalone",
        incident_type="ROAD_CLOSURE",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now - datetime.timedelta(minutes=8),
        delay_seconds=2700,  # 45 mins
        criticality="critical",
        road_name="Connaught Circus Outer Circle",
    )

    # 4. Populate Standalone Torrential Downpour (No traffic in AIIMS)
    weather_aiims = WeatherObservation(
        source_id="weatherapi",
        source_record_id="w-aiims-standalone",
        location_name="Delhi AIIMS Ring Road",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=12),
        temperature_c=22.0,
        precipitation_mm=28.0,  # Cloudburst threshold (> 20)
        condition_text="Violent cloudburst downpour",
    )

    # 5. Populate Active NDMA SACHET Emergency Notice
    notice = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="CAP-DL-2026-TEST-99",
        sender="ndma_control_room",
        event_type="Flash Flood & Waterlogging Warning",
        severity="Severe",
        urgency="Immediate",
        certainty="Observed",
        headline="Flash Flood and Waterlogging Alert for National Capital Territory of Delhi",
        description="Low-lying arterial roads inundated. Severe transit friction expected across Delhi.",
        instruction="Avoid traveling through underpasses. Monitor public announcements.",
        area_description="Delhi, Rohini, New Delhi, Central Delhi",
        circle_geojson={"latitude": 28.7041, "longitude": 77.1025, "radius_km": 20.0},
        effective_at=now - datetime.timedelta(minutes=30),
        expires_at=now + datetime.timedelta(hours=4),
        is_active=True,
    )

    db_session.add_all([weather_rohini, traffic_rohini, traffic_cp, weather_aiims, notice])
    db_session.commit()

    # Run Correlation Engine Pipeline
    engine = CorrelationEngine(db_session)
    insights = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)

    # Validate that insights were generated
    assert len(insights) >= 3

    insight_types = [i.insight_type for i in insights]
    assert "weather_traffic_correlation" in insight_types  # Scenario A
    assert "severe_public_alert" in insight_types          # Scenario B
    assert "single_signal_traffic_notice" in insight_types  # Scenario C (Traffic)
    assert "single_signal_weather_notice" in insight_types  # Scenario C (Weather)

    # Inspect Scenario A insight
    scen_a = next(i for i in insights if i.insight_type == "weather_traffic_correlation")
    assert scen_a.confidence_level == "HIGH (Multi-Source Corroborated)"
    assert scen_a.rule_identifier == "SCENARIO_A_WEATHER_TRAFFIC"
    assert len(scen_a.signals) == 2
    assert any(s.signal_type == "weather" for s in scen_a.signals)
    assert any(s.signal_type == "traffic" for s in scen_a.signals)

    # Inspect Scenario B insight
    scen_b = next(i for i in insights if i.insight_type == "severe_public_alert")
    assert scen_b.confidence_level == "HIGH (Official Emergency Authority)"
    assert scen_b.rule_identifier == "SCENARIO_B_PUBLIC_ALERT"
    assert "Avoid traveling through underpasses" in scen_b.recommendation
    assert len(scen_b.signals) == 1
    assert scen_b.signals[0].signal_type == "alert"

    # Inspect Scenario C Traffic insight
    scen_c_traffic = next(i for i in insights if i.insight_type == "single_signal_traffic_notice")
    assert scen_c_traffic.confidence_level == "MEDIUM (Single Credible Source)"
    assert scen_c_traffic.rule_identifier == "SCENARIO_C_TRAFFIC_ALERT"
    assert "Single-source telemetry" in scen_c_traffic.data_quality_notes

    # Inspect Scenario C Weather insight
    scen_c_weather = next(i for i in insights if i.insight_type == "single_signal_weather_notice")
    assert scen_c_weather.confidence_level == "MEDIUM (Single Credible Source)"
    assert scen_c_weather.rule_identifier == "SCENARIO_C_WEATHER_ALERT"

    # 6. Test Deduplication: Re-running immediately produces 0 new insights!
    second_run = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)
    assert len(second_run) == 0

    # Total in DB remains unchanged
    total_insights = db_session.query(IntelligenceInsight).count()
    assert total_insights == len(insights)


def test_pipeline_insufficient_evidence_gating(db_session: Session):
    """Signals that fail minimum evidence thresholds must NOT generate insights."""
    now = datetime.datetime.utcnow()

    # Mild rain (1.2 mm) and light delay (90s)
    weather_mild = WeatherObservation(
        source_id="weatherapi",
        source_record_id="w-mild-01",
        location_name="Rohini, Delhi",
        latitude=28.7041,
        longitude=77.1025,
        observed_at=now - datetime.timedelta(minutes=10),
        temperature_c=25.0,
        precipitation_mm=1.2,  # Too low
        condition_text="Passing light mist",
    )
    traffic_mild = TrafficObservation(
        source_id="tomtom_traffic",
        source_record_id="t-mild-01",
        incident_type="CONGESTION",
        latitude=28.7050,
        longitude=77.1030,
        observed_at=now - datetime.timedelta(minutes=10),
        delay_seconds=90,  # Too low
        criticality="minor",
        road_name="Sector 14 Alley",
    )

    db_session.add_all([weather_mild, traffic_mild])
    db_session.commit()

    engine = CorrelationEngine(db_session)
    insights = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)

    assert len(insights) == 0


def test_pipeline_stale_and_expired_signal_rejection(db_session: Session):
    """Stale observations (> 90 mins old) and expired notices must be rejected."""
    now = datetime.datetime.utcnow()

    weather_stale = WeatherObservation(
        source_id="weatherapi",
        source_record_id="w-stale-01",
        location_name="Rohini, Delhi",
        latitude=28.7041,
        longitude=77.1025,
        observed_at=now - datetime.timedelta(minutes=150),  # 2.5 hours old
        temperature_c=24.0,
        precipitation_mm=18.0,
        condition_text="Heavy rain",
    )
    traffic_stale = TrafficObservation(
        source_id="tomtom_traffic",
        source_record_id="t-stale-01",
        incident_type="CONGESTION",
        latitude=28.7050,
        longitude=77.1030,
        observed_at=now - datetime.timedelta(minutes=140),  # 2.3 hours old
        delay_seconds=2000,
        criticality="major",
    )
    notice_expired = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="CAP-EXPIRED-01",
        sender="ndma",
        event_type="Flood Warning",
        severity="Extreme",
        urgency="Immediate",
        certainty="Observed",
        headline="Expired Flood Warning",
        area_description="Delhi",
        effective_at=now - datetime.timedelta(hours=5),
        expires_at=now - datetime.timedelta(minutes=10),  # Expired
        is_active=True,
    )

    db_session.add_all([weather_stale, traffic_stale, notice_expired])
    db_session.commit()

    engine = CorrelationEngine(db_session)
    insights = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)

    assert len(insights) == 0


def test_pipeline_geographically_distant_signals_rejection(db_session: Session):
    """Heavy rain in Delhi and heavy congestion in Mumbai must not be correlated."""
    now = datetime.datetime.utcnow()

    weather_delhi = WeatherObservation(
        source_id="weatherapi",
        source_record_id="w-delhi-heavy",
        location_name="Rohini, Delhi",
        latitude=28.7041,
        longitude=77.1025,
        observed_at=now - datetime.timedelta(minutes=10),
        temperature_c=24.0,
        precipitation_mm=16.0,
        condition_text="Heavy rain",
    )
    # Traffic in Mumbai (~1150 km away)
    traffic_mumbai = TrafficObservation(
        source_id="tomtom_traffic",
        source_record_id="t-mumbai-heavy",
        incident_type="CONGESTION",
        latitude=19.0760,
        longitude=72.8777,
        observed_at=now - datetime.timedelta(minutes=10),
        delay_seconds=1800,
        criticality="major",
        road_name="Western Express Highway",
    )

    db_session.add_all([weather_delhi, traffic_mumbai])
    db_session.commit()

    engine = CorrelationEngine(db_session)
    # Only run Scenario A
    insights = engine.run_correlation(
        reference_time_utc=now,
        enforce_time_window=False,
        run_scenario_a=True,
        run_scenario_b=False,
        run_scenario_c=False,
    )

    assert len(insights) == 0


def test_pipeline_insight_expiry_lifecycle(db_session: Session):
    """Verify that expire_stale_insights marks past-expiry insights as inactive."""
    now = datetime.datetime.utcnow()

    insight = IntelligenceInsight(
        insight_type="weather_traffic_correlation",
        area_label="Test Area",
        latitude=28.70,
        longitude=77.10,
        radius_km=5.0,
        headline="Test Alert",
        summary="Summary",
        potential_impact="Impact",
        recommendation="Action",
        evidence_quality="supported",
        composite_severity="high",
        confidence_level="HIGH (Multi-Source Corroborated)",
        rule_identifier="SCENARIO_A_WEATHER_TRAFFIC",
        rule_version="1.0",
        dedup_hash="dedup-lifecycle-test",
        is_active=True,
        created_at=now - datetime.timedelta(hours=3),
        expires_at=now - datetime.timedelta(minutes=30),  # Expired 30 mins ago
    )
    db_session.add(insight)
    db_session.commit()

    engine = CorrelationEngine(db_session)
    expired_count = engine.expire_stale_insights(now)

    assert expired_count == 1
    db_session.refresh(insight)
    assert insight.is_active is False
