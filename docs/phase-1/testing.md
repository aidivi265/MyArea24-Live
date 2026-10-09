# Automated Testing & Verification Guide

**Phase:** Phase 1 (Milestone 1)  
**Test Suite:** Pytest (Unit & Integration Tests)  
**Total Automated Tests:** 33 Passed (0 Failed)  

---

## 1. Running the Automated Test Suite

All tests execute entirely against isolated, in-memory SQLite fixtures (`StaticPool`), requiring **zero live network calls, zero API credentials, and zero billable transactions**.

```bash
# Run the full test suite with verbose output
.\.venv\Scripts\pytest.exe -v
```

Expected output:
```text
======================== 33 passed in 1.34s ========================
```

---

## 2. Test Suite Breakdown

### 2.1 Unit Tests (`tests/unit/`)
1. **`test_normalization.py` (5 tests):**
   - Weather normalization from heavy rain and light rain payloads.
   - Coordinate validation (WGS-84 latitude and longitude bounds).
   - Traffic normalization from HERE v7 LineString shape links.
   - Traffic flow normalization for low-delay segments.
2. **`test_sachet_cap.py` (5 tests):**
   - OASIS CAP v1.2 XML parsing with defusedxml protection.
   - Coordinate order inversion (CAP lat,lon to GeoJSON [lon, lat]).
   - Circle geometry extraction with radius in km.
   - Expired alert detection (`is_active = False`).
   - Malformed XML resilience (graceful empty return without unhandled crash).
3. **`test_correlation.py` (6 tests):**
   - Haversine distance accuracy between known coordinates.
   - IST evaluation window calculation (17:30 to 20:30 IST).
   - **Scenario D Acceptance Test:** Verified that synthetic $12\text{ mm/hr}$ rain and a $7.5$ jam factor successfully emit an active, grounded intelligence insight card with supporting provenance.
   - Negative rejection when rainfall is below threshold ($2.5\text{ mm/hr} < 8.0\text{ mm/hr}$).
   - Negative rejection when signals are geographically separated ($> 5.0\text{ km}$).
   - Negative rejection when weather signals are stale ($> 60\text{ minutes}$).
4. **`test_adapters.py` (5 tests):**
   - Missing credential guards raising typed `ProviderAuthError`.
   - In-memory 60-minute TTL cache verification for WeatherAPI.
   - HERE traffic incident querying.
   - SACHET XML retrieval.
5. **`test_retry_and_errors.py` (3 tests):**
   - Retry success with exponential backoff on transient timeouts.
   - Immediate failure on non-retryable 401/403 authentication errors.
   - Max retry exhaustion on 429 rate limit errors.
6. **`test_config.py` (2 tests):**
   - Pilot location bounds validation and JSON parsing.
   - Pilot traffic bounding box coordinate parsing.

### 2.2 Integration Tests (`tests/integration/`)
1. **`test_database.py` (3 tests):**
   - Table initialization and DataSource record persistence.
   - Unique constraint enforcement preventing duplicate `source_record_id` entries.
   - Foreign key cascading between `intelligence_insights` and `intelligence_signals`.
2. **`test_ingestion.py` (1 test):**
   - End-to-end multi-provider ingestion cycle using AsyncMock adapters.
   - **Idempotency Verification:** Confirmed that repeated ingestion runs do not create duplicate observation rows.
   - Correlation engine insight generation with linked provenance.
   - **Deduplication Verification:** Confirmed that repeated correlation runs suppress duplicate card emissions.
3. **`test_api.py` (3 tests):**
   - `GET /health` liveness probe.
   - `GET /ready` readiness probe probing database connectivity and source status.
   - `GET /api/v1/intelligence` paginated list and detail endpoints with 404 handling.

---

## 3. The 24-Hour Soak-Test Procedure

To verify 24-hour stability under continuous production polling without memory leaks or quota overages:

### Procedure Steps:
1. Ensure `.env` is configured with valid provider credentials and `INGESTION_ENABLED=true`.
2. Start the standalone worker daemon with the configured 10-minute polling interval:
   ```bash
   .\.venv\Scripts\python.exe scripts/run_worker.py --interval 600
   ```
3. Monitor log output and database growth using the verification query:
   ```bash
   .\.venv\Scripts\python.exe -c "
   from backend.app.database.session import SessionLocal
   from backend.app.database.models import DataSyncLog, WeatherObservation, TrafficObservation, IntelligenceInsight
   with SessionLocal() as db:
       logs = db.query(DataSyncLog).count()
       weather = db.query(WeatherObservation).count()
       traffic = db.query(TrafficObservation).count()
       insights = db.query(IntelligenceInsight).count()
       print(f'Sync Logs: {logs} | Weather Obs: {weather} | Traffic Obs: {traffic} | Insights: {insights}')
   "
   ```
4. **Success Criteria for Soak Test:**
   - Worker runs for 24 continuous hours (144 scheduled cycles) without process termination.
   - Zero unhandled exceptions in logs.
   - Total WeatherAPI requests $\le 240$ calls (well within 100k free tier).
   - Total HERE requests $\le 144$ transactions (well within 250k free tier).
   - Duplicate observation counts remain exactly zero.
