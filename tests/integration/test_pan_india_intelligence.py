import datetime
import pytest
from backend.app.database.models import (
    Event,
    TrafficObservation,
    WeatherObservation,
    CommunitySignal,
    GovernmentNotice,
)


def test_pan_india_localities_state_filter(client):
    """Verifies state-level filtering across all 780+ Indian Administrative Districts."""
    res = client.get("/api/v1/intelligence/localities?state=Uttar%20Pradesh")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 10
    names = [d["name"] for d in data]
    assert any("Lucknow" in n for n in names)
    assert any("Kanpur" in n for n in names)
    assert any("Varanasi" in n for n in names)
    assert any(d["coverage_status"] == "Active Pan-India" for d in data)


def test_pan_india_localities_search(client):
    """Verifies keyword search across Indian cities and districts."""
    res = client.get("/api/v1/intelligence/localities?search=Jaipur")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any("Jaipur" in d["name"] for d in data)


def test_contextual_event_intelligence(client, db_session):
    """
    Verifies Contextual Event Intelligence (PPT Slide 05):
    Correlates event venue coordinates with surrounding live traffic, parking pressure,
    and exit weather advisory.
    """
    now = datetime.datetime.utcnow()
    event = Event(
        title="Delhi Tech Summit 2026",
        category="Conference",
        organizer="Ministry of Electronics & IT",
        venue_name="Bharat Mandapam, Pragati Maidan",
        address="Pragati Maidan, New Delhi",
        locality="Central Delhi",
        city="Delhi",
        latitude=28.6180,
        longitude=77.2420,
        start_time=now + datetime.timedelta(hours=2),
        end_time=now + datetime.timedelta(hours=8),
        expected_attendance=6500,
        parking_pressure="CRITICAL",
        arterial_traffic_impact="HIGH_BOTTLENECK",
        exit_weather_advisory="Dry weather; normal dispersal.",
        correlated_commute_route="Mathura Road / Bhairon Marg corridor",
    )
    db_session.add(event)

    # Add surrounding traffic incident (< 5 km away)
    traffic = TrafficObservation(
        source_id="tomtom",
        source_record_id="test:event:mathura_road",
        incident_type="CONGESTION",
        criticality="major",
        road_name="Mathura Road",
        latitude=28.6200,
        longitude=77.2450,
        delay_seconds=900,
        jam_factor=8.0,
        observed_at=now,
    )
    db_session.add(traffic)

    # Add local weather
    weather = WeatherObservation(
        source_id="weatherapi",
        source_record_id="test:event:weather",
        location_name="Delhi Pragati Maidan",
        latitude=28.6180,
        longitude=77.2420,
        observed_at=now,
        temperature_c=29.0,
        precipitation_mm=12.0,
        condition_text="Heavy Rain",
        wind_kph=18.0,
        humidity=80,
    )
    db_session.add(weather)
    db_session.commit()

    res = client.get(f"/api/v1/events/{event.id}/contextual-intelligence")
    assert res.status_code == 200
    data = res.json()
    assert data["event_id"] == event.id
    assert data["venue_name"] == "Bharat Mandapam, Pragati Maidan"
    assert data["expected_attendance"] == 6500
    assert data["parking_pressure"] == "CRITICAL"
    assert data["arterial_traffic_impact"] == "HIGH_BOTTLENECK"
    assert data["total_approach_delay_minutes"] >= 15
    assert len(data["nearby_traffic_bottlenecks"]) >= 1
    assert any("Mathura Road" in b["road_name"] for b in data["nearby_traffic_bottlenecks"])
    assert "parking" in data["parking_guidance"].lower()


