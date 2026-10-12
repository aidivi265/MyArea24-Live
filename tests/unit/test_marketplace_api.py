import datetime
import pytest
from backend.app.database.models import Business, Product, ServiceListing, Offer, Event, User, EmergencyFacility, CommunitySignal
from backend.app.core.security import create_access_token


def test_auth_otp_flow(client):
    # 1. Send OTP
    res = client.post("/api/v1/auth/send-otp", json={"email": "rahul.verma@example.com", "purpose": "login"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["dev_otp"] is not None
    otp_code = data["dev_otp"]

    # 2. Verify OTP
    verify_res = client.post(
        "/api/v1/auth/verify-otp",
        json={
            "email": "rahul.verma@example.com",
            "otp_code": otp_code,
            "full_name": "Rahul Verma",
            "role": "resident"
        }
    )
    assert verify_res.status_code == 200
    auth_data = verify_res.json()
    assert "access_token" in auth_data
    assert auth_data["user"]["email"] == "rahul.verma@example.com"
    token = auth_data["access_token"]

    # 3. Check /me with Bearer token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "rahul.verma@example.com"


def test_business_and_product_flow(client, db_session):
    # 1. Create a merchant user and business
    user = User(email="merchant@shop.com", full_name="Shop Owner", role="merchant")
    db_session.add(user)
    db_session.commit()

    biz = Business(
        slug="delhi-tech-hub",
        name="Delhi Tech Hub",
        owner_id=user.id,
        category="Electronics & Mobile",
        address="Connaught Place, Delhi",
        locality="Delhi Connaught Place",
        city="Delhi",
        state="Delhi NCR",
        latitude=28.6304,
        longitude=77.2177,
        opening_time="10:00",
        closing_time="21:00",
        status="active",
        rating=4.8
    )
    db_session.add(biz)
    db_session.commit()

    # 2. Add product with price comparison
    prod = Product(
        business_id=biz.id,
        name="boAt Rockerz 550 Wireless Headphones",
        brand="boAt",
        category="Electronics & Mobile",
        local_price=1499.0,
        mrp=3990.0,
        online_price=1799.0,
        online_provider="Amazon.in",
        availability_status="in_stock"
    )
    db_session.add(prod)
    db_session.commit()

    # 3. List businesses
    biz_res = client.get("/api/v1/businesses?category=Electronics+%26+Mobile")
    assert biz_res.status_code == 200
    assert biz_res.json()["total"] >= 1
    assert biz_res.json()["items"][0]["name"] == "Delhi Tech Hub"

    # 4. Search products
    prod_res = client.get("/api/v1/products?q=boAt")
    assert prod_res.status_code == 200
    items = prod_res.json()["items"]
    assert len(items) >= 1
    item = items[0]
    assert item["local_price"] == 1499.0
    assert item["online_price"] == 1799.0
    assert item["better_offline"] is True
    assert item["savings_amount"] == 300.0


def test_services_marketplace(client, db_session):
    svc = ServiceListing(
        provider_name="Quick Electrician Services",
        category="Electrician",
        service_area="South Delhi, Saket, Malviya Nagar",
        locality="South Delhi",
        city="Delhi",
        latitude=28.5244,
        longitude=77.2066,
        phone="+919811002233",
        price_starting_at=199.0,
        price_unit="per visit",
        timing="09:00 AM - 08:00 PM",
        rating=4.9
    )
    db_session.add(svc)
    db_session.commit()

    res = client.get("/api/v1/services?category=Electrician")
    assert res.status_code == 200
    assert res.json()["total"] >= 1
    assert res.json()["items"][0]["provider_name"] == "Quick Electrician Services"


def test_offers_and_events(client, db_session):
    biz = Business(
        slug="book-depot",
        name="City Book Depot",
        category="Stationery & Books",
        address="Rohini, Delhi",
        locality="Delhi Rohini",
        city="Delhi",
        latitude=28.7144,
        longitude=77.1197,
        status="active"
    )
    db_session.add(biz)
    db_session.commit()

    now = datetime.datetime.utcnow()
    offer = Offer(
        business_id=biz.id,
        title="20% Off on Engineering Books",
        discount_text="20% OFF",
        category="Stationery & Books",
        valid_until=now + datetime.timedelta(days=7),
        is_active=True
    )
    evt = Event(
        title="Rohini Community Blood Donation Camp",
        category="Community",
        organizer="Red Cross Delhi",
        venue_name="Community Centre Sector 11",
        address="Rohini Sector 11, Delhi",
        locality="Delhi Rohini",
        city="Delhi",
        latitude=28.7144,
        longitude=77.1197,
        start_time=now + datetime.timedelta(days=2),
        is_verified=True
    )
    db_session.add_all([offer, evt])
    db_session.commit()

    # Check offers
    off_res = client.get("/api/v1/offers")
    assert off_res.status_code == 200
    assert off_res.json()["total"] >= 1

    # Check events
    evt_res = client.get("/api/v1/events")
    assert evt_res.status_code == 200
    assert evt_res.json()["total"] >= 1


def test_customer_enquiry_and_click_tracking(client, db_session):
    biz = Business(
        slug="krishna-electronics",
        name="Krishna Electronics",
        category="Electronics",
        address="Connaught Place",
        locality="Connaught Place",
        city="Delhi",
        latitude=28.6304,
        longitude=77.2177,
        status="active"
    )
    db_session.add(biz)
    db_session.commit()

    # Track click
    track_res = client.post("/api/v1/enquiries/track-click", json={"business_id": biz.id, "event_type": "call_click"})
    assert track_res.status_code == 200

    # Submit enquiry
    enq_res = client.post(
        "/api/v1/enquiries",
        json={
            "business_id": biz.id,
            "customer_name": "Pooja Sharma",
            "customer_phone": "+919988776655",
            "message": "Do you have the C-type adapter in stock?",
            "enquiry_type": "stock_check"
        }
    )
    assert enq_res.status_code == 201
    assert enq_res.json()["success"] is True


def test_market_rates_and_civic_bulletins(client, db_session):
    from backend.app.database.models import CivicBulletin, MandiPrice

    mandi = MandiPrice(
        commodity="Tomato Local",
        mandi_name="Azadpur Mandi",
        state="Delhi",
        modal_price=28.0,
        min_price=24.0,
        max_price=32.0,
        unit="kg",
        price_trend="Steady"
    )
    bulletin = CivicBulletin(
        title="Traffic Advisory Near Ring Road",
        summary="Waterlogging team deployed.",
        source_agency="Delhi Traffic Police",
        category="Transit & Safety",
        locality="AIIMS Ring Road",
        city="Delhi"
    )
    db_session.add_all([mandi, bulletin])
    db_session.commit()

    # Test market rates
    m_res = client.get("/api/v1/market-rates?search=Tomato")
    assert m_res.status_code == 200
    m_data = m_res.json()
    assert m_data["total"] >= 1
    assert m_data["items"][0]["commodity"] == "Tomato Local"

    # Test bulletins
    b_res = client.get("/api/v1/bulletins?locality=AIIMS")
    assert b_res.status_code == 200
    b_data = b_res.json()
    assert b_data["total"] >= 1
    assert "Ring Road" in b_data["items"][0]["title"]


def test_pan_india_location_endpoints(client):
    # 1. Test states listing (All 36 States & UTs)
    states_res = client.get("/api/v1/location/states")
    assert states_res.status_code == 200
    states_data = states_res.json()
    assert len(states_data) >= 36
    state_names = [s["name"] for s in states_data]
    assert "Uttar Pradesh" in state_names
    assert "Maharashtra" in state_names
    assert "Delhi NCR" in state_names
    assert "Karnataka" in state_names

    # 2. Test districts listing for Uttar Pradesh
    dist_res = client.get("/api/v1/location/districts?state=Uttar%20Pradesh")
    assert dist_res.status_code == 200
    dist_data = dist_res.json()
    assert len(dist_data) >= 5
    dist_names = [d["name"] for d in dist_data]
    assert any("Ghaziabad" in name for name in dist_names)
    assert any("Lucknow" in name for name in dist_names)

    # 3. Test location search
    search_res = client.get("/api/v1/location/search?q=Varanasi")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data) >= 1
    assert search_data[0]["district"] == "Varanasi"

    # 4. Test reverse-geocoding (Centroid fallback or live OpenStreetMap)
    rev_res = client.get("/api/v1/location/reverse-geocode?lat=28.6692&lon=77.4538")
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["success"] is True
    assert "district" in rev_data
    assert "state" in rev_data
    assert rev_data["country"] == "India"


def test_emergency_facilities_flow(client, db_session):
    # 1. Create emergency facility
    facility = EmergencyFacility(
        name="NIMHANS Trauma Care Center",
        facility_type="Specialized Neuro & Trauma Hospital",
        city="Bengaluru",
        locality="Hosur Road, Bengaluru",
        state="Karnataka",
        phone="080-26995000",
        secondary_phone="080-26995530",
        trauma_level="Level 1 Advanced Neurotrauma",
        blood_bank_available=True,
        address="Hosur Road, Lakkasandra, Bengaluru 560029",
        latitude=12.9385,
        longitude=77.5950,
        is_24_7=True
    )
    db_session.add(facility)
    db_session.commit()

    # 2. Query facilities by city
    res = client.get("/api/v1/emergency/facilities?city=Bengaluru")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert data["facilities"][0]["name"] == "NIMHANS Trauma Care Center"
    assert data["facilities"][0]["blood_bank_available"] is True
    assert data["national_emergency_number"] == "112"
    assert data["nhai_highway_helpline"] == "1033"
    assert data["ndma_disaster_helpline"] == "1078"
    assert data["sdma_state_control"] == "1070"
    assert data["flood_maritime_rescue"] == "1554"

    # 3. Query with GPS distance coordinates and blood bank filter
    geo_res = client.get("/api/v1/emergency/facilities?latitude=12.938&longitude=77.595&blood_bank_only=true")
    assert geo_res.status_code == 200
    geo_data = geo_res.json()
    assert geo_data["total"] >= 1
    assert geo_data["facilities"][0]["distance_km"] is not None
    assert geo_data["facilities"][0]["blood_bank_available"] is True


def test_service_enquiry_without_business_id(client, db_session):
    # 1. Create independent service listing
    service = ServiceListing(
        provider_name="Rajesh Electrical Works",
        category="Electrician",
        description="Emergency fault diagnosis, switchgear replacement, and inverter setup.",
        service_area="Indiranagar & Koramangala",
        locality="Indiranagar",
        city="Bengaluru",
        latitude=12.9716,
        longitude=77.5946,
        phone="+91 9876543210",
        price_starting_at=350.0,
        is_verified=True
    )
    db_session.add(service)
    db_session.commit()

    # 2. Submit enquiry without business_id
    enquiry_payload = {
        "service_id": service.id,
        "customer_name": "Deepak Kumar",
        "customer_email": "deepak.k@example.com",
        "customer_phone": "+91 9888877777",
        "service_date": (datetime.date.today() + datetime.timedelta(days=1)).isoformat(),
        "message": "Immediate electrical wiring inspection required for apartment."
    }
    res = client.post("/api/v1/enquiries", json=enquiry_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert data["recipient_name"] == "Rajesh Electrical Works"
    assert data["business_id"] is None


def test_admin_community_signals_and_overview(client, db_session):
    # 1. Create an admin user and non-admin user
    admin_user = User(email="admin.test@myarea24.in", full_name="Super Admin", role="admin")
    resident_user = User(email="resident.test@myarea24.in", full_name="Local Resident", role="resident")
    db_session.add_all([admin_user, resident_user])
    db_session.commit()

    admin_token = create_access_token({"sub": str(admin_user.id), "role": admin_user.role})
    resident_token = create_access_token({"sub": str(resident_user.id), "role": resident_user.role})

    # 2. Add community signal
    sig = CommunitySignal(
        user_id=resident_user.id,
        signal_type="WATERLOGGING",
        title="Severe Waterlogging on Ring Road Underpass",
        description="Drainage overflow causing bumper-to-bumper vehicle stall.",
        locality="Ring Road Sector 14",
        city="Ghaziabad",
        latitude=28.6692,
        longitude=77.4538,
        severity="high",
        status="REPORTED",
        upvotes=4,
    )
    db_session.add(sig)
    db_session.commit()

    # 3. Test non-admin gets 403 Forbidden on admin endpoints
    res_forbidden = client.get("/api/v1/admin/community-signals", headers={"Authorization": f"Bearer {resident_token}"})
    assert res_forbidden.status_code == 403

    # 4. Test admin overview contains signals count
    overview_res = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert overview_res.status_code == 200
    metrics = overview_res.json()["metrics"]
    assert metrics["total_signals"] >= 1
    assert metrics["pending_signals"] >= 1

    # 5. Test admin community signals listing & filters
    list_res = client.get("/api/v1/admin/community-signals?status_filter=REPORTED", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] >= 1
    assert list_data["items"][0]["id"] == sig.id
    assert list_data["items"][0]["signal_type"] == "WATERLOGGING"

    # Search filter
    search_res = client.get("/api/v1/admin/community-signals?q=Underpass", headers={"Authorization": f"Bearer {admin_token}"})
    assert search_res.status_code == 200
    assert search_res.json()["total"] >= 1

    # 6. Test triage status update: Escalate to municipality
    escalate_res = client.put(
        f"/api/v1/admin/community-signals/{sig.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "ESCALATED_TO_MUNICIPALITY"}
    )
    assert escalate_res.status_code == 200
    assert escalate_res.json()["status"] == "ESCALATED_TO_MUNICIPALITY"

    db_session.refresh(sig)
    assert sig.status == "ESCALATED_TO_MUNICIPALITY"

    # 7. Test triage status update: Mark Resolved
    resolve_res = client.put(
        f"/api/v1/admin/community-signals/{sig.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "RESOLVED"}
    )
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "RESOLVED"

    db_session.refresh(sig)
    assert sig.status == "RESOLVED"


