import pytest
from backend.app.normalization.weather import normalize_weatherapi_response, NormalizedWeatherRecord
from backend.app.normalization.traffic import normalize_here_traffic_response, NormalizedTrafficRecord


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
