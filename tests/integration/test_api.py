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


def test_list_localities_endpoint(client):
    response = client.get("/api/v1/intelligence/localities")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    assert any("AIIMS" in loc["name"] for loc in data)
    assert any("Indiranagar" in loc["name"] for loc in data)
    assert all("coverage_status" in loc for loc in data)


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


def test_api_filtering_by_type_severity_and_confidence(client, db_session):
    now = datetime.datetime.utcnow()

    # 1. Weather + Traffic correlation (severe, high confidence)
    ins1 = IntelligenceInsight(
        insight_type="weather_traffic_correlation",
        area_label="Rohini, Delhi",
        latitude=28.7041,
        longitude=77.1025,
        radius_km=5.0,
        headline="Monsoon Commute Alert",
        summary="Rain and traffic friction",
        potential_impact="Severe delays",
        recommendation="Take metro",
        evidence_quality="supported",
        composite_severity="severe",
        confidence_level="HIGH (Multi-Source Corroborated)",
        rule_identifier="SCENARIO_A_WEATHER_TRAFFIC",
        rule_version="1.0",
        dedup_hash="hash-1",
        is_active=True,
        created_at=now,
        expires_at=now + datetime.timedelta(hours=2),
    )

    # 2. Severe Public Alert (moderate, high confidence)
    ins2 = IntelligenceInsight(
        insight_type="severe_public_alert",
        area_label="Rohini, Delhi",
        latitude=28.7041,
        longitude=77.1025,
        radius_km=10.0,
        headline="Official Public Alert",
        summary="Thunderstorm warning",
        potential_impact="Wind and rain damage",
        recommendation="Stay indoors",
        evidence_quality="supported",
        composite_severity="moderate",
        confidence_level="HIGH (Official Emergency Authority)",
        rule_identifier="SCENARIO_B_PUBLIC_ALERT",
        rule_version="1.0",
        dedup_hash="hash-2",
        is_active=True,
        created_at=now - datetime.timedelta(minutes=5),
        expires_at=now + datetime.timedelta(hours=4),
    )

    # 3. Single-signal traffic notice (high severity, medium confidence)
    ins3 = IntelligenceInsight(
        insight_type="single_signal_traffic_notice",
        area_label="Outer Ring Road",
        latitude=28.7100,
        longitude=77.1100,
        radius_km=5.0,
        headline="Traffic Bottleneck Notice",
        summary="35 min delay on flyover",
        potential_impact="Traffic queue expansion",
        recommendation="Avoid flyover",
        evidence_quality="supported",
        composite_severity="high",
        confidence_level="MEDIUM (Single Credible Source)",
        rule_identifier="SCENARIO_C_TRAFFIC_ALERT",
        rule_version="1.0",
        dedup_hash="hash-3",
        is_active=True,
        created_at=now - datetime.timedelta(minutes=10),
        expires_at=now + datetime.timedelta(hours=1),
    )

    db_session.add_all([ins1, ins2, ins3])
    db_session.commit()

    # Filter by insight_type
    res_type = client.get("/api/v1/intelligence?insight_type=severe_public_alert")
    assert res_type.status_code == 200
    data_type = res_type.json()
    assert data_type["total"] == 1
    assert data_type["items"][0]["insight_type"] == "severe_public_alert"

    # Filter by severity
    res_sev = client.get("/api/v1/intelligence?severity=severe")
    assert res_sev.status_code == 200
    data_sev = res_sev.json()
    assert data_sev["total"] == 1
    assert data_sev["items"][0]["composite_severity"] == "severe"

    # Filter by confidence
    res_conf = client.get("/api/v1/intelligence?confidence=Emergency")
    assert res_conf.status_code == 200
    data_conf = res_conf.json()
    assert data_conf["total"] == 1
    assert "Emergency" in data_conf["items"][0]["confidence_level"]

    # Filter by area + type
    res_comb = client.get("/api/v1/intelligence?area=Rohini&insight_type=weather_traffic_correlation")
    assert res_comb.status_code == 200
    data_comb = res_comb.json()
    assert data_comb["total"] == 1
    assert data_comb["items"][0]["area"]["label"] == "Rohini, Delhi"

    # Pagination test
    res_page = client.get("/api/v1/intelligence?page=1&page_size=2")
    assert res_page.status_code == 200
    data_page = res_page.json()
    assert data_page["total"] == 3
    assert len(data_page["items"]) == 2
    assert data_page["page"] == 1
    assert data_page["page_size"] == 2


