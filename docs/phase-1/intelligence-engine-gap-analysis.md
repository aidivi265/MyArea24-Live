# MyArea24 — Intelligence Engine Gap Analysis & Architectural Blueprint

**Milestone:** 2.0 (Build the MyArea24 Intelligence Engine)  
**Date:** 2026-10-09  
**Status:** Completed Analysis  
**Author:** Lead Backend Engineer & Data Feasibility Analyst  

---

## 1. Executive Summary

Milestone 1 and 1.2 successfully established live, normalized, and idempotent ingestion pipelines for **WeatherAPI**, **TomTom Traffic v5** (with HERE v7 alternative), and **NDMA SACHET CAP/RSS** syndication feeds, supported by 56 automated tests.

However, the existing intelligence layer was built strictly as a proof-of-concept for Scenario D (Monsoon Commute & Congestion). It does not yet constitute a generalized, multi-scenario Local Intelligence Engine. Crucially:
1. **NDMA SACHET public notices are ingested but never surfaced as intelligence insights.**
2. **Single-source high-impact events are discarded** because the engine exclusively searches for 2-signal weather-traffic pairs.
3. **The insight data model lacks standardized evidence-strength semantics, uncertainty notes, and explicit observed-vs-generated timestamps.**
4. **The deduplication key is hardcoded to `weather_id:traffic_id`**, which fails for any alert involving government notices or single signals.
5. **The API lacks filtering** across insight types, severity levels, and freshness windows.

This document audits the existing codebase, defines the gaps, and specifies the architecture for Milestone 2.0.

---

## 2. Inventory of Current Implementation (Milestones 1.0 & 1.2)

### 2.1 Persisted Data Models (`backend/app/database/models.py`)
| Model | Description | Current Intelligence Engine Usage |
| :--- | :--- | :--- |
| `WeatherObservation` | Hourly weather & precipitation from WeatherAPI | Queried for recent observations ($\le 120\text{ min}$) |
| `TrafficObservation` | Traffic incidents, delays, criticality from TomTom v5 | Queried for recent observations ($\le 120\text{ min}$) |
| `GovernmentNotice` | Official disaster notices & CAP XML from NDMA SACHET | **Completely ignored by correlation engine** |
| `IntelligenceInsight` | Persisted cross-signal intelligence records | Only stores weather-traffic correlation |
| `IntelligenceSignal` | Source provenance links to underlying observation tables | Only supports `weather_observations` and `traffic_observations` |
| `DataSource` / `DataSyncLog` | Operational provider tracking and sync telemetry | Verified working |

### 2.2 Correlation Engine (`backend/app/intelligence/correlation.py` & `rules.py`)
- Evaluates `evaluate_scenario_d_rule` in a double loop (`recent_weather` $\times$ `recent_traffic`).
- Deduplication hash format: `f"{area_label}:{weather_id}:{traffic_id}:{ref_date.isoformat()}"`.
- Rigidly assumes exactly one weather signal and one traffic signal per insight.
- Does not inspect `GovernmentNotice` table.
- Does not detect standalone severe weather (e.g. flash cloudburst) or standalone road closures (e.g. multi-hour corridor blockages) when unaccompanied by a second signal.

### 2.3 API & Service Layer (`backend/app/api/intelligence.py` & `backend/app/services/intelligence_service.py`)
- Endpoints:
  - `GET /api/v1/intelligence`: Filters by `area` and `is_active`.
  - `GET /api/v1/intelligence/{id}`: Detail view.
- Missing query parameters: `insight_type`, `severity` / `composite_severity`, `min_confidence`, and freshness window.

---

## 3. Detailed Gap Analysis Matrix

| Requirement | Existing State (Milestone 1.2) | Required State (Milestone 2.0) | Gap Severity |
| :--- | :--- | :--- | :---: |
| **Scenario A: Weather + Traffic** | Implemented as Scenario D (`evaluate_scenario_d_rule`), rigid evening window default. | Aligned with Scenario A specification: configurable commute window or anytime-thresholds, explicit evidence strength, uncertainty notes. | Medium |
| **Scenario B: Severe Public Alert** | Zero implementation. `GovernmentNotice` records sit idle in database. | Active SACHET notices matched to pilot localities via geographic coordinates, circles, or area description; extracts official severity, urgency, area, timing, instructions. | **Critical** |
| **Scenario C: Single-Signal Alert** | Zero implementation. Uncorrelated signals are dropped. | Standalone high-severity events (e.g. TomTom road closure/critical delays or severe weather $> 20\text{ mm/hr}$) surfaced as explicit single-source notices without pretending multi-source corroboration. | **Critical** |
| **Insight Data Model** | Basic fields (`id`, `area`, `headline`, `summary`, `impact`, `recommendation`, `evidence_quality`, `composite_severity`, `rule_version`). | Comprehensive model adding `confidence_level` (explicit definition), `uncertainty_notes`, `rule_identifier`, `observed_at`, `next_review_at`. | High |
| **Deduplication Hashing** | Hardcoded to `weather_id:traffic_id`. | Extensible deterministic hash: `sha256(f"{rule_id}:{area_label}:{primary_signal_type}:{primary_id}:{secondary_id}:{date}")`. | **Critical** |
| **Spatio-Temporal Matching** | Point-to-point Haversine for weather-to-traffic. | Multi-tier matcher supporting point-to-point, bounding-box, and CAP circle/polygon proximity. | High |
| **Data Quality & Uncertainty** | Binary `evidence_quality` string ("supported"). | Structured data quality notes explaining sensor freshness, spatial distance, and uncertainty bounds. | High |
| **API Query Capabilities** | Only `area` substring and `is_active`. | Adds `insight_type`, `severity`, `min_confidence`, and pagination consistency. | Medium |

