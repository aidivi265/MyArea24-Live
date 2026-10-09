# Automated Testing & Verification Guide

**Phase:** Phase 1 (Milestone 1)  
**Test Suite:** Pytest (Unit & Integration Tests)  
**Total Automated Tests:** 56 Passed (0 Failed)  

---

## 1. Running the Automated Test Suite

All tests execute entirely against isolated, in-memory SQLite fixtures (`StaticPool`), requiring **zero live network calls, zero API credentials, and zero billable transactions**.

```bash
# Run the full test suite with verbose output
.\.venv\Scripts\pytest.exe -v
```

Expected output:
```text
======================== 56 passed in 1.62s ========================
```

---

## 2. Test Suite Breakdown

### 2.1 Unit Tests (`tests/unit/`)
1. **`test_normalization.py` (9 tests):**
   - Weather normalization from heavy rain and light rain payloads.
   - Coordinate validation (WGS-84 latitude and longitude bounds).
   - Traffic normalization from HERE v7 LineString shape links.
   - Traffic flow normalization for low-delay segments.
   - TomTom v5 traffic heavy congestion normalization (`jam_factor is None`, `delay_seconds=1800`, `criticality="major"`).
   - TomTom v5 traffic normal flow normalization.
   - TomTom v5 missing metrics handling (gracefully normalizes sparse data).
   - TomTom v5 malformed / non-dict payload protection.
2. **`test_sachet_cap.py` (7 tests):**
   - OASIS CAP v1.2 XML parsing with defusedxml protection.
   - Coordinate order inversion (CAP lat,lon to GeoJSON [lon, lat]).
   - Circle geometry extraction with radius in km.
   - Expired alert detection (`is_active = False`).
   - Malformed XML resilience (graceful empty return without unhandled crash).
   - RSS 2.0 item link extraction (`extract_rss_item_links`).
   - RSS 2.0 index fallback parsing when no `<alert>` tags exist.
3. **`test_correlation.py` (9 tests):**
   - Haversine distance accuracy between known coordinates.
   - IST evaluation window calculation (17:30 to 20:30 IST).
   - **Scenario D Acceptance Test (HERE):** Verified that synthetic $12\text{ mm/hr}$ rain and a $7.5$ jam factor emit a high severity card.
   - **Scenario D Acceptance Test (TomTom):** Verified that synthetic $12\text{ mm/hr}$ rain and TomTom delay (+30 mins) emit a grounded insight card.
   - **Scenario D Critical Escalation (TomTom):** Verified that `criticality="critical"` escalates composite severity to `severe`.
   - **Scenario D Low Delay Rejection (TomTom):** Negative rejection when queue delay is below threshold ($120\text{s} < 900\text{s}$).
   - Negative rejection when rainfall is below threshold ($2.5\text{ mm/hr} < 8.0\text{ mm/hr}$).
   - Negative rejection when signals are geographically separated ($> 5.0\text{ km}$).
   - Negative rejection when weather signals are stale ($> 60\text{ minutes}$).
4. **`test_adapters.py` (16 tests):**
   - Missing credential guards for WeatherAPI, HERE, and TomTom raising typed `ProviderAuthError`.
   - In-memory 60-minute TTL cache verification for WeatherAPI.
   - In-memory 5-minute TTL cache verification for TomTom traffic.
   - HERE traffic incident querying.
   - SACHET direct CAP XML retrieval.
   - SACHET HTTP 404 error translation (`ProviderError` with `status_code=404`).
   - SACHET request timeout handling (`ProviderTimeoutError`).
   - SACHET ETag conditional caching (HTTP 304 Not Modified).
   - SACHET RSS 2.0 index parsing with concurrent detail CAP fetching.
   - SACHET duplicate alert deduplication by `alert_identifier`.
   - TomTom authentication error (HTTP 401/403 -> `ProviderAuthError`).
   - TomTom rate limit error (HTTP 429 -> `ProviderRateLimitError`).
   - TomTom timeout error (`ProviderTimeoutError`).
   - TomTom malformed JSON response error (`ProviderError`).
   - TomTom sparse response / missing traffic metrics handling.
5. **`test_retry_and_errors.py` (3 tests):**
   - Retry success with exponential backoff on transient timeouts.
   - Immediate failure on non-retryable 401/403 authentication errors.
   - Max retry exhaustion on 429 rate limit errors.
6. **`test_config.py` (2 tests):**
   - Pilot location bounds validation and JSON parsing.
   - Pilot traffic bounding box coordinate parsing.

### 2.2 Integration Tests (`tests/integration/`)
1. **`test_ingestion.py` (3 tests):**
   - Idempotent ingestion, deduplication, and correlation with HERE traffic adapter.
   - Idempotent ingestion, deduplication, and correlation with TomTom traffic adapter (`source_id="tomtom_traffic"`).
   - SACHET notice persistence, duplicate update idempotency, and automated expiry deactivation (`is_active = False`).
2. **`test_database.py` (3 tests):**
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
