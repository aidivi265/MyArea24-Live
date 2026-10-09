import datetime
from typing import Any, Dict, List, Optional
from dateutil import parser as dt_parser
from pydantic import BaseModel, Field, field_validator


class NormalizedTrafficRecord(BaseModel):
    source_id: str = "tomtom_traffic"
    source_record_id: str
    incident_type: str  # 'CONGESTION', 'ACCIDENT', 'ROAD_CLOSURE', etc.
    criticality: Optional[str] = None  # 'critical', 'major', 'minor', 'low', 'unknown'
    latitude: float
    longitude: float
    geometry_geojson: Optional[Dict[str, Any]] = None
    jam_factor: Optional[float] = None  # 0.0 to 10.0 (None for TomTom, never fabricated)
    delay_seconds: Optional[int] = None
    road_name: Optional[str] = None
    description: Optional[str] = None
    observed_at: datetime.datetime  # UTC
    expected_end_at: Optional[datetime.datetime] = None  # UTC

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"Invalid latitude: {v}")
        return v

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"Invalid longitude: {v}")
        return v


def _parse_iso_utc(date_str: Optional[str]) -> Optional[datetime.datetime]:
    if not date_str:
        return None
    try:
        dt = dt_parser.isoparse(date_str)
        if dt.tzinfo is not None:
            return dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None


# TomTom Category & Severity Mappings
TOMTOM_ICON_CATEGORY_MAP: Dict[int, str] = {
    0: "UNKNOWN",
    1: "ACCIDENT",
    2: "FOG",
    3: "DANGEROUS_CONDITIONS",
    4: "RAIN",
    5: "ICE",
    6: "CONGESTION",
    7: "LANE_CLOSURE",
    8: "ROAD_CLOSURE",
    9: "ROAD_WORKS",
    10: "WIND",
    11: "FLOODING",
    14: "BROKEN_DOWN_VEHICLE",
}

TOMTOM_MAGNITUDE_DELAY_MAP: Dict[int, str] = {
    0: "unknown",
    1: "minor",
    2: "moderate",
    3: "major",
    4: "critical",
}


def normalize_tomtom_traffic_response(data: Dict[str, Any]) -> List[NormalizedTrafficRecord]:
    """
    Normalizes TomTom Traffic API v5 (/traffic/services/5/incidentDetails) response
    into NormalizedTrafficRecords. Maps only fields that TomTom actually returns.
    Does NOT fabricate jam_factor (jam_factor is explicitly None).
    """
    records: List[NormalizedTrafficRecord] = []
    incidents = data.get("incidents", [])
    if not isinstance(incidents, list):
        return []

    for item in incidents:
        if not isinstance(item, dict):
            continue
        properties = item.get("properties")
        if not isinstance(properties, dict):
            continue
        geometry = item.get("geometry")
        if not isinstance(geometry, dict):
            continue

        inc_id = str(properties.get("id") or "")
        icon_cat = properties.get("iconCategory", 0)
        incident_type = TOMTOM_ICON_CATEGORY_MAP.get(icon_cat, "CONGESTION")

        # Map criticality from magnitudeOfDelay
        mag_delay = properties.get("magnitudeOfDelay")
        criticality = None
        if mag_delay is not None and isinstance(mag_delay, int):
            criticality = TOMTOM_MAGNITUDE_DELAY_MAP.get(mag_delay, "unknown")

        # Delay in seconds
        delay_sec = properties.get("delay")
        if delay_sec is not None:
            try:
                delay_sec = int(delay_sec)
            except (ValueError, TypeError):
                delay_sec = None

        # Road name
        road_numbers = properties.get("roadNumbers")
        road_name = None
        if isinstance(road_numbers, list) and len(road_numbers) > 0:
            road_name = ", ".join(str(r) for r in road_numbers)
        elif properties.get("from") or properties.get("to"):
            from_str = properties.get("from", "")
            to_str = properties.get("to", "")
            road_name = f"{from_str} -> {to_str}".strip(" ->")

        # Description
        events = properties.get("events", [])
        description = None
        if isinstance(events, list) and len(events) > 0 and isinstance(events[0], dict):
            description = events[0].get("description")

        # Extract coordinates from geometry
        geom_type = geometry.get("type")
        coords = geometry.get("coordinates", [])
        lat = 0.0
        lon = 0.0

        if geom_type == "LineString" and isinstance(coords, list) and len(coords) > 0:
            # TomTom GeoJSON coordinates are [lon, lat]
            first_pt = coords[0]
            if isinstance(first_pt, list) and len(first_pt) >= 2:
                lon = float(first_pt[0])
                lat = float(first_pt[1])
        elif geom_type == "Point" and isinstance(coords, list) and len(coords) >= 2:
            lon = float(coords[0])
            lat = float(coords[1])
        elif geom_type == "MultiLineString" and isinstance(coords, list) and len(coords) > 0:
            if isinstance(coords[0], list) and len(coords[0]) > 0:
                first_pt = coords[0][0]
                if isinstance(first_pt, list) and len(first_pt) >= 2:
                    lon = float(first_pt[0])
                    lat = float(first_pt[1])

        # Skip if no coordinates could be extracted
        if lat == 0.0 and lon == 0.0:
            continue

        # Timestamps
        start_time_str = properties.get("startTime")
        end_time_str = properties.get("endTime")
        observed_at = _parse_iso_utc(start_time_str) or datetime.datetime.utcnow()
        expected_end_at = _parse_iso_utc(end_time_str)

        record_id = f"tomtom:{inc_id or f'{lat:.4f}:{lon:.4f}:{int(observed_at.timestamp())}'}"

        records.append(
            NormalizedTrafficRecord(
                source_id="tomtom_traffic",
                source_record_id=record_id,
                incident_type=incident_type,
                criticality=criticality,
                latitude=lat,
                longitude=lon,
                geometry_geojson=geometry if geometry else None,
                jam_factor=None,  # Explicitly None for TomTom (no fabrication)
                delay_seconds=delay_sec,
                road_name=road_name,
                description=description,
                observed_at=observed_at,
                expected_end_at=expected_end_at,
            )
        )

    return records


