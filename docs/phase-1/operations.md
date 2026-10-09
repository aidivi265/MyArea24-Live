# Solo Founder Operations & Deployment Manual

**Phase:** Phase 1 (Milestone 1)  
**Target:** Local Development, Ingestion Workers, and Production Readiness  

---

## 1. Quick Start Commands

### 1.1 Database Migrations
Apply all schema migrations to your local or production database:
```bash
# Apply migrations to latest revision
.\.venv\Scripts\alembic.exe upgrade head
```

### 1.2 Starting the FastAPI Application Server
Run the REST API locally on port 8000:
```bash
# Start server with auto-reload (development)
.\.venv\Scripts\uvicorn.exe backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`
- Health Probe: `http://127.0.0.1:8000/health`
- Readiness Probe: `http://127.0.0.1:8000/ready`
- Intelligence API: `http://127.0.0.1:8000/api/v1/intelligence`

### 1.3 Running Ingestion Jobs
Ingestion can be run either inside the FastAPI process (set `INGESTION_ENABLED=true` in `.env`) or as a dedicated worker process:

```bash
# Option A: Run a single on-demand sync cycle
.\.venv\Scripts\python.exe scripts/run_worker.py --once

# Option B: Run as a long-running background daemon (default 10-minute cycle)
.\.venv\Scripts\python.exe scripts/run_worker.py --interval 600
```

---

## 2. Quota Management & Cost Safety Controls

To guarantee that external provider limits are never breached during continuous operations:

| Provider | Configured Polling Interval | Daily Request Projection (5 Pilot Nodes) | Monthly Request Projection | Free Tier Allowance | Safety Margin |
|---|---|---|---|---|---|
| **WeatherAPI** | 30 minutes | 240 requests/day | 7,200 requests/month | 100,000 requests/month | **92.8% Buffer Remaining** |
| **HERE Traffic**| 10 minutes | 144 requests/day | 4,320 requests/month | 250,000 transactions/month| **98.2% Buffer Remaining** |
| **NDMA SACHET** | 15 minutes | 96 requests/day | 2,880 requests/month | Unlimited (Public RSS) | **100% Free** |

### Circuit Breakers:
1. **Cache Protection:** `WeatherAPIClient` caches forecast queries in memory for 60 minutes per coordinate pair. Repeated polls within the cache window consume 0 billable API calls.
2. **Pre-Paid / Freemium Account Setting:** Never configure auto-recharge on credit cards in the HERE or Mapbox developer consoles.
3. **Decoupled User Traffic:** Zero client requests hit third-party APIs. Millions of user app opens cost ₹0 in external data fees.

---

## 3. Operational Troubleshooting

### Problem 1: `[weatherapi] Authentication failed: HTTP 401`
- **Cause:** Invalid or missing `WEATHERAPI_API_KEY` in `.env`.
- **Resolution:** Verify API key in developer dashboard at [weatherapi.com](https://www.weatherapi.com/).

### Problem 2: `[here_traffic] Rate limited: Retry-After 5s`
- **Cause:** Bursty requests sent to HERE traffic endpoints.
- **Resolution:** The engine automatically applies exponential backoff with jitter and respects the `Retry-After` header. If persistent, increase `TRAFFIC_POLL_INTERVAL_MINUTES` in `.env`.

### Problem 3: `[sachet_cap] Failed to download CAP feed`
- **Cause:** Government NDMA portal undergoing scheduled maintenance or experiencing DNS latency.
- **Resolution:** The worker marks the sync log as `FAILED` and retains previous active notices without halting the application server. Alerts past `expires_at` are automatically purged from active view.
