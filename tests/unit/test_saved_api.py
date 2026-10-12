import datetime
import pytest
from backend.app.database.models import User, Business, Product, CivicBulletin, Event
from backend.app.core.security import create_access_token


def test_saved_items_guest_user(client):
    """Guest unauthenticated user receives 200 with empty list rather than 401."""
    res = client.get("/api/v1/saved")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 0
    assert data["businesses"] == []
    assert data["products"] == []
    assert data["services"] == []
    assert data["offers"] == []
    assert data["bulletins"] == []


def test_saved_items_authenticated_toggle_and_list(client, db_session):
    """Authenticated user can toggle bookmark on/off and list saved records."""
    user = User(email="bookmark.user@test.com", full_name="Bookmark Tester", role="resident")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Create dummy business
    biz = Business(
        owner_id=user.id,
        name="Royal Bakery",
        slug="royal-bakery-1",
        category="Bakery & Cafe",
        address="Plot 4, RDC Raj Nagar",
        locality="RDC Raj Nagar",
        city="Ghaziabad",
        latitude=28.67,
        longitude=77.44,
        phone="+919876543210",
    )
    db_session.add(biz)
    db_session.commit()
    db_session.refresh(biz)

    # 1. Save business
    save_res = client.post("/api/v1/saved", json={"item_type": "business", "item_id": biz.id}, headers=headers)
    assert save_res.status_code == 201
    assert save_res.json()["saved"] is True

    # 2. List saved items
    list_res = client.get("/api/v1/saved", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] == 1
    assert len(data["businesses"]) == 1
    assert data["businesses"][0]["id"] == biz.id
    assert data["businesses"][0]["name"] == "Royal Bakery"

    # 3. Toggle off
    toggle_res = client.post("/api/v1/saved", json={"item_type": "business", "item_id": biz.id}, headers=headers)
    assert toggle_res.status_code == 201
    assert toggle_res.json()["saved"] is False

    # 4. Verify list is empty
    list_res2 = client.get("/api/v1/saved", headers=headers)
    assert list_res2.status_code == 200
    assert list_res2.json()["total"] == 0


def test_saved_items_sync_and_clear_all(client, db_session):
    """Batch syncing local guest bookmarks to user account and clearing all bookmarks."""
    user = User(email="sync.user@test.com", full_name="Sync Tester", role="resident")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    biz = Business(
        owner_id=user.id,
        name="City Mart",
        slug="city-mart-test",
        category="Grocery",
        address="Shop 12, Sector 62, Noida",
        locality="Sector 62",
        city="Noida",
        latitude=28.62,
        longitude=77.36,
    )
    bulletin = CivicBulletin(
        title="NH-24 Flyover Maintenance",
        summary="Lane restriction near Indirapuram from 11 PM to 5 AM.",
        source_agency="Traffic Police Ghaziabad",
        category="Transit & Safety",
        locality="Indirapuram",
        city="Ghaziabad",
        priority="high",
    )
    db_session.add_all([biz, bulletin])
    db_session.commit()
    db_session.refresh(biz)
    db_session.refresh(bulletin)

    # Batch Sync 2 items
    sync_payload = {
        "items": [
            {"item_type": "business", "item_id": biz.id},
            {"item_type": "bulletin", "item_id": bulletin.id},
        ]
    }
    sync_res = client.post("/api/v1/saved/sync", json=sync_payload, headers=headers)
    assert sync_res.status_code == 200
    assert sync_res.json()["added"] == 2
    assert sync_res.json()["total"] == 2

    # Verify both exist in list
    list_res = client.get("/api/v1/saved", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] == 2
    assert len(data["businesses"]) == 1
    assert len(data["bulletins"]) == 1
    assert data["bulletins"][0]["title"] == "NH-24 Flyover Maintenance"

    # Clear all
    clear_res = client.delete("/api/v1/saved/all", headers=headers)
    assert clear_res.status_code == 200
    assert clear_res.json()["deleted_count"] == 2

    # Verify total is 0
    list_res3 = client.get("/api/v1/saved", headers=headers)
    assert list_res3.status_code == 200
    assert list_res3.json()["total"] == 0
