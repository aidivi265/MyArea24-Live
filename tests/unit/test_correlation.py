import datetime
import pytest
from backend.app.database.models import WeatherObservation, TrafficObservation, GovernmentNotice
from backend.app.intelligence.rules import (
    haversine_distance_km,
    is_within_time_window,
    is_valid_coordinate,
    point_in_geojson_polygon,
    is_point_in_circle,
    is_notice_relevant_to_locality,
    evaluate_scenario_a_rule,
    evaluate_scenario_b_rule,
    evaluate_scenario_c_traffic_rule,
    evaluate_scenario_c_weather_rule,
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


def test_scenario_d_rule_success_tomtom():
    """Validates Scenario D correlation using TomTom delay_seconds and criticality (jam_factor is None)."""
    now = datetime.datetime(2026, 10, 9, 13, 0)  # 18:30 IST

    weather = WeatherObservation(
        id=101,
        source_id="weatherapi",
        source_record_id="w-101",
        location_name="Delhi AIIMS Ring Road",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=10),
        temperature_c=24.0,
        precipitation_mm=12.0,
        condition_text="Heavy rain",
    )

    traffic = TrafficObservation(
        id=303,
        source_id="tomtom_traffic",
        source_record_id="tomtom:inc-001",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=5),
        jam_factor=None,  # Not fabricated
        delay_seconds=1800,  # 30 mins delay
        criticality="major",
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
    assert "delay +30 mins" in res.insight.summary
    assert res.insight.composite_severity == "high"
    assert res.insight.evidence_quality == "supported"
    assert res.insight.signals[1].source == "tomtom_traffic"
    assert "Delay: +30 mins" in res.insight.signals[1].metric_summary
    assert "Criticality: major" in res.insight.signals[1].metric_summary


def test_scenario_d_rule_tomtom_critical_severity():
    """TomTom criticality='critical' escalates composite severity to 'severe'."""
    now = datetime.datetime(2026, 10, 9, 13, 0)

    weather = WeatherObservation(
        id=101,
        source_id="weatherapi",
        source_record_id="w-101",
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=10),
        precipitation_mm=10.0,
        temperature_c=24.0,
        condition_text="Heavy rain",
    )

    traffic = TrafficObservation(
        id=304,
        source_id="tomtom_traffic",
        source_record_id="tomtom:inc-002",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=5),
        jam_factor=None,
        delay_seconds=1200,
        criticality="critical",
        road_name="Ring Road",
    )

    res = evaluate_scenario_d_rule(
        weather=weather,
        traffic=traffic,
        area_label="AIIMS",
        reference_time_utc=now,
        enforce_time_window=False,
    )

    assert res.matched is True
    assert res.insight.composite_severity == "severe"


def test_scenario_d_rule_tomtom_low_delay_rejects():
    """TomTom observation with low delay (< 900s) and minor criticality fails congestion gate."""
    now = datetime.datetime(2026, 10, 9, 13, 0)

    weather = WeatherObservation(
        id=101,
        source_id="weatherapi",
        source_record_id="w-101",
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=10),
        precipitation_mm=12.0,
        temperature_c=24.0,
        condition_text="Heavy rain",
    )

    traffic = TrafficObservation(
        id=305,
        source_id="tomtom_traffic",
        source_record_id="tomtom:inc-003",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=5),
        jam_factor=None,
        delay_seconds=120,  # Only 2 mins
        criticality="minor",
        road_name="Ring Road",
    )

    res = evaluate_scenario_d_rule(
        weather=weather,
        traffic=traffic,
        area_label="AIIMS",
        reference_time_utc=now,
        enforce_time_window=False,
    )

    assert res.matched is False
    assert "Traffic below congestion threshold" in res.reason


