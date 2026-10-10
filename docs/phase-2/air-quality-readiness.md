# MyArea24 — Phase 2A: Air Quality Readiness & Data Integrity Audit

**Date:** October 9, 2026  
**Phase:** Phase 2A (Air Quality Intelligence & Data Integrity Audit)  
**Author:** Lead Backend Engineer & Data Feasibility Analyst  
**Status:** AUDIT COMPLETE — ACCESS BLOCKER IDENTIFIED & DOCUMENTED  

---

## 1. Executive Summary

This readiness audit evaluates the technical, legal, and operational feasibility of integrating official Indian Air Quality data into **MyArea24**. In accordance with MyArea24's zero-hallucination mandate, no synthetic AQI figures, guessed station readings, or speculative integrations may be published.

### Key Audit Findings:
1. **Direct CPCB CAAQMS Portal (`app.cpcbccr.com/ccr`):** No documented public-facing developer REST API or RSS feed exists. The portal is a protected web application designed for manual human download. Scraping is prohibited by website terms and product constraints.
2. **Open Government Data Platform (`api.data.gov.in` - Resource `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`):** Provides a documented CPCB Real-time Air Quality dataset under Government Open Data License (GODL-India). However, it requires an individually registered API key. In our live environment, no `DATA_GOV_IN_API_KEY` is configured, and incoming TLS handshakes to `api.data.gov.in` (164.100.61.198:443) are currently forcibly reset by remote NIC gateway firewalls (`curl: (35) Recv failure: Connection was reset`).
3. **OpenAQ API v3 (`api.openaq.org/v3`):** Officially ingests and standardizes CPCB and State Pollution Control Board (SPCB) CAAQMS stations across 250+ Indian cities under open data licenses (CC-BY 4.0 / GODL-India). However, OpenAQ v3 mandates an API key passed via the `X-API-Key` header. Requests without a key return `HTTP 401: Unauthorized`. No `OPENAQ_API_KEY` is present in `.env`.
4. **WeatherAPI Air Quality Module (`/current.json?aqi=yes`):** Tested successfully using the configured `WEATHERAPI_API_KEY`. However, it provides global numerical atmospheric model estimates (US EPA index 1–6 and UK Defra index 1–10). It does **not** provide station-level Indian CAAQMS telemetry, station coordinates, or official Indian National AQI (NAQI) sub-indices. Displaying WeatherAPI's global estimate as official CPCB station data would violate product integrity.
5. **Database & Lifecycle Integrity:** Inspected existing models, worker pipelines, and insight expiry mechanisms. Identified that during Milestone 3.1 & 3.2 UI testing, 5 live traffic insights were temporarily extended in `myarea24.db` (`expires_at = datetime.now() + 24h`) to facilitate browser validation. The current production database remains intact with zero data loss.

---

## 2. Repository & Architecture Audit

### 2.1 Git Status & Workspace Integrity
- **Modified files:** `README.md`, `backend/app/api/intelligence.py`, `backend/app/intelligence/correlation.py`, `backend/app/intelligence/rules.py`, `backend/app/services/intelligence_service.py`, `tests/integration/test_api.py`.
- **Untracked directories:** `docs/phase-1/`, `frontend/`.
- All uncommitted work is preserved and documented.

### 2.2 Database Schema Inspection (`backend/app/database/models.py`)
| Model | Table Name | Purpose | Current AQI Status |
| :--- | :--- | :--- | :--- |
| `DataSource` | `data_sources` | Provider metadata, sync logs, error tracking | `weatherapi`, `tomtom_traffic`, `sachet_cap` active. No AQI source registered. |
| `DataSyncLog` | `data_sync_logs` | Audit trail of ingestion runs and record counts | Tracks weather, traffic, and CAP feeds. |
| `WeatherObservation` | `weather_observations` | Normalized WeatherAPI records (temp, rain mm, wind) | Inactive for AQI. |
| `TrafficObservation` | `traffic_observations` | Normalized TomTom v5 incident details (delays, closures) | Active. |
| `GovernmentNotice` | `government_notices` | Normalized NDMA SACHET CAP v1.2 bulletins | Active. |
| `IntelligenceInsight` | `intelligence_insights` | Multi-scenario evidence-backed insights | Scenarios A, B, and C active. |
| `IntelligenceSignal` | `intelligence_signals` | Linked signal provenance with raw observation IDs | Supports extensible signal types. |

