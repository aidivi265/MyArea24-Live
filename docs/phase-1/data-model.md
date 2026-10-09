# Phase 1 Data Model & Database Schema Specification

**Phase:** Phase 1 (Milestone 1)  
**Database Dialect Support:** PostgreSQL / SQLite (Alembic Managed)  

---

## 1. Entity-Relationship Overview

```
┌─────────────────┐       1:N       ┌─────────────────┐
│  data_sources   ├────────────────►│ data_sync_logs  │
└────────┬────────┘                 └─────────────────┘
         │
         │ 1:N
         ├────────────────► weather_observations
         ├────────────────► traffic_observations
         └────────────────► government_notices

┌───────────────────────┐ 1:N       ┌───────────────────────┐
│ intelligence_insights ├──────────►│ intelligence_signals  │
└───────────────────────┘           └───────────────────────┘
```

---

## 2. Table Specifications

### 2.1 `data_sources`
Tracks external providers, operational status, and health metrics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | VARCHAR(50) | PRIMARY KEY | Unique provider key (`weatherapi`, `here_traffic`, `sachet_cap`) |
| `name` | VARCHAR(100) | NOT NULL | Human-readable provider name |
| `base_url` | VARCHAR(255) | NULLABLE | Primary endpoint or feed URL |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Master kill switch for provider polling |
| `last_sync_at`| DATETIME (UTC)| NULLABLE | Timestamp of last attempted sync |
| `last_status` | VARCHAR(50) | NULLABLE | Status of last run (`SUCCESS`, `FAILED`, `RATE_LIMITED`) |
| `error_count` | INTEGER | NOT NULL, DEFAULT 0 | Cumulative failure counter |
| `created_at` | DATETIME (UTC)| NOT NULL | Creation timestamp |
| `updated_at` | DATETIME (UTC)| NOT NULL | Last update timestamp |

---

### 2.2 `data_sync_logs`
Audit log recording every background ingestion job.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Auto-incrementing log ID |
| `source_id` | VARCHAR(50) | FK (`data_sources.id`) | Target provider ID |
| `sync_started_at`| DATETIME (UTC)| NOT NULL | Execution start time |
| `sync_ended_at` | DATETIME (UTC)| NULLABLE | Execution completion time |
| `duration_ms` | INTEGER | NULLABLE | Duration of sync in milliseconds |
| `records_fetched`| INTEGER | NOT NULL, DEFAULT 0 | Raw records returned by provider |
| `records_persisted`| INTEGER| NOT NULL, DEFAULT 0 | New records written to database |
| `records_rejected` | INTEGER| NOT NULL, DEFAULT 0 | Invalid or duplicate records discarded |
| `status` | VARCHAR(50) | NOT NULL | Execution outcome |
| `error_message` | TEXT | NULLABLE | Exception traceback if failed |
| `metadata_json` | JSON | NULLABLE | Diagnostic telemetry |

*Indexes:* `ix_sync_logs_source_started (source_id, sync_started_at)`

---

### 2.3 `weather_observations`
Normalized atmospheric readings and forecast hours.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Internal observation ID |
| `source_id` | VARCHAR(50) | FK (`data_sources.id`) | Provider identifier (`weatherapi`) |
| `source_record_id` | VARCHAR(255) | UNIQUE, NOT NULL | Deduplication key (`weatherapi:{type}:{lat}:{lon}:{epoch}`) |
| `location_name` | VARCHAR(100) | NOT NULL | Locality or pilot node name |
| `latitude` | FLOAT | NOT NULL | WGS-84 latitude |
| `longitude` | FLOAT | NOT NULL | WGS-84 longitude |
| `observed_at` | DATETIME (UTC)| NOT NULL | Observation or forecast timestamp |
| `forecast_valid_until`| DATETIME (UTC)| NULLABLE | End of valid forecast window |
| `temperature_c` | FLOAT | NOT NULL | Ambient temperature in Celsius |
| `precipitation_mm` | FLOAT | NOT NULL | Rainfall accumulation in millimeters |
| `precipitation_interval_minutes`| INTEGER| NOT NULL, DEFAULT 60 | Accumulation interval |
| `condition_text` | VARCHAR(100) | NOT NULL | Condition label (e.g., "Heavy rain") |
| `wind_kph` | FLOAT | NULLABLE | Wind speed in km/h |
| `humidity` | INTEGER | NULLABLE | Relative humidity percentage |
| `raw_timestamp` | BIGINT | NULLABLE | Raw provider epoch timestamp |
| `ingested_at` | DATETIME (UTC)| NOT NULL | Ingestion timestamp |

*Indexes:* `ix_weather_coords_observed (latitude, longitude, observed_at)`, `ix_weather_observed_at (observed_at)`

---

### 2.4 `traffic_observations`
Normalized road incidents, congestion queues, and traffic flow metrics.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Internal observation ID |
| `source_id` | VARCHAR(50) | FK (`data_sources.id`) | Provider identifier (`here_traffic`) |
| `source_record_id` | VARCHAR(255) | UNIQUE, NOT NULL | Deduplication key (`here:{incidentId}`) |
| `incident_type` | VARCHAR(50) | NOT NULL | Incident category (`CONGESTION`, `ACCIDENT`, `CLOSURE`) |
| `criticality` | VARCHAR(20) | NULLABLE | Severity (`critical`, `major`, `minor`, `low`) |
| `latitude` | FLOAT | NOT NULL | Centroid/start latitude |
| `longitude` | FLOAT | NOT NULL | Centroid/start longitude |
| `geometry_geojson`| JSON | NULLABLE | GeoJSON LineString or Point shape |
| `jam_factor` | FLOAT | NULLABLE | Congestion factor on 0.0 to 10.0 scale |
| `delay_seconds` | INTEGER | NULLABLE | Estimated queue delay in seconds |
| `road_name` | VARCHAR(200) | NULLABLE | Road or corridor name |
| `description` | TEXT | NULLABLE | Ground-truth incident description |
| `observed_at` | DATETIME (UTC)| NOT NULL | Provider incident start time |
| `expected_end_at` | DATETIME (UTC)| NULLABLE | Estimated incident clearance time |
| `ingested_at` | DATETIME (UTC)| NOT NULL | Ingestion timestamp |