def normalize_here_traffic_response(data: Dict[str, Any]) -> List[NormalizedTrafficRecord]:
    """
    Normalizes HERE Traffic API v7 (/v7/incidents) response into NormalizedTrafficRecords.
    Retained for backward compatibility and multi-provider fallback.
    """
    records: List[NormalizedTrafficRecord] = []
    results = data.get("results", [])

    for item in results:
        inc_id = str(item.get("id") or item.get("incidentId") or "")
        details = item.get("incidentDetails", {})
        location = item.get("location", {})

        lat = 0.0
        lon = 0.0
        geojson_shape = None

        shape = location.get("shape", {})
        links = shape.get("links", [])
        if links and links[0].get("points"):
            first_point = links[0]["points"][0]
            lat = float(first_point.get("lat", 0.0))
            lon = float(first_point.get("lng") or first_point.get("lon", 0.0))
            coords = [[p.get("lng") or p.get("lon", 0.0), p.get("lat", 0.0)] for l in links for p in l.get("points", [])]
            if len(coords) >= 2:
                geojson_shape = {"type": "LineString", "coordinates": coords}
            elif len(coords) == 1:
                geojson_shape = {"type": "Point", "coordinates": coords[0]}
        elif "point" in location:
            lat = float(location["point"].get("lat", 0.0))
            lon = float(location["point"].get("lng") or location["point"].get("lon", 0.0))
            geojson_shape = {"type": "Point", "coordinates": [lon, lat]}
        else:
            continue

        if lat == 0.0 and lon == 0.0:
            continue

        start_time_str = details.get("startTime")
        end_time_str = details.get("endTime")
        observed_at = _parse_iso_utc(start_time_str) or datetime.datetime.utcnow()
        expected_end_at = _parse_iso_utc(end_time_str)

        jam_factor = details.get("jamFactor")
        criticality = details.get("criticality")
        if jam_factor is None and criticality:
            crit_lower = str(criticality).lower()
            if crit_lower == "critical":
                jam_factor = 8.5
            elif crit_lower == "major":
                jam_factor = 7.0
            elif crit_lower == "minor":
                jam_factor = 4.0
            else:
                jam_factor = 2.0
        elif jam_factor is not None:
            jam_factor = float(jam_factor)

        delay_sec = details.get("delay")
        if delay_sec is not None:
            delay_sec = int(delay_sec)

        desc_raw = details.get("description")
        desc = desc_raw.get("value") if isinstance(desc_raw, dict) else str(desc_raw or "")

        road_raw = details.get("roadName")
        road_name = road_raw.get("value") if isinstance(road_raw, dict) else (str(road_raw) if road_raw else None)

        inc_type = str(details.get("incidentType") or "CONGESTION").upper()
        record_id = f"here:{inc_id or f'{lat:.4f}:{lon:.4f}:{int(observed_at.timestamp())}'}"

        records.append(
            NormalizedTrafficRecord(
                source_id="here_traffic",
                source_record_id=record_id,
                incident_type=inc_type,
                criticality=str(criticality) if criticality else None,
                latitude=lat,
                longitude=lon,
                geometry_geojson=geojson_shape,
                jam_factor=jam_factor,
                delay_seconds=delay_sec,
                road_name=road_name,
                description=desc if desc else None,
                observed_at=observed_at,
                expected_end_at=expected_end_at,
            )
        )

    return records
