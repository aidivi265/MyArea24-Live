import pytest
from backend.app.normalization.alerts import (
    parse_cap_xml_payload,
    parse_cap_polygon,
    parse_cap_circle,
)


def test_valid_cap_xml_parsing(valid_cap_xml):
    records = parse_cap_xml_payload(valid_cap_xml)
    assert len(records) == 1

    rec = records[0]
    assert rec.alert_identifier == "NDMA-CAP-2026-DEL-0841"
    assert rec.sender == "ndma@sachet.gov.in"
    assert rec.event_type == "Severe Thunderstorm & Inundation"
    assert rec.severity == "Severe"
    assert "Delhi-NCR" in rec.headline
    assert rec.polygon_geojson is not None
    assert rec.polygon_geojson["type"] == "Polygon"
    assert len(rec.polygon_geojson["coordinates"][0]) == 5
    # Verify coordinate inversion: GeoJSON must be [lon, lat]
    first_coord = rec.polygon_geojson["coordinates"][0][0]
    assert first_coord == [77.1500, 28.5200]
    assert rec.circle_geojson is not None
    assert rec.circle_geojson["radius_km"] == 10.0


def test_expired_cap_xml_parsing(expired_cap_xml):
    records = parse_cap_xml_payload(expired_cap_xml)
    assert len(records) == 1
    assert records[0].alert_identifier == "NDMA-CAP-2026-DEL-EXPIRED"
    assert records[0].is_active is False


def test_malformed_cap_xml_handling(malformed_cap_xml):
    # Parser must fail gracefully and return empty list without crashing
    records = parse_cap_xml_payload(malformed_cap_xml)
    assert records == []


def test_polygon_parser_edge_cases():
    assert parse_cap_polygon("") is None
    assert parse_cap_polygon("invalid text") is None
    # 2 points cannot make a polygon
    assert parse_cap_polygon("28.1,77.1 28.2,77.2") is None


def test_circle_parser():
    circle = parse_cap_circle("28.5672,77.2100 15.5")
    assert circle is not None
    assert circle["center"] == [77.2100, 28.5672]
    assert circle["radius_km"] == 15.5
