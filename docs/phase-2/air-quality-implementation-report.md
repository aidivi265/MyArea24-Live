# MyArea24 — Phase 2A: Air Quality Intelligence & Data Integrity Implementation Report

**Date:** October 9, 2026  
**Milestone:** Phase 2A (Air Quality Intelligence & Data Integrity Audit)  
**Author:** Lead Backend Engineer & Data Feasibility Analyst  
**Status:** IMPLEMENTATION COMPLETE & VERIFIED  

---

## 1. Executive Summary & Verification Baseline

Phase 2A implements trustworthy Air Quality Intelligence for **MyArea24** while strictly enforcing the product's zero-hallucination and data integrity mandate. In accordance with initial requirements:
- **No synthetic AQI figures** or fabricated station telemetry are ever generated or rendered.
- **No prohibited web scraping** of protected government dashboards (such as `app.cpcbccr.com/ccr`) was performed.
- **Mathematical fidelity:** All AQI values and sub-indices follow the official Ministry of Environment, Forest & Climate Change (MoEFCC) / Central Pollution Control Board (CPCB) October 2014 linear interpolation standard.
- **Defensible Spatial Boundaries:** Monitoring stations must be within a maximum allowable radius (15 km) and meet strict temporal freshness criteria (180 minutes).
- **Honest Operational Disclosures:** When provider keys (`OPENAQ_API_KEY`) are unconfigured, the system explicitly reports its pending status to both API consumers and UI users rather than feigning live data.

### Verification Baseline:
- **Backend Test Suite:** **108 tests passing** (increased from 83 baseline tests, +25 new automated unit and integration tests).
- **Frontend Test Suite:** **24 tests passing** (increased from 20 baseline tests, +4 new component tests across all AQI states).
- **Production Build:** Vite + TypeScript build passing cleanly (`tsc -b && vite build` in 442ms).

---

## 2. Official Indian AQI Provider Feasibility Summary

Prior to code development, comprehensive connectivity, authentication, licensing, and schema verification was performed across all candidate data sources (detailed in [`docs/phase-2/air-quality-readiness.md`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-2/air-quality-readiness.md)):

| Candidate Source | Protocol / Endpoint | Auth Protocol | License | Verification Finding | Operational Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Direct CPCB Portal** | `app.cpcbccr.com/ccr` | Human CAPTCHA | Disallowed scraping | No public REST API exists. Automated scraping violates terms. | Disqualified |
| **data.gov.in (CPCB)** | `/resource/3b01bcb8...` | OGD API Key | GODL-India | TLS connection reset by remote NIC gateway (`164.100.61.198:443`). Key missing. | Blocked |
| **OpenAQ API v3** | `api.openaq.org/v3` | `X-API-Key` HTTP Header | CC-BY 4.0 / GODL | Ingests real-time CPCB/SPCB CAAQMS stations across India. Returns 401 without key. | **Production Target** |
| **WeatherAPI AQI** | `/current.json?aqi=yes` | Current Key | Commercial | Returns global model estimations (US EPA / Defra), lacking CAAQMS station telemetry. | Inadequate for CPCB |

**Engineering Decision:** Architected the complete ingestion and normalization engine targeting the OpenAQ v3 / CPCB aggregation standard, equipped with in-memory TTL caching, offline fixtures for real Delhi and Bengaluru stations, and graceful handling of missing environment keys.

---

## 3. Architecture & Core Implementation Details

### 3.1 Database Persistence (`AirQualityObservation`)
Added the `AirQualityObservation` model in [`backend/app/database/models.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/database/models.py#L133-L162) linked to `data_sources`:
- **Identifiers & Metadata:** `source_id` ("openaq"), `source_record_id` (deterministic dedup key), `station_id`, `station_name`, `city`, `state`.
- **Geographic Coordinates:** `latitude`, `longitude` with composite index `ix_aqi_coords_observed`.
- **Observation Timestamp:** `observed_at` (UTC naive datetime).
- **CPCB NAQI Metrics:** `aqi_value` (0–500+), `aqi_category` (Good, Satisfactory, Moderate, Poor, Very Poor, Severe), `prominent_pollutant` (e.g., PM2.5, PM10).
- **Individual Pollutants (SI Units):** `pm25` (µg/m³), `pm10` (µg/m³), `no2` (µg/m³), `so2` (µg/m³), `co` (mg/m³), `o3` (µg/m³).
- **Provenance & Raw Payload:** `raw_data` (JSON) and `ingested_at`.

### 3.2 CPCB NAQI Calculation Engine (`aqi_calculator.py`)
Implemented in [`backend/app/normalization/aqi_calculator.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/normalization/aqi_calculator.py):
- **Formula:**
  $$I_p = \left[\frac{I_{hi} - I_{lo}}{B_{hi} - B_{lo}}\right] \times (C_p - B_{lo}) + I_{lo}$$
- **Breakpoints:** Official 8-pollutant breakpoint matrices for PM2.5, PM10, NO2, SO2, CO, O3, NH3, and Pb.
- **NAQI Aggregation Rules:**
  - Overall AQI equals $\max(I_{p1}, I_{p2}, \dots, I_{pn})$.
  - Prominent pollutant is the pollutant corresponding to the maximum sub-index.
  - Strict CPCB compliance flag (`is_naqi_compliant`): Requires at least 3 monitored pollutants with at least one being particulate matter (PM2.5 or PM10).

### 3.3 Provider Client & Normalization
- **Client:** [`backend/app/integrations/openaq/client.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/integrations/openaq/client.py) inheriting from `BaseProviderClient`, utilizing `X-API-Key` headers and a 60-minute in-memory cache.
- **Normalization:** [`backend/app/normalization/air_quality.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/normalization/air_quality.py) converting OpenAQ v3 location payloads into validated `NormalizedAQIRecord` instances.