def test_is_valid_coordinate():
    assert is_valid_coordinate(28.5672, 77.2100) is True
    assert is_valid_coordinate(0.0, 0.0) is True
    assert is_valid_coordinate(-90.0, 180.0) is True
    assert is_valid_coordinate(None, 77.21) is False
    assert is_valid_coordinate(28.5, None) is False
    assert is_valid_coordinate(95.0, 77.0) is False
    assert is_valid_coordinate(28.0, 185.0) is False
    assert is_valid_coordinate(float("nan"), 77.0) is False


def test_point_in_geojson_polygon():
    # Square around (28.6 to 28.8 lat, 77.0 to 77.2 lon)
    # GeoJSON coordinates format: [lon, lat]
    polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.0, 28.6],
                [77.2, 28.6],
                [77.2, 28.8],
                [77.0, 28.8],
                [77.0, 28.6],
            ]
        ],
    }
    # Point inside (lat=28.7, lon=77.1)
    assert point_in_geojson_polygon(28.7, 77.1, polygon) is True
    # Point outside (lat=28.9, lon=77.1)
    assert point_in_geojson_polygon(28.9, 77.1, polygon) is False
    # Empty / malformed
    assert point_in_geojson_polygon(28.7, 77.1, {}) is False
    assert point_in_geojson_polygon(28.7, 77.1, {"coordinates": []}) is False


def test_is_point_in_circle():
    circle = {
        "latitude": 28.7041,
        "longitude": 77.1025,
        "radius_km": 10.0,
    }
    # Point ~3 km away
    assert is_point_in_circle(28.72, 77.12, circle, buffer_km=2.0) is True
    # Point 30 km away
    assert is_point_in_circle(28.45, 77.02, circle, buffer_km=2.0) is False
    # Malformed
    assert is_point_in_circle(28.7, 77.1, {}) is False


def test_scenario_a_missing_or_invalid_coordinates():
    now = datetime.datetime(2026, 10, 9, 13, 0)
    weather = WeatherObservation(
        id=101,
        source_id="weatherapi",
        source_record_id="w-101",
        location_name="AIIMS",
        latitude=None,  # Missing!
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=10),
        precipitation_mm=15.0,
        temperature_c=24.0,
        condition_text="Heavy rain",
    )
    traffic = TrafficObservation(
        id=202,
        source_id="tomtom_traffic",
        source_record_id="t-202",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=5),
        delay_seconds=1800,
        criticality="major",
    )

    res = evaluate_scenario_a_rule(weather, traffic, "AIIMS", now, enforce_time_window=False)
    assert res.matched is False
    assert "Invalid or missing" in res.reason


def test_scenario_a_evidence_and_provenance_retention():
    now = datetime.datetime(2026, 10, 9, 13, 0)
    weather = WeatherObservation(
        id=101,
        source_id="weatherapi",
        source_record_id="w-101",
        location_name="AIIMS",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now - datetime.timedelta(minutes=15),
        precipitation_mm=16.0,
        temperature_c=24.0,
        condition_text="Heavy rain",
    )
    traffic = TrafficObservation(
        id=202,
        source_id="tomtom_traffic",
        source_record_id="t-202",
        incident_type="CONGESTION",
        latitude=28.5680,
        longitude=77.2110,
        observed_at=now - datetime.timedelta(minutes=10),
        delay_seconds=2500,
        criticality="critical",
        road_name="Ring Road",
    )

    res = evaluate_scenario_a_rule(weather, traffic, "AIIMS", now, enforce_time_window=False)
    assert res.matched is True
    insight = res.insight
    assert insight is not None
    assert insight.rule_identifier == "SCENARIO_A_WEATHER_TRAFFIC"
    assert insight.confidence_level == "HIGH (Multi-Source Corroborated)"
    assert insight.composite_severity == "severe"
    assert insight.data_quality_notes is not None
    assert "Corroborated across 2 independent operational streams" in insight.data_quality_notes
    assert insight.observed_at == now - datetime.timedelta(minutes=10)
    assert insight.next_review_at == now + datetime.timedelta(minutes=30)
    assert len(insight.signals) == 2
    assert insight.signals[0].freshness_minutes == 15.0
    assert insight.signals[1].freshness_minutes == 10.0


