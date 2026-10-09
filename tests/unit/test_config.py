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