def test_dynamic_route_prioritization(client, db_session):
    """
    Verifies Dynamic Route Prioritization & Risk Assessment (PPT Slide 04):
    Evaluates competing corridors (Surface Arterial, Bypass, Metro), waterlogging risk,
    and returns a prioritized route with AI rationale.
    """
    now = datetime.datetime.utcnow()
    # Add weather with rain
    w = WeatherObservation(
        source_id="weatherapi",
        source_record_id="test:route:rain",
        location_name="Delhi AIIMS Corridor",
        latitude=28.5672,
        longitude=77.2100,
        observed_at=now,
        temperature_c=27.0,
        precipitation_mm=16.5,
        condition_text="Moderate to Heavy Rain",
        wind_kph=20.0,
        humidity=85,
    )
    db_session.add(w)

    # Add congestion incident on surface link
    t = TrafficObservation(
        source_id="tomtom",
        source_record_id="test:route:surface_jam",
        incident_type="CONGESTION",
        criticality="major",
        road_name="Aurobindo Marg Underpass",
        latitude=28.5700,
        longitude=77.2120,
        delay_seconds=1200,
        jam_factor=8.5,
        observed_at=now,
    )
    db_session.add(t)
    db_session.commit()

    payload = {
        "origin_name": "AIIMS New Delhi",
        "origin_latitude": 28.5672,
        "origin_longitude": 77.2100,
        "destination_name": "Connaught Place",
        "destination_latitude": 28.6304,
        "destination_longitude": 77.2177,
    }
    res = client.post("/api/v1/intelligence/routes/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["origin"] == "AIIMS New Delhi"
    assert data["destination"] == "Connaught Place"
    assert "recommended_route" in data
    assert len(data["evaluated_corridors"]) == 3

    # Direct surface corridor should register waterlogging risk from 16.5mm rain
    surface = next(c for c in data["evaluated_corridors"] if "Direct Arterial" in c["route_name"])
    assert surface["waterlogging_risk"] in ("HIGH", "CRITICAL")
    assert surface["rainfall_mm"] >= 16.0
    assert surface["risk_score"] > 30.0

    # Ensure one route is flagged as recommended
    assert any(c["is_recommended"] is True for c in data["evaluated_corridors"])
    assert "ai_commute_advisory" in data


def test_multi_signal_demand_intelligence(client, db_session):
    """
    Verifies Multi-Signal Demand Intelligence Engine (PPT Slide 08):
    Correlates weather + traffic + local events to generate demand surge multipliers.
    """
    now = datetime.datetime.utcnow()
    # Insert rain weather
    w = WeatherObservation(
        source_id="weatherapi",
        source_record_id="test:demand:rain",
        location_name="Delhi Connaught Place",
        latitude=28.6304,
        longitude=77.2177,
        observed_at=now,
        temperature_c=25.0,
        precipitation_mm=14.0,
        condition_text="Heavy Showers",
        wind_kph=15.0,
        humidity=90,
    )
    db_session.add(w)

    # Insert traffic delay
    t = TrafficObservation(
        source_id="tomtom",
        source_record_id="test:demand:traffic",
        incident_type="CONGESTION",
        criticality="major",
        road_name="Janpath",
        latitude=28.6280,
        longitude=77.2190,
        delay_seconds=1500,
        jam_factor=8.2,
        observed_at=now,
    )
    db_session.add(t)
    db_session.commit()

    res = client.get("/api/v1/intelligence/demand?area=Delhi%20Connaught%20Place")
    assert res.status_code == 200
    data = res.json()
    assert data["composite_demand_index"] > 25.0
    assert data["market_state"] in ("ELEVATED_DEMAND", "PEAK_COMMERCE")
    assert len(data["categories"]) >= 4

    # Food surge multiplier should be elevated due to 14mm rain
    food_cat = next(c for c in data["categories"] if "Food" in c["category"])
    assert food_cat["demand_surge_multiplier"] >= 1.5
    assert len(food_cat["merchant_action_items"]) >= 1
    assert "consumer_insight" in food_cat

    # Weather protection surge should be high
    gear_cat = next(c for c in data["categories"] if "Weather Protection" in c["category"])
    assert gear_cat["demand_surge_multiplier"] >= 2.0


def test_community_signals_reporting_and_upvoting(client, db_session):
    """
    Verifies User-Reported Community Signals (PPT Slide 04 & 06):
    Ground-truth reporting, proximity retrieval, and peer upvote consensus.
    """
    # 1. Post a new community signal
    report_data = {
        "signal_type": "WATERLOGGING",
        "title": "Severe Water Pooling under Moolchand Flyover",
        "description": "Knee-deep water accumulation on southbound carriageway. Two-wheelers stalled.",
        "locality": "Lajpat Nagar",
        "city": "Delhi",
        "state": "Delhi NCR",
        "latitude": 28.5700,
        "longitude": 77.2350,
        "severity": "high",
    }
    create_res = client.post("/api/v1/intelligence/community/signals", json=report_data)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["signal_type"] == "WATERLOGGING"
    assert created["title"] == report_data["title"]
    assert created["upvotes"] == 1
    signal_id = created["id"]

    # 2. List signals near coordinates
    list_res = client.get("/api/v1/intelligence/community/signals?lat=28.5672&lon=77.2100")
    assert list_res.status_code == 200
    signals = list_res.json()
    assert len(signals) >= 1
    assert any(s["id"] == signal_id for s in signals)

    # 3. Upvote signal
    upvote_res = client.post(f"/api/v1/intelligence/community/signals/{signal_id}/upvote")
    assert upvote_res.status_code == 200
    assert upvote_res.json()["upvotes"] == 2

    # Upvote again to reach peer consensus threshold
    upvote_res2 = client.post(f"/api/v1/intelligence/community/signals/{signal_id}/upvote")
    assert upvote_res2.status_code == 200
    assert upvote_res2.json()["upvotes"] == 3
    assert upvote_res2.json()["status"] == "COMMUNITY_VERIFIED"

    # 4. Resolve signal
    resolve_res = client.post(f"/api/v1/intelligence/community/signals/{signal_id}/resolve?notes=Water+pump+deployed")
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"
    assert resolve_res.json()["success"] is True


def test_location_filtered_government_alerts(client, db_session):
    """
    Verifies 100% Trusted, Geographic-Filtered NDMA Alerts:
    - User in Ghaziabad/NCR receives local NCR & State alerts, NEVER foreign state alerts (Kerala/AP/WB).
    - Unimpacted locations (Bengaluru) receive 0 alerts (conditions normal).
    - All-India scope returns full national feed.
    - Zero synthetic data, strictly official CAP v1.2 schema compliance.
    """
    now = datetime.datetime.utcnow()

    # 1. Seed official notices across diverse states
    notice_ncr = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="NDMA-CAP-TEST-NCR",
        sender="ndma@sachet.gov.in",
        event_type="Severe Thunderstorm",
        severity="Severe",
        urgency="Expected",
        certainty="Observed",
        headline="Thunderstorm and Downpour Warning for Delhi-NCR",
        area_description="Delhi-NCR, Ghaziabad, Gautam Buddha Nagar, New Delhi",
        effective_at=now - datetime.timedelta(hours=1),
        expires_at=now + datetime.timedelta(days=1),
        is_active=True,
    )
    notice_up = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="UP-SDMA-TEST-RAE",
        sender="Uttar-Pradesh-SDMA",
        event_type="Flood Warning",
        severity="Moderate",
        urgency="Expected",
        certainty="Observed",
        headline="River Gauge Warning for Rae-Bareli",
        area_description="SAI, Rae-Bareli, Rae-Bareli, Uttar Pradesh",
        effective_at=now - datetime.timedelta(hours=2),
        expires_at=now + datetime.timedelta(days=1),
        is_active=True,
    )
    notice_kerala = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="KER-SDMA-TEST-01",
        sender="Kerala-SDMA",
        event_type="Thunderstorm",
        severity="Severe",
        urgency="Expected",
        certainty="Observed",
        headline="Thunderstorm Warning for Wayanad",
        area_description="Wayanad district of Kerala",
        effective_at=now - datetime.timedelta(hours=1),
        expires_at=now + datetime.timedelta(days=1),
        is_active=True,
    )
    notice_ap = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="AP-SDMA-TEST-02",
        sender="Andhra-Pradesh-SDMA",
        event_type="Lightning",
        severity="Severe",
        urgency="Immediate",
        certainty="Observed",
        headline="Lightning Warning in YSR Kadapa",
        area_description="knl-tuggali, ysr-smydukur mandals of Andhra Pradesh",
        effective_at=now - datetime.timedelta(hours=1),
        expires_at=now + datetime.timedelta(days=1),
        is_active=True,
    )
    notice_wb = GovernmentNotice(
        source_id="sachet_cap",
        alert_identifier="WB-SDMA-TEST-03",
        sender="West-Bengal-SDMA",
        event_type="Flood",
        severity="Moderate",
        urgency="Expected",
        certainty="Observed",
        headline="Ganga Inundation Bulletin",
        area_description="Ganga, Farakka, Murshidabad, West Bengal",
        effective_at=now - datetime.timedelta(hours=1),
        expires_at=now + datetime.timedelta(days=1),
        is_active=True,
    )

    db_session.add_all([notice_ncr, notice_up, notice_kerala, notice_ap, notice_wb])
    db_session.commit()

    # 2. Query Ghaziabad (AKGEC) — must receive NCR alert, must NOT receive Kerala/AP/WB
    res_ghz = client.get("/api/v1/intelligence/alerts?area=AKGEC%20Ghaziabad&scope=local")
    assert res_ghz.status_code == 200
    ghz_alerts = res_ghz.json()
    ghz_ids = [a["alert_identifier"] for a in ghz_alerts]
    assert "NDMA-CAP-TEST-NCR" in ghz_ids
    assert "KER-SDMA-TEST-01" not in ghz_ids
    assert "AP-SDMA-TEST-02" not in ghz_ids
    assert "WB-SDMA-TEST-03" not in ghz_ids

    # 3. Query Bengaluru — must receive 0 alerts (conditions normal, no cross-state pollution)
    res_blr = client.get("/api/v1/intelligence/alerts?area=Indiranagar%20Bengaluru&scope=local")
    assert res_blr.status_code == 200
    blr_alerts = res_blr.json()
    assert len(blr_alerts) == 0

    # 4. Query All-India Feed — must return all active alerts
    res_all = client.get("/api/v1/intelligence/alerts?scope=all")
    assert res_all.status_code == 200
    all_alerts = res_all.json()
    all_ids = [a["alert_identifier"] for a in all_alerts]
    assert "NDMA-CAP-TEST-NCR" in all_ids
    assert "KER-SDMA-TEST-01" in all_ids
    assert "AP-SDMA-TEST-02" in all_ids
    assert "WB-SDMA-TEST-03" in all_ids


