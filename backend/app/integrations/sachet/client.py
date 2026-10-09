import asyncio
import datetime
from typing import List, Optional
from backend.app.core.config import settings
from backend.app.core.errors import ProviderError, ProviderTimeoutError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.normalization.alerts import (
    NormalizedAlertRecord,
    parse_cap_xml_payload,
    extract_rss_item_links,
)


class SACHETClient(BaseProviderClient):
    """
    Client for NDMA SACHET CAP XML / RSS public disaster alert feeds.
    Features:
    - Official NDMA RSS feeds (rss_india.xml, rss_delhi.xml, etc.)
    - Direct OASIS CAP v1.1 / v1.2 XML document ingestion
    - Conditional ETag (If-None-Match) caching per NDMA specifications (HTTP 304)
    - In-memory TTL caching
    - Bounded concurrent fetching of linked full CAP XML files (FetchXMLFile)
    - Resilient fallback to RSS item metadata
    """

    def __init__(
        self,
        feed_url: Optional[str] = None,
        max_items_per_poll: Optional[int] = None,
        timeout_seconds: Optional[float] = None,
    ):
        super().__init__(provider_name="sachet_cap", timeout_seconds=timeout_seconds)
        self.feed_url = feed_url or settings.SACHET_FEED_URL
        self.max_items = max_items_per_poll or getattr(settings, "SACHET_MAX_ITEMS_PER_POLL", 20)
        self._cache: List[NormalizedAlertRecord] = []
        self._cache_expires_at: Optional[datetime.datetime] = None
        self._etag: Optional[str] = None

    async def fetch_alerts(self, bypass_cache: bool = False) -> List[NormalizedAlertRecord]:
        """
        Fetches and parses the latest NDMA SACHET CAP v1.2 alerts.
        """
        now = datetime.datetime.utcnow()

        if not bypass_cache and self._cache and self._cache_expires_at and now < self._cache_expires_at:
            logger.debug("[sachet_cap] In-memory cache HIT for SACHET alerts")
            return self._cache

        logger.info(f"[sachet_cap] Fetching live CAP feed from {self.feed_url}")
        headers = {
            "User-Agent": "MyArea24-Local-Intelligence-Engine/0.1 (+https://github.com/myarea24)",
            "Accept": "application/xml, text/xml, */*",
        }
        if self._etag and not bypass_cache:
            headers["If-None-Match"] = self._etag

        try:
            response = await self._get(self.feed_url, headers=headers)
        except (ProviderError, ProviderTimeoutError):
            raise
        except Exception as e:
            logger.error(f"[sachet_cap] Failed to retrieve feed from {self.feed_url}: {e}")
            raise ProviderError("sachet_cap", f"Failed to download CAP feed: {str(e)}") from e

        # Handle HTTP 304 Not Modified
        if response.status_code == 304:
            logger.info("[sachet_cap] Feed not modified (HTTP 304 via ETag). Returning cached alerts.")
            self._cache_expires_at = now + datetime.timedelta(minutes=settings.SACHET_POLL_INTERVAL_MINUTES)
            return self._cache

        # Record ETag if provided
        if "etag" in response.headers:
            self._etag = response.headers["etag"]

        xml_content = response.content

        # Case 1: Direct CAP XML (contains <alert> tags)
        direct_records = parse_cap_xml_payload(xml_content)
        item_links = extract_rss_item_links(xml_content)[: self.max_items]

        # If direct CAP alerts were parsed and no RSS item links exist (e.g. standalone CAP fixture)
        if direct_records and not item_links:
            self._cache = direct_records
            self._cache_expires_at = now + datetime.timedelta(minutes=settings.SACHET_POLL_INTERVAL_MINUTES)
            return direct_records

        # Case 2: RSS 2.0 index feed with item links
        if item_links:
            logger.info(f"[sachet_cap] Discovered {len(item_links)} alert items in RSS index. Fetching detail CAP XMLs...")
            sem = asyncio.Semaphore(5)

            async def _fetch_one_cap(link: str) -> Optional[bytes]:
                try:
                    async with sem:
                        res = await self._get(link, use_retry=False)
                        if res.status_code == 200:
                            return res.content
                        return None
                except Exception as ex:
                    logger.warning(f"[sachet_cap] Could not fetch detail CAP from {link}: {ex}")
                    return None

            detail_payloads = await asyncio.gather(*[_fetch_one_cap(link) for _, link in item_links])

            detailed_records: List[NormalizedAlertRecord] = []
            for payload in detail_payloads:
                if payload:
                    parsed = parse_cap_xml_payload(payload)
                    detailed_records.extend(parsed)

            if detailed_records:
                # Deduplicate by alert_identifier
                seen_ids = set()
                unique_records: List[NormalizedAlertRecord] = []
                for rec in detailed_records:
                    if rec.alert_identifier not in seen_ids:
                        seen_ids.add(rec.alert_identifier)
                        unique_records.append(rec)

                self._cache = unique_records
                self._cache_expires_at = now + datetime.timedelta(minutes=settings.SACHET_POLL_INTERVAL_MINUTES)
                return unique_records

        # Case 3: Fallback to whatever parse_cap_xml_payload extracted (e.g. RSS fallback items)
        self._cache = direct_records
        self._cache_expires_at = now + datetime.timedelta(minutes=settings.SACHET_POLL_INTERVAL_MINUTES)
        return direct_records
