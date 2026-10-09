import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class NormalizedWeatherRecord(BaseModel):
    source_id: str = "weatherapi"
    source_record_id: str
    location_name: str
    latitude: float
    longitude: float
    observed_at: datetime.datetime  # UTC
    forecast_valid_until: Optional[datetime.datetime] = None  # UTC
    temperature_c: float
    precipitation_mm: float  # mm of rainfall over interval
    precipitation_interval_minutes: int = 60
    condition_text: str
    wind_kph: Optional[float] = None
    humidity: Optional[int] = None
    raw_timestamp: Optional[int] = None

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
    def is_heavy_rain(self) -> bool:
        """Returns True if precipitation exceeds moderate rain threshold (> 7.5 mm/hr)."""
        return self.precipitation_mm >= 7.5


def normalize_weatherapi_response(data: Dict[str, Any]) -> List[NormalizedWeatherRecord]:
    """
    Normalizes WeatherAPI.com /forecast.json or /current.json response into NormalizedWeatherRecords.
    Extracts current condition and upcoming hourly forecast records.
    """
    records: List[NormalizedWeatherRecord] = []

    location = data.get("location", {})
    loc_name = location.get("name", "Unknown")
    lat = float(location.get("lat", 0.0))
    lon = float(location.get("lon", 0.0))

    # 1. Normalize Current Observation
    current = data.get("current")
    if current:
        last_updated_epoch = current.get("last_updated_epoch")
        if last_updated_epoch:
            observed_at = datetime.datetime.fromtimestamp(last_updated_epoch, tz=datetime.timezone.utc).replace(tzinfo=None)
        else:
            observed_at = datetime.datetime.utcnow()

        record_id = f"weatherapi:current:{lat:.4f}:{lon:.4f}:{last_updated_epoch or int(observed_at.timestamp())}"
        condition = current.get("condition", {})

        records.append(
            NormalizedWeatherRecord(
                source_id="weatherapi",
                source_record_id=record_id,
                location_name=loc_name,
                latitude=lat,
                longitude=lon,
                observed_at=observed_at,
                forecast_valid_until=observed_at + datetime.timedelta(minutes=60),
                temperature_c=float(current.get("temp_c", 0.0)),
                precipitation_mm=float(current.get("precip_mm", 0.0)),
                precipitation_interval_minutes=60,
                condition_text=condition.get("text", "Unknown"),
                wind_kph=float(current.get("wind_kph", 0.0)) if "wind_kph" in current else None,
                humidity=int(current.get("humidity", 0)) if "humidity" in current else None,
                raw_timestamp=last_updated_epoch,
            )
        )

    # 2. Normalize Hourly Forecast Records (if present)
    forecast = data.get("forecast", {}).get("forecastday", [])
    for fday in forecast:
        for hour in fday.get("hour", []):
            time_epoch = hour.get("time_epoch")
            if not time_epoch:
                continue
            forecast_time = datetime.datetime.fromtimestamp(time_epoch, tz=datetime.timezone.utc).replace(tzinfo=None)
            hour_cond = hour.get("condition", {})

            hour_record_id = f"weatherapi:forecast:{lat:.4f}:{lon:.4f}:{time_epoch}"
            records.append(
                NormalizedWeatherRecord(
                    source_id="weatherapi",
                    source_record_id=hour_record_id,
                    location_name=loc_name,
                    latitude=lat,
                    longitude=lon,
                    observed_at=forecast_time,
                    forecast_valid_until=forecast_time + datetime.timedelta(minutes=60),
                    temperature_c=float(hour.get("temp_c", 0.0)),
                    precipitation_mm=float(hour.get("precip_mm", 0.0)),
                    precipitation_interval_minutes=60,
                    condition_text=hour_cond.get("text", "Forecast"),
                    wind_kph=float(hour.get("wind_kph", 0.0)) if "wind_kph" in hour else None,
                    humidity=int(hour.get("humidity", 0)) if "humidity" in hour else None,
                    raw_timestamp=time_epoch,
                )
            )

    return records
