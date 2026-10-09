# External Provider Setup & Configuration Guide

**Phase:** Phase 1 (Milestone 1)  
**Target:** WeatherAPI, HERE Technologies, NDMA SACHET  

---

## 1. Quick Credentials Checklist

Before activating live ingestion in `.env`:

| Provider | Account Registration URL | Key Required in `.env` | Free Tier Allowance | Commercial Rights |
|---|---|---|---|---|
| **WeatherAPI** | [weatherapi.com/signup.aspx](https://www.weatherapi.com/signup.aspx) | `WEATHERAPI_API_KEY` | 100,000 calls / month | Explicitly Allowed |
| **HERE Traffic**| [developer.here.com](https://developer.here.com/) | `HERE_API_KEY` | 250,000 transactions / month | Explicitly Allowed |
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

### 2.2 HERE Technologies Traffic API v7 Setup
1. Register for a free Freemium account at the [HERE Developer Portal](https://developer.here.com/).
2. Under "Projects", generate a new **REST API Key**.
3. Add the key to `.env`:
   ```env
   HERE_API_KEY=your_actual_here_api_key_here
   ```
4. Configure the pilot traffic bounding box (minLon, minLat, maxLon, maxLat) in `.env`:
   ```env
   PILOT_TRAFFIC_BBOX=77.1500,28.5200,77.2600,28.6200
   ```
5. **Quota Safety:** Ensure the account is set to "Pre-paid only" / Freemium without auto-top-up to prevent unexpected credit card charges beyond 250,000 transactions.

### 2.3 NDMA SACHET CAP Feed Setup
1. SACHET requires **zero registration or API keys**. It is the official emergency disaster alerting portal of the Government of India.
2. The standard national/regional CAP RSS feed endpoint is configured in `.env`:
   ```env
   SACHET_FEED_URL=https://sachet.ndma.gov.in/backend/cap/rss/all/en
   ```
3. Feeds are retrieved over HTTPS with standard `defusedxml` parser sanitization.

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
    Location: Delhi AIIMS Ring Road | Temp: 28.0°C | Precip: 0.0 mm/hr (Clear)

--- 2. Testing HERE Traffic API v7 ---
[+] HERE Traffic SUCCESS: Received 8 incidents in pilot bbox.
    Type: CONGESTION | Jam Factor: 7.2 | Delay: 980s | Road: Ring Road

--- 3. Testing NDMA SACHET Public CAP Feed ---
[+] NDMA SACHET SUCCESS: Received 12 active public disaster notices.
    Alert ID: NDMA-CAP-2026-IN-1029 | Severity: Moderate | Event: Thunderstorm
    Headline: Thunderstorm with lightning warning for Western Himalayan Region...

Smoke test run completed.
```
