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
from backend.app.integrations.weatherapi.client import WeatherAPIClient
from backend.app.integrations.here.client import HERETrafficClient
from backend.app.integrations.sachet.client import SACHETClient


@pytest.mark.asyncio
async def test_weather_client_missing_key():
    client = WeatherAPIClient(api_key=None)
    with pytest.raises(ProviderAuthError, match="WEATHERAPI_API_KEY is not configured"):
        await client.fetch_forecast(28.5672, 77.2100)


@pytest.mark.asyncio
async def test_traffic_client_missing_key():
    client = HERETrafficClient(api_key=None)
    with pytest.raises(ProviderAuthError, match="HERE_API_KEY is not configured"):
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
