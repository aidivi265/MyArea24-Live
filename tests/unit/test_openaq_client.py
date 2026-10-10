import datetime
import pytest
import httpx
from unittest.mock import AsyncMock, patch

from backend.app.core.config import settings
from backend.app.core.errors import ProviderAuthError, ProviderError, ProviderRateLimitError
from backend.app.integrations.openaq.client import OpenAQClient
from backend.app.normalization.air_quality import (
    NormalizedAQIRecord,
    normalize_openaq_location_response,
)


DELHI_ANAND_VIHAR_FIXTURE = {
    "id": 8118,
    "name": "Anand Vihar, Delhi - DPCC",
    "locality": "Delhi",
    "coordinates": {"latitude": 28.6508, "longitude": 77.3152},
    "sensors": [
        {
            "parameter": {"name": "pm25"},
            "latest": {"value": 265.4, "datetime": "2026-10-09T12:00:00Z"},
        },
        {
            "parameter": {"name": "pm10"},
            "latest": {"value": 380.2, "datetime": "2026-10-09T12:00:00Z"},
        },
        {
            "parameter": {"name": "no2"},
            "latest": {"value": 92.5, "datetime": "2026-10-09T12:00:00Z"},
        },
        {
            "parameter": {"name": "so2"},
            "latest": {"value": 18.2, "datetime": "2026-10-09T12:00:00Z"},
        },
    ],
}

BENGALURU_SILK_BOARD_FIXTURE = {
    "id": 7890,
    "name": "Central Silk Board, Bengaluru - KSPCB",
    "locality": "Bengaluru",
    "coordinates": {"latitude": 12.9176, "longitude": 77.6233},
    "sensors": [
        {
            "parameter": {"name": "pm25"},
            "latest": {"value": 35.0, "datetime": "2026-10-09T12:00:00Z"},
        },
        {
            "parameter": {"name": "pm10"},
            "latest": {"value": 68.0, "datetime": "2026-10-09T12:00:00Z"},
        },
        {
            "parameter": {"name": "no2"},
            "latest": {"value": 32.0, "datetime": "2026-10-09T12:00:00Z"},
        },
    ],
}


def test_normalize_delhi_anand_vihar_fixture():
    record = normalize_openaq_location_response(DELHI_ANAND_VIHAR_FIXTURE)
    assert record is not None
    assert record.station_id == "8118"
    assert "Anand Vihar" in record.station_name
    assert record.city == "Delhi"
    assert record.latitude == 28.6508
    assert record.longitude == 77.3152
    assert record.pm25 == 265.4
    assert record.pm10 == 380.2
    assert record.no2 == 92.5
    assert record.so2 == 18.2
    assert record.is_naqi_compliant is True
    # At PM2.5 = 265.4, sub-index is in Severe range (> 400)
    assert record.aqi_value >= 401.0
    assert record.aqi_category == "Severe"
    assert record.is_severe is True
    assert record.is_very_poor is True


def test_normalize_bengaluru_silk_board_fixture():
    record = normalize_openaq_location_response(BENGALURU_SILK_BOARD_FIXTURE)
    assert record is not None
    assert record.station_id == "7890"
    assert "Silk Board" in record.station_name
    assert record.city == "Bengaluru"
    assert record.pm25 == 35.0
    assert record.pm10 == 68.0
    assert record.aqi_category in ("Satisfactory", "Moderate")
    assert record.is_severe is False
    assert record.is_very_poor is False


def test_normalize_invalid_coordinates():
    invalid_data = {
        "id": 999,
        "name": "Invalid Station",
        "coordinates": {"latitude": None, "longitude": None},
    }
    assert normalize_openaq_location_response(invalid_data) is None


@pytest.mark.asyncio
async def test_openaq_client_unauthenticated(monkeypatch):
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", None)
    client = OpenAQClient(api_key=None)
    with pytest.raises(ProviderAuthError) as exc_info:
        await client.fetch_latest_for_coordinates(28.6139, 77.2090)
    assert "OPENAQ_API_KEY is not configured" in str(exc_info.value)


@pytest.mark.asyncio
async def test_openaq_client_success_and_caching():
    client = OpenAQClient(api_key="mock_test_key_123")

    mock_response = httpx.Response(
        status_code=200,
        json={"results": [DELHI_ANAND_VIHAR_FIXTURE]},
        request=httpx.Request("GET", "https://api.openaq.org/v3/locations"),
    )

    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response

        # First call: makes network request
        records1 = await client.fetch_latest_for_coordinates(28.6508, 77.3152)
        assert len(records1) == 1
        assert records1[0].station_id == "8118"
        assert mock_get.call_count == 1

        # Second call with same coordinates: hits in-memory cache
        records2 = await client.fetch_latest_for_coordinates(28.6508, 77.3152)
        assert len(records2) == 1
        assert mock_get.call_count == 1  # Cache HIT, no new request


@pytest.mark.asyncio
async def test_openaq_client_rate_limited():
    client = OpenAQClient(api_key="mock_key")

    mock_resp = httpx.Response(
        status_code=429,
        headers={"Retry-After": "10"},
        request=httpx.Request("GET", "https://api.openaq.org/v3/locations"),
    )

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        with pytest.raises(ProviderRateLimitError) as exc_info:
            await client.fetch_latest_for_coordinates(28.6508, 77.3152, bypass_cache=True)
        assert exc_info.value.retry_after == 10


def test_normalize_unit_conversion_for_co():
    fixture_with_micrograms_co = {
        "id": 9100,
        "name": "Delhi Test Station - DPCC",
        "locality": "Delhi",
        "coordinates": {"latitude": 28.6000, "longitude": 77.2000},
        "sensors": [
            {
                "parameter": {"name": "pm25", "units": "µg/m³"},
                "latest": {"value": 50.0, "datetime": "2026-10-10T12:00:00Z"},
            },
            {
                "parameter": {"name": "pm10", "units": "µg/m³"},
                "latest": {"value": 90.0, "datetime": "2026-10-10T12:00:00Z"},
            },
            {
                "parameter": {"name": "co", "units": "µg/m³"},
                "latest": {"value": 1500.0, "datetime": "2026-10-10T12:00:00Z"},
            },
        ],
    }
    record = normalize_openaq_location_response(fixture_with_micrograms_co)
    assert record is not None
    # 1500 µg/m³ must be converted to 1.5 mg/m³
    assert record.co == 1.5
    assert record.aqi_value is not None


def test_normalize_rejection_when_under_minimum_pollutants():
    # Only PM2.5 available (fewer than 3 pollutants)
    single_sensor_fixture = {
        "id": 9200,
        "name": "Single Sensor Station",
        "locality": "Delhi",
        "coordinates": {"latitude": 28.6000, "longitude": 77.2000},
        "sensors": [
            {
                "parameter": {"name": "pm25", "units": "µg/m³"},
                "latest": {"value": 120.0, "datetime": "2026-10-10T12:00:00Z"},
            },
        ],
    }
    record = normalize_openaq_location_response(single_sensor_fixture)
    assert record is not None
    assert record.pm25 == 120.0
    # Overall AQI must NOT be calculated when minimum data requirement is not met
    assert record.aqi_value is None
    assert record.aqi_category is None
    assert record.is_naqi_compliant is False

