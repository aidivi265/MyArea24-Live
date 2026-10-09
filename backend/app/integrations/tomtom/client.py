import datetime
from typing import Dict, List, Optional, Tuple
from backend.app.core.config import settings
from backend.app.core.errors import ProviderAuthError, ProviderError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.normalization.traffic import NormalizedTrafficRecord, normalize_tomtom_traffic_response


class TomTomTrafficClient(BaseProviderClient):
    """
    Client for TomTom Traffic Incidents API v5 (/traffic/services/5/incidentDetails)
    with 5-minute TTL caching and quota protection.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        super().__init__(provider_name="tomtom_traffic")
        self.api_key = api_key if api_key is not None else settings.TOMTOM_API_KEY
        self.base_url = (base_url or settings.TOMTOM_TRAFFIC_BASE_URL).rstrip("/")
        # In-memory cache: (min_lon, min_lat, max_lon, max_lat) -> (records, expires_at_utc)
        self._cache: Dict[Tuple[float, float, float, float], Tuple[List[NormalizedTrafficRecord], datetime.datetime]] = {}

    def _get_cache_key(self, bbox: Tuple[float, float, float, float]) -> Tuple[float, float, float, float]:
        return (round(bbox[0], 3), round(bbox[1], 3), round(bbox[2], 3), round(bbox[3], 3))

    async def fetch_incidents(
        self,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        bypass_cache: bool = False,
    ) -> List[NormalizedTrafficRecord]:
        """
        Fetches traffic incidents for a bounding box (minLon, minLat, maxLon, maxLat).
        """
        if not self.api_key:
            raise ProviderAuthError("tomtom_traffic", "TOMTOM_API_KEY is not configured.")

        target_bbox = bbox or settings.traffic_bbox_coords
        cache_key = self._get_cache_key(target_bbox)
        now = datetime.datetime.utcnow()

        if not bypass_cache and cache_key in self._cache:
            records, expires_at = self._cache[cache_key]
            if now < expires_at:
                logger.debug(f"[tomtom_traffic] Cache HIT for bbox {target_bbox}")
                return records

        url = f"{self.base_url}/incidentDetails"
        min_lon, min_lat, max_lon, max_lat = target_bbox
        fields_param = (
            "{incidents{type,geometry{type,coordinates},"
            "properties{id,iconCategory,magnitudeOfDelay,events{code,description},"
            "startTime,endTime,from,to,length,delay,roadNumbers}}}"
        )

        params = {
            "key": self.api_key,
            "bbox": f"{min_lon:.4f},{min_lat:.4f},{max_lon:.4f},{max_lat:.4f}",
            "fields": fields_param,
            "language": "en-GB",
        }

        logger.info(
            f"[tomtom_traffic] Fetching incidents for bbox {min_lon:.4f},{min_lat:.4f} -> {max_lon:.4f},{max_lat:.4f}"
        )
        response = await self._get(url, params=params)

        try:
            data = response.json()
        except Exception as e:
            raise ProviderError("tomtom_traffic", f"Failed to parse JSON response: {str(e)}") from e

        records = normalize_tomtom_traffic_response(data)

        # Cache for 5 minutes
        cache_ttl = datetime.timedelta(minutes=5)
        self._cache[cache_key] = (records, now + cache_ttl)

        return records
