import datetime
from typing import List, Optional
from backend.app.core.config import settings
from backend.app.core.errors import ProviderError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.normalization.alerts import NormalizedAlertRecord, parse_cap_xml_payload


class SACHETClient(BaseProviderClient):
    """
    Client for NDMA SACHET CAP XML / RSS public disaster alert feeds.
    """

    def __init__(self, feed_url: Optional[str] = None):
        super().__init__(provider_name="sachet_cap")
        self.feed_url = feed_url or settings.SACHET_FEED_URL
        self._cache: Optional[List[NormalizedAlertRecord]] = None
        self._cache_expires_at: Optional[datetime.datetime] = None

    async def fetch_alerts(self, bypass_cache: bool = False) -> List[NormalizedAlertRecord]:
        """
        Fetches and parses the latest NDMA SACHET CAP v1.2 XML feed.
        """
        now = datetime.datetime.utcnow()

        if not bypass_cache and self._cache is not None and self._cache_expires_at is not None:
            if now < self._cache_expires_at:
                logger.debug("[sachet_cap] Cache HIT for SACHET alerts")
                return self._cache

        logger.info(f"[sachet_cap] Fetching live CAP feed from {self.feed_url}")
        headers = {
            "User-Agent": "MyArea24-Local-Intelligence-Engine/0.1 (+https://github.com/myarea24)"
        }

        try:
            response = await self._get(self.feed_url, headers=headers)
            xml_content = response.content
        except Exception as e:
            logger.error(f"[sachet_cap] Failed to retrieve feed from {self.feed_url}: {e}")
            raise ProviderError("sachet_cap", f"Failed to download CAP feed: {str(e)}") from e

        records = parse_cap_xml_payload(xml_content)

        # Cache for 10 minutes
        self._cache = records
        self._cache_expires_at = now + datetime.timedelta(minutes=10)

        return records
