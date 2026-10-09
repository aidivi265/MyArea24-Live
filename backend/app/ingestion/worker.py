import datetime
import time
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.models import (
    DataSource,
    DataSyncLog,
    WeatherObservation,
    TrafficObservation,
    GovernmentNotice,
)
from backend.app.integrations.weatherapi.client import WeatherAPIClient
from backend.app.integrations.tomtom.client import TomTomTrafficClient
from backend.app.integrations.here.client import HERETrafficClient
from backend.app.integrations.sachet.client import SACHETClient
from backend.app.normalization.weather import NormalizedWeatherRecord
from backend.app.normalization.traffic import NormalizedTrafficRecord
from backend.app.normalization.alerts import NormalizedAlertRecord


class IngestionWorker:
    """
    Coordinates data ingestion, validation, normalization, and idempotent persistence.
    """

    def __init__(
        self,
        weather_client: Optional[WeatherAPIClient] = None,
        traffic_client: Optional[Any] = None,
        sachet_client: Optional[SACHETClient] = None,
    ):
        self.weather_client = weather_client or WeatherAPIClient()
        if traffic_client is not None:
            self.traffic_client = traffic_client
        elif settings.TRAFFIC_PROVIDER.lower() == "tomtom":
            self.traffic_client = TomTomTrafficClient()
        else:
            self.traffic_client = HERETrafficClient()
        self.sachet_client = sachet_client or SACHETClient()

    def ensure_data_sources(self, db: Session) -> None:
        """Initializes default DataSource records if missing."""
        traffic_source_id = getattr(self.traffic_client, "provider_name", "tomtom_traffic")
        if not isinstance(traffic_source_id, str):
            traffic_source_id = "tomtom_traffic" if settings.TRAFFIC_PROVIDER == "tomtom" else "here_traffic"
        traffic_name = "TomTom Traffic Incidents v5" if "tomtom" in traffic_source_id else "HERE Technologies Traffic v7"
        traffic_url = settings.TOMTOM_TRAFFIC_BASE_URL if "tomtom" in traffic_source_id else settings.HERE_TRAFFIC_BASE_URL

        sources = [
            ("weatherapi", "WeatherAPI.com", settings.WEATHERAPI_BASE_URL),
            (traffic_source_id, traffic_name, traffic_url),
            ("sachet_cap", "NDMA SACHET Disaster Alerts", settings.SACHET_FEED_URL),
        ]
        for src_id, name, url in sources:
            existing = db.query(DataSource).filter(DataSource.id == src_id).first()
            if not existing:
                src = DataSource(id=src_id, name=name, base_url=url, is_active=True)
                db.add(src)
        db.commit()

    async def sync_weather(self, db: Session) -> DataSyncLog:
        """Polls WeatherAPI for all configured pilot locations and persists records."""
        start_time = datetime.datetime.utcnow()
        start_mono = time.monotonic()
        fetched_count = 0
        persisted_count = 0
        rejected_count = 0
        status = "SUCCESS"
        error_msg = None

        try:
            locations = settings.parsed_pilot_locations
            for loc in locations:
                try:
                    records = await self.weather_client.fetch_forecast(loc.lat, loc.lon)
                    fetched_count += len(records)
                    for rec in records:
                        # Check existing by source_record_id
                        existing = db.query(WeatherObservation).filter(
                            WeatherObservation.source_record_id == rec.source_record_id
                        ).first()
                        if existing:
                            # Update existing record
                            existing.temperature_c = rec.temperature_c
                            existing.precipitation_mm = rec.precipitation_mm
                            existing.condition_text = rec.condition_text
                            existing.ingested_at = datetime.datetime.utcnow()
                        else:
                            obs = WeatherObservation(
                                source_id=rec.source_id,
                                source_record_id=rec.source_record_id,
                                location_name=loc.name,
                                latitude=rec.latitude,
                                longitude=rec.longitude,
                                observed_at=rec.observed_at,
                                forecast_valid_until=rec.forecast_valid_until,
                                temperature_c=rec.temperature_c,
                                precipitation_mm=rec.precipitation_mm,
                                precipitation_interval_minutes=rec.precipitation_interval_minutes,
                                condition_text=rec.condition_text,
                                wind_kph=rec.wind_kph,
                                humidity=rec.humidity,
                                raw_timestamp=rec.raw_timestamp,
                            )
                            db.add(obs)
                            persisted_count += 1
                    db.commit()
                except Exception as loc_err:
                    logger.error(f"[worker] Weather sync error for {loc.name}: {loc_err}")
                    rejected_count += 1
                    db.rollback()

        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            logger.error(f"[worker] Weather sync failed: {e}")
            db.rollback()

        duration_ms = int((time.monotonic() - start_mono) * 1000)
        end_time = datetime.datetime.utcnow()

        log = DataSyncLog(
            source_id="weatherapi",
            sync_started_at=start_time,
            sync_ended_at=end_time,
            duration_ms=duration_ms,
            records_fetched=fetched_count,
            records_persisted=persisted_count,
            records_rejected=rejected_count,
            status=status,
            error_message=error_msg,
        )
        db.add(log)

        # Update source metadata
        src = db.query(DataSource).filter(DataSource.id == "weatherapi").first()
        if src:
            src.last_sync_at = end_time
            src.last_status = status
            if status == "FAILED":
                src.error_count += 1

        db.commit()
        return log

    async def sync_traffic(self, db: Session) -> DataSyncLog:
        """Polls HERE Traffic for pilot bounding box and persists incidents."""
        start_time = datetime.datetime.utcnow()
        start_mono = time.monotonic()
        fetched_count = 0
        persisted_count = 0
        rejected_count = 0
        status = "SUCCESS"
        error_msg = None

        try:
            bbox = settings.traffic_bbox_coords
            records = await self.traffic_client.fetch_incidents(bbox)
            fetched_count = len(records)

            for rec in records:
                existing = db.query(TrafficObservation).filter(
                    TrafficObservation.source_record_id == rec.source_record_id
                ).first()
                if existing:
                    existing.jam_factor = rec.jam_factor
                    existing.delay_seconds = rec.delay_seconds
                    existing.criticality = rec.criticality
                    existing.expected_end_at = rec.expected_end_at
                    existing.ingested_at = datetime.datetime.utcnow()
                else:
                    obs = TrafficObservation(
                        source_id=rec.source_id,
                        source_record_id=rec.source_record_id,
                        incident_type=rec.incident_type,
                        criticality=rec.criticality,
                        latitude=rec.latitude,
                        longitude=rec.longitude,
                        geometry_geojson=rec.geometry_geojson,
                        jam_factor=rec.jam_factor,
                        delay_seconds=rec.delay_seconds,
                        road_name=rec.road_name,
                        description=rec.description,
                        observed_at=rec.observed_at,
                        expected_end_at=rec.expected_end_at,
                    )
                    db.add(obs)
                    persisted_count += 1
            db.commit()

        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            logger.error(f"[worker] Traffic sync failed: {e}")
            db.rollback()

        duration_ms = int((time.monotonic() - start_mono) * 1000)
        end_time = datetime.datetime.utcnow()

        traffic_source_id = getattr(self.traffic_client, "provider_name", "tomtom_traffic")
        log = DataSyncLog(
            source_id=traffic_source_id,
            sync_started_at=start_time,
            sync_ended_at=end_time,
            duration_ms=duration_ms,
            records_fetched=fetched_count,
            records_persisted=persisted_count,
            records_rejected=rejected_count,
            status=status,
            error_message=error_msg,
        )
        db.add(log)

        src = db.query(DataSource).filter(DataSource.id == traffic_source_id).first()
        if src:
            src.last_sync_at = end_time
            src.last_status = status
            if status == "FAILED":
                src.error_count += 1

        db.commit()
        return log

    async def sync_sachet(self, db: Session) -> DataSyncLog:
        """Polls NDMA SACHET CAP XML feed and updates government advisories."""
        start_time = datetime.datetime.utcnow()
        start_mono = time.monotonic()
        fetched_count = 0
        persisted_count = 0
        rejected_count = 0
        status = "SUCCESS"
        error_msg = None

        try:
            records = await self.sachet_client.fetch_alerts()
            fetched_count = len(records)
            now = datetime.datetime.utcnow()

            for rec in records:
                existing = db.query(GovernmentNotice).filter(
                    GovernmentNotice.alert_identifier == rec.alert_identifier
                ).first()
                if existing:
                    existing.expires_at = rec.expires_at
                    existing.is_active = rec.expires_at > now
                    existing.ingested_at = now
                else:
                    notice = GovernmentNotice(
                        source_id=rec.source_id,
                        alert_identifier=rec.alert_identifier,
                        sender=rec.sender,
                        event_type=rec.event_type,
                        severity=rec.severity,
                        urgency=rec.urgency,
                        certainty=rec.certainty,
                        headline=rec.headline,
                        description=rec.description,
                        instruction=rec.instruction,
                        area_description=rec.area_description,
                        polygon_geojson=rec.polygon_geojson,
                        circle_geojson=rec.circle_geojson,
                        effective_at=rec.effective_at,
                        expires_at=rec.expires_at,
                        is_active=rec.is_active,
                    )
                    db.add(notice)
                    persisted_count += 1

            # Mark expired notices
            db.query(GovernmentNotice).filter(
                GovernmentNotice.expires_at <= now,
                GovernmentNotice.is_active == True,
            ).update({"is_active": False})

            db.commit()

        except Exception as e:
            status = "FAILED"
            error_msg = str(e)
            logger.error(f"[worker] SACHET sync failed: {e}")
            db.rollback()

        duration_ms = int((time.monotonic() - start_mono) * 1000)
        end_time = datetime.datetime.utcnow()

        log = DataSyncLog(
            source_id="sachet_cap",
            sync_started_at=start_time,
            sync_ended_at=end_time,
            duration_ms=duration_ms,
            records_fetched=fetched_count,
            records_persisted=persisted_count,
            records_rejected=rejected_count,
            status=status,
            error_message=error_msg,
        )
        db.add(log)

        src = db.query(DataSource).filter(DataSource.id == "sachet_cap").first()
        if src:
            src.last_sync_at = end_time
            src.last_status = status
            if status == "FAILED":
                src.error_count += 1

        db.commit()
        return log

    async def run_full_sync_cycle(self, db: Session) -> Dict[str, DataSyncLog]:
        """Runs a complete sync cycle across all sources."""
        self.ensure_data_sources(db)
        results = {}
        results["weather"] = await self.sync_weather(db)
        results["traffic"] = await self.sync_traffic(db)
        results["sachet"] = await self.sync_sachet(db)
        return results