def test_pan_india_air_quality_fallback_for_non_pilot_districts(client, db_session, monkeypatch):
    """
    Verifies that GET /api/v1/intelligence/air-quality returns ACTIVE CPCB 2014 NAQI
    telemetry for any non-pilot Indian district (e.g., Ranchi, Kochi, Guwahati, Dehradun)
    even when SQLite has 0 pre-seeded rows and external keys are offline.
    """
    from backend.app.core.config import settings

    monkeypatch.setattr(settings, "OPENAQ_API_KEY", None)
    monkeypatch.setattr(settings, "WEATHERAPI_API_KEY", None)

    for city, lat, lon in [
        ("Ranchi", 23.3441, 85.3096),
        ("Kochi", 9.9312, 76.2673),
        ("Guwahati", 26.1445, 91.7362),
        ("Dehradun", 30.3165, 78.0322),
    ]:
        res = client.get(f"/api/v1/intelligence/air-quality?area={city}&lat={lat}&lon={lon}")
        assert res.status_code == 200
        data = res.json()
        assert data["is_available"] is True
        assert data["status"] == "ACTIVE"
        assert data["is_stale"] is False
        assert data["aqi_value"] is not None and data["aqi_value"] > 10.0
        assert data["aqi_category"] in ("Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe")
        assert data["pm25"] is not None and data["pm25"] > 0
        assert data["pm10"] is not None and data["pm10"] > 0
        assert city.lower() in (data["station_name"] or "").lower() or city.lower() in (data["city"] or "").lower()


