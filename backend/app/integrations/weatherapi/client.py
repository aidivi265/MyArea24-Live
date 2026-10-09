import datetime
from typing import Dict, List, Optional, Tuple
from backend.app.core.config import settings
from backend.app.core.errors import ProviderAuthError, ProviderError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.normalization.weather import NormalizedWeatherRecord, normalize_weatherapi_response


class WeatherAPIClient(BaseProviderClient):
    """
    Client for WeatherAPI.com forecast endpoint with in-memory TTL caching.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        super().__init__(provider_name="weatherapi")
        self.api_key = api_key if api_key is not None else settings.WEATHERAPI_API_KEY
        self.base_url = (base_url or settings.WEATHERAPI_BASE_URL).rstrip("/")
        # In-memory cache: (rounded_lat, rounded_lon) -> (records, expires_at_utc)
        self._cache: Dict[Tuple[float, float], Tuple[List[NormalizedWeatherRecord], datetime.datetime]] = {}

    def _get_cache_key(self, lat: float, lon: float) -> Tuple[float, float]:
        return (round(lat, 3), round(lon, 3))

    async def fetch_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 1,
        bypass_cache: bool = False,
    ) -> List[NormalizedWeatherRecord]:
        """
        Fetches current weather and hourly forecast for latitude/longitude.
        Complies with 60-minute current conditions caching policy.
        """
        if not self.api_key:
            raise ProviderAuthError("weatherapi", "WEATHERAPI_API_KEY is not configured.")

        cache_key = self._get_cache_key(lat, lon)
        now = datetime.datetime.utcnow()

        # Check in-memory cache
        if not bypass_cache and cache_key in self._cache:
            records, expires_at = self._cache[cache_key]
            if now < expires_at:
                logger.debug(f"[weatherapi] Cache HIT for coords ({lat:.3f}, {lon:.3f})")
                return records

        url = f"{self.base_url}/forecast.json"
        params = {
            "key": self.api_key,
            "q": f"{lat},{lon}",
            "days": days,
            "aqi": "no",
            "alerts": "no",
        }

        logger.info(f"[weatherapi] Fetching live forecast for ({lat:.4f}, {lon:.4f})")
        response = await self._get(url, params=params)

        try:
            data = response.json()
        except Exception as e:
            raise ProviderError("weatherapi", f"Failed to parse JSON response: {str(e)}") from e

        records = normalize_weatherapi_response(data)

        # Cache for 60 minutes as permitted by Terms of Service
        cache_ttl = datetime.timedelta(minutes=60)
        self._cache[cache_key] = (records, now + cache_ttl)

        return records