---

## 4. Architectural Blueprint for Milestone 2.0

### 4.1 The Unified Intelligence Pipeline

The engine executes a 6-stage deterministic pipeline:
```
[1. Collect Active Signals] 
       │ (Weather, Traffic, Government Notices within max_age window)
       ▼
[2. Normalize & Validate Boundaries]
       │ (Reject missing coordinates, expired notices, NaN thresholds)
       ▼
[3. Match Signals]
       │ ├── Multi-Signal Spatial/Temporal Intersection (Weather ∩ Traffic)
       │ ├── Public Alert Locality Association (SACHET ∩ Pilot Area)
       │ └── Standalone Signal Threshold Filtering (Single Credible Outliers)
       ▼
[4. Assess Impact & Evidence Quality]
       │ (Compute composite severity, assign deterministic confidence label, generate uncertainty notes)
       ▼
[5. Generate Insight & Recommendations]
       │ (Compose plain-language summary, grounded impact, and evidence-justified action)
       ▼
[6. Deduplicate & Persist Provenance]
       │ (Deterministic SHA-256 hash check, write IntelligenceInsight and IntelligenceSignal records)
```

### 4.2 Initial Scenario Definitions & Evidence Thresholds

#### Scenario A — Weather + Traffic Correlation
- **Rule ID:** `SCENARIO_A_WEATHER_TRAFFIC`
- **Matching Conditions:**
  - Spatial distance $\le 5.0\text{ km}$ between weather sensor and traffic incident point.
  - Precipitation $\ge 5.0\text{ mm/hr}$ (or condition text indicating active thunderstorm/downpour).
  - Traffic disruption: Jam factor $\ge 7.0/10$ OR delay $\ge 900\text{ seconds}$ (15 mins) OR criticality $\in \{\text{"major"}, \text{"critical"}\}$.
  - Signal freshness: Both records $\le 90\text{ minutes}$ old.
- **Confidence Level:** `HIGH` (Corroborated by two independent operational providers).
- **Uncertainty Notes:** Explains distance between observations and whether rain forecast is hourly interpolation or radar.

#### Scenario B — Severe Public Alert
- **Rule ID:** `SCENARIO_B_PUBLIC_ALERT`
- **Matching Conditions:**
  - Active `GovernmentNotice` (`is_active == True`, `effective_at <= now <= expires_at`).
  - Severity $\in \{\text{"Extreme"}, \text{"Severe"}, \text{"Moderate"}\}$.
  - Geographic match to pilot area: Notice circle/polygon intersects locality coordinate within radius, OR notice `area_description` mentions pilot locality/district.
- **Confidence Level:** `HIGH` (Direct official government notice from NDMA SACHET).
- **Uncertainty Notes:** Documents sender authority, bulletin timing, and alert certainty level (e.g. "Observed", "Likely").

#### Scenario C — Single-Signal Alert
- **Rule ID:** `SCENARIO_C_SINGLE_SIGNAL`
- **Matching Conditions (Either C1 or C2):**
  - **C1 (Standalone Critical Traffic):** Criticality == "critical" OR delay $\ge 1800\text{ seconds}$ (30 mins) OR road closure, with NO overlapping weather trigger.
  - **C2 (Standalone Severe Weather):** Precipitation $\ge 20.0\text{ mm/hr}$ (torrential downpour/cloudburst) with NO correlated traffic incident recorded yet.
- **Confidence Level:** `MEDIUM` (Single credible source; no cross-corroboration detected).
- **Crucial Rule:** The card explicitly states: *"Single-source observation. No corroborating secondary signals currently reported in this locality."*

### 4.3 Database Evolution & Backwards Compatibility
- All new fields on `IntelligenceInsight` are nullable or have sensible defaults.
- Database migration script created under `backend/alembic/versions/` for schema upgrades.
- Existing unit tests (`test_adapters.py`, `test_correlation.py`, `test_ingestion.py`, `test_api.py`) continue to pass without regression.

---

## 5. Next Steps for Implementation
1. Enhance the data models in `backend/app/database/models.py` and create the corresponding Alembic migration.
2. Upgrade `backend/app/intelligence/schemas.py` with the complete structured insight schema.
3. Implement modular rule evaluators for Scenarios A, B, and C in `backend/app/intelligence/rules.py`.
4. Upgrade `backend/app/intelligence/correlation.py` to orchestrate the unified pipeline.
5. Enhance `IntelligenceService` and `backend/app/api/intelligence.py` with multi-field filtering.
6. Build comprehensive automated tests covering all edge cases, missing data, and cross-signal scenarios.
