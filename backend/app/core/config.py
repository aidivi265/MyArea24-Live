import json
import logging
from typing import Any, List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
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

    # CORS Configuration (W3C Fetch Specification Compliant)
    ALLOWED_ORIGINS: Any = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "https://aidivi265.github.io",
        ]
    )
    ALLOWED_ORIGIN_REGEX: Optional[str] = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://aidivi265\.github\.io$"

    # Database
    DATABASE_URL: str = "sqlite:///./myarea24.db"
    DB_POOL_SIZE: int = 15
    DB_MAX_OVERFLOW: int = 25
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Authentication & JWT Configuration
    JWT_SECRET_KEY: str = "myarea24_local_development_secret_key_2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Email & SMTP Configuration for OTP Delivery
    # In development mode, if SMTP credentials are blank, OTP is logged to console and provided in dev responses
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "no-reply@myarea24.in"
    SMTP_TLS: bool = True
    OTP_DEV_MODE: bool = True

    # Resend Transactional Email API (Alternative to SMTP)
    RESEND_API_KEY: Optional[str] = None

    # Google Gemini AI Assistant Configuration
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash"

    # Sarvam AI — Indian language TTS, STT, translation (https://www.sarvam.ai)
    SARVAM_API_KEY: Optional[str] = None
    SARVAM_API_BASE_URL: str = "https://api.sarvam.ai"

    # Google Maps Platform
    GOOGLE_MAPS_API_KEY: Optional[str] = None

    # Weather Providers (WeatherAPI Primary, OpenWeatherMap Secondary)
    WEATHERAPI_API_KEY: Optional[str] = None
    WEATHERAPI_BASE_URL: str = "https://api.weatherapi.com/v1"
    OPENWEATHERMAP_API_KEY: Optional[str] = None
    WEATHER_POLL_INTERVAL_MINUTES: int = 30

    # Fuel Price Telemetry (API Mitra)
    API_MITRA_API_KEY: Optional[str] = None

    # Traffic Provider Configuration (TomTom Primary, HERE Optional Fallback)
    TRAFFIC_PROVIDER: str = "tomtom"  # "tomtom" or "here"
    TOMTOM_API_KEY: Optional[str] = None
    TOMTOM_TRAFFIC_BASE_URL: str = "https://api.tomtom.com/traffic/services/5"

    HERE_API_KEY: Optional[str] = None
    HERE_TRAFFIC_BASE_URL: str = "https://data.traffic.hereapi.com/v7"
    TRAFFIC_POLL_INTERVAL_MINUTES: int = 10

    # NDMA SACHET
    SACHET_FEED_URL: str = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
    SACHET_POLL_INTERVAL_MINUTES: int = 15
    SACHET_MAX_ITEMS_PER_POLL: int = 20
    SACHET_DETAIL_FETCH_TIMEOUT: float = 8.0

    # Air Quality Provider Configuration (OpenAQ v3 / CPCB CAAQMS Aggregation)
    OPENAQ_API_KEY: Optional[str] = None
    OPENAQ_BASE_URL: str = "https://api.openaq.org/v3"
    DATA_GOV_IN_API_KEY: Optional[str] = None
    AQI_POLL_INTERVAL_MINUTES: int = 60
    AQI_MAX_STATION_DISTANCE_KM: float = 15.0
    AQI_OBSERVATION_MAX_AGE_MINUTES: int = 180
    CORRELATION_POLL_INTERVAL_MINUTES: int = 10

    @field_validator("OPENAQ_API_KEY")
    @classmethod
    def clean_openaq_key(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = v.strip().strip("'\"")
        if "=" in cleaned:
            cleaned = cleaned.split("=")[-1].strip().strip("'\"")
        if cleaned.lower() in ("your_key", "your_openaq_api_key", "placeholder", "xxx", "none", "null", ""):
            return None
        return cleaned if cleaned else None

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
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, str):
            raw = self.ALLOWED_ORIGINS.strip()
            if raw.startswith("["):
                try:
                    return json.loads(raw)
                except Exception:
                    pass
            return [orig.strip() for orig in raw.split(",") if orig.strip()]
        elif isinstance(self.ALLOWED_ORIGINS, list):
            return [str(x) for x in self.ALLOWED_ORIGINS]
        return ["http://localhost:5173", "https://aidivi265.github.io"]

    @property
    def traffic_bbox_coords(self) -> tuple[float, float, float, float]:
        parts = [float(x.strip()) for x in self.PILOT_TRAFFIC_BBOX.split(",")]
        if len(parts) != 4:
            raise ValueError(f"Invalid PILOT_TRAFFIC_BBOX: {self.PILOT_TRAFFIC_BBOX}")
        return parts[0], parts[1], parts[2], parts[3]

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        env = (self.APP_ENV or "").strip().lower()
        default_insecure_key = "myarea24_local_development_secret_key_2026"
        if env in ["production", "prod"]:
            if not self.JWT_SECRET_KEY or default_insecure_key in self.JWT_SECRET_KEY:
                raise ValueError(
                    "CRITICAL SECURITY CONFIGURATION ERROR: Default JWT_SECRET_KEY cannot be used "
                    "when APP_ENV is set to 'production'. You must configure a secure, unique JWT_SECRET_KEY."
                )
        return self


settings = Settings()
