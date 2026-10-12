import datetime
import pytest
from backend.app.core.security import create_access_token
from backend.app.database.models import (
    Business,
    CommunitySignal,
    CustomerEnquiry,
    EmergencyFacility,
    Offer,
    Product,
    User,
)


def test_pan_india_end_to_end_user_and_civic_lifecycle(client, db_session):
    """
    Comprehensive End-to-End System Test verifying:
    1. Spatial & District Intelligence (780+ district spatial engine)
    2. Disaster Crisis Protocol & Highway Safety SOS
    3. Citizen Ground-Truth Civic Action Lifecycle (Report -> Upvote -> Municipal Triage -> Resolution)
    4. Hyperlocal Merchant Commerce & Demand Radar
    5. Administrative Governance & Moderation Desk
    """

    # =========================================================================
    # Phase 1: User & Merchant Setup
    # =========================================================================
    admin_user = User(
        email="superadmin@myarea24.in",
        full_name="National Governance Admin",
        role="admin",
        is_active=True,
    )
    merchant_user = User(
        email="merchant.delhi@myarea24.in",
        full_name="Sanjay Kirana Store",
        role="merchant",
        is_active=True,
    )
    resident_user = User(
        email="citizen.delhi@myarea24.in",
        full_name="Arun Sharma",
        role="resident",
        is_active=True,
    )
    db_session.add_all([admin_user, merchant_user, resident_user])
    db_session.commit()

    admin_token = create_access_token({"sub": str(admin_user.id), "role": admin_user.role})
    merchant_token = create_access_token({"sub": str(merchant_user.id), "role": merchant_user.role})
    resident_token = create_access_token({"sub": str(resident_user.id), "role": resident_user.role})

    # =========================================================================
    # Phase 2: Spatial & District Geocoding Across India
    # =========================================================================
    # Check states endpoint
    states_res = client.get("/api/v1/location/states")
    assert states_res.status_code == 200
    states_data = states_res.json()
    state_names = [s["name"] for s in states_data]
    assert "Uttar Pradesh" in state_names
    assert "Maharashtra" in state_names
    assert "Karnataka" in state_names

    # Search location by query
    loc_search = client.get("/api/v1/location/search?q=Ghaziabad")
    assert loc_search.status_code == 200
    assert len(loc_search.json()) >= 1
    assert loc_search.json()[0]["district"] == "Ghaziabad"

    # Reverse-geocoding coordinates (Ghaziabad / Delhi NCR)
    rev_res = client.get("/api/v1/location/reverse-geocode?lat=28.6692&lon=77.4538")
    assert rev_res.status_code == 200
    rev_data = rev_res.json()
    assert rev_data["success"] is True
    assert rev_data["country"] == "India"

    # =========================================================================
    # Phase 3: Emergency Facilities & Crisis Protocol Verification
    # =========================================================================
    facility = EmergencyFacility(
        name="AIIMS New Delhi Apex Trauma Center",
        facility_type="Level-1 Apex Emergency Hospital",
        phone="011-26598500",
        secondary_phone="011-26598700",
        address="Ring Road, Ansari Nagar, New Delhi 110029",
        locality="Ansari Nagar / Ring Road",
        city="Delhi",
        state="Delhi NCR",
        latitude=28.5672,
        longitude=77.2100,
        is_24_7=True,
        trauma_level="Level-1",
        blood_bank_available=True,
    )
    db_session.add(facility)
    db_session.commit()

    emer_res = client.get("/api/v1/emergency/facilities?city=Delhi")
    assert emer_res.status_code == 200
    emer_data = emer_res.json()
    assert emer_data["total"] >= 1
    # Verify emergency speed dials
    assert emer_data["national_emergency_number"] == "112"
    assert emer_data["nhai_highway_helpline"] == "1033"
    assert emer_data["ndma_disaster_helpline"] == "1078"
    assert emer_data["sdma_state_control"] == "1070"
    assert emer_data["flood_maritime_rescue"] == "1554"

    # =========================================================================
    # Phase 4: Citizen Ground-Truth Civic Action Lifecycle
    # =========================================================================
    # 1. Citizen reports waterlogging hazard
    report_payload = {
        "signal_type": "WATERLOGGING",
        "title": "Severe Waterlogging Under Ring Road Flyover",
        "description": "3 feet water stagnation after cloudburst; traffic halted towards Dhaula Kuan.",
        "locality": "Ring Road Sector 14",
        "city": "Delhi",
        "state": "Delhi NCR",
        "latitude": 28.5670,
        "longitude": 77.2090,
        "severity": "severe",
    }
    report_res = client.post(
        "/api/v1/intelligence/community/signals",
        headers={"Authorization": f"Bearer {resident_token}"},
        json=report_payload,
    )
    assert report_res.status_code == 201
    created_sig = report_res.json()
    sig_id = created_sig["id"]
    assert created_sig["status"] in ["REPORTED", "COMMUNITY_VERIFIED"]

    # 2. Local community upvotes the hazard
    upvote_res = client.post(f"/api/v1/intelligence/community/signals/{sig_id}/upvote")
    assert upvote_res.status_code == 200
    assert upvote_res.json()["upvotes"] >= 2

    # 3. Community signal query by area/city
    sig_list_res = client.get("/api/v1/intelligence/community/signals?area=Delhi")
    assert sig_list_res.status_code == 200
    assert any(s["id"] == sig_id for s in sig_list_res.json())

    # 4. Admin Governance: Municipal Ward Escalation
    admin_escalate = client.put(
        f"/api/v1/admin/community-signals/{sig_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "ESCALATED_TO_MUNICIPALITY"},
    )
    assert admin_escalate.status_code == 200
    assert admin_escalate.json()["status"] == "ESCALATED_TO_MUNICIPALITY"

    # 5. Admin Governance: Municipal Resolution
    admin_resolve = client.put(
        f"/api/v1/admin/community-signals/{sig_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "RESOLVED"},
    )
    assert admin_resolve.status_code == 200
    assert admin_resolve.json()["status"] == "RESOLVED"

    # =========================================================================
    # Phase 5: Hyperlocal Commerce, Flash Deal & Demand Radar
    # =========================================================================
    # 1. Merchant registers store
    biz = Business(
        slug="sanjay-provisions-rohini",
        name="Sanjay Provisions & Daily Needs",
        owner_id=merchant_user.id,
        category="Grocery & Daily Needs",
        address="Shop 4, Pocket B, Rohini Sector 11, Delhi 110085",
        locality="Rohini Sector 11",
        city="Delhi",
        state="Delhi NCR",
        latitude=28.7144,
        longitude=77.1197,
        phone="+91 9811223344",
        status="pending_approval",
        is_verified=False,
    )
    db_session.add(biz)
    db_session.commit()

    # 2. Admin moderates and verifies store
    verify_res = client.post(
        f"/api/v1/admin/businesses/{biz.id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["is_verified"] is True

    status_res = client.put(
        f"/api/v1/admin/businesses/{biz.id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "active"},
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "active"

    # 3. Merchant publishes a monsoon flash deal
    deal_payload = {
        "business_id": biz.id,
        "title": "Monsoon Emergency Flash Deal: 25% Off Inverters & Torches",
        "description": "Instant backup lighting for power cuts",
        "discount_text": "25% OFF",
        "category": "Electronics & Daily Needs",
        "valid_days": 3,
    }
    deal_res = client.post(
        "/api/v1/offers",
        headers={"Authorization": f"Bearer {merchant_token}"},
        json=deal_payload,
    )
    assert deal_res.status_code == 201
    assert deal_res.json()["success"] is True
    assert deal_res.json()["offer_id"] is not None

    # 4. Merchant checks multi-signal demand intelligence
    demand_res = client.get("/api/v1/intelligence/demand?area=Delhi")
    assert demand_res.status_code == 200
    demand_data = demand_res.json()
    assert "composite_demand_index" in demand_data
    assert "categories" in demand_data
    assert len(demand_data["categories"]) >= 1

    # 5. Resident submits direct customer enquiry
    enquiry_res = client.post(
        "/api/v1/enquiries",
        json={
            "business_id": biz.id,
            "customer_name": "Arun Sharma",
            "customer_phone": "+91 9999888877",
            "customer_email": "arun@example.com",
            "enquiry_type": "stock_check",
            "message": "Do you have rechargeable emergency LED lanterns in stock?",
        },
    )
    assert enquiry_res.status_code == 201
    assert enquiry_res.json()["success"] is True

    # =========================================================================
    # Phase 6: Admin Overview Metrics Verification
    # =========================================================================
    overview_res = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {admin_token}"})
    assert overview_res.status_code == 200
    metrics = overview_res.json()["metrics"]
    assert metrics["total_businesses"] >= 1
    assert metrics["verified_businesses"] >= 1
    assert metrics["total_offers"] >= 1
    assert metrics["total_enquiries"] >= 1
    assert metrics["total_signals"] >= 1

    # =========================================================================
    # Phase 7: Pan-India Ambient Mesh Diagnostics & Provider Status
    # =========================================================================
    mesh_res = client.get("/api/v1/system/mesh-status")
    assert mesh_res.status_code == 200
    mesh_data = mesh_res.json()
    assert mesh_data["status"] == "synchronized"
    assert mesh_data["mesh_network_state"] == "ACTIVE"
    assert mesh_data["active_districts_indexed"] >= 700
    assert "weather" in mesh_data["providers"]
    assert "traffic" in mesh_data["providers"]
    assert "emergency_sos" in mesh_data["providers"]
