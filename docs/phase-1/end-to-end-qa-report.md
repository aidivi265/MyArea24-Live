# MyArea24 — Milestone 3.1: End-to-End QA and Local Product Validation Report

**Document ID:** `DOC-P1-E2E-QA-001`  
**Date:** October 2026  
**Status:** VALIDATED & READY FOR INTERNAL PILOT  
**Recommendation:** **GO (Conditional on Continuous Ingestion Daemon for Pilot Corridors)**  
**Author:** Lead Full-Stack / QA Engineer & Systems Analyst  

---

## 1. Executive Summary & Deployment Recommendation

Milestone 3.1 executed an end-to-end Quality Assurance (QA) and product validation audit for **MyArea24**, testing the full stack as a real user would experience it:
- **FastAPI Backend:** Verified across health, readiness, localities, and filtered intelligence endpoints.
- **React 19 Frontend:** Verified in a real **Google Chrome** browser using automated headless control across desktop (1280px) and mobile (375px) viewports.
- **External Data Providers:** Live smoke tests confirmed active connectivity to **WeatherAPI**, **TomTom Traffic v5**, and **NDMA SACHET RSS/CAP**.
- **Data Integrity:** Verified that displayed insights match underlying database telemetry records, timestamps in Indian Standard Time (IST) are grounded, and past-expiry records are strictly gated.

### Final Recommendation: **GO FOR PILOT STAGING**
- **Decision:** **GO**
- **Conditions:**
  1. The background ingestion worker must run continuously (`scripts/run_worker.py --interval 600`) to keep observation caches fresh.
  2. Geographic coverage remains explicitly scoped to pilot corridors in Delhi NCR and Bengaluru.

---

## 2. Task 1: Repository & Reproducibility Audit

### 2.1 Git Status & Commit Lineage
- **Branch:** `master`
- **Recent Commit Lineage:**
  - `2c325a8`: `feat(milestone-2): build deterministic local intelligence engine with multi-scenario correlation`
  - `6b8587e`: `fix(sachet): resolve 404 by migrating to official NDMA CAP RSS feed and ETag caching`
  - `b9834a1`: `feat(traffic): migrate traffic integration from HERE to TomTom v5`
  - `ab6042f`: `feat(milestone-1): implement core signal ingestion, normalization, and deterministic correlation engine`
- **Database Migrations:** Checked against Alembic; database is at head revision `c2e4b6a8d102 (head)` with all schemas synchronized.

### 2.2 Code-Level Logic Verification (Zero Manual DB Dependencies)
All wording, classification, and locality label associations were verified to be produced directly by deterministic Python source code:
1. **Road Closure Detection (`backend/app/intelligence/rules.py`):**
   - Automatically detects `incident_type == "ROAD_CLOSURE"`.
   - Formulates headline: `Traffic Advisory: Road Closure on {road}`.
   - Emits impact: `Corridor is closed to vehicular traffic. Severe bottleneck and diversions expected around {road}.`
   - Emits advice: `Avoid this corridor. Use designated bypass routes or alternate arterial roads.`
   - Assigns severity `severe` without relying on numerical delay seconds.
2. **Nearest Pilot Corridor Association (`backend/app/intelligence/correlation.py`):**
   - Correlates traffic incidents within 8 km of pilot zones to their nearest pilot label (e.g., `Janpath -> Ashoka Road (Delhi Connaught Place)`).
   - Tested and verified dynamically via `CorrelationEngine`.

---

## 3. Task 2: Live Backend API Verification

The FastAPI server running on `http://127.0.0.1:8000` was tested with real HTTP requests and CORS headers matching the frontend origin `http://localhost:5173`.

### Endpoint Audit Matrix

| Endpoint | Method | Status | CORS Header | Key Observations |
|---|---|---|---|---|
| `/health` | `GET` | `200 OK` | `http://localhost:5173` | Reports healthy status, environment `development`. |
| `/ready` | `GET` | `200 OK` | `http://localhost:5173` | Database connection verified. |
| `/api/v1/intelligence/localities` | `GET` | `200 OK` | `http://localhost:5173` | Returns all 5 pilot zones (AIIMS, CP, Rohini, Silk Board, Indiranagar). |
| `/api/v1/intelligence` | `GET` | `200 OK` | `http://localhost:5173` | Paginated feed returns valid insight schema with signals list. |
| `/api/v1/intelligence?area=Connaught` | `GET` | `200 OK` | `http://localhost:5173` | Filters correctly by area substring (returns CP insights). |
| `/api/v1/intelligence?severity=severe` | `GET` | `200 OK` | `http://localhost:5173` | Isolates severe road closure alert. |
| `/api/v1/intelligence?insight_type=single_signal_traffic_notice` | `GET` | `200 OK` | `http://localhost:5173` | Returns single-source traffic advisories. |
| `/api/v1/intelligence?confidence=Single` | `GET` | `200 OK` | `http://localhost:5173` | Filters by confidence strength category. |
| `/api/v1/intelligence/{id}` | `GET` | `200 OK` | `http://localhost:5173` | Returns full record with raw telemetry provenance. |
| `/api/v1/intelligence/99999` | `GET` | `404 Not Found` | `http://localhost:5173` | Returns standard RFC 7807 / FastAPI error JSON. |

