import pytest
import httpx
from unittest.mock import AsyncMock, patch
from backend.app.core.errors import (
    ProviderAuthError,
    ProviderQuotaError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderError,
)
from backend.app.core.config import settings
from backend.app.integrations.weatherapi.client import WeatherAPIClient
from backend.app.integrations.here.client import HERETrafficClient
from backend.app.integrations.tomtom.client import TomTomTrafficClient
from backend.app.integrations.sachet.client import SACHETClient


@pytest.mark.asyncio
async def test_weather_client_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "WEATHERAPI_API_KEY", "")
    client = WeatherAPIClient(api_key=None)
    with pytest.raises(ProviderAuthError, match="WEATHERAPI_API_KEY is not configured"):
        await client.fetch_forecast(28.5672, 77.2100)


@pytest.mark.asyncio
async def test_here_traffic_client_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "HERE_API_KEY", "")
    client = HERETrafficClient(api_key=None)
    with pytest.raises(ProviderAuthError, match="HERE_API_KEY is not configured"):
        await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))


@pytest.mark.asyncio
async def test_tomtom_traffic_client_missing_key(monkeypatch):
    monkeypatch.setattr(settings, "TOMTOM_API_KEY", "")
    client = TomTomTrafficClient(api_key=None)
    with pytest.raises(ProviderAuthError, match="TOMTOM_API_KEY is not configured"):
        await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))


@pytest.mark.asyncio
async def test_weather_client_success_and_cache(heavy_rain_fixture):
    client = WeatherAPIClient(api_key="test_key")
    mock_resp = httpx.Response(200, json=heavy_rain_fixture)

    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        # First call hits mock
        records1 = await client.fetch_forecast(28.5672, 77.2100)
        assert len(records1) >= 1
        assert mock_get.call_count == 1

        # Second call hits cache (no new HTTP request)
        records2 = await client.fetch_forecast(28.5672, 77.2100)
        assert len(records2) == len(records1)
        assert mock_get.call_count == 1


@pytest.mark.asyncio
async def test_here_traffic_client_success(heavy_traffic_fixture):
    client = HERETrafficClient(api_key="test_key")
    mock_resp = httpx.Response(200, json=heavy_traffic_fixture)

    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        records = await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))
        assert len(records) == 1
        assert records[0].incident_type == "CONGESTION"


@pytest.mark.asyncio
async def test_sachet_client_success(valid_cap_xml):
    client = SACHETClient(feed_url="https://mock.sachet.gov.in/feed.xml")
    mock_resp = httpx.Response(200, content=valid_cap_xml.encode("utf-8"))

    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        records = await client.fetch_alerts()
        assert len(records) == 1
        assert records[0].alert_identifier == "NDMA-CAP-2026-DEL-0841"


@pytest.mark.asyncio
async def test_tomtom_traffic_client_success_and_cache(tomtom_heavy_traffic_fixture):
    client = TomTomTrafficClient(api_key="test_tomtom_key")
    mock_resp = httpx.Response(200, json=tomtom_heavy_traffic_fixture)

    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        # First call: hits mock HTTP
        records1 = await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))
        assert len(records1) == 1
        rec = records1[0]
        assert rec.source_record_id == "tomtom:TTI-DEL-HEAVY-001"
        assert rec.incident_type == "CONGESTION"
        assert rec.criticality == "major"
        assert rec.jam_factor is None  # Must never fabricate HERE jamFactor
        assert rec.delay_seconds == 1800
        assert rec.latitude == 28.5680
        assert rec.longitude == 77.2110
        assert mock_get.call_count == 1

        # Second call: hits 5-minute cache
        records2 = await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))
        assert len(records2) == 1
        assert mock_get.call_count == 1  # No additional network request


@pytest.mark.asyncio
async def test_tomtom_traffic_client_auth_error():
    client = TomTomTrafficClient(api_key="invalid_tomtom_key")
    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = ProviderAuthError("tomtom_traffic", "Authentication failed: HTTP 403", status_code=403)
        with pytest.raises(ProviderAuthError, match="Authentication failed: HTTP 403"):
            await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))


@pytest.mark.asyncio
async def test_tomtom_traffic_client_rate_limit():
    client = TomTomTrafficClient(api_key="test_tomtom_key")
    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = ProviderRateLimitError("tomtom_traffic", retry_after=10)
        with pytest.raises(ProviderRateLimitError, match="Rate limit exceeded"):
            await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))


@pytest.mark.asyncio
async def test_tomtom_traffic_client_timeout():
    client = TomTomTrafficClient(api_key="test_tomtom_key")
    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = ProviderTimeoutError("tomtom_traffic", "Request timed out")
        with pytest.raises(ProviderTimeoutError, match="Request timed out"):
            await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))


@pytest.mark.asyncio
async def test_tomtom_traffic_client_malformed_json():
    client = TomTomTrafficClient(api_key="test_tomtom_key")
    # Response that fails json() parsing
    mock_resp = httpx.Response(200, text="NOT_VALID_JSON{")
    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        with pytest.raises(ProviderError, match="Failed to parse JSON response"):
            await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))


@pytest.mark.asyncio
async def test_tomtom_traffic_client_missing_traffic_metrics(tomtom_sparse_traffic_fixture):
    client = TomTomTrafficClient(api_key="test_tomtom_key")
    mock_resp = httpx.Response(200, json=tomtom_sparse_traffic_fixture)
    with patch.object(client, "_get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp
        records = await client.fetch_incidents((77.15, 28.52, 77.26, 28.62))
        assert len(records) == 1
        rec = records[0]
        assert rec.source_record_id == "tomtom:TTI-DEL-SPARSE-003"
        assert rec.delay_seconds is None
        assert rec.jam_factor is None
        assert rec.criticality is None
        assert rec.latitude == 28.5680
        assert rec.longitude == 77.2110

