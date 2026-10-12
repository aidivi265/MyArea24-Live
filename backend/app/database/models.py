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


class AirQualityObservation(Base):
    __tablename__ = "air_quality_observations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_id = Column(String(50), ForeignKey("data_sources.id"), default="openaq", nullable=False)
    source_record_id = Column(String(255), unique=True, nullable=False)  # deduplication key
    station_id = Column(String(100), nullable=False)
    station_name = Column(String(200), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    observed_at = Column(DateTime, nullable=False)
    aqi_value = Column(Float, nullable=True)  # CPCB NAQI (0-500+)
    aqi_category = Column(String(50), nullable=True)  # 'Good', 'Satisfactory', 'Moderate', 'Poor', 'Very Poor', 'Severe'
    prominent_pollutant = Column(String(50), nullable=True)  # e.g. 'PM2.5', 'PM10'
    pm25 = Column(Float, nullable=True)  # µg/m³
    pm10 = Column(Float, nullable=True)  # µg/m³
    no2 = Column(Float, nullable=True)  # µg/m³
    so2 = Column(Float, nullable=True)  # µg/m³
    co = Column(Float, nullable=True)  # mg/m³
    o3 = Column(Float, nullable=True)  # µg/m³
    raw_data = Column(JSON, nullable=True)
    ingested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_aqi_coords_observed", "latitude", "longitude", "observed_at"),
        Index("ix_aqi_observed_at", "observed_at"),
        Index("ix_aqi_station_observed", "station_id", "observed_at"),
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


# ==============================================================================
# MyArea24 Hyperlocal Marketplace & Discovery Domain Models
# ==============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True, index=True)
    full_name = Column(String(150), nullable=True)
    role = Column(String(50), default="resident", nullable=False)  # 'resident', 'merchant', 'admin'
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    businesses = relationship("Business", back_populates="owner")
    saved_items = relationship("SavedItem", back_populates="user", cascade="all, delete-orphan")


class OtpToken(Base):
    __tablename__ = "otp_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    otp_code = Column(String(10), nullable=False)
    purpose = Column(String(50), default="login", nullable=False)  # 'login', 'signup', 'merchant_onboarding'
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_otp_email_code", "email", "otp_code"),
    )


class Business(Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(150), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(100), nullable=False, index=True)  # 'Electronics', 'Grocery', 'Pharmacy', 'Stationery', 'Food & Dining', 'Services'
    subcategory = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    address = Column(Text, nullable=False)
    locality = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), default="Delhi NCR", nullable=False)
    pincode = Column(String(20), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String(50), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    website = Column(String(255), nullable=True)
    opening_time = Column(String(10), default="09:00", nullable=False)
    closing_time = Column(String(10), default="21:30", nullable=False)
    days_open = Column(String(100), default="Mon-Sun", nullable=False)
    image_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="active", nullable=False)  # 'active', 'pending_approval', 'suspended'
    rating = Column(Float, default=4.5, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)
    view_count = Column(Integer, default=0, nullable=False)
    call_clicks = Column(Integer, default=0, nullable=False)
    direction_clicks = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="businesses")
    products = relationship("Product", back_populates="business", cascade="all, delete-orphan")
    offers = relationship("Offer", back_populates="business", cascade="all, delete-orphan")
    enquiries = relationship("CustomerEnquiry", back_populates="business", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_business_locality_category", "locality", "category"),
        Index("ix_business_city_category", "city", "category"),
        Index("ix_business_coords", "latitude", "longitude"),
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    brand = Column(String(100), nullable=True, index=True)
    model_variant = Column(String(100), nullable=True)
    category = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    local_price = Column(Float, nullable=False)  # Price in INR ₹
    mrp = Column(Float, nullable=True)
    online_price = Column(Float, nullable=True)  # Online comparison benchmark
    online_provider = Column(String(50), nullable=True)  # e.g. Amazon, Flipkart, Blinkit
    online_url = Column(String(500), nullable=True)
    availability_status = Column(String(50), default="in_stock", nullable=False)  # 'in_stock', 'confirm_with_seller', 'low_stock', 'out_of_stock'
    stock_quantity = Column(Integer, nullable=True)
    image_url = Column(String(500), nullable=True)
    price_updated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    business = relationship("Business", back_populates="products")

    __table_args__ = (
        Index("ix_product_category_price", "category", "local_price"),
    )


class ServiceListing(Base):
    __tablename__ = "service_listings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_name = Column(String(200), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True)
    category = Column(String(100), nullable=False, index=True)  # 'Electrician', 'Plumber', 'AC Repair', 'Salon', 'Tutor'
    description = Column(Text, nullable=True)
    service_area = Column(String(255), nullable=False)
    locality = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String(50), nullable=False)
    whatsapp = Column(String(50), nullable=True)
    price_starting_at = Column(Float, nullable=True)
    price_unit = Column(String(50), default="per visit", nullable=False)
    timing = Column(String(100), default="08:00 AM - 08:00 PM", nullable=False)
    experience_years = Column(Integer, default=5, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    rating = Column(Float, default=4.8, nullable=False)
    review_count = Column(Integer, default=12, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_service_locality_cat", "locality", "category"),
    )


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    discount_text = Column(String(100), nullable=False)  # e.g., '20% OFF', 'Flat ₹500 Off'
    coupon_code = Column(String(50), nullable=True)
    category = Column(String(100), nullable=False, index=True)
    valid_from = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    valid_until = Column(DateTime, nullable=False)
    terms_conditions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    banner_image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    business = relationship("Business", back_populates="offers")

    __table_args__ = (
        Index("ix_offers_valid_active", "is_active", "valid_until"),
    )


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, index=True)  # 'Civic Advisory', 'Community', 'Workshop', 'Market'
    organizer = Column(String(200), nullable=False)
    venue_name = Column(String(200), nullable=False)
    address = Column(Text, nullable=False)
    locality = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    timing_text = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    registration_url = Column(String(500), nullable=True)
    is_verified = Column(Boolean, default=True, nullable=False)
    source = Column(String(100), default="Official Municipal / Community Board", nullable=False)
    expected_attendance = Column(Integer, default=500, nullable=True)
    parking_pressure = Column(String(50), default="MODERATE", nullable=True)  # 'CRITICAL', 'ELEVATED', 'MODERATE', 'NORMAL'
    arterial_traffic_impact = Column(String(50), default="MODERATE", nullable=True)  # 'HIGH_BOTTLENECK', 'MODERATE', 'LOW'
    exit_weather_advisory = Column(String(255), nullable=True)
    correlated_commute_route = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_events_locality_time", "locality", "start_time"),
    )