---

## 4. Task 3: Real Browser End-to-End Validation

Using automated browser instrumentation (`puppeteer-core` driving local **Google Chrome** `145.0.7632.77`), the web application running on Vite (`http://localhost:5173`) was validated through real user interactions.

### 4.1 Test Flow & Results

1. **Initial Page Load (Desktop 1280x800):**
   - Title: `MyArea24 — Evidence-Backed Local Intelligence`.
   - Header shows brand badge, pilot version pill `India Pilot v0.3`, and `Live Signal Engine` indicator.
   - Pilot Scope Banner correctly informs users of monitoring boundaries in Delhi NCR & Bengaluru.
   - Insight cards render with high-contrast borders and scenario tags.
2. **Data Integrity on Cards:**
   - Road Closure card accurately displays `Traffic Advisory: Road Closure on Janpath -> Ashoka Road`. Zero instances of `+0 mins delay` found.
   - Single-source disclosure notes are present on all standalone cards.
3. **Locality Switching:**
   - Clicking `Delhi Connaught Place` immediately updates the feed to show only CP-area insights.
   - Clicking `Delhi Rohini Sector 11` (where no active disruption exists) renders the **Normal Conditions Reported** empty state with a timestamp.
   - Clicking `All Active Pilot Zones` restores the complete multi-locality view.
4. **Severity Filtering:**
   - Selecting `Severe (Critical Disruption)` reduces feed to exactly 1 verified road closure card.
   - Clicking `Clear Filters` resets dropdowns and restores feed count.
5. **Evidence Detail Modal & Escape Key:**
   - Clicking an insight card launches the modal dialog.
   - Modal displays exact GPS coordinates (`(28.5799°N, 77.2250°E)`), Local Impact callout, Action Recommendation, and Provenance Signal Cards (with source name, observation ID, and metrics).
   - Pressing `Escape` closes the modal immediately.
6. **Mobile Viewport (375x667 — iPhone SE width):**
   - Evaluated touch targets (minimum 40px height for locality pills).
   - Verified body scroll width ($375\text{px}$) matches window width ($375\text{px}$) with **zero horizontal overflow**.
7. **Console & Network Inspection:**
   - **Console Errors:** `0`
   - **Failed Network Requests:** `0`

### 4.2 Visual Verification Artifacts
Six high-resolution screenshots were captured and archived in [`docs/phase-1/e2e-screenshots/`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/docs/phase-1/e2e-screenshots):
- `01-desktop-initial-feed.png`: Desktop feed with active insight cards and status pills.
- `02-locality-connaught-place.png`: Filtered locality view for Connaught Place.
- `03-empty-state-normal.png`: Reassuring "Normal Conditions Reported" empty state for Rohini.
- `04-filter-severe.png`: Filtered severe road closure card.
- `05-evidence-detail-modal.png`: Deep evidence and provenance modal with observation IDs.
- `06-mobile-viewport-375.png`: Mobile layout rendering seamlessly without truncation.

---

## 5. Task 4: Data Integrity & Expiry Handling

### 5.1 Telemetry Provenance Verification
Every insight in the database was cross-referenced with its underlying telemetry observation:
- **Insight #1:** Matched `TrafficObservation #166` (`Aurobindo Marg -> Mahatma Gandhi Marg`, `delay_s=1244`, `CONGESTION`).
- **Insight #2:** Matched `TrafficObservation #121` (`Aurobindo Marg -> Lodi Colony`, `delay_s=1228`, `CONGESTION`).
- **Insight #3:** Matched `TrafficObservation #47` (`Rotary Number 49 -> Kautilya Marg`, `delay_s=959`, `CONGESTION`).
- **Insight #4:** Matched `TrafficObservation #116` (`Janpath -> Ashoka Road`, `delay_s=None`, `ROAD_CLOSURE`).
- **Insight #5:** Matched `TrafficObservation #182` (`AH1`, `delay_s=1371`, `CONGESTION`).

