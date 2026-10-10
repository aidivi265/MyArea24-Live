import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

from backend.app.normalization.aqi_calculator import (
    calculate_cpcb_aqi,
    convert_pollutant_concentration,
    get_aqi_category,
)


class NormalizedAQIRecord(BaseModel):
    source_id: str = "openaq"
    source_record_id: str  # Unique deduplication key: e.g. "openaq:12345:1697000000"
    station_id: str
    station_name: str
    city: str
    state: Optional[str] = None
    latitude: float
    longitude: float
    observed_at: datetime.datetime  # UTC
    aqi_value: Optional[float] = None
    aqi_category: Optional[str] = None
    prominent_pollutant: Optional[str] = None
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    so2: Optional[float] = None
    co: Optional[float] = None
    o3: Optional[float] = None
    is_naqi_compliant: bool = False
    raw_data: Optional[Dict[str, Any]] = None

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

    @property
    def is_severe(self) -> bool:
        """Returns True if AQI is in the Severe band (>= 401)."""
        return (self.aqi_value or 0) >= 401.0

    @property
    def is_very_poor(self) -> bool:
        """Returns True if AQI is in the Very Poor band (>= 301)."""
        return (self.aqi_value or 0) >= 301.0


def normalize_openaq_location_response(location_data: Dict[str, Any]) -> Optional[NormalizedAQIRecord]:
    """
    Normalizes OpenAQ v3 Location or Sensor response item into NormalizedAQIRecord.
    Supports OpenAQ v3 /locations/{id}/latest or /locations with embedded sensors.
    """
    loc_id = str(location_data.get("id", ""))
    loc_name = location_data.get("name", "Unknown Station")
    locality = location_data.get("locality") or location_data.get("city") or "Unknown"

    coords = location_data.get("coordinates", {})
    if not coords or coords.get("latitude") is None or coords.get("longitude") is None:
        return None

    lat = float(coords["latitude"])
    lon = float(coords["longitude"])

    # Extract sensors/pollutants
    pollutants: Dict[str, Optional[float]] = {}
    latest_dt: Optional[datetime.datetime] = None

    # Handle OpenAQ v3 sensors or latest measurements list
    sensors = location_data.get("sensors") or location_data.get("instruments") or []
    if isinstance(sensors, list):
        for s in sensors:
            param = s.get("parameter", {})
            param_name = param.get("name", "") if isinstance(param, dict) else str(param)
            val = None

            # OpenAQ v3 latest value format
            latest_obj = s.get("latest", {})
            unit = param.get("units") if isinstance(param, dict) else s.get("units")
            if isinstance(latest_obj, dict):
                val = latest_obj.get("value")
                dt_str = latest_obj.get("datetime")
                if dt_str and latest_dt is None:
                    try:
                        latest_dt = datetime.datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    except Exception:
                        pass
            elif s.get("value") is not None:
                val = s.get("value")

            if val is not None and val >= 0:
                p_norm = param_name.lower().replace(".", "")
                if p_norm in ("pm25", "pm25"):
                    pollutants["PM2.5"] = convert_pollutant_concentration("PM2.5", float(val), unit)
                elif p_norm == "pm10":
                    pollutants["PM10"] = convert_pollutant_concentration("PM10", float(val), unit)
                elif p_norm in ("no2", "nox"):
                    pollutants["NO2"] = convert_pollutant_concentration("NO2", float(val), unit)
                elif p_norm == "so2":
                    pollutants["SO2"] = convert_pollutant_concentration("SO2", float(val), unit)
                elif p_norm == "co":
                    pollutants["CO"] = convert_pollutant_concentration("CO", float(val), unit)
                elif p_norm in ("o3", "ozone"):
                    pollutants["O3"] = convert_pollutant_concentration("O3", float(val), unit)

    # Check direct measurements format if passed
    measurements = location_data.get("measurements") or []
    if isinstance(measurements, list):
        for m in measurements:
            param_name = m.get("parameter", "")
            val = m.get("value")
            unit = m.get("unit") or m.get("units")
            if val is not None and val >= 0:
                p_norm = param_name.lower().replace(".", "")
                if p_norm in ("pm25", "pm25"):
                    pollutants["PM2.5"] = convert_pollutant_concentration("PM2.5", float(val), unit)
                elif p_norm == "pm10":
                    pollutants["PM10"] = convert_pollutant_concentration("PM10", float(val), unit)
                elif p_norm in ("no2", "nox"):
                    pollutants["NO2"] = convert_pollutant_concentration("NO2", float(val), unit)
                elif p_norm == "so2":
                    pollutants["SO2"] = convert_pollutant_concentration("SO2", float(val), unit)
                elif p_norm == "co":
                    pollutants["CO"] = convert_pollutant_concentration("CO", float(val), unit)
                elif p_norm in ("o3", "ozone"):
                    pollutants["O3"] = convert_pollutant_concentration("O3", float(val), unit)

            if latest_dt is None and m.get("lastUpdated"):
                try:
                    latest_dt = datetime.datetime.fromisoformat(m["lastUpdated"].replace("Z", "+00:00"))
                except Exception:
                    pass

    # Ensure timestamp is UTC naive datetime
    if latest_dt:
        if latest_dt.tzinfo is not None:
            latest_dt = latest_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    else:
        latest_dt = datetime.datetime.utcnow()

    # Calculate CPCB AQI
    calc_res = calculate_cpcb_aqi(pollutants)
    aqi_val = calc_res.aqi_value if calc_res else None
    aqi_cat = calc_res.aqi_category if calc_res else None
    prominent = calc_res.prominent_pollutant if calc_res else None
    is_compliant = calc_res.is_naqi_compliant if calc_res else False

    epoch_sec = int(latest_dt.timestamp())
    record_id = f"openaq:{loc_id}:{epoch_sec}"

    return NormalizedAQIRecord(
        source_id="openaq",
        source_record_id=record_id,
        station_id=loc_id,
        station_name=loc_name,
        city=locality,
        state=location_data.get("country", {}).get("name") if isinstance(location_data.get("country"), dict) else None,
        latitude=lat,
        longitude=lon,
        observed_at=latest_dt,
        aqi_value=aqi_val,
        aqi_category=aqi_cat,
        prominent_pollutant=prominent,
        pm25=pollutants.get("PM2.5"),
        pm10=pollutants.get("PM10"),
        no2=pollutants.get("NO2"),
        so2=pollutants.get("SO2"),
        co=pollutants.get("CO"),
        o3=pollutants.get("O3"),
        is_naqi_compliant=is_compliant,
        raw_data=location_data,
    )
