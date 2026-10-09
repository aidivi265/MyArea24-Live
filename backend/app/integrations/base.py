from typing import Any, Dict, Optional
import httpx
from backend.app.core.config import settings
from backend.app.core.errors import (
    ProviderAuthError,
    ProviderError,
    ProviderQuotaError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.app.core.logging import logger
from backend.app.ingestion.retry import execute_with_retry


class BaseProviderClient:
    """Base class for all external data provider clients."""

    def __init__(self, provider_name: str, timeout_seconds: float | None = None):
        self.provider_name = provider_name
        self.timeout = timeout_seconds or settings.HTTP_TIMEOUT_SECONDS

    async def _get(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        use_retry: bool = True,
    ) -> httpx.Response:
        """Executes HTTP GET request with typed error mapping and optional retry."""

        async def _make_request():
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                try:
                    response = await client.get(url, params=params, headers=headers)

                    if response.status_code in (401, 403):
                        logger.error(f"[{self.provider_name}] Authentication/permission error: HTTP {response.status_code}")
                        raise ProviderAuthError(
                            self.provider_name,
                            f"Authentication failed: HTTP {response.status_code}",
                            status_code=response.status_code,
                        )

                    if response.status_code == 429:
                        retry_after = response.headers.get("Retry-After")
                        retry_sec = int(retry_after) if retry_after and retry_after.isdigit() else 5
                        logger.warning(f"[{self.provider_name}] Rate limited: Retry-After {retry_sec}s")
                        raise ProviderRateLimitError(self.provider_name, retry_after=retry_sec)

                    if response.status_code == 402:
                        logger.error(f"[{self.provider_name}] Payment/Quota required: HTTP 402")
                        raise ProviderQuotaError(self.provider_name, "Quota/Payment exhausted", status_code=402)

                    if response.status_code == 304:
                        return response

                    response.raise_for_status()
                    return response

                except httpx.TimeoutException as e:
                    raise ProviderTimeoutError(self.provider_name, f"Request timed out: {str(e)}") from e
                except httpx.HTTPStatusError as e:
                    raise ProviderError(
                        self.provider_name,
                        f"HTTP error {e.response.status_code}: {e.response.text[:200]}",
                        status_code=e.response.status_code,
                    ) from e
                except (ProviderAuthError, ProviderRateLimitError, ProviderQuotaError, ProviderTimeoutError):
                    raise
                except Exception as e:
                    raise ProviderError(self.provider_name, f"Unexpected request failure: {str(e)}") from e

        if use_retry:
            return await execute_with_retry(
                _make_request,
                max_retries=settings.MAX_HTTP_RETRIES,
                provider_name=self.provider_name,
            )
        else:
            return await _make_request()