def test_scenario_b_severe_public_alert_circle_match():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    notice = GovernmentNotice(
        id=501,
        source_id="sachet_cap",
        alert_identifier="IN-DL-2026-001",
        sender="imd_delhi",
        event_type="Severe Thunderstorm",
        severity="Severe",
        urgency="Immediate",
        certainty="Observed",
        headline="Severe Thunderstorm and Squall Warning for Delhi NCR",
        description="High winds and torrential rain expected across the capital.",
        instruction="Stay indoors and secure loose outdoor objects.",
        area_description="Delhi, Rohini, Pitampura",
        circle_geojson={"latitude": 28.7041, "longitude": 77.1025, "radius_km": 15.0},
        effective_at=now - datetime.timedelta(minutes=20),
        expires_at=now + datetime.timedelta(hours=3),
        is_active=True,
    )

    res = evaluate_scenario_b_rule(notice, "Rohini, Delhi", 28.7041, 77.1025, now)
    assert res.matched is True
    assert res.insight is not None
    assert res.insight.insight_type == "severe_public_alert"
    assert res.insight.rule_identifier == "SCENARIO_B_PUBLIC_ALERT"
    assert res.insight.composite_severity == "severe"
    assert res.insight.confidence_level == "HIGH (Official Emergency Authority)"
    assert "Stay indoors" in res.insight.recommendation
    assert res.supporting_notice_id == 501
    assert len(res.insight.signals) == 1
    assert res.insight.signals[0].type == "alert"


def test_scenario_b_rejects_expired_notice():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    notice = GovernmentNotice(
        id=502,
        source_id="sachet_cap",
        alert_identifier="IN-DL-2026-002",
        sender="imd_delhi",
        event_type="Severe Thunderstorm",
        severity="Severe",
        urgency="Immediate",
        certainty="Observed",
        headline="Old Thunderstorm Warning",
        area_description="Delhi",
        circle_geojson={"latitude": 28.7041, "longitude": 77.1025, "radius_km": 15.0},
        effective_at=now - datetime.timedelta(hours=5),
        expires_at=now - datetime.timedelta(minutes=10),  # Expired!
        is_active=True,
    )

    res = evaluate_scenario_b_rule(notice, "Rohini", 28.7041, 77.1025, now)
    assert res.matched is False
    assert "expired" in res.reason.lower()


def test_scenario_b_rejects_geographically_unrelated_notice():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    notice = GovernmentNotice(
        id=503,
        source_id="sachet_cap",
        alert_identifier="IN-MH-2026-003",
        sender="imd_mumbai",
        event_type="Coastal Cyclone",
        severity="Extreme",
        urgency="Immediate",
        certainty="Observed",
        headline="Cyclone Alert for Konkan Coast",
        area_description="Mumbai Suburban, Ratnagiri, Sindhudurg",
        circle_geojson={"latitude": 18.9220, "longitude": 72.8347, "radius_km": 50.0},
        effective_at=now - datetime.timedelta(minutes=10),
        expires_at=now + datetime.timedelta(hours=6),
        is_active=True,
    )

    res = evaluate_scenario_b_rule(notice, "Rohini, Delhi", 28.7041, 77.1025, now)
    assert res.matched is False
    assert "not geographically relevant" in res.reason


def test_scenario_b_rejects_minor_severity_notice():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    notice = GovernmentNotice(
        id=504,
        source_id="sachet_cap",
        alert_identifier="IN-DL-2026-004",
        sender="imd_delhi",
        event_type="Light Mist",
        severity="Minor",  # Minor severity
        urgency="Past",
        certainty="Unlikely",
        headline="Shallow morning mist",
        area_description="Delhi",
        effective_at=now - datetime.timedelta(minutes=10),
        expires_at=now + datetime.timedelta(hours=2),
        is_active=True,
    )

    res = evaluate_scenario_b_rule(notice, "Delhi", 28.6139, 77.2090, now)
    assert res.matched is False
    assert "below public warning threshold" in res.reason


