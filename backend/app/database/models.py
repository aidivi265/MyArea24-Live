import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    Index,
    JSON,
    BigInteger,
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base


class DataSource(Base):
    __tablename__ = "data_sources"

    id = Column(String(50), primary_key=True)  # e.g., 'weatherapi', 'here_traffic', 'sachet_cap'
    name = Column(String(100), nullable=False)
    base_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_sync_at = Column(DateTime, nullable=True)
    last_status = Column(String(50), nullable=True)  # 'SUCCESS', 'FAILED', 'RATE_LIMITED'
    error_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    sync_logs = relationship("DataSyncLog", back_populates="source", cascade="all, delete-orphan")


class DataSyncLog(Base):
    __tablename__ = "data_sync_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(50), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False)
    sync_started_at = Column(DateTime, nullable=False)
    sync_ended_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    records_fetched = Column(Integer, default=0, nullable=False)
    records_persisted = Column(Integer, default=0, nullable=False)
    records_rejected = Column(Integer, default=0, nullable=False)
    status = Column(String(50), nullable=False)  # 'SUCCESS', 'FAILED', 'RATE_LIMITED'
    error_message = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    source = relationship("DataSource", back_populates="sync_logs")

    __table_args__ = (
        Index("ix_sync_logs_source_started", "source_id", "sync_started_at"),
    )


class WeatherObservation(Base):
    __tablename__ = "weather_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(50), ForeignKey("data_sources.id"), default="weatherapi", nullable=False)
    source_record_id = Column(String(255), unique=True, nullable=False)  # deduplication key
    location_name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    observed_at = Column(DateTime, nullable=False)
    forecast_valid_until = Column(DateTime, nullable=True)
    temperature_c = Column(Float, nullable=False)
    precipitation_mm = Column(Float, nullable=False)  # rainfall accumulation over interval
    precipitation_interval_minutes = Column(Integer, default=60, nullable=False)
    condition_text = Column(String(100), nullable=False)
    wind_kph = Column(Float, nullable=True)
    humidity = Column(Integer, nullable=True)
    raw_timestamp = Column(BigInteger, nullable=True)
    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_weather_coords_observed", "latitude", "longitude", "observed_at"),
        Index("ix_weather_observed_at", "observed_at"),
    )


class TrafficObservation(Base):
    __tablename__ = "traffic_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(50), ForeignKey("data_sources.id"), default="here_traffic", nullable=False)
    source_record_id = Column(String(255), unique=True, nullable=False)  # deduplication key
    incident_type = Column(String(50), nullable=False)  # 'CONGESTION', 'ACCIDENT', 'ROAD_CLOSURE', etc.
    criticality = Column(String(20), nullable=True)  # 'critical', 'major', 'minor', 'low'
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    geometry_geojson = Column(JSON, nullable=True)
    jam_factor = Column(Float, nullable=True)  # 0.0 to 10.0
    delay_seconds = Column(Integer, nullable=True)
    road_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    observed_at = Column(DateTime, nullable=False)
    expected_end_at = Column(DateTime, nullable=True)
    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_traffic_coords_observed", "latitude", "longitude", "observed_at"),
        Index("ix_traffic_observed_at", "observed_at"),
    )


class GovernmentNotice(Base):
    __tablename__ = "government_notices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(50), ForeignKey("data_sources.id"), default="sachet_cap", nullable=False)
    alert_identifier = Column(String(255), unique=True, nullable=False)  # CAP <identifier>
    sender = Column(String(255), nullable=False)
    event_type = Column(String(100), nullable=False)
    severity = Column(String(50), nullable=False)  # 'Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'
    urgency = Column(String(50), nullable=False)
    certainty = Column(String(50), nullable=False)
    headline = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    instruction = Column(Text, nullable=True)
    area_description = Column(Text, nullable=False)
    polygon_geojson = Column(JSON, nullable=True)
    circle_geojson = Column(JSON, nullable=True)
    effective_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_notices_effective_expires", "effective_at", "expires_at"),
        Index("ix_notices_active", "is_active"),
    )


class IntelligenceInsight(Base):
    __tablename__ = "intelligence_insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    insight_type = Column(String(50), nullable=False)  # 'weather_traffic_correlation'
    area_label = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    radius_km = Column(Float, default=5.0, nullable=False)
    headline = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    potential_impact = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    evidence_quality = Column(String(50), nullable=False)  # 'supported', 'insufficient_evidence'
    composite_severity = Column(String(20), nullable=False)  # 'minor', 'moderate', 'high', 'severe'
    confidence_level = Column(String(50), default="HIGH (Multi-Source Corroborated)", nullable=False)
    rule_identifier = Column(String(100), default="SCENARIO_A_WEATHER_TRAFFIC", nullable=False)
    rule_version = Column(String(20), default="1.0", nullable=False)
    data_quality_notes = Column(Text, nullable=True)
    observed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    next_review_at = Column(DateTime, nullable=True)
    dedup_hash = Column(String(64), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    signals = relationship("IntelligenceSignal", back_populates="insight", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_insights_area_created", "area_label", "created_at"),
        Index("ix_insights_active_expires", "is_active", "expires_at"),
        Index("ix_insights_type_severity", "insight_type", "composite_severity"),
    )


class IntelligenceSignal(Base):
    __tablename__ = "intelligence_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    insight_id = Column(Integer, ForeignKey("intelligence_insights.id", ondelete="CASCADE"), nullable=False)
    signal_type = Column(String(50), nullable=False)  # 'weather', 'traffic', 'alert'
    source_name = Column(String(50), nullable=False)  # 'weatherapi', 'here_traffic', 'sachet_cap'
    observation_table = Column(String(50), nullable=False)
    observation_id = Column(Integer, nullable=False)
    observed_at = Column(DateTime, nullable=False)
    metric_summary = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    insight = relationship("IntelligenceInsight", back_populates="signals")

    __table_args__ = (
        Index("ix_signals_insight", "insight_id"),
        Index("ix_signals_obs", "observation_table", "observation_id"),
    )