*Indexes:* `ix_traffic_coords_observed (latitude, longitude, observed_at)`, `ix_traffic_observed_at (observed_at)`

---

### 2.5 `government_notices`
Authoritative disaster and civic bulletins parsed from NDMA SACHET CAP v1.2 XML.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Internal notice ID |
| `source_id` | VARCHAR(50) | FK (`data_sources.id`) | Provider identifier (`sachet_cap`) |
| `alert_identifier` | VARCHAR(255) | UNIQUE, NOT NULL | Standard CAP `<identifier>` |
| `sender` | VARCHAR(255) | NOT NULL | Disseminating agency (`ndma@sachet.gov.in`) |
| `event_type` | VARCHAR(100) | NOT NULL | Hazard event (e.g., "Severe Thunderstorm") |
| `severity` | VARCHAR(50) | NOT NULL | CAP severity (`Extreme`, `Severe`, `Moderate`) |
| `urgency` | VARCHAR(50) | NOT NULL | CAP urgency (`Immediate`, `Expected`) |
| `certainty` | VARCHAR(50) | NOT NULL | CAP certainty (`Observed`, `Likely`) |
| `headline` | TEXT | NOT NULL | Primary warning headline |
| `description` | TEXT | NULLABLE | Detailed bulletin text |
| `instruction` | TEXT | NULLABLE | Mitigation guidance |
| `area_description` | TEXT | NOT NULL | Target geographic sector or district |
| `polygon_geojson` | JSON | NULLABLE | GeoJSON bounding polygon |
| `circle_geojson` | JSON | NULLABLE | GeoJSON circle geometry |
| `effective_at` | DATETIME (UTC)| NOT NULL | Start of advisory window |
| `expires_at` | DATETIME (UTC)| NOT NULL | Expiry of advisory window |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE| Active status flag |
| `ingested_at` | DATETIME (UTC)| NOT NULL | Ingestion timestamp |

*Indexes:* `ix_notices_effective_expires (effective_at, expires_at)`, `ix_notices_active (is_active)`

---

### 2.6 `intelligence_insights`
Cross-signal compound intelligence cards generated by the correlation engine.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Public insight identifier |
| `insight_type` | VARCHAR(50) | NOT NULL | Pattern type (`weather_traffic_correlation`) |
| `area_label` | VARCHAR(100) | NOT NULL | Locality name (e.g. "Delhi AIIMS Ring Road") |
| `latitude` | FLOAT | NOT NULL | Central latitude of correlated zone |
| `longitude` | FLOAT | NOT NULL | Central longitude of correlated zone |
| `radius_km` | FLOAT | NOT NULL, DEFAULT 5.0 | Spatial relevance radius |
| `headline` | VARCHAR(255) | NOT NULL | User-facing headline |
| `summary` | TEXT | NOT NULL | Factual synthesis of overlapping conditions |
| `potential_impact`| TEXT | NOT NULL | Contextual transit friction assessment |
| `recommendation` | TEXT | NOT NULL | Grounded mitigation advice |
| `evidence_quality`| VARCHAR(50) | NOT NULL | Reliability badge (`supported`) |
| `composite_severity`| VARCHAR(20)| NOT NULL | Alert tier (`minor`, `moderate`, `high`, `severe`) |
| `dedup_hash` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 hash preventing duplicate active cards |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE| Active feed visibility flag |
| `created_at` | DATETIME (UTC)| NOT NULL | Card creation time |
| `expires_at` | DATETIME (UTC)| NOT NULL | Card auto-expiry time |
| `rule_version` | VARCHAR(20) | NOT NULL, DEFAULT "1.0"| Deterministic rule specification version |

*Indexes:* `ix_insights_area_created (area_label, created_at)`, `ix_insights_active_expires (is_active, expires_at)`

---

### 2.7 `intelligence_signals`
Strict provenance linking table binding an insight to its supporting raw observations.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY, AUTO | Signal reference ID |
| `insight_id` | INTEGER | FK (`intelligence_insights.id`, CASCADE) | Parent insight ID |
| `signal_type` | VARCHAR(50) | NOT NULL | Signal category (`weather`, `traffic`, `alert`) |
| `source_name` | VARCHAR(50) | NOT NULL | Originating source (`weatherapi`, `here_traffic`) |
| `observation_table`| VARCHAR(50)| NOT NULL | Source table name |
| `observation_id` | INTEGER | NOT NULL | Exact row ID in source table |
| `observed_at` | DATETIME (UTC)| NOT NULL | Original observation timestamp |
| `metric_summary` | VARCHAR(255) | NOT NULL | Human-readable metric badge (e.g. "Precip: 12.0 mm/hr") |
| `created_at` | DATETIME (UTC)| NOT NULL | Record creation time |

*Indexes:* `ix_signals_insight (insight_id)`, `ix_signals_obs (observation_table, observation_id)`
