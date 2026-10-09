import json
import logging
from typing import Any, List, Optional
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class PilotLocation(BaseModel):
    name: str
    lat: float
    lon: float

    @field_validator("lat")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        if not (-90.0 <= v <= 90.0):
            raise ValueError(f"Latitude must be between -90 and 90, got {v}")
        return v

    @field_validator("lon")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        if not (-180.0 <= v <= 180.0):
            raise ValueError(f"Longitude must be between -180 and 180, got {v}")
        return v


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General
    APP_ENV: str = "development"
    APP_NAME: str = "MyArea24"
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite:///./myarea24.db"

    # WeatherAPI
    WEATHERAPI_API_KEY: Optional[str] = None
    WEATHERAPI_BASE_URL: str = "https://api.weatherapi.com/v1"
    WEATHER_POLL_INTERVAL_MINUTES: int = 30

    # Traffic Provider Configuration (TomTom Primary, HERE Optional Fallback)
    TRAFFIC_PROVIDER: str = "tomtom"  # "tomtom" or "here"
    TOMTOM_API_KEY: Optional[str] = None
    TOMTOM_TRAFFIC_BASE_URL: str = "https://api.tomtom.com/traffic/services/5"

    HERE_API_KEY: Optional[str] = None
    HERE_TRAFFIC_BASE_URL: str = "https://data.traffic.hereapi.com/v7"
    TRAFFIC_POLL_INTERVAL_MINUTES: int = 10

    # NDMA SACHET
    SACHET_FEED_URL: str = "https://sachet.ndma.gov.in/backend/cap/rss/all/en"
    SACHET_POLL_INTERVAL_MINUTES: int = 15

    # HTTP Client Controls
    HTTP_TIMEOUT_SECONDS: float = 10.0
    MAX_HTTP_RETRIES: int = 3

    # Ingestion Master Switch
    INGESTION_ENABLED: bool = False

    # Correlation Rule Thresholds (Scenario D: Monsoon Commute)
    RULE_RAIN_THRESHOLD_MM_PER_HR: float = 8.0
    RULE_JAM_FACTOR_THRESHOLD: float = 6.5
    RULE_DELAY_THRESHOLD_SECONDS: int = 900
    RULE_SPATIAL_RADIUS_KM: float = 5.0
    RULE_EVALUATION_WINDOW_START: str = "17:30"
    RULE_EVALUATION_WINDOW_END: str = "20:30"
    RULE_SIGNAL_MAX_AGE_MINUTES: int = 60
    RULE_TIMEZONE: str = "Asia/Kolkata"

    # Pilot Locations & Traffic Bounding Box
    PILOT_LOCATIONS: Any = Field(
        default=[
            {"name": "Delhi AIIMS Ring Road", "lat": 28.5672, "lon": 77.2100},
            {"name": "Delhi Connaught Place", "lat": 28.6304, "lon": 77.2177},
            {"name": "Delhi Rohini Sector 11", "lat": 28.7144, "lon": 77.1197},
            {"name": "Bengaluru Silk Board", "lat": 12.9176, "lon": 77.6233},
            {"name": "Bengaluru Indiranagar", "lat": 12.9784, "lon": 77.6408},
        ]
    )
    PILOT_TRAFFIC_BBOX: str = "77.1500,28.5200,77.2600,28.6200"  # minLon,minLat,maxLon,maxLat

    @property
    def parsed_pilot_locations(self) -> List[PilotLocation]:
        if isinstance(self.PILOT_LOCATIONS, str):
            try:
                raw = json.loads(self.PILOT_LOCATIONS)
            except json.JSONDecodeError:
                return []
        else:
            raw = self.PILOT_LOCATIONS
        return [PilotLocation(**item) if isinstance(item, dict) else item for item in raw]

    @property
    def traffic_bbox_coords(self) -> tuple[float, float, float, float]:
        parts = [float(x.strip()) for x in self.PILOT_TRAFFIC_BBOX.split(",")]
        if len(parts) != 4:
            raise ValueError(f"Invalid PILOT_TRAFFIC_BBOX: {self.PILOT_TRAFFIC_BBOX}")
        return parts[0], parts[1], parts[2], parts[3]


settings = Settings()
