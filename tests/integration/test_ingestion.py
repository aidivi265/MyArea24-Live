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
    mock_weather.provider_name = "weatherapi"
    mock_weather.fetch_forecast.return_value = normalize_weatherapi_response(heavy_rain_fixture)

    mock_traffic = AsyncMock()
    mock_traffic.provider_name = "here_traffic"
    mock_traffic.fetch_incidents.return_value = normalize_here_traffic_response(heavy_traffic_fixture)

    mock_sachet = AsyncMock()
    mock_sachet.provider_name = "sachet_cap"
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


@pytest.mark.asyncio
async def test_tomtom_idempotent_ingestion_and_correlation(
    db_session,
    heavy_rain_fixture,
    tomtom_heavy_traffic_fixture,
    valid_cap_xml,
):
    from backend.app.normalization.traffic import normalize_tomtom_traffic_response

    mock_weather = AsyncMock()
    mock_weather.provider_name = "weatherapi"
    mock_weather.fetch_forecast.return_value = normalize_weatherapi_response(heavy_rain_fixture)

    mock_traffic = AsyncMock()
    mock_traffic.provider_name = "tomtom_traffic"
    mock_traffic.fetch_incidents.return_value = normalize_tomtom_traffic_response(tomtom_heavy_traffic_fixture)

    mock_sachet = AsyncMock()
    mock_sachet.provider_name = "sachet_cap"
    mock_sachet.fetch_alerts.return_value = parse_cap_xml_payload(valid_cap_xml)

    worker = IngestionWorker(
        weather_client=mock_weather,
        traffic_client=mock_traffic,
        sachet_client=mock_sachet,
    )

    worker.ensure_data_sources(db_session)
    weather_log = await worker.sync_weather(db_session)
    traffic_log = await worker.sync_traffic(db_session)
    sachet_log = await worker.sync_sachet(db_session)

    assert weather_log.status == "SUCCESS"
    assert traffic_log.status == "SUCCESS"
    assert sachet_log.status == "SUCCESS"

    traffic_obs = db_session.query(TrafficObservation).first()
    assert traffic_obs is not None
    assert traffic_obs.source_id == "tomtom_traffic"
    assert traffic_obs.jam_factor is None  # Never fabricated!
    assert traffic_obs.delay_seconds == 1800
    assert traffic_obs.criticality == "major"

    # Correlate
    now = datetime.datetime.utcnow()
    db_session.query(WeatherObservation).update({"observed_at": now - datetime.timedelta(minutes=10)})
    db_session.query(TrafficObservation).update({"observed_at": now - datetime.timedelta(minutes=5)})
    db_session.commit()

    engine = CorrelationEngine(db_session)
    insights = engine.run_correlation(reference_time_utc=now, enforce_time_window=False)

    assert len(insights) >= 1
    insight = insights[0]
    assert "Monsoon Commute Alert" in insight.headline
    assert "delay +30 mins" in insight.summary.lower()
    assert insight.signals[1].source_name == "tomtom_traffic"
    assert "Delay: +30 mins" in insight.signals[1].metric_summary


@pytest.mark.asyncio
async def test_sachet_worker_expiry_and_duplicate_persistence(
    db_session,
    valid_cap_xml,
    expired_cap_xml,
):
    mock_weather = AsyncMock()
    mock_weather.provider_name = "weatherapi"
    mock_traffic = AsyncMock()
    mock_traffic.provider_name = "tomtom_traffic"

    mock_sachet = AsyncMock()
    mock_sachet.provider_name = "sachet_cap"
    # First sync returns both active and expired alert
    active_alerts = parse_cap_xml_payload(valid_cap_xml)
    expired_alerts = parse_cap_xml_payload(expired_cap_xml)
    mock_sachet.fetch_alerts.return_value = active_alerts + expired_alerts

    worker = IngestionWorker(
        weather_client=mock_weather,
        traffic_client=mock_traffic,
        sachet_client=mock_sachet,
    )
    worker.ensure_data_sources(db_session)

    # 1. First Sync: Persist both notices
    log = await worker.sync_sachet(db_session)
    assert log.status == "SUCCESS"
    assert log.records_fetched == 2
    assert log.records_persisted == 2

    notices = db_session.query(GovernmentNotice).all()
    assert len(notices) == 2

    active_notice = db_session.query(GovernmentNotice).filter_by(alert_identifier="NDMA-CAP-2026-DEL-0841").first()
    expired_notice = db_session.query(GovernmentNotice).filter_by(alert_identifier="NDMA-CAP-2026-DEL-EXPIRED").first()

    assert active_notice.is_active is True
    assert expired_notice.is_active is False

    # 2. Second Sync (Duplicate / Idempotency Check)
    log2 = await worker.sync_sachet(db_session)
    assert log2.status == "SUCCESS"
    assert log2.records_persisted == 0  # Zero new records inserted!
    assert db_session.query(GovernmentNotice).count() == 2  # No duplicate rows created

    # 3. Expiry Transition Check: If time passes and active notice expires
    active_notice.expires_at = datetime.datetime.utcnow() - datetime.timedelta(minutes=5)
    db_session.commit()

    # Re-running sync deactivates expired notice
    await worker.sync_sachet(db_session)
    db_session.refresh(active_notice)
    assert active_notice.is_active is False


