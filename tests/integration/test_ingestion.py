import datetime
import pytest
from unittest.mock import AsyncMock
from backend.app.ingestion.worker import IngestionWorker
from backend.app.intelligence.correlation import CorrelationEngine
from backend.app.normalization.weather import normalize_weatherapi_response
from backend.app.normalization.traffic import normalize_here_traffic_response
from backend.app.normalization.alerts import parse_cap_xml_payload
from backend.app.database.models import (
    WeatherObservation,
    TrafficObservation,
    GovernmentNotice,
    IntelligenceInsight,
)


@pytest.mark.asyncio
async def test_idempotent_ingestion_and_correlation(
    db_session,
    heavy_rain_fixture,
    heavy_traffic_fixture,
    valid_cap_xml,
):
    # 1. Setup Mocked Provider Clients
    mock_weather = AsyncMock()
    mock_weather.fetch_forecast.return_value = normalize_weatherapi_response(heavy_rain_fixture)

    mock_traffic = AsyncMock()
    mock_traffic.fetch_incidents.return_value = normalize_here_traffic_response(heavy_traffic_fixture)

    mock_sachet = AsyncMock()
    mock_sachet.fetch_alerts.return_value = parse_cap_xml_payload(valid_cap_xml)

    worker = IngestionWorker(
        weather_client=mock_weather,
        traffic_client=mock_traffic,
        sachet_client=mock_sachet,
    )

    # 2. Run First Sync Cycle
    worker.ensure_data_sources(db_session)
    weather_log = await worker.sync_weather(db_session)
    traffic_log = await worker.sync_traffic(db_session)
    sachet_log = await worker.sync_sachet(db_session)

    assert weather_log.status == "SUCCESS"
    assert traffic_log.status == "SUCCESS"
    assert sachet_log.status == "SUCCESS"

    initial_weather_count = db_session.query(WeatherObservation).count()
    initial_traffic_count = db_session.query(TrafficObservation).count()
    initial_sachet_count = db_session.query(GovernmentNotice).count()

    assert initial_weather_count > 0
    assert initial_traffic_count == 1
    assert initial_sachet_count == 1

    # 3. Run Second Sync Cycle (Idempotency Test)
    # Repeated ingestion must update existing records, NOT create duplicates!
    await worker.sync_weather(db_session)
    await worker.sync_traffic(db_session)
    await worker.sync_sachet(db_session)

    second_weather_count = db_session.query(WeatherObservation).count()
    second_traffic_count = db_session.query(TrafficObservation).count()
    second_sachet_count = db_session.query(GovernmentNotice).count()

    assert second_weather_count == initial_weather_count
    assert second_traffic_count == initial_traffic_count
    assert second_sachet_count == initial_sachet_count

    # 4. Run Deterministic Correlation Engine
    # Ensure timestamps on observation records match current test evaluation time
    now = datetime.datetime.utcnow()
    db_session.query(WeatherObservation).update({"observed_at": now - datetime.timedelta(minutes=10)})
    db_session.query(TrafficObservation).update({"observed_at": now - datetime.timedelta(minutes=5)})
    db_session.commit()

    engine = CorrelationEngine(db_session)
    insights = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)

    assert len(insights) >= 1
    insight = insights[0]
    assert insight.headline.startswith("Monsoon Commute Alert")
    assert insight.is_active is True
    assert len(insight.signals) == 2

    # 5. Re-run Correlation (Deduplication Test)
    re_run_insights = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)
    assert len(re_run_insights) == 0  # Deduplication must suppress second emission!

    total_insights_count = db_session.query(IntelligenceInsight).count()
    assert total_insights_count == len(insights)
