import datetime
from typing import Any, Dict, List, Optional
from dateutil import parser as dt_parser
from pydantic import BaseModel, Field, field_validator


class NormalizedTrafficRecord(BaseModel):
    source_id: str = "here_traffic"
    source_record_id: str
    incident_type: str  # 'CONGESTION', 'ACCIDENT', 'ROAD_CLOSURE', etc.
    criticality: Optional[str] = None  # 'critical', 'major', 'minor', 'low'
    latitude: float
    longitude: float
    geometry_geojson: Optional[Dict[str, Any]] = None
    jam_factor: Optional[float] = None  # 0.0 to 10.0
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


def normalize_here_traffic_response(data: Dict[str, Any]) -> List[NormalizedTrafficRecord]:
    """
    Normalizes HERE Traffic API v7 (/v7/incidents) response into NormalizedTrafficRecords.
    """
    records: List[NormalizedTrafficRecord] = []
    results = data.get("results", [])

    for item in results:
        inc_id = str(item.get("id") or item.get("incidentId") or "")
        details = item.get("incidentDetails", {})
        location = item.get("location", {})

        # Extract coordinates from shape points or centroid
        lat = 0.0
        lon = 0.0
        geojson_shape = None

        shape = location.get("shape", {})
        links = shape.get("links", [])
        if links and links[0].get("points"):
            first_point = links[0]["points"][0]
            lat = float(first_point.get("lat", 0.0))
            lon = float(first_point.get("lng") or first_point.get("lon", 0.0))
            # Format coordinates into GeoJSON LineString
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
            # Skip if no valid location coordinate found
            continue

        if lat == 0.0 and lon == 0.0:
            continue

        # Timestamps
        start_time_str = details.get("startTime")
        end_time_str = details.get("endTime")
        observed_at = _parse_iso_utc(start_time_str) or datetime.datetime.utcnow()
        expected_end_at = _parse_iso_utc(end_time_str)

        # Jam factor & delay
        jam_factor = details.get("jamFactor")
        criticality = details.get("criticality")
        if jam_factor is None and criticality:
            # Map criticality heuristic if jamFactor is omitted by specific incident type
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

        # Description and road name
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