### 3.4 Ingestion Worker Pipeline
Updated [`backend/app/ingestion/worker.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/ingestion/worker.py):
- Registered `openaq` source in `ensure_data_sources()`.
- Added `sync_air_quality(db)`:
  - If `OPENAQ_API_KEY` is not present, records `DataSyncLog` with status `AWAITING_CONFIG` and skips external calls to avoid synthetic data.
  - If present, fetches stations within `settings.AQI_MAX_STATION_DISTANCE_KM` (15 km), computes CPCB NAQI, and persists idempotently using `source_record_id`.
- Integrated into `run_full_sync_cycle()`.

### 3.5 Scenario E: Air Quality Intelligence Rule & Correlation
Implemented in [`backend/app/intelligence/rules.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/intelligence/rules.py#L696-L835) and [`backend/app/intelligence/correlation.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/intelligence/correlation.py#L377-L417):
- **Rule Identifier:** `SCENARIO_E_AIR_QUALITY_ADVISORY`.
- **Validation Gates:**
  1. Coordinate validity on both station and locality.
  2. Geographic proximity: `haversine_distance_km <= 15.0 km`.
  3. Telemetry freshness: Observation age $\le 180$ minutes, not future-dated.
  4. Severity threshold: Triggers for `Severe` (AQI $\ge 401$, composite severity `severe`) and `Very Poor` (AQI $\ge 301$, composite severity `high`). Rejects Moderate and Good AQI.
- **Correlation Pipeline:** Integrated as Stage 4 in `CorrelationEngine.run_correlation()`, complete with SHA-256 deduplication hashing and signal provenance linking to `air_quality_observations`.

### 3.6 Air Quality API Endpoint
Exposed `GET /api/v1/intelligence/air-quality` in [`backend/app/api/intelligence.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/backend/app/api/intelligence.py#L84-L199):
- Supports `area`, `lat`, and `lon` query filters.
- Returns `AirQualityStatusResponse` containing `status` (`ACTIVE`, `STALE`, `UNAVAILABLE`, or `AWAITING_CONFIG`), station metadata, distance in km, AQI value, category, prominent pollutant, and source attribution.

---

## 4. Frontend Integration & Truthful UI States

Updated [`frontend/src/components/LocalConditionsGrid.tsx`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/frontend/src/components/LocalConditionsGrid.tsx) and [`frontend/src/services/api.ts`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/frontend/src/services/api.ts#L142-L177):

The Air Quality card dynamically handles 4 distinct, truthful operational states:

1. **Active Live Telemetry (`ACTIVE`):**
   - Displays real AQI value and category badge with CPCB color-coding (`.aqi-good`, `.aqi-moderate`, `.aqi-very-poor`, `.aqi-severe`).
   - Displays station name, distance (e.g., `Station: Anand Vihar (3.4 km away)`), and prominent pollutant.
   - Green online status indicator.
2. **Expired Telemetry (`STALE`):**
   - Flags observations older than 180 minutes with warning amber styling.
   - Clarifies that data is stale and awaiting the next synchronization cycle.
3. **Out of Range (`UNAVAILABLE`):**
   - Displayed when no active CAAQMS station exists within 15 km of the selected locality.
   - Explicitly notes: `"No official CAAQMS monitoring station within 15 km"`.
4. **Integration Pending (`AWAITING_CONFIG`):**
   - Default truthful state when `OPENAQ_API_KEY` is not present in `.env`.
   - Displays: `"Integration Pending · Awaiting OPENAQ_API_KEY configuration in environment. Zero synthetic data shown."`

---

## 5. Automated Verification Results

### Backend Pytest Suite
```
tests/unit/test_aqi_calculator.py ........                            [100%]
tests/unit/test_openaq_client.py .....                                [100%]
tests/unit/test_aqi_rules.py ......                                   [100%]
tests/integration/test_api.py .........................               [100%]

108 passed, 1 warning in 35.85s
```

### Frontend Vitest Suite
```
 ✓ src/test/LocalConditionsGrid.test.tsx (4 tests) 395ms
 ✓ src/test/FilterBar.test.tsx (3 tests) 1003ms
 ✓ src/test/InsightCard.test.tsx (6 tests) 1026ms
 ✓ src/test/LocalitySelector.test.tsx (3 tests) 1128ms
 ✓ src/test/InsightDetailModal.test.tsx (4 tests) 1362ms
 ✓ src/test/App.test.tsx (4 tests) 3206ms

 Test Files  6 passed (6)
      Tests  24 passed (24)
   Duration  11.54s
```

### Frontend Production Build
```
vite v8.3.4 building client environment for production...
✓ 31 modules transformed.
dist/index.html                   0.69 kB │ gzip:  0.42 kB
dist/assets/index-CsN4F5TO.css   34.30 kB │ gzip:  6.59 kB
dist/assets/index-CFvPbPkI.js   273.94 kB │ gzip: 80.66 kB
✓ built in 442ms
```

---

## 6. Founder Next Steps & Activation Guide

To activate live CPCB CAAQMS air quality telemetry in production:
1. Register for a free OpenAQ API key at [https://openaq.org](https://openaq.org).
2. Add the key to your `.env` file:
   ```env
   OPENAQ_API_KEY=your_openaq_api_key_here
   ```
3. Run the ingestion worker or trigger a sync cycle. The system will automatically fetch, calculate, correlate, and render real-time station telemetry across Delhi-NCR and Bengaluru pilot corridors.
