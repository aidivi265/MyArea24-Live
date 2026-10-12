import asyncio
from typing import Any, Dict, Optional
from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.session import SessionLocal
from backend.app.ingestion.worker import IngestionWorker
from backend.app.intelligence.correlation import CorrelationEngine


class IngestionScheduler:
    """
    Lightweight, in-process async scheduler for background ingestion and correlation jobs.
    Does not require Celery, Redis, or external brokers.
    Features graceful shutdown, lock guards against overlap, and master enable/disable switches.
    """

    def __init__(self, worker: Optional[IngestionWorker] = None):
        self.worker = worker or IngestionWorker()
        self._running = False
        self._shutdown_event: Optional[asyncio.Event] = None
        self._weather_lock: Optional[asyncio.Lock] = None
        self._traffic_lock: Optional[asyncio.Lock] = None
        self._sachet_lock: Optional[asyncio.Lock] = None
        self._aqi_lock: Optional[asyncio.Lock] = None
        self._correlation_lock: Optional[asyncio.Lock] = None
        self._tasks: list[asyncio.Task] = []

    def _get_shutdown_event(self) -> asyncio.Event:
        if self._shutdown_event is None:
            self._shutdown_event = asyncio.Event()
        return self._shutdown_event

    def _get_weather_lock(self) -> asyncio.Lock:
        if self._weather_lock is None:
            self._weather_lock = asyncio.Lock()
        return self._weather_lock

    def _get_traffic_lock(self) -> asyncio.Lock:
        if self._traffic_lock is None:
            self._traffic_lock = asyncio.Lock()
        return self._traffic_lock

    def _get_sachet_lock(self) -> asyncio.Lock:
        if self._sachet_lock is None:
            self._sachet_lock = asyncio.Lock()
        return self._sachet_lock

    def _get_aqi_lock(self) -> asyncio.Lock:
        if self._aqi_lock is None:
            self._aqi_lock = asyncio.Lock()
        return self._aqi_lock

    def _get_correlation_lock(self) -> asyncio.Lock:
        if self._correlation_lock is None:
            self._correlation_lock = asyncio.Lock()
        return self._correlation_lock

    async def _run_correlation_pass(self) -> int:
        """Executes a thread-safe cross-signal correlation pass over persisted observations."""
        async with self._get_correlation_lock():
            with SessionLocal() as db:
                engine = CorrelationEngine(db)
                insights = engine.run_correlation(enforce_time_window=False)
                if insights:
                    logger.info(f"[scheduler] Cross-signal correlation emitted {len(insights)} new insights.")
                return len(insights)

    async def _weather_loop(self):
        interval_sec = settings.WEATHER_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting weather loop (interval: {interval_sec}s)")
        event = self._get_shutdown_event()
        while not event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._get_weather_lock():
                        with SessionLocal() as db:
                            await self.worker.sync_weather(db)
                    await self._run_correlation_pass()
                except Exception as e:
                    logger.error(f"[scheduler] Weather job unhandled error: {e}")
            try:
                await asyncio.wait_for(event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def _traffic_loop(self):
        interval_sec = settings.TRAFFIC_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting traffic loop (interval: {interval_sec}s)")
        event = self._get_shutdown_event()
        while not event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._get_traffic_lock():
                        with SessionLocal() as db:
                            await self.worker.sync_traffic(db)
                    await self._run_correlation_pass()
                except Exception as e:
                    logger.error(f"[scheduler] Traffic job unhandled error: {e}")
            try:
                await asyncio.wait_for(event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def _sachet_loop(self):
        interval_sec = settings.SACHET_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting SACHET loop (interval: {interval_sec}s)")
        event = self._get_shutdown_event()
        while not event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._get_sachet_lock():
                        with SessionLocal() as db:
                            await self.worker.sync_sachet(db)
                    await self._run_correlation_pass()
                except Exception as e:
                    logger.error(f"[scheduler] SACHET job unhandled error: {e}")
            try:
                await asyncio.wait_for(event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def _aqi_loop(self):
        interval_sec = settings.AQI_POLL_INTERVAL_MINUTES * 60
        logger.info(f"[scheduler] Starting Air Quality (OpenAQ/CPCB) loop (interval: {interval_sec}s)")
        event = self._get_shutdown_event()
        while not event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    async with self._get_aqi_lock():
                        with SessionLocal() as db:
                            await self.worker.sync_air_quality(db)
                    await self._run_correlation_pass()
                except Exception as e:
                    logger.error(f"[scheduler] Air Quality job unhandled error: {e}")
            try:
                await asyncio.wait_for(event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def _correlation_loop(self):
        interval_sec = getattr(settings, "CORRELATION_POLL_INTERVAL_MINUTES", 10) * 60
        logger.info(f"[scheduler] Starting Cross-Signal Correlation loop (interval: {interval_sec}s)")
        event = self._get_shutdown_event()
        while not event.is_set():
            if settings.INGESTION_ENABLED:
                try:
                    await self._run_correlation_pass()
                except Exception as e:
                    logger.error(f"[scheduler] Correlation job unhandled error: {e}")
            try:
                await asyncio.wait_for(event.wait(), timeout=interval_sec)
            except asyncio.TimeoutError:
                pass

    async def run_once(self, db: Optional[ Any ] = None) -> Dict[str, Any]:
        """
        Executes a single deterministic cycle across all 4 ingestion sources
        (Weather, Traffic, SACHET, Air Quality) followed by Cross-Signal Correlation.
        """
        if db is not None:
            logs = await self.worker.run_full_sync_cycle(db)
            insights = CorrelationEngine(db).run_correlation(enforce_time_window=False)
            return {"logs": logs, "insights_emitted": len(insights), "insights": insights}

        with SessionLocal() as session:
            logs = await self.worker.run_full_sync_cycle(session)
            insights = CorrelationEngine(session).run_correlation(enforce_time_window=False)
            return {"logs": logs, "insights_emitted": len(insights), "insights": insights}

    def start(self):
        """Starts background ingestion and correlation loops in asyncio event loop."""
        if self._running:
            return
        self._running = True
        self._shutdown_event = asyncio.Event()
        self._weather_lock = asyncio.Lock()
        self._traffic_lock = asyncio.Lock()
        self._sachet_lock = asyncio.Lock()
        self._aqi_lock = asyncio.Lock()
        self._correlation_lock = asyncio.Lock()
        try:
            with SessionLocal() as db:
                self.worker.ensure_data_sources(db)
        except Exception as e:
            logger.warning(f"[scheduler] Could not pre-initialize data sources: {e}")
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        self._tasks.append(loop.create_task(self._weather_loop()))
        self._tasks.append(loop.create_task(self._traffic_loop()))
        self._tasks.append(loop.create_task(self._sachet_loop()))
        self._tasks.append(loop.create_task(self._aqi_loop()))
        self._tasks.append(loop.create_task(self._correlation_loop()))
        logger.info(
            "[scheduler] Background ingestion & correlation loops initialized "
            "(weather, traffic, sachet, air_quality, correlation)."
        )

    async def stop(self):
        """Signals graceful shutdown and waits for running jobs to finish."""
        if not self._running:
            return
        logger.info("[scheduler] Initiating graceful shutdown...")
        if self._shutdown_event:
            self._shutdown_event.set()
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        self._running = False
        logger.info("[scheduler] Background ingestion & correlation loops stopped.")

    def get_status(self) -> Dict[str, Any]:
        """Returns diagnostic status of background scheduler tasks."""
        return {
            "running": self._running,
            "ingestion_enabled": settings.INGESTION_ENABLED,
            "active_tasks": len([t for t in self._tasks if not t.done()]),
            "loops": ["weather", "traffic", "sachet", "air_quality", "correlation"],
        }


scheduler = IngestionScheduler()
