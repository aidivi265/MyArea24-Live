# Phase 1 Architecture — Core Signal Ingestion & Normalization Engine

**Phase:** Phase 1 (Milestone 1)  
**System:** MyArea24 Backend  
**Architecture Style:** Modular Monolith (Python / FastAPI / SQLAlchemy / Pydantic)  

---

## 1. System Overview

Milestone 1 establishes the headless signal ingestion, normalization, persistence, and deterministic correlation backbone of MyArea24. 

The architecture strictly adheres to the core principle established in Phase 0: **Complete Decoupling of Ingestion from User Consumption**. Client applications and user requests never query external third-party APIs directly. Instead, client reads hit an internal PostgreSQL/SQLite database populated on fixed schedules by asynchronous background workers.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA PROVIDERS                               │
│  WeatherAPI.com (REST)     TomTom v5 / HERE v7 Traffic   NDMA SACHET (CAP v1.2) │
└──────────┬───────────────────────────┬────────────────────────────┬─────────────┘
           │ (Hourly / 30m)            │ (10m)                      │ (15m)
           ▼                           ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           INTEGRATION & ADAPTER LAYER                           │
│  WeatherAPIClient          TomTomTrafficClient (or HERE)  SACHETClient          │
│  - 60m In-Memory Cache     - 5m In-Memory Cache           - 10m In-Memory Cache │
│  - Bounded HTTP Timeouts   - Geo Bounding Box Query       - Safe defusedxml     │
│  - Exponential Backoff     - Rate-Limit Protection        - Entity Protection   │
└──────────┬───────────────────────────┬────────────────────────────┬─────────────┘
           │                           │                            │
           ▼                           ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           NORMALIZATION & VALIDATION                            │
│  NormalizedWeatherRecord   NormalizedTrafficRecord    NormalizedAlertRecord     │
│  - Coordinates Validated   - JamFactor / Delays       - GeoJSON Polygons/Circles│
│  - Precipitation in mm     - Criticality Heuristics   - UTC Normalized Dates    │
└──────────┬───────────────────────────┬────────────────────────────┬─────────────┘
           │                           │                            │
           ▼                           ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       INGESTION WORKER & PERSISTENCE                            │
│  - Idempotent upserts via source_record_id & alert_identifier                   │
│  - Audit logs recorded in data_sync_logs with latency & record counts           │
│  - Transaction rollbacks on partial failure                                     │
└──────────┬──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       PERSISTENT DATABASE (SQLAlchemy 2.0)                      │
│  weather_observations   traffic_observations   government_notices   data_sources│
└──────────┬──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     DETERMINISTIC CORRELATION ENGINE                            │
│  - Scenario D: Monsoon Commute & Congestion Evaluator                           │
│  - Haversine Distance (Radius <= 5.0 km)                                        │
│  - Rain Threshold (>= 8.0 mm/hr) & Jam Factor Threshold (>= 6.5)                │
│  - Evening Peak Commute Window (17:30 - 20:30 IST)                              │
│  - Deduplication via SHA-256 Hash -> intelligence_insights & child signals      │
└──────────┬──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            REST API (FastAPI)                                   │
│  GET /health            GET /ready                                              │
│  GET /api/v1/intelligence (Paginated list, area filters, status)                │
│  GET /api/v1/intelligence/{id} (Grounded insight with source signal provenance) │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Structure

- **`app/core/`**: Centralized configuration (`config.py`) using `pydantic-settings`, redacting logging (`logging.py`), and error hierarchy (`errors.py`).
- **`app/database/`**: Database engine and session lifecycle (`session.py`), SQLAlchemy ORM models (`models.py`), and Alembic migrations (`backend/alembic`).
- **`app/integrations/`**: Provider-specific HTTP adapters (`base.py`, `weatherapi/client.py`, `tomtom/client.py`, `here/client.py`, `sachet/client.py`).
- **`app/normalization/`**: Pydantic models and parsers converting provider schemas into stable internal domain objects (`weather.py`, `traffic.py`, `alerts.py`).
- **`app/ingestion/`**: Background sync workers (`worker.py`), retry utilities with backoff and jitter (`retry.py`), and lock-guarded in-process scheduler (`scheduler.py`).
- **`app/intelligence/`**: Deterministic rules (`rules.py`), correlation coordinator (`correlation.py`), and structured schemas (`schemas.py`).
- **`app/api/`**: FastAPI routers for health, readiness, and paginated intelligence feeds (`health.py`, `intelligence.py`).
- **`scripts/`**: Operational CLI tools for live provider smoke testing (`smoke_test_live.py`) and background worker execution (`run_worker.py`).

---

## 3. Key Design Decisions

1. **Dual Database Dialect Strategy:**
   - Production targets PostgreSQL (`postgresql+psycopg2://...`) for multi-tenant scalability and spatial indexing.
   - Local development and test suites run on SQLite (`sqlite:///:memory:` with `StaticPool` or `sqlite:///./myarea24.db`). Geospatial queries use pure Python Haversine algorithms and `shapely` geometric polygons, guaranteeing full local functionality without requiring native PostGIS installation.
2. **Defensive XML Security:**
   - CAP XML parsing uses `defusedxml` to disable external entity resolution, preventing denial-of-service and XXE attacks from third-party public RSS feeds.
3. **Idempotency & Zero Duplicate Storage:**
   - Unique constraints on `source_record_id` and `alert_identifier` ensure that repeated polling cycles update existing records rather than duplicating them.
4. **Deterministic Gate before AI:**
   - Zero LLM tokens are consumed in Milestone 1. Mathematical thresholds and spatial geometry strictly decide whether an insight exists.