def test_scenario_c_traffic_standalone_critical():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    traffic = TrafficObservation(
        id=401,
        source_id="tomtom_traffic",
        source_record_id="tomtom:401",
        incident_type="ROAD_CLOSURE",
        latitude=28.6139,
        longitude=77.2090,
        observed_at=now - datetime.timedelta(minutes=15),
        delay_seconds=2400,  # 40 mins
        criticality="critical",
        road_name="Barakhamba Road",
    )

    res = evaluate_scenario_c_traffic_rule(traffic, "Barakhamba Road", now)
    assert res.matched is True
    assert res.insight is not None
    assert res.insight.insight_type == "single_signal_traffic_notice"
    assert res.insight.rule_identifier == "SCENARIO_C_TRAFFIC_ALERT"
    assert res.insight.confidence_level == "MEDIUM (Single Credible Source)"
    assert res.insight.composite_severity == "severe"
    assert "Single-source telemetry" in res.insight.data_quality_notes
    assert len(res.insight.signals) == 1
    assert res.insight.signals[0].type == "traffic"


def test_scenario_c_traffic_suppresses_when_already_correlated():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    traffic = TrafficObservation(
        id=401,
        source_id="tomtom_traffic",
        source_record_id="tomtom:401",
        incident_type="CONGESTION",
        latitude=28.6139,
        longitude=77.2090,
        observed_at=now - datetime.timedelta(minutes=10),
        delay_seconds=1800,
        criticality="major",
    )

    # Traffic ID 401 is in correlated_traffic_ids set
    res = evaluate_scenario_c_traffic_rule(traffic, "Barakhamba Road", now, correlated_traffic_ids={401})
    assert res.matched is False
    assert "already included in multi-signal correlation" in res.reason


def test_scenario_c_traffic_rejects_insufficient_delay():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    traffic = TrafficObservation(
        id=402,
        source_id="tomtom_traffic",
        source_record_id="tomtom:402",
        incident_type="CONGESTION",
        latitude=28.6139,
        longitude=77.2090,
        observed_at=now - datetime.timedelta(minutes=10),
        delay_seconds=300,  # Only 5 minutes
        criticality="minor",
    )

    res = evaluate_scenario_c_traffic_rule(traffic, "Road", now)
    assert res.matched is False
    assert "below standalone threshold" in res.reason


def test_scenario_c_weather_standalone_cloudburst():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    weather = WeatherObservation(
        id=601,
        source_id="weatherapi",
        source_record_id="w-601",
        location_name="Connaught Place",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now - datetime.timedelta(minutes=12),
        precipitation_mm=26.5,  # > 20 mm/hr
        temperature_c=23.0,
        condition_text="Heavy torrential downpour",
    )

    res = evaluate_scenario_c_weather_rule(weather, "Connaught Place", now)
    assert res.matched is True
    assert res.insight is not None
    assert res.insight.insight_type == "single_signal_weather_notice"
    assert res.insight.rule_identifier == "SCENARIO_C_WEATHER_ALERT"
    assert res.insight.confidence_level == "MEDIUM (Single Credible Source)"
    assert res.insight.composite_severity == "high"
    assert "Single-source weather telemetry" in res.insight.data_quality_notes
    assert len(res.insight.signals) == 1
    assert res.insight.signals[0].type == "weather"


def test_scenario_c_weather_suppresses_when_already_correlated():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    weather = WeatherObservation(
        id=601,
        source_id="weatherapi",
        source_record_id="w-601",
        location_name="Connaught Place",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now - datetime.timedelta(minutes=12),
        precipitation_mm=26.5,
        temperature_c=23.0,
        condition_text="Heavy rain",
    )

    res = evaluate_scenario_c_weather_rule(weather, "Connaught Place", now, correlated_weather_ids={601})
    assert res.matched is False
    assert "already included in multi-signal correlation" in res.reason


