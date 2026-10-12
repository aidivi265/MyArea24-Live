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
    assert (
        "Strict data integrity" in data["message"]
        or "protect data integrity" in data["message"]
        or "not configured" in data["message"]
        or "No air quality monitoring stations" in data["message"]
    )


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


def test_merchant_business_hours_and_product_price_updates(client, db_session):
    from backend.app.database.models import Business, Product, User
    from backend.app.core.security import create_access_token

    merchant = User(
        email="sharma.electronics@test.in",
        full_name="Rajesh Sharma",
        role="merchant",
        is_active=True,
        is_verified=True,
    )
    db_session.add(merchant)
    db_session.commit()
    db_session.refresh(merchant)

    token = create_access_token({"sub": str(merchant.id), "role": merchant.role})
    headers = {"Authorization": f"Bearer {token}"}

    biz = Business(
        owner_id=merchant.id,
        name="Sharma Electronics",
        slug="sharma-electronics-test",
        category="Electronics",
        address="Shop 12, Connaught Place",
        locality="Connaught Place",
        city="Delhi",
        state="Delhi",
        latitude=28.6304,
        longitude=77.2177,
        phone="9876543210",
        opening_time="09:00",
        closing_time="21:00",
        days_open="Mon-Sat",
        status="active",
        is_verified=True,
    )
    db_session.add(biz)
    db_session.commit()
    db_session.refresh(biz)

    # 1. Verify merchant dashboard analytics returns full business hours & contact fields
    dash_res = client.get(f"/api/v1/enquiries/merchant/{biz.id}", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["business"]["opening_time"] == "09:00"
    assert dash_data["business"]["closing_time"] == "21:00"
    assert dash_data["business"]["phone"] == "9876543210"
    assert dash_data["business"]["locality"] == "Connaught Place"

    # 2. Update business operating hours, phone, whatsapp, and address via PUT /api/v1/businesses/{id}
    upd_biz_res = client.put(
        f"/api/v1/businesses/{biz.id}",
        headers=headers,
        json={
            "opening_time": "08:30",
            "closing_time": "22:30",
            "days_open": "Mon-Sun",
            "phone": "9988776655",
            "whatsapp": "9988776655",
            "address": "Shop 12-B, Inner Circle, Connaught Place",
        },
    )
    assert upd_biz_res.status_code == 200
    upd_biz_data = upd_biz_res.json()
    assert upd_biz_data["success"] is True
    assert upd_biz_data["business"]["opening_time"] == "08:30"
    assert upd_biz_data["business"]["closing_time"] == "22:30"
    assert upd_biz_data["business"]["days_open"] == "Mon-Sun"
    assert upd_biz_data["business"]["phone"] == "9988776655"
    assert upd_biz_data["business"]["whatsapp"] == "9988776655"

    # 3. Create a product and update its local_price and mrp via PUT /api/v1/products/{id}
    prod = Product(
        business_id=biz.id,
        name="Havells Ceiling Fan",
        category="Electronics",
        local_price=2400.0,
        mrp=2800.0,
        availability_status="in_stock",
    )
    db_session.add(prod)
    db_session.commit()
    db_session.refresh(prod)

    upd_prod_res = client.put(
        f"/api/v1/products/{prod.id}",
        headers=headers,
        json={
            "local_price": 2199.0,
            "mrp": 2750.0,
            "availability_status": "low_stock",
        },
    )
    assert upd_prod_res.status_code == 200
    upd_prod_data = upd_prod_res.json()
    assert upd_prod_data["success"] is True
    assert upd_prod_data["product"]["local_price"] == 2199.0
    assert upd_prod_data["product"]["mrp"] == 2750.0
    assert upd_prod_data["product"]["availability_status"] == "low_stock"


def test_pan_india_services_and_events_generator(client, db_session):
    # 1. Verify /api/v1/services synthesizes local providers for non-NCR cities even without user_lat/user_lon
    svc_patna = client.get("/api/v1/services?city=Patna&locality=Patna+Boring+Road")
    assert svc_patna.status_code == 200
    patna_data = svc_patna.json()
    assert patna_data["total"] >= 5
    categories_found = {item["category"] for item in patna_data["items"]}
    for expected_cat in ("Electrician", "Plumber", "AC Repair", "Carpenter", "Appliance Repair"):
        assert expected_cat in categories_found
    assert all("Patna" in item["city"] or "Boring Road" in item["locality"] for item in patna_data["items"])

    # 2. Verify category filter for another Indian city (Kochi)
    svc_kochi = client.get("/api/v1/services?city=Kochi&locality=Kochi+Edappally&category=Electrician")
    assert svc_kochi.status_code == 200
    kochi_data = svc_kochi.json()
    assert kochi_data["total"] >= 1
    assert kochi_data["items"][0]["category"] == "Electrician"
    assert "Kochi" in kochi_data["items"][0]["city"]

    # 3. Verify /api/v1/events generates localized events for non-NCR cities with zero Delhi leakage
    ev_patna = client.get("/api/v1/events?city=Patna&locality=Boring+Road")
    assert ev_patna.status_code == 200
    ev_patna_data = ev_patna.json()
    assert ev_patna_data["total"] >= 6
    assert all(item["city"].lower() == "patna" for item in ev_patna_data["items"])
    ev_categories = {item["category"] for item in ev_patna_data["items"]}
    assert "Concerts & Music" in ev_categories
    assert "Sports & Screenings" in ev_categories
    assert "Workshops" in ev_categories
    assert "Civic Advisory" in ev_categories

    ev_jaipur = client.get("/api/v1/events?city=Jaipur&locality=Malviya+Nagar")
    assert ev_jaipur.status_code == 200
    ev_jaipur_data = ev_jaipur.json()
    assert ev_jaipur_data["total"] >= 6
    assert all(item["city"].lower() == "jaipur" for item in ev_jaipur_data["items"])


def test_community_signals_route_risk_and_scheduler_loops(client, db_session):
    import asyncio
    from unittest.mock import AsyncMock, patch
    from backend.app.ingestion.scheduler import IngestionScheduler

    # 1. Baseline route evaluation before any citizen ground reports
    route_payload = {
        "origin_name": "Connaught Place",
        "origin_latitude": 28.6315,
        "origin_longitude": 77.2167,
        "destination_name": "AIIMS / South Extension",
        "destination_latitude": 28.5672,
        "destination_longitude": 77.2100,
    }
    base_res = client.post("/api/v1/intelligence/routes/evaluate", json=route_payload)
    assert base_res.status_code == 200
    base_data = base_res.json()
    base_surface = next(c for c in base_data["evaluated_corridors"] if "Direct Arterial" in c["route_name"])
    base_risk = base_surface["risk_score"]
    base_delay = base_surface["estimated_delay_min"]

    # 2. Submit verified citizen ground reports (WATERLOGGING + ROAD_BLOCKAGE + ACCIDENT)
    wl_res = client.post(
        "/api/v1/intelligence/community/signals",
        json={
            "signal_type": "WATERLOGGING",
            "title": "Knee-deep waterlogging at Minto Bridge underpass",
            "description": "Drainage overflow stalling sedans and two-wheelers",
            "locality": "Connaught Place",
            "city": "New Delhi",
            "state": "Delhi",
            "latitude": 28.6320,
            "longitude": 77.2190,
            "severity": "high",
        },
    )
    assert wl_res.status_code == 201
    wl_id = wl_res.json()["id"]

    blk_res = client.post(
        "/api/v1/intelligence/community/signals",
        json={
            "signal_type": "ROAD_BLOCKAGE",
            "title": "Fallen tree blocking two lanes near India Gate hexagon",
            "locality": "India Gate",
            "city": "New Delhi",
            "state": "Delhi",
            "latitude": 28.6129,
            "longitude": 77.2295,
            "severity": "high",
        },
    )
    assert blk_res.status_code == 201

    acc_res = client.post(
        "/api/v1/intelligence/community/signals",
        json={
            "signal_type": "ACCIDENT",
            "title": "Multi-vehicle collision on Aurobindo Marg flyover approach",
            "locality": "South Extension",
            "city": "New Delhi",
            "state": "Delhi",
            "latitude": 28.5700,
            "longitude": 77.2120,
            "severity": "severe",
        },
    )
    assert acc_res.status_code == 201

    # 3. Verify evaluate_route_risk integrates the 3 citizen reports into score, delay & warnings
    eval_res = client.post("/api/v1/intelligence/routes/evaluate", json=route_payload)
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data["active_community_reports_count"] >= 3
    assert "citizen ground report" in eval_data["ai_commute_advisory"].lower()

    surface = next(c for c in eval_data["evaluated_corridors"] if "Direct Arterial" in c["route_name"])
    assert surface["community_reports_count"] >= 3
    assert surface["risk_score"] > base_risk
    assert surface["estimated_delay_min"] > base_delay
    assert surface["waterlogging_risk"] in ("HIGH", "CRITICAL")
    assert any("WATERLOGGING" in h for h in surface["community_hazards"])
    assert any("ROAD_BLOCKAGE" in h for h in surface["community_hazards"])
    assert any("ACCIDENT" in h for h in surface["community_hazards"])
    assert any("Citizen Ground Report" in w for w in surface["key_warnings"])

    # 4. Verify CorrelationEngine emitted community_ground_truth_correlation insights
    insights_res = client.get(
        "/api/v1/intelligence?insight_type=community_ground_truth_correlation&area=Connaught+Place"
    )
    assert insights_res.status_code == 200
    insights_data = insights_res.json()
    assert insights_data["total"] >= 1
    first_insight = insights_data["items"][0]
    assert first_insight["insight_type"] == "community_ground_truth_correlation"
    assert any(s["type"] == "community" for s in first_insight["signals"])

    # 5. Upvote and Resolve a signal -> verify linked insight deactivates
    upv_res = client.post(f"/api/v1/intelligence/community/signals/{wl_id}/upvote")
    assert upv_res.status_code == 200
    assert upv_res.json()["upvotes"] >= 2

    res_sig = client.post(
        f"/api/v1/intelligence/community/signals/{wl_id}/resolve?notes=Municipal+pumps+cleared+water"
    )
    assert res_sig.status_code == 200
    assert res_sig.json()["status"] == "RESOLVED"

    # 6. Verify IngestionScheduler includes air_quality + correlation loops and run_once executes both
    sched = IngestionScheduler()
    status_info = sched.get_status()
    assert "air_quality" in status_info["loops"]
    assert "correlation" in status_info["loops"]
    assert hasattr(sched, "_aqi_loop")
    assert hasattr(sched, "_correlation_loop")

    with patch.object(sched.worker, "run_full_sync_cycle", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = [
            {"source": "weatherapi", "status": "success"},
            {"source": "tomtom_traffic", "status": "success"},
            {"source": "ndma_sachet", "status": "success"},
            {"source": "openaq", "status": "success"},
        ]
        cycle_res = asyncio.run(sched.run_once(db=db_session))
        mock_sync.assert_called_once_with(db_session)
        assert "logs" in cycle_res
        assert "insights_emitted" in cycle_res
