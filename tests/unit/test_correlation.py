import datetime
import pytest
from backend.app.database.models import WeatherObservation, TrafficObservation
from backend.app.intelligence.rules import (
    haversine_distance_km,
    is_within_time_window,
    evaluate_scenario_d_rule,
)


def test_haversine_distance():
    # Same point
    assert haversine_distance_km(28.5672, 77.2100, 28.5672, 77.2100) == 0.0

    # AIIMS to Connaught Place (~7.1 km)
    dist = haversine_distance_km(28.5672, 77.2100, 28.6304, 77.2177)
    assert 6.8 <= dist <= 7.4


def test_time_window_check():
    # 18:00 IST is 12:30 UTC
    dt_in_window = datetime.datetime(2026, 10, 9, 12, 30, tzinfo=datetime.timezone.utc).replace(tzinfo=None)
    assert is_within_time_window(dt_in_window, "17:30", "20:30") is True

    # 15:00 IST is 09:30 UTC (outside evening window)
    dt_out_window = datetime.datetime(2026, 10, 9, 9, 30, tzinfo=datetime.timezone.utc).replace(tzinfo=None)
    assert is_within_time_window(dt_out_window, "17:30", "20:30") is False


def test_scenario_d_rule_success():
    """Phase 0 Acceptance Test: Synthetic 12 mm/hr rain + 7.5 jam factor triggers Scenario D."""
    now = datetime.datetime(2026, 10, 9, 13, 0)  # 18:30 IST (in window)

    weather = WeatherObservation(
        id=101,
        source_id="weatherapi",
        source_record_id="w-101",
        location_name="Delhi AIIMS Ring Road",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=15),
        temperature_c=24.0,
        precipitation_mm=12.0,  # > 8.0
        condition_text="Heavy rain",
    )

    traffic = TrafficObservation(
        id=202,
        source_id="here_traffic",
        source_record_id="t-202",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,  # ~130 meters away (< 5 km)
        observed_at=now - datetime.timedelta(minutes=10),
        jam_factor=7.5,  # > 6.5
        delay_seconds=1800,
        road_name="Ring Road",
    )

    res = evaluate_scenario_d_rule(
        weather=weather,
        traffic=traffic,
        area_label="Delhi AIIMS Ring Road",
        reference_time_utc=now,
        enforce_time_window=True,
    )

    assert res.matched is True
    assert res.insight is not None
    assert res.insight.headline.startswith("Monsoon Commute Alert")
    assert res.insight.evidence_quality == "supported"
    assert res.insight.composite_severity == "high"
    assert len(res.insight.signals) == 2
    assert res.supporting_weather_id == 101
    assert res.supporting_traffic_id == 202


def test_scenario_d_rejects_light_rain():
    now = datetime.datetime(2026, 10, 9, 13, 0)
    weather = WeatherObservation(
        id=101,
        source_record_id="w-101",
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=10),
        precipitation_mm=2.5,  # below 8.0 threshold
        temperature_c=25.0,
        condition_text="Light drizzle",
    )
    traffic = TrafficObservation(
        id=202,
        source_record_id="t-202",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=5),
        jam_factor=7.5,
    )

    res = evaluate_scenario_d_rule(
        weather=weather,
        traffic=traffic,
        area_label="AIIMS",
        reference_time_utc=now,
        enforce_time_window=False,
    )
    assert res.matched is False
    assert "below threshold" in res.reason


def test_scenario_d_rejects_geographically_distant_signals():
    now = datetime.datetime(2026, 10, 9, 13, 0)
    weather = WeatherObservation(
        id=101,
        source_record_id="w-101",
        location_name="AIIMS Delhi",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=10),
        precipitation_mm=12.0,
        temperature_c=24.0,
        condition_text="Heavy rain",
    )
    traffic = TrafficObservation(
        id=202,
        source_record_id="t-202",
        incident_type="CONGESTION",
        latitude=28.7144,
        longitude=77.1197,  # Rohini Sector 11 (~18 km away from AIIMS)
        observed_at=now - datetime.timedelta(minutes=5),
        jam_factor=8.0,
    )

    res = evaluate_scenario_d_rule(
        weather=weather,
        traffic=traffic,
        area_label="AIIMS Delhi",
        reference_time_utc=now,
        enforce_time_window=False,
        max_radius_km=5.0,
    )
    assert res.matched is False
    assert "Geographically unrelated" in res.reason


def test_scenario_d_rejects_stale_weather():
    now = datetime.datetime(2026, 10, 9, 13, 0)
    weather = WeatherObservation(
        id=101,
        source_record_id="w-101",
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=95),  # 95 min old (> 60m limit)
        precipitation_mm=14.0,
        temperature_c=24.0,
        condition_text="Heavy rain",
    )
    traffic = TrafficObservation(
        id=202,
        source_record_id="t-202",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=5),
        jam_factor=8.0,
    )

    res = evaluate_scenario_d_rule(
        weather=weather,
        traffic=traffic,
        area_label="AIIMS",
        reference_time_utc=now,
        enforce_time_window=False,
    )
    assert res.matched is False
    assert "Stale weather signal" in res.reason
