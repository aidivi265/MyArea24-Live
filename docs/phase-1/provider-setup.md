# External Provider Setup & Configuration Guide

**Phase:** Phase 1 (Milestone 1)  
**Target:** WeatherAPI, HERE Technologies, NDMA SACHET  

---

## 1. Quick Credentials Checklist

Before activating live ingestion in `.env`:

| Provider | Account Registration URL | Key Required in `.env` | Free Tier Allowance | Commercial Rights |
|---|---|---|---|---|
| **WeatherAPI** | [weatherapi.com/signup.aspx](https://www.weatherapi.com/signup.aspx) | `WEATHERAPI_API_KEY` | 100,000 calls / month | Explicitly Allowed |
| **TomTom Traffic (Default)** | [developer.tomtom.com](https://developer.tomtom.com/) | `TOMTOM_API_KEY` | 2,500 calls / day (75,000 / mo) | Allowed under Developer Terms |
| **HERE Traffic (Optional)** | [developer.here.com](https://developer.here.com/) | `HERE_API_KEY` | 250,000 transactions / month | Explicitly Allowed |
| **NDMA SACHET** | [sachet.ndma.gov.in](https://sachet.ndma.gov.in/) | *None (Public Feed)* | Unlimited | Open Public Alert |

---

## 2. Step-by-Step Provider Onboarding

### 2.1 WeatherAPI.com Setup
1. Register for a free account at [WeatherAPI.com](https://www.weatherapi.com/signup.aspx).
2. Retrieve your API key from the dashboard.
3. Add the key to `.env`:
   ```env
   WEATHERAPI_API_KEY=your_actual_weatherapi_key_here
   ```
4. **Caching Rule:** WeatherAPI permits caching current weather for up to 60 minutes and forecast data for up to 24 hours. The internal `WeatherAPIClient` automatically implements an in-memory 60-minute TTL cache per coordinate pair.
5. **Attribution:** If running on the Free tier, user-facing interfaces must include a link-back or "Powered by WeatherAPI.com" text.

### 2.2 TomTom Traffic API v5 Setup (Primary Provider)
1. Register for a free developer account at [TomTom Developer Portal](https://developer.tomtom.com/).
2. Under "Keys", copy your **Consumer API Key**.
3. Add the key and provider selection to `.env`:
   ```env
   TRAFFIC_PROVIDER=tomtom
   TOMTOM_API_KEY=your_actual_tomtom_api_key_here
   TOMTOM_TRAFFIC_BASE_URL=https://api.tomtom.com/traffic/services/5
   ```
4. Configure the pilot traffic bounding box (minLon, minLat, maxLon, maxLat) in `.env`:
   ```env
   PILOT_TRAFFIC_BBOX=77.1500,28.5200,77.2600,28.6200
   ```
5. **Metrics & Field Mapping:**
   - Endpoint: `/traffic/services/5/incidentDetails`
   - Parameters: `bbox={minLon},{minLat},{maxLon},{maxLat}`, `fields={incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{code,description},startTime,endTime,from,to,length,delay,roadNumbers}}}`
   - `magnitudeOfDelay`: Mapped to `criticality` (0: `unknown`, 1: `minor`, 2: `moderate`, 3: `major`, 4: `critical`).
   - `delay`: Queue delay in seconds, mapped directly to `delay_seconds`.
   - `jam_factor`: **Strictly None.** TomTom does not report HERE's proprietary 0-10 jam factor; it is never faked or interpolated.
6. **Rate Limits & Caching:** Free tier provides 2,500 daily requests and a 5 QPS rate limit. `TomTomTrafficClient` enforces an in-memory 5-minute TTL cache to stay well below rate and quota limits.

### 2.3 HERE Technologies Traffic API v7 Setup (Legacy / Alternative)
1. Register for a free Freemium account at the [HERE Developer Portal](https://developer.here.com/).
2. Under "Projects", generate a new **REST API Key**.
3. Add the key to `.env` and switch `TRAFFIC_PROVIDER`:
   ```env
   TRAFFIC_PROVIDER=here
   HERE_API_KEY=your_actual_here_api_key_here
   ```
4. **Quota Safety:** Ensure the account is set to "Pre-paid only" / Freemium without auto-top-up to prevent unexpected credit card charges beyond 250,000 transactions.

### 2.4 NDMA SACHET CAP Feed Setup
1. SACHET requires **zero registration or API keys**. It is the official emergency disaster alerting portal of the Government of India.
2. The official production CAP RSS feed endpoints published by NDMA / WMO are configured in `.env`:
   - **All-India Master Feed:**
     ```env
     SACHET_FEED_URL=https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml
     SACHET_MAX_ITEMS_PER_POLL=20
     ```
   - **Regional / State-Specific Feeds (Optional Alternative):**
     ```env
     SACHET_FEED_URL=https://sachet.ndma.gov.in/cap_public_website/rss/rss_delhi.xml
     ```
3. **ETag Conditional Caching:** Per NDMA integration specifications, `SACHETClient` sends `If-None-Match` HTTP headers with the server's ETag. When no new alerts are issued, the server returns HTTP 304 Not Modified, transferring zero alert payload and saving bandwidth.
4. **Detail XML Resolving:** The RSS index contains links to official OASIS CAP v1.2 XML documents (`/cap_public_website/FetchXMLFile?identifier=...`). `SACHETClient` fetches detail CAP files concurrently with an `asyncio.Semaphore(5)` to extract precise polygons, circles, severity, and timestamps.
5. Feeds and detail XML payloads are parsed using `defusedxml` to guarantee entity-attack and XXE protection.

---

## 3. Validating Provider Connectivity

Once keys are set in `.env`, run the automated live smoke test script:

```bash
# Execute opt-in live connectivity smoke test
.\.venv\Scripts\python.exe scripts/smoke_test_live.py
```

Expected output:
```text
============================================================
MyArea24 — External Provider Smoke Test
============================================================

--- 1. Testing WeatherAPI.com ---
[+] WeatherAPI SUCCESS: Received 25 normalized records.
    Location: New Delhi | Temp: 32.6°C | Precip: 0.0 mm/hr (Clear)

--- 2. Testing Traffic API (Configured Provider: tomtom) ---
[+] TomTom Traffic v5 SUCCESS: Received 239 incidents in pilot bbox.
    Type: CONGESTION | Criticality: major | Delay: 289s | Road: Bhagwan Mahaveer Marg -> Abdul Gaffar Khan Marg
    Jam Factor: None (Strictly None - not fabricated)

--- 3. Testing NDMA SACHET Public CAP Feed ---
[+] NDMA SACHET SUCCESS: Received 20 active public disaster notices.
    Alert ID: IN-1791553740889019_19 | Severity: Moderate | Event: Thunderstorm
    Headline: Thunderstorm is likely to occur at isolated places over Chamarajanagara...

Smoke test run completed.
```