class CustomerEnquiry(Base):
    __tablename__ = "customer_enquiries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    service_id = Column(Integer, ForeignKey("service_listings.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(50), nullable=False)
    customer_email = Column(String(100), nullable=True)
    enquiry_type = Column(String(50), default="general", nullable=False)  # 'stock_check', 'price_quote', 'appointment', 'general'
    message = Column(Text, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # 'pending', 'contacted', 'resolved'
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    business = relationship("Business", back_populates="enquiries")
    service = relationship("ServiceListing")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=True, index=True)
    product_id = Column(Integer, nullable=True)
    event_type = Column(String(50), nullable=False)  # 'page_view', 'call_click', 'whatsapp_click', 'direction_click', 'enquiry_submitted'
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class SavedItem(Base):
    __tablename__ = "saved_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item_type = Column(String(50), nullable=False)  # 'business', 'product', 'service', 'offer'
    item_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="saved_items")

    __table_args__ = (
        Index("ix_saved_user_item", "user_id", "item_type", "item_id"),
    )


class MandiPrice(Base):
    __tablename__ = "mandi_prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    commodity = Column(String(100), nullable=False, index=True)
    variety = Column(String(100), nullable=True)
    mandi_name = Column(String(150), nullable=False, index=True)
    state = Column(String(50), nullable=False)
    district = Column(String(100), nullable=True, index=True)
    city = Column(String(100), nullable=True, index=True)
    category = Column(String(50), default="Vegetables", nullable=True)
    modal_price = Column(Float, nullable=False)
    min_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    unit = Column(String(20), default="kg", nullable=False)
    arrival_volume = Column(String(50), nullable=True)
    price_trend = Column(String(50), default="Stable", nullable=False)
    observed_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class CivicBulletin(Base):
    __tablename__ = "civic_bulletins"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    source_agency = Column(String(150), nullable=False)
    category = Column(String(50), default="Transit & Safety", nullable=False)
    locality = Column(String(100), nullable=True, index=True)
    city = Column(String(50), nullable=True, index=True)
    priority = Column(String(20), default="medium", nullable=False)
    published_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    official_link = Column(String(500), nullable=True)


class EmergencyFacility(Base):
    __tablename__ = "emergency_facilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    facility_type = Column(String(100), default="Casualty & Trauma Center", nullable=False)
    phone = Column(String(50), nullable=False)
    secondary_phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=False)
    locality = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_24_7 = Column(Boolean, default=True, nullable=False)
    trauma_level = Column(String(50), default="Level-1", nullable=True)
    blood_bank_available = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_emergency_city_locality", "city", "locality"),
    )


class CommunitySignal(Base):
    __tablename__ = "community_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    signal_type = Column(String(50), nullable=False)  # 'WATERLOGGING', 'POTHOLE', 'ROAD_BLOCKAGE', 'ACCIDENT', 'LOCAL_MARKET'
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    locality = Column(String(100), nullable=False, index=True)
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), default="India", nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    upvotes = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default="COMMUNITY_VERIFIED", nullable=False)  # 'REPORTED', 'COMMUNITY_VERIFIED', 'RESOLVED'
    severity = Column(String(20), default="moderate", nullable=False)  # 'low', 'moderate', 'high', 'severe'
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_comm_signals_loc_time", "locality", "created_at"),
        Index("ix_comm_signals_coords", "latitude", "longitude"),
    )