def test_api_excludes_past_expiry_insights_even_if_flagged_active(client, db_session):
    """
    Regression test: Verifies that an insight whose expires_at has passed
    is NEVER returned in the active intelligence feed, even if is_active is True in the database.
    """
    now = datetime.datetime.utcnow()
    # Expired 10 minutes ago, but is_active is True
    expired_insight = IntelligenceInsight(
        insight_type="single_signal_traffic_notice",
        area_label="Delhi AIIMS Ring Road",
        latitude=28.5672,
        longitude=77.2100,
        radius_km=5.0,
        headline="Expired Traffic Jam",
        summary="Old congestion report",
        potential_impact="Old impact",
        recommendation="None",
        evidence_quality="supported",
        composite_severity="high",
        dedup_hash="hash-expired-test",
        is_active=True,  # Intentionally True
        created_at=now - datetime.timedelta(hours=2),
        expires_at=now - datetime.timedelta(minutes=10),  # In the past
    )
    # Valid active insight
    active_insight = IntelligenceInsight(
        insight_type="single_signal_traffic_notice",
        area_label="Delhi AIIMS Ring Road",
        latitude=28.5672,
        longitude=77.2100,
        radius_km=5.0,
        headline="Active Traffic Jam",
        summary="Current congestion report",
        potential_impact="Current delay",
        recommendation="Reroute",
        evidence_quality="supported",
        composite_severity="high",
        dedup_hash="hash-active-test",
        is_active=True,
        created_at=now - datetime.timedelta(minutes=5),
        expires_at=now + datetime.timedelta(minutes=55),  # In the future
    )
    db_session.add_all([expired_insight, active_insight])
    db_session.commit()

    # Query default active feed: should ONLY return active_insight
    res = client.get("/api/v1/intelligence?is_active=true")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["headline"] == "Active Traffic Jam"

    # Query inactive/expired feed: should return expired_insight
    res_inactive = client.get("/api/v1/intelligence?is_active=false")
    assert res_inactive.status_code == 200
    data_inactive = res_inactive.json()
    assert data_inactive["total"] >= 1
    headlines = [i["headline"] for i in data_inactive["items"]]
    assert "Expired Traffic Jam" in headlines


def test_air_quality_endpoint_awaiting_config(client):
    res = client.get("/api/v1/intelligence/air-quality?area=Delhi AIIMS Ring Road")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("AWAITING_CONFIG", "UNAVAILABLE")
    assert "Strict data integrity" in data["message"] or "protect data integrity" in data["message"] or "not configured" in data["message"]


def test_air_quality_endpoint_with_active_station(client, db_session):
    from backend.app.database.models import AirQualityObservation

    now = datetime.datetime.utcnow()
    obs = AirQualityObservation(
        source_id="openaq",
        source_record_id="openaq:mandir_marg_api_test:1",
        station_id="8120",
        station_name="Mandir Marg CAAQMS",
        city="Delhi",
        latitude=28.6360,
        longitude=77.2010,
        observed_at=now - datetime.timedelta(minutes=25),
        aqi_value=385.0,
        aqi_category="Very Poor",
        prominent_pollutant="PM2.5",
        pm25=210.0,
        pm10=320.0,
    )
    db_session.add(obs)
    db_session.commit()

    # Query for Delhi Connaught Place (~1.7 km away)
    res = client.get("/api/v1/intelligence/air-quality?area=Delhi Connaught Place")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ACTIVE"
    assert data["station_name"] == "Mandir Marg CAAQMS"
    assert data["aqi_value"] == 385.0
    assert data["aqi_category"] == "Very Poor"
    assert data["prominent_pollutant"] == "PM2.5"
    assert data["is_stale"] is False
    assert data["distance_km"] is not None
    assert data["distance_km"] < 5.0


def test_air_quality_endpoint_stale_telemetry(client, db_session):
    from backend.app.database.models import AirQualityObservation

    now = datetime.datetime.utcnow()
    # Delete existing and insert stale observation (> 180 min old)
    db_session.query(AirQualityObservation).delete()
    obs = AirQualityObservation(
        source_id="openaq",
        source_record_id="openaq:mandir_marg_stale:1",
        station_id="8120",
        station_name="Mandir Marg CAAQMS",
        city="Delhi",
        latitude=28.6360,
        longitude=77.2010,
        observed_at=now - datetime.timedelta(minutes=250),
        aqi_value=350.0,
        aqi_category="Very Poor",
    )
    db_session.add(obs)
    db_session.commit()

    res = client.get("/api/v1/intelligence/air-quality?area=Delhi Connaught Place")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "STALE"
    assert data["is_stale"] is True
    assert "stale" in data["message"].lower()


