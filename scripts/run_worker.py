#!/usr/bin/env python3
"""
MyArea24 — Background Ingestion & Correlation Worker Entrypoint
Can be executed as a one-off cycle or as a continuous background daemon.
"""

import argparse
import asyncio
import signal
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.core.logging import logger
from backend.app.database.session import SessionLocal, Base, engine
from backend.app.ingestion.worker import IngestionWorker
from backend.app.intelligence.correlation import CorrelationEngine


async def run_single_cycle():
    logger.info("Executing single ingestion and correlation cycle...")
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        worker = IngestionWorker()
        results = await worker.run_full_sync_cycle(db)
        logger.info(
            f"Ingestion results -> Weather: {results['weather'].status} ({results['weather'].records_persisted} new), "
            f"Traffic: {results['traffic'].status} ({results['traffic'].records_persisted} new), "
            f"SACHET: {results['sachet'].status} ({results['sachet'].records_persisted} new)"
        )

        corr = CorrelationEngine(db)
        insights = corr.run_correlation(enforce_time_window=False)
        logger.info(f"Correlation complete: {len(insights)} active insights emitted.")


async def run_daemon(poll_interval_seconds: int = 600):
    logger.info(f"Starting continuous worker daemon (poll interval: {poll_interval_seconds}s)...")
    Base.metadata.create_all(bind=engine)
    stop_event = asyncio.Event()

    def handle_exit(*_):
        logger.info("Received exit signal. Shutting down worker daemon...")
        stop_event.set()

    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    while not stop_event.is_set():
        try:
            await run_single_cycle()
        except Exception as e:
            logger.error(f"Worker cycle failed with error: {e}")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=poll_interval_seconds)
        except asyncio.TimeoutError:
            pass

    logger.info("Worker daemon terminated.")


def main():
    parser = argparse.ArgumentParser(description="MyArea24 Ingestion & Intelligence Worker")
    parser.add_argument("--once", action="store_true", help="Run a single ingestion & correlation cycle then exit")
    parser.add_argument("--interval", type=int, default=600, help="Daemon polling interval in seconds (default: 600)")
    args = parser.parse_args()

    if args.once:
        asyncio.run(run_single_cycle())
    else:
        asyncio.run(run_daemon(args.interval))


if __name__ == "__main__":
    main()