### 5.2 Defect Fixed: Dynamic Query-Time Expiry Check
- **Discovered Edge Case:** When the ingestion worker daemon is not running continuously, insights that elapsed past their `expires_at` could retain `is_active = True` in SQLite. Querying `GET /api/v1/intelligence?is_active=true` could return stale records.
- **Remediation (`backend/app/services/intelligence_service.py`):** Added a dynamic query-time check:
  ```python
  if is_active is True:
      now_utc = datetime.datetime.utcnow()
      query = query.filter(
          IntelligenceInsight.is_active == True,
          IntelligenceInsight.expires_at > now_utc,
      )
  elif is_active is False:
      now_utc = datetime.datetime.utcnow()
      query = query.filter(
          (IntelligenceInsight.is_active == False)
          | (IntelligenceInsight.expires_at <= now_utc)
      )
  ```
- **Regression Test Added:** `test_api_excludes_past_expiry_insights_even_if_flagged_active` in [`tests/integration/test_api.py`](file:///c:/Users/divya/OneDrive/Desktop/AKGEC/tests/integration/test_api.py).

---

## 6. Task 5: Automated Verification Summary

All test suites and production build commands were executed cleanly:

```text
======================================================================
1. Backend Test Suite (pytest)
Command: .venv\Scripts\pytest -v
Result:  83 PASSED, 0 FAILED (Duration: 1.18s)
Coverage: API contracts, rules A/B/C/D, geometry ray-casting, expiry gating.

2. Frontend Test Suite (Vitest)
Command: npm --prefix frontend test
Result:  20 PASSED across 5 test suites (Duration: 4.60s)
Suites:  InsightCard, FilterBar, LocalitySelector, InsightDetailModal, App.

3. Browser E2E Test Suite (Chrome Automation)
Command: npm --prefix frontend run test:e2e
Result:  8 / 8 E2E Scenarios PASSED (0 console errors, 0 net errors)

4. Frontend Production Build (Vite)
Command: npm --prefix frontend run build
Result:  SUCCESS (0 errors, bundle: dist/assets/index-BHsw4wrB.js 241 kB)

5. Live External Provider Smoke Test
Command: .venv\Scripts\python scripts/smoke_test_live.py
Result:  WeatherAPI (SUCCESS), TomTom v5 (SUCCESS), NDMA SACHET (SUCCESS)
======================================================================
```

---

## 7. How to Run Locally

### 1. Start the Backend API Server
```powershell
.\.venv\Scripts\uvicorn.exe backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the Frontend Web Application
```powershell
npm --prefix frontend run dev
```
Open **`http://localhost:5173`** in your browser.

### 3. Run Automated Tests
```powershell
# Run backend tests (83 tests):
.\.venv\Scripts\pytest.exe -v

# Run frontend component tests (20 tests):
npm --prefix frontend test

# Run browser E2E test with real Chrome:
npm --prefix frontend run test:e2e
```

### 4. Run Live Ingestion & Correlation Worker
```powershell
# Single sync cycle:
$env:PYTHONPATH='.'; .\.venv\Scripts\python.exe scripts/run_worker.py --once

# Continuous 10-minute daemon:
$env:PYTHONPATH='.'; .\.venv\Scripts\python.exe scripts/run_worker.py --interval 600
```

---

## 8. Known Limitations & Remaining Risks

1. **Pilot Scope Boundary:** Live monitoring is actively configured for 5 pilot corridors in Delhi NCR and Bengaluru. Districts outside these pilot bounding boxes will naturally show normal conditions.
2. **TomTom Commercial Tier Limits:** The free Developer Tier provides 2,500 non-tile requests/day. At a 10-minute polling interval across 2 pilot corridors, consumption is ~288 calls/day (well within the free quota).
3. **No Push Notifications / Service Worker:** The application is currently a responsive Single Page App. Automated background alerts or SMS notifications require future mobile push infrastructure.
4. **Single-Source Telemetry Prevalence:** Under dry weather conditions, most active advisories are single-source traffic incidents. Multi-signal (Weather + Traffic) insights appear when rain events overlap commute corridors.

---

## 9. Conclusion

MyArea24 Milestone 3.1 is **fully validated, robust, and verified in a real browser**. The application accurately reflects real-world conditions, presents transparent evidence and data provenance, and avoids unverified claims or fake data.