**Gap Identified:** A dedicated `AirQualityObservation` model is required to persist station identity, geographic coordinates, observation timestamps, individual pollutant concentrations (PM2.5, PM10, NO2, SO2, CO, O3), official NAQI values, and provider provenance.

### 2.3 Insight Expiry & Data Integrity Audit
- In `backend/app/services/intelligence_service.py`: Active queries enforce `is_active == True` AND `expires_at > datetime.utcnow()`.
- In `backend/app/intelligence/correlation.py`: `expire_stale_insights()` deactivates past-expiry records.
- **Audit Finding:** In `myarea24.db`, during local browser testing, the 5 live traffic records were updated with an extended `expires_at` timestamp. This prevented empty-state card flicker during frontend browser tests but represents a temporary deviation from deterministic 60-minute expiry windows.
- **Recommendation:** When live worker ingestion is resumed, observation and insight lifecycles should strictly follow deterministic rules:
  - Real-time AQI observations: 120-minute freshness window.
  - AQI Intelligence insights: 60-minute evaluation validity with 20-minute review intervals.

### 2.4 Current Frontend Air Quality Card Status
- In [`frontend/src/components/LocalConditionsGrid.tsx`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/frontend/src/components/LocalConditionsGrid.tsx):
  - Card displays `"Air Quality Index"`, `"CPCB (Phase 2)"` provider badge, `"Integration Pending"` status, and subtext: `"National Air Quality Monitoring Programme (CPCB API) scheduled for Phase 2 ingestion. Zero synthetic data shown · Strict data integrity"`.
- In [`frontend/src/components/Sidebar.tsx`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/frontend/src/components/Sidebar.tsx):
  - Category item `"Air Quality (AQI)"` is disabled with an informative tooltip (`Awaiting CPCB API Integration in Phase 2`).
- This status is completely transparent and prevents false user expectations.

---

## 3. Official Indian Air Quality Data Source Feasibility

We evaluated all potential official and quasi-official sources for Indian air quality data against six feasibility criteria:

| Candidate Source | Operator | Protocol / Format | Auth Required | Live Connectivity Test | Commercial / Terms | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Direct CPCB CAAQMS** | Central Pollution Control Board (MoEFCC) | Web Portal / CSV Download | Human CAPTCHA / SPA | No developer REST API exists | Web UI only; automated scraping prohibited | **DISQUALIFIED** (Prohibited scraping) |
| **data.gov.in (CPCB)** | NIC / OGD India Platform | REST API (`/resource/3b01...`) | OGD API Key | Remote connection reset by NIC gateway (`164.100.61.198:443`) | GODL-India (Free commercial use with attribution) | **BLOCKED** (Requires API key + NIC gateway connectivity) |
| **OpenAQ API v3** | OpenAQ Inc. (Aggregates CPCB & SPCB stations) | REST API (`/v3/locations`, `/v3/sensors`) | `X-API-Key` HTTP Header | Returns `HTTP 401 Unauthorized` without API key | CC-BY 4.0 / GODL (Free commercial use with attribution) | **VIABLE PROVIDER** (Requires free API key in `.env`) |
| **WeatherAPI AQI** | Bluesky Capital Ltd | REST API (`/current.json?aqi=yes`) | Current `WEATHERAPI_API_KEY` | Successfully tested (HTTP 200) | Commercial license allowed | **INADEQUATE AS CPCB SOURCE** (Global model estimates only; no CPCB CAAQMS stations) |
| **SAFAR (IITM)** | Ministry of Earth Sciences | Mobile App / Web Portal | None | No public developer REST API | Manual access only | **DISQUALIFIED** (No API) |

---

## 4. Analysis of the Primary Candidate: OpenAQ API v3 vs. data.gov.in

### 4.1 Why OpenAQ API v3 is the Recommended Implementation Target
OpenAQ operates an open data pipeline that continuously ingests real-time telemetry from CPCB, Delhi Pollution Control Committee (DPCC), Karnataka State Pollution Control Board (KSPCB), and Maharashtra Pollution Control Board (MPCB).

1. **Station Granularity:** Station-level locations mapped to exact latitude and longitude coordinates.
   - Delhi examples: Anand Vihar, Mandir Marg, Punjabi Bagh, RK Puram, Siri Fort, IGI Airport.
   - Bengaluru examples: Silk Board, BTM Layout, City Railway Station, Hombegowda Nagar.
