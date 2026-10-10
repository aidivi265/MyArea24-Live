import datetime
from typing import Any, Dict, List, Optional, Tuple
from backend.app.core.config import settings
from backend.app.core.errors import ProviderAuthError, ProviderError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.normalization.air_quality import (
    NormalizedAQIRecord,
    normalize_openaq_location_response,
)


class OpenAQClient(BaseProviderClient):
    """
    Client for OpenAQ v3 API (/locations endpoint).
    Aggregates official CPCB and State SPCB CAAQMS monitoring stations across India.
    Requires OPENAQ_API_KEY sent via 'X-API-Key' HTTP header.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        super().__init__(provider_name="openaq")
        self.api_key = api_key if api_key is not None else settings.OPENAQ_API_KEY
        self.base_url = (base_url or settings.OPENAQ_BASE_URL).rstrip("/")
        # In-memory cache: (rounded_lat, rounded_lon) -> (records, expires_at_utc)
        self._cache: Dict[Tuple[float, float], Tuple[List[NormalizedAQIRecord], datetime.datetime]] = {}

    def _get_cache_key(self, lat: float, lon: float) -> Tuple[float, float]:
        return (round(lat, 3), round(lon, 3))

    async def fetch_latest_for_coordinates(
        self,
        lat: float,
        lon: float,
        radius_meters: int = 25000,
        limit: int = 10,
        bypass_cache: bool = False,
    ) -> List[NormalizedAQIRecord]:
        """
        Fetches the nearest air quality monitoring stations and their latest sensor telemetry.
        """
        if not self.api_key:
            logger.warning("[openaq] OPENAQ_API_KEY is not configured. Live fetch aborted.")
            raise ProviderAuthError("openaq", "OPENAQ_API_KEY is not configured in environment.")

        cache_key = self._get_cache_key(lat, lon)
        now = datetime.datetime.utcnow()

        if not bypass_cache and cache_key in self._cache:
            records, expires_at = self._cache[cache_key]
            if now < expires_at:
                logger.debug(f"[openaq] Cache HIT for coords ({lat:.3f}, {lon:.3f})")
                return records

        url = f"{self.base_url}/locations"
        params = {
            "coordinates": f"{lat},{lon}",
            "radius": radius_meters,
            "limit": limit,
        }
        headers = {
            "X-API-Key": self.api_key,
            "Accept": "application/json",
        }

        logger.info(f"[openaq] Fetching monitoring stations near ({lat:.4f}, {lon:.4f})")
        response = await self._get(url, params=params, headers=headers)

        try:
            payload = response.json()
        except Exception as e:
            raise ProviderError("openaq", f"Failed to parse JSON response: {str(e)}") from e

        results = payload.get("results", [])
        records: List[NormalizedAQIRecord] = []

        for item in results:
            rec = normalize_openaq_location_response(item)
            if rec:
                records.append(rec)

        # Cache for 60 minutes
        cache_ttl = datetime.timedelta(minutes=60)
        self._cache[cache_key] = (records, now + cache_ttl)

        return records

    async def fetch_location_by_id(self, location_id: int) -> Optional[NormalizedAQIRecord]:
        """Fetches metadata and sensor readings for a single station ID."""
        if not self.api_key:
            raise ProviderAuthError("openaq", "OPENAQ_API_KEY is not configured.")

        url = f"{self.base_url}/locations/{location_id}"
        headers = {"X-API-Key": self.api_key, "Accept": "application/json"}

        response = await self._get(url, headers=headers)
        try:
            payload = response.json()
        except Exception as e:
            raise ProviderError("openaq", f"Failed to parse JSON response: {str(e)}") from e

        results = payload.get("results", [])
        if results:
            return normalize_openaq_location_response(results[0])
        return None
