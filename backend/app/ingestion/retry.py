import asyncio
import random
import time
from typing import Callable, TypeVar, Any
from backend.app.core.errors import ProviderRateLimitError, ProviderTimeoutError
from backend.app.core.logging import logger

T = TypeVar("T")


async def execute_with_retry(
    func: Callable[..., Any],
    max_retries: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    jitter: bool = True,
    provider_name: str = "provider",
) -> Any:
    """
    Executes an async callable with exponential backoff and jitter.
    Respects ProviderRateLimitError.retry_after when provided.
    """
    attempt = 0
    delay = initial_delay

    while True:
        try:
            return await func()
        except ProviderRateLimitError as e:
            attempt += 1
            if attempt > max_retries:
                logger.error(f"[{provider_name}] Max retries exceeded after rate limit: {e}")
                raise

            sleep_time = e.retry_after if e.retry_after else delay
            if jitter:
                sleep_time += random.uniform(0.1, 0.5)

            logger.warning(
                f"[{provider_name}] Rate limited on attempt {attempt}/{max_retries}. Backing off for {sleep_time:.2f}s"
            )
            await asyncio.sleep(sleep_time)
            delay *= backoff_factor

        except ProviderTimeoutError as e:
            attempt += 1
            if attempt > max_retries:
                logger.error(f"[{provider_name}] Max retries exceeded after timeout: {e}")
                raise

            sleep_time = delay + (random.uniform(0.1, 0.5) if jitter else 0.0)
            logger.warning(
                f"[{provider_name}] Request timed out on attempt {attempt}/{max_retries}. Retrying in {sleep_time:.2f}s"
            )
            await asyncio.sleep(sleep_time)
            delay *= backoff_factor

        except Exception as e:
            # Non-retryable error (e.g. Auth error, 400 Bad Request)
            raise
