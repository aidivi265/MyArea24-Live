import pytest
from backend.app.core.config import Settings, PilotLocation


def test_pilot_location_validation():
    valid = PilotLocation(name="Test Loc", lat=28.5, lon=77.2)
    assert valid.lat == 28.5
    assert valid.lon == 77.2

    with pytest.raises(ValueError):
        PilotLocation(name="Bad Lat", lat=95.0, lon=77.2)

    with pytest.raises(ValueError):
        PilotLocation(name="Bad Lon", lat=28.5, lon=185.0)


def test_default_settings_properties():
    s = Settings()
    locations = s.parsed_pilot_locations
    assert len(locations) == 5
    assert locations[0].name == "Delhi AIIMS Ring Road"

    bbox = s.traffic_bbox_coords
    assert len(bbox) == 4
    min_lon, min_lat, max_lon, max_lat = bbox
    assert min_lon < max_lon
    assert min_lat < max_lat


def test_production_jwt_secret_validation_rejects_default_secret():
    with pytest.raises((ValueError, Exception)) as exc_info:
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="myarea24_local_development_secret_key_2026",
        )
    assert "JWT_SECRET_KEY" in str(exc_info.value)


def test_production_jwt_secret_validation_rejects_empty_secret():
    with pytest.raises((ValueError, Exception)) as exc_info:
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="",
        )
    assert "JWT_SECRET_KEY" in str(exc_info.value)


def test_production_jwt_secret_validation_accepts_strong_secret():
    custom_secret = "v9x_k8P3_mZ4_prod_super_secure_unique_key_9901"
    s = Settings(
        APP_ENV="production",
        JWT_SECRET_KEY=custom_secret,
    )
    assert s.APP_ENV == "production"
    assert s.JWT_SECRET_KEY == custom_secret


def test_development_allows_default_jwt_secret():
    s = Settings(APP_ENV="development")
    assert s.JWT_SECRET_KEY == "myarea24_local_development_secret_key_2026"