def test_scenario_c_weather_rejects_ordinary_rain():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    weather = WeatherObservation(
        id=602,
        source_id="weatherapi",
        source_record_id="w-602",
        location_name="Connaught Place",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now - datetime.timedelta(minutes=12),
        precipitation_mm=6.0,  # ordinary rain below 20.0 mm
        temperature_c=25.0,
        condition_text="Moderate rain",
    )

    res = evaluate_scenario_c_weather_rule(weather, "Connaught Place", now)
    assert res.matched is False
    assert "below standalone alert threshold" in res.reason


def test_scenario_b_polygon_match():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [77.0, 28.6],
                [77.2, 28.6],
                [77.2, 28.8],
                [77.0, 28.8],
                [77.0, 28.6],
            ]
        ],
    }
    notice = GovernmentNotice(
        id=505,
        source_id="sachet_cap",
        alert_identifier="IN-DL-2026-005",
        sender="imd_delhi",
        event_type="Heavy Rain Warning",
        severity="Moderate",
        urgency="Expected",
        certainty="Likely",
        headline="Moderate rainfall advisory for North-West Delhi",
        description="Waterlogging possible in low-lying underpasses.",
        instruction="Drive cautiously and avoid low-lying underpasses.",
        area_description="North Delhi Sector",
        polygon_geojson=polygon,
        effective_at=now - datetime.timedelta(minutes=15),
        expires_at=now + datetime.timedelta(hours=2),
        is_active=True,
    )

    # Point inside polygon: (28.7, 77.1)
    res = evaluate_scenario_b_rule(notice, "Rohini, Delhi", 28.7, 77.1, now)
    assert res.matched is True
    assert res.insight is not None
    assert res.insight.composite_severity == "moderate"

    # Point outside polygon: (28.9, 77.1)
    res_outside = evaluate_scenario_b_rule(notice, "Outside Area", 28.9, 77.1, now)
    assert res_outside.matched is False


def test_scenario_b_invalid_locality_coordinates():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    notice = GovernmentNotice(
        id=506,
        source_id="sachet_cap",
        alert_identifier="IN-DL-2026-006",
        sender="imd_delhi",
        event_type="Warning",
        severity="Severe",
        urgency="Immediate",
        certainty="Observed",
        headline="Test Headline",
        area_description="Delhi",
        effective_at=now,
        expires_at=now + datetime.timedelta(hours=1),
        is_active=True,
    )
    res = evaluate_scenario_b_rule(notice, "Invalid Loc", float("nan"), 77.1, now)
    assert res.matched is False
    assert "Invalid or missing" in res.reason


def test_scenario_c_traffic_invalid_coordinates():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    traffic = TrafficObservation(
        id=403,
        source_id="tomtom_traffic",
        source_record_id="t-403",
        incident_type="CONGESTION",
        latitude=None,  # Missing
        longitude=77.2090,
        observed_at=now,
        delay_seconds=2000,
        criticality="major",
    )
    res = evaluate_scenario_c_traffic_rule(traffic, "Road", now)
    assert res.matched is False
    assert "Invalid or missing" in res.reason


def test_scenario_c_weather_invalid_coordinates():
    now = datetime.datetime(2026, 10, 9, 12, 0)
    weather = WeatherObservation(
        id=603,
        source_id="weatherapi",
        source_record_id="w-603",
        location_name="Loc",
        latitude=95.0,  # Out of bounds
        longitude=77.2090,
        observed_at=now,
        precipitation_mm=25.0,
        condition_text="Heavy rain",
    )
    res = evaluate_scenario_c_weather_rule(weather, "Loc", now)
    assert res.matched is False
    assert "Invalid or missing" in res.reason

