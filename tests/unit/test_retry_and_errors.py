import pytest
from unittest.mock import AsyncMock
from backend.app.core.errors import ProviderAuthError, ProviderRateLimitError, ProviderTimeoutError
from backend.app.ingestion.retry import execute_with_retry


@pytest.mark.asyncio
async def test_retry_success_after_transient_timeout():
    mock_func = AsyncMock()
    mock_func.side_effect = [
        ProviderTimeoutError("test", "Timeout 1"),
        "success_result",
    ]

    result = await execute_with_retry(
        mock_func,
        max_retries=2,
        initial_delay=0.01,
        backoff_factor=1.5,
        jitter=False,
    )
    assert result == "success_result"
    assert mock_func.call_count == 2


@pytest.mark.asyncio
async def test_retry_fails_on_non_retryable_auth_error():
    mock_func = AsyncMock()
    mock_func.side_effect = ProviderAuthError("test", "Invalid API Key")

    with pytest.raises(ProviderAuthError):
        await execute_with_retry(mock_func, max_retries=3, initial_delay=0.01)

    assert mock_func.call_count == 1  # No repeated attempts on 401/403


@pytest.mark.asyncio
async def test_retry_exhausted_raises_exception():
    mock_func = AsyncMock()
    mock_func.side_effect = ProviderRateLimitError("test", retry_after=0)

    with pytest.raises(ProviderRateLimitError):
        await execute_with_retry(mock_func, max_retries=2, initial_delay=0.01, jitter=False)

    assert mock_func.call_count == 3  # Initial + 2 retries