def test_air_quality_endpoint_out_of_range(client, db_session):
    from backend.app.database.models import AirQualityObservation

    now = datetime.datetime.utcnow()
    # Ensure only Delhi station is present
    db_session.query(AirQualityObservation).delete()
    obs = AirQualityObservation(
        source_id="openaq",
        source_record_id="openaq:delhi_only:1",
        station_id="8120",
        station_name="Mandir Marg CAAQMS",
        city="Delhi",
        latitude=28.6360,
        longitude=77.2010,
        observed_at=now - datetime.timedelta(minutes=15),
        aqi_value=310.0,
        aqi_category="Very Poor",
    )
    db_session.add(obs)
    db_session.commit()

    # Query for Bengaluru locality (~1700 km away)
    res = client.get("/api/v1/intelligence/air-quality?area=Bengaluru Silk Board")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "UNAVAILABLE"
    assert "within 15 km" in data["message"]


def test_weather_endpoint_pilot_and_expansion(client, db_session):
    from backend.app.database.models import WeatherObservation

    now = datetime.datetime.utcnow()
    obs = WeatherObservation(
        source_id="weatherapi",
        source_record_id="test:weather:connaught",
        location_name="Delhi Connaught Place",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now,
        temperature_c=28.5,
        precipitation_mm=2.5,
        condition_text="Light Rain",
        wind_kph=14.0,
        humidity=65,
    )
    db_session.add(obs)
    db_session.commit()

    # Pilot locality should return available observation
    res = client.get("/api/v1/intelligence/weather?area=Delhi Connaught Place")
    assert res.status_code == 200
    data = res.json()
    assert data["is_available"] is True
    assert data["location_name"] == "Delhi Connaught Place"
    assert data["temperature_c"] == 28.5
    assert data["condition_text"] == "Light Rain"

    # Unmonitored expansion locality should return is_available=False
    res_exp = client.get("/api/v1/intelligence/weather?area=Mumbai Andheri East (WEH)")
    assert res_exp.status_code == 200
    data_exp = res_exp.json()
    assert data_exp["is_available"] is False
    assert "unmonitored" in data_exp["message"].lower()


def test_traffic_endpoint_pilot_and_expansion(client, db_session):
    from backend.app.database.models import TrafficObservation

    now = datetime.datetime.utcnow()
    obs = TrafficObservation(
        source_id="tomtom",
        source_record_id="test:traffic:cp",
        incident_type="CONGESTION",
        criticality="major",
        road_name="Barakhamba Road",
        description="Heavy traffic jam",
        latitude=28.6310,
        longitude=77.2200,
        delay_seconds=480,
        jam_factor=7.2,
        observed_at=now,
    )
    db_session.add(obs)
    db_session.commit()

    # Pilot locality should return incidents
    res = client.get("/api/v1/intelligence/traffic?area=Delhi Connaught Place")
    assert res.status_code == 200
    data = res.json()
    assert data["is_available"] is True
    assert data["total_incidents"] >= 1
    assert any(i["road_name"] == "Barakhamba Road" for i in data["incidents"])

    # Unmonitored expansion locality
    res_exp = client.get("/api/v1/intelligence/traffic?area=Mumbai Andheri East (WEH)")
    assert res_exp.status_code == 200
    data_exp = res_exp.json()
    assert data_exp["is_available"] is False
    assert data_exp["total_incidents"] == 0


def test_assistant_endpoint_pilot_and_expansion(client, db_session):
    from backend.app.database.models import WeatherObservation, TrafficObservation

    now = datetime.datetime.utcnow()
    w_obs = WeatherObservation(
        source_id="weatherapi",
        source_record_id="test:assistant:w",
        location_name="Delhi Connaught Place",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now,
        temperature_c=29.0,
        precipitation_mm=0.0,
        condition_text="Clear",
    )
    t_obs = TrafficObservation(
        source_id="tomtom",
        source_record_id="test:assistant:t",
        incident_type="CONGESTION",
        criticality="minor",
        road_name="Janpath",
        latitude=28.6250,
        longitude=77.2180,
        delay_seconds=300,
        observed_at=now,
    )
    db_session.add_all([w_obs, t_obs])
    db_session.commit()

    # Query pilot area about traffic
    res = client.get("/api/v1/intelligence/assistant?query=is+it+safe+to+drive&area=Delhi Connaught Place")
    assert res.status_code == 200
    data = res.json()
    assert data["is_live_supported"] is True
    assert "Janpath" in data["response_text"] or len(data["key_findings"]) > 0
    assert "TomTom Traffic API v5" in data["grounded_sources"]
    assert "HIGH" in data["confidence"]

    # Query unmonitored expansion area
    res_exp = client.get("/api/v1/intelligence/assistant?query=is+it+safe+to+drive&area=Mumbai Andheri East (WEH)")
    assert res_exp.status_code == 200
    data_exp = res_exp.json()
    assert data_exp["is_live_supported"] is False
    assert data_exp["confidence"] == "UNAVAILABLE"
    assert "unmonitored" in data_exp["response_text"].lower()


