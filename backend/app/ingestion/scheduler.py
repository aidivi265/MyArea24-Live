import asyncio
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.session import SessionLocal
from backend.app.ingestion.worker import IngestionWorker


class IngestionScheduler:
    """
    Lightweight, in-process async scheduler for background ingestion jobs.
    Does not require Celery, Redis, or external brokers.
    Features graceful shutdown, lock guards against overlap, and master enable/disable switches.
    """

    def __init__(self, worker: Optional[IngestionWorker] = None):
        self.worker = worker or IngestionWorker()
        self._running = False
        self._shutdown_event = asyncio.Event()
        self._lock = asyncio.Lock()
        self._tasks: list[asyncio.Task] = []

    async def _weather_loop(self):
        interval_sec = settings.WEATHER_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting weather loop (interval: {interval_sec}s)")
        while not self._shutdown_event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._lock:
                        with SessionLocal() as db:
                            await self.worker.sync_weather(db)
                except Exception as e:
                    logger.error(f"[scheduler] Weather job unhandled error: {e}")
            try:
                await asyncio.wait_for(self._shutdown_event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def _traffic_loop(self):
        interval_sec = settings.TRAFFIC_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting traffic loop (interval: {interval_sec}s)")
        while not self._shutdown_event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._lock:
                        with SessionLocal() as db:
                            await self.worker.sync_traffic(db)
                except Exception as e:
                    logger.error(f"[scheduler] Traffic job unhandled error: {e}")
            try:
                await asyncio.wait_for(self._shutdown_event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def _sachet_loop(self):
        interval_sec = settings.SACHET_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting SACHET loop (interval: {interval_sec}s)")
        while not self._shutdown_event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._lock:
                        with SessionLocal() as db:
                            await self.worker.sync_sachet(db)
                except Exception as e:
                    logger.error(f"[scheduler] SACHET job unhandled error: {e}")
            try:
                await asyncio.wait_for(self._shutdown_event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    def start(self):
        """Starts background loops in asyncio event loop."""
        if self._running:
            return
        self._running = True
        self._shutdown_event.clear()
        loop = asyncio.get_event_loop()
        self._tasks.append(loop.create_task(self._weather_loop()))
        self._tasks.append(loop.create_task(self._traffic_loop()))
        self._tasks.append(loop.create_task(self._sachet_loop()))
        logger.info("[scheduler] Background ingestion loops initialized.")

    async def stop(self):
        """Signals graceful shutdown and waits for running jobs to finish."""
        if not self._running:
            return
        logger.info("[scheduler] Initiating graceful shutdown...")
        self._shutdown_event.set()
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        self._running = False
        logger.info("[scheduler] Background ingestion loops stopped.")


scheduler = IngestionScheduler()