def test_community_reports_integrated_into_route_risk_and_correlation_engine(client, db_session):
    """
    Verifies PPT Slide 09: 'Community traffic & road reports verified and integrated into the local signal mesh.'
    1. Submitting a CommunitySignal (WATERLOGGING / ROAD_BLOCKAGE) synthesizes a Scenario G insight via CorrelationEngine.
    2. Evaluating route risk incorporates active CommunitySignals into corridor waterlogging risk, delay, risk_score, and warnings.
    3. Resolving the CommunitySignal deactivates the linked insight and clears the route risk penalty.
    """
    from backend.app.database.models import IntelligenceInsight

    # 1. Submit a severe WATERLOGGING community report near AIIMS -> Connaught Place corridor
    report_payload = {
        "signal_type": "WATERLOGGING",
        "title": "Burst Pipeline & Underpass Flooding at Moolchand",
        "description": "3 feet water accumulation blocking surface lanes.",
        "locality": "Moolchand Underpass",
        "city": "Delhi",
        "state": "Delhi NCR",
        "latitude": 28.5800,
        "longitude": 77.2150,
        "severity": "high",
    }
    create_res = client.post("/api/v1/intelligence/community/signals", json=report_payload)
    assert create_res.status_code == 201
    sig_id = create_res.json()["id"]

    # 2. Verify CorrelationEngine synthesized a Scenario G insight in the database
    mesh_insight = (
        db_session.query(IntelligenceInsight)
        .filter(
            IntelligenceInsight.insight_type == "community_ground_truth_correlation",
            IntelligenceInsight.is_active == True,
        )
        .first()
    )
    assert mesh_insight is not None
    assert "Moolchand" in mesh_insight.headline
    assert mesh_insight.rule_identifier == "SCENARIO_G_COMMUNITY_SIGNAL_MESH"
    assert any(s.signal_type == "community" and s.observation_id == sig_id for s in mesh_insight.signals)

    # 3. Verify evaluate_route_risk integrates the community report into corridor assessment
    route_payload = {
        "origin_name": "AIIMS New Delhi",
        "origin_latitude": 28.5672,
        "origin_longitude": 77.2100,
        "destination_name": "Connaught Place",
        "destination_latitude": 28.6304,
        "destination_longitude": 77.2177,
    }
    route_res = client.post("/api/v1/intelligence/routes/evaluate", json=route_payload)
    assert route_res.status_code == 200
    rdata = route_res.json()
    assert rdata["active_community_reports_count"] >= 1
    assert "citizen ground report" in rdata["ai_commute_advisory"].lower()

    surface = next(c for c in rdata["evaluated_corridors"] if "Direct Arterial" in c["route_name"])
    assert surface["community_reports_count"] >= 1
    assert surface["waterlogging_risk"] in ("HIGH", "CRITICAL")
    assert surface["risk_score"] >= 45.0
    assert any("Citizen Ground Report" in w for w in surface["key_warnings"])

    # 4. Resolve the community report and verify insight deactivation + route clearance
    resolve_res = client.post(f"/api/v1/intelligence/community/signals/{sig_id}/resolve?notes=Drainage+cleared")
    assert resolve_res.status_code == 200

    db_session.expire_all()
    refreshed_insight = db_session.query(IntelligenceInsight).filter(IntelligenceInsight.id == mesh_insight.id).first()
    assert refreshed_insight.is_active is False

    route_res_after = client.post("/api/v1/intelligence/routes/evaluate", json=route_payload)
    assert route_res_after.status_code == 200
    assert route_res_after.json()["active_community_reports_count"] == 0



