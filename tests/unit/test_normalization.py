import pytest
from backend.app.normalization.weather import normalize_weatherapi_response, NormalizedWeatherRecord
from backend.app.normalization.traffic import (
    normalize_here_traffic_response,
    normalize_tomtom_traffic_response,
    NormalizedTrafficRecord,
)


def test_weather_normalization_heavy_rain(heavy_rain_fixture):
    records = normalize_weatherapi_response(heavy_rain_fixture)
    assert len(records) >= 1

    current = records[0]
    assert current.location_name == "Delhi AIIMS Ring Road"
    assert current.latitude == 28.5672
    assert current.longitude == 77.2100
    assert current.precipitation_mm == 12.0
    assert current.is_heavy_rain is True
    assert "Heavy rain" in current.condition_text
    assert current.source_record_id.startswith("weatherapi:current:")


def test_weather_normalization_light_rain(light_rain_fixture):
    records = normalize_weatherapi_response(light_rain_fixture)
    assert len(records) == 1
    current = records[0]
    assert current.precipitation_mm == 2.0
    assert current.is_heavy_rain is False


def test_weather_invalid_coordinates():
    with pytest.raises(ValueError, match="Invalid latitude"):
        NormalizedWeatherRecord(
            source_record_id="test",
            location_name="Invalid",
            latitude=95.0,  # invalid
            longitude=77.0,
            observed_at="2026-10-09T12:00:00",
            temperature_c=25.0,
            precipitation_mm=5.0,
            condition_text="Rain",
        )


def test_traffic_normalization_heavy_congestion(heavy_traffic_fixture):
    records = normalize_here_traffic_response(heavy_traffic_fixture)
    assert len(records) == 1

    rec = records[0]
    assert rec.source_record_id == "here:IN-DEL-98421"
    assert rec.incident_type == "CONGESTION"
    assert rec.criticality == "critical"
    assert rec.jam_factor == 7.5
    assert rec.delay_seconds == 1800
    assert rec.latitude == 28.5680
    assert rec.longitude == 77.2110
    assert rec.geometry_geojson is not None
    assert rec.geometry_geojson["type"] == "LineString"


def test_traffic_normalization_normal_flow(normal_traffic_fixture):
    records = normalize_here_traffic_response(normal_traffic_fixture)
    assert len(records) == 1
    rec = records[0]
    assert rec.jam_factor == 2.0
    assert rec.delay_seconds == 0


def test_tomtom_traffic_normalization_heavy(tomtom_heavy_traffic_fixture):
    records = normalize_tomtom_traffic_response(tomtom_heavy_traffic_fixture)
    assert len(records) == 1
    rec = records[0]
    assert rec.source_record_id == "tomtom:TTI-DEL-HEAVY-001"
    assert rec.incident_type == "CONGESTION"
    assert rec.criticality == "major"
    assert rec.jam_factor is None  # Must never fabricate HERE jamFactor
    assert rec.delay_seconds == 1800
    assert rec.road_name == "Ring Road"
    assert rec.latitude == 28.5680
    assert rec.longitude == 77.2110
    assert rec.geometry_geojson is not None
    assert rec.geometry_geojson["type"] == "LineString"


def test_tomtom_traffic_normalization_normal(tomtom_normal_traffic_fixture):
    records = normalize_tomtom_traffic_response(tomtom_normal_traffic_fixture)
    assert len(records) == 1
    rec = records[0]
    assert rec.source_record_id == "tomtom:TTI-DEL-NORMAL-002"
    assert rec.criticality == "minor"
    assert rec.delay_seconds == 120
    assert rec.jam_factor is None


def test_tomtom_traffic_normalization_missing_metrics(tomtom_sparse_traffic_fixture):
    records = normalize_tomtom_traffic_response(tomtom_sparse_traffic_fixture)
    assert len(records) == 1
    rec = records[0]
    assert rec.source_record_id == "tomtom:TTI-DEL-SPARSE-003"
    assert rec.delay_seconds is None
    assert rec.criticality is None
    assert rec.jam_factor is None
    assert rec.road_name is None
    assert rec.latitude == 28.5680
    assert rec.longitude == 77.2110


def test_tomtom_traffic_normalization_invalid():
    assert normalize_tomtom_traffic_response({}) == []
    assert normalize_tomtom_traffic_response({"incidents": "not_a_list"}) == []
    assert normalize_tomtom_traffic_response({"incidents": [{}]}) == []