2. **Standardized Pollutants:** Standard SI units (`µg/m³` for PM2.5, PM10, NO2, SO2, O3; `mg/m³` or `ppm` for CO).
3. **Observation Provenance:** Explicit provider attribution metadata (`owner_name: Central Pollution Control Board`, `provider: CPCB`).
4. **Update Frequency:** Hourly station synchronization with UTC/IST timestamps.
5. **Licensing:** Fully compatible with commercial attribution under Creative Commons Attribution 4.0 International (CC BY 4.0).

### 4.2 Official Indian National Air Quality Index (NAQI) Standard
Under the CPCB 2014 standard, the Indian National AQI is calculated using 24-hour average sub-indices across 8 pollutants. The sub-index for pollutant $p$ with concentration $C_p$ is calculated by linear interpolation:

$$I_p = \frac{I_{hi} - I_{lo}}{B_{hi} - B_{lo}} \times (C_p - B_{lo}) + I_{lo}$$

Where:
- $B_{hi}, B_{lo}$: Upper and lower concentration breakpoints for pollutant $p$.
- $I_{hi}, I_{lo}$: Upper and lower AQI index breakpoints for the corresponding category.

#### Official CPCB AQI Breakpoints:
| Category | AQI Range | PM2.5 (24h, µg/m³) | PM10 (24h, µg/m³) | NO2 (24h, µg/m³) | SO2 (24h, µg/m³) | CO (8h, mg/m³) | O3 (8h, µg/m³) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Good** | 0–50 | 0–30 | 0–50 | 0–40 | 0–40 | 0–1.0 | 0–50 |
| **Satisfactory** | 51–100 | 31–60 | 51–100 | 41–80 | 41–80 | 1.1–2.0 | 51–100 |
| **Moderate** | 101–200 | 61–90 | 101–250 | 81–180 | 81–380 | 2.1–10 | 101–168 |
| **Poor** | 201–300 | 91–120 | 251–350 | 181–280 | 381–800 | 10.1–17 | 169–208 |
| **Very Poor** | 301–400 | 121–250 | 351–430 | 281–400 | 801–1600 | 17.1–34 | 209–748 |
| **Severe** | 401–500 | 250+ | 430+ | 400+ | 1600+ | 34+ | 748+ |

**Overall AQI:** Maximum of sub-indices ($AQI = \max(I_1, I_2, \dots, I_n)$), provided at least 3 pollutants are measured, with at least one being PM2.5 or PM10.

---

## 5. Formal Blocker Statement & Action Plan

### The Blocker:
Neither `OPENAQ_API_KEY` nor `DATA_GOV_IN_API_KEY` is present in `.env`.
- Live network requests to `api.openaq.org/v3` fail with `HTTP 401 Unauthorized`.
- Live network requests to `api.data.gov.in` are dropped at the TLS layer by NIC gateway firewalls.
- Direct CPCB web scraping is legally and technically disallowed.

### Safe Implementation Strategy (Phase 2A Scope):
To maintain engineering momentum without violating data integrity:
1. **Architect the Complete Production AQI Pipeline:**
   - Define `AirQualityObservation` in SQLAlchemy models.
   - Implement `OpenAQClient` in `backend/app/integrations/openaq/` reading `OPENAQ_API_KEY` from settings.
   - Implement official CPCB NAQI calculation logic adhering strictly to the 2014 CPCB formula.
   - Implement `NormalizedAQIRecord` normalizer.
   - Implement geographic station matching to pilot localities (`haversine_distance_km` with station distance and age).
   - Implement Scenario E: Air Quality Intelligence rule (deterministic alert generation for Severe/Very Poor AQI).
2. **Offline Fixtures for Testing:**
   - Add unit test fixtures with verified real-world CPCB CAAQMS station data (Delhi Anand Vihar, Delhi Mandir Marg, Bengaluru Silk Board).
   - Ensure 100% of automated tests run offline without external API dependencies.
3. **Honest Frontend Integration:**
   - If an API key is configured and valid observations are stored, the Air Quality card displays live station readings, AQI value, category, observation timestamp, and station distance.
   - If no key is configured or station data is stale, the card displays an honest, accessible `"Unavailable / Awaiting Key Configuration"` state. Zero fabricated data is rendered.
