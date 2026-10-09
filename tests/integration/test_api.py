import datetime
from backend.app.database.models import (
    DataSource,
    IntelligenceInsight,
    IntelligenceSignal,
)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "MyArea24"


def test_readiness_endpoint(client, db_session):
    src = DataSource(id="weatherapi", name="WeatherAPI.com", is_active=True, last_status="SUCCESS")
    db_session.add(src)
    db_session.commit()

    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert "weatherapi" in data["sources"]


def test_list_and_get_insights_api(client, db_session):
    # Initially empty
    response = client.get("/api/v1/intelligence")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []

    # Insert sample insight with provenance signal
    now = datetime.datetime.utcnow()
    insight = IntelligenceInsight(
        insight_type="weather_traffic_correlation",
        area_label="Delhi AIIMS Ring Road",
        latitude=28.5672,
        longitude=77.2100,
        radius_km=5.0,
        headline="Monsoon Commute Friction",
        summary="Rain and congestion overlap",
        potential_impact="Transit delay expected",
        recommendation="Take metro",
        evidence_quality="supported",
        composite_severity="high",
        dedup_hash="hash-abc-123",
        is_active=True,
        created_at=now,
        expires_at=now + datetime.timedelta(hours=2),
    )
    db_session.add(insight)
    db_session.flush()

    sig = IntelligenceSignal(
        insight_id=insight.id,
        signal_type="weather",
        source_name="weatherapi",
        observation_table="weather_observations",
        observation_id=10,
        observed_at=now,
        metric_summary="Rain 14 mm/hr",
    )
    db_session.add(sig)
    db_session.commit()

    # Query list
    res_list = client.get("/api/v1/intelligence?area=AIIMS")
    assert res_list.status_code == 200
    list_data = res_list.json()
    assert list_data["total"] == 1
    assert len(list_data["items"]) == 1
    item = list_data["items"][0]
    assert item["headline"] == "Monsoon Commute Friction"
    assert len(item["signals"]) == 1
    assert item["signals"][0]["type"] == "weather"

    # Query detail
    res_detail = client.get(f"/api/v1/intelligence/{insight.id}")
    assert res_detail.status_code == 200
    detail_data = res_detail.json()
    assert detail_data["id"] == insight.id
    assert detail_data["area"]["label"] == "Delhi AIIMS Ring Road"

    # Query 404
    res_not_found = client.get("/api/v1/intelligence/99999")
    assert res_not_found.status_code == 404
