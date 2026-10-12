import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.indian_spatial_service import (
    global_spatial_kdtree,
    global_geocode_cache,
    reverse_geocode_hybrid,
    INDIAN_ADMINISTRATIVE_DISTRICTS,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_kdtree_coverage_all_36_states_and_uts():
    """Verify KD-Tree contains 780+ districts across all 36 States and UTs of India."""
    assert len(INDIAN_ADMINISTRATIVE_DISTRICTS) == 36
    total_districts = sum(len(d_list) for d_list in INDIAN_ADMINISTRATIVE_DISTRICTS.values())
    assert total_districts >= 780

    # Test KD-Tree lookup for major metros
    # 1. Delhi NCR
    delhi_match, d_delhi = global_spatial_kdtree.find_nearest(28.6139, 77.2090)
    assert delhi_match is not None
    assert "Delhi" in delhi_match["state"] or "Delhi" in delhi_match["district"]
    assert d_delhi < 10.0

    # 2. Bengaluru, Karnataka
    blr_match, d_blr = global_spatial_kdtree.find_nearest(12.9716, 77.5946)
    assert blr_match is not None
    assert blr_match["state"] == "Karnataka"
    assert "Bengaluru" in blr_match["district"]
    assert d_blr < 15.0

    # 3. Mumbai, Maharashtra
    mum_match, d_mum = global_spatial_kdtree.find_nearest(18.9220, 72.8347)
    assert mum_match is not None
    assert mum_match["state"] == "Maharashtra"
    assert "Mumbai" in mum_match["district"]
    assert d_mum < 15.0

    # 4. Kolkata, West Bengal
    kol_match, d_kol = global_spatial_kdtree.find_nearest(22.5726, 88.3639)
    assert kol_match is not None
    assert kol_match["state"] == "West Bengal"
    assert "Kolkata" in kol_match["district"]
    assert d_kol < 15.0


@pytest.mark.asyncio
async def test_geocode_cache_grid_and_ttl():
    """Test that geocoding is cached by (round(lat, 3), round(lon, 3)) grid."""
    lat = 28.5352
    lon = 77.3912

    # Query hybrid engine
    res1 = await reverse_geocode_hybrid(lat, lon)
    assert res1["success"] is True
    assert "district" in res1
    assert "state" in res1

    # Nearby coordinate within same 3-decimal grid bucket (round(28.5354, 3) == 28.535)
    lat_nearby = 28.5354
    lon_nearby = 77.3914
    res2 = await reverse_geocode_hybrid(lat_nearby, lon_nearby)
    assert res2["success"] is True
    # Should be served directly from in-memory cache
    assert res2.get("cache_hit") is True



def test_reverse_geocode_api_endpoint(client):
    """Test /api/v1/location/reverse-geocode endpoint returns high-speed resolved payload."""
    res = client.get("/api/v1/location/reverse-geocode?lat=13.0827&lon=80.2707")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["country"] == "India"
    assert "district" in data
    assert "state" in data

    # Verify search endpoint searches across all 780+ districts
    search_res = client.get("/api/v1/location/search?q=Guwahati")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data) >= 1
    assert search_data[0]["state"] == "Assam"
