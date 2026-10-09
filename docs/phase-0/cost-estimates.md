# Solo Founder Operational Cost Model & Infrastructure Budget (INR)

**Document Version:** 1.0  
**Phase:** Phase 0 (Product & Data Feasibility Validation)  
**Author:** Technical Researcher & Data Feasibility Analyst  
**Currency:** Indian Rupee (INR) | USD pegged at 1 USD = ₹84.00, EUR pegged at 1 EUR = ₹91.50  

---

## 1. Cost Architecture Philosophy

For a solo-founder venture powered by AI coding agents, cost discipline is an existential imperative. 

The architecture is designed around four strict economic principles:
1. **Aggressive Cache Maximization within Legal Licenses:** Ingest data at the city/corridor level rather than per-user request. For example, polling WeatherAPI once per hour for a locality serves 10,000 concurrent users from local memory, keeping external API consumption constant regardless of user surges.
2. **Deterministic Pre-filtering before LLM Invocation:** Zero tokens are spent on non-events. The AI model is invoked only when mathematical thresholds trigger a confirmed multi-signal correlation.
3. **PWA-First Distribution:** Initial rollout as an installable Progressive Web App (PWA) eliminates immediate Apple Developer ($99/year) and Google Play review delays, while providing full Web Push notification capabilities.
4. **Hard Budget Capping:** All cloud accounts (Google Cloud, HERE, Mapbox, Supabase/Render) configured with hard billing cutoffs and 50%/80% spending alerts.

---

## 2. Infrastructure & Provider Unit Costs (Verified Pricing)

| Service / Provider | Product & Tier | Free Allowance | Overage / Paid Rate |
|---|---|---|---|
| **WeatherAPI.com** | Weather Forecast | 100,000 calls / month | $4.00 (~₹336) per 1,000,000 calls |
| **HERE Technologies** | Traffic API v7 | 250,000 transactions / month | $1.00 (~₹84) per 1,000 transactions |
| **NDMA SACHET** | Disaster Alerts XML | Unlimited (Public RSS) | ₹0.00 |
| **OpenAQ / CPCB** | Air Quality API v3 | 2,000 requests / hour | ₹0.00 (Standard Tier) |
| **Mapbox** | Search & Geocoding v6 | 100,000 requests / month | $0.75 (~₹63) per 1,000 requests |
| **Google Gemini Flash**| LLM Synthesis | 15 RPM free (AI Studio) | Input: $0.10/1M tokens (~₹8.40) <br> Output: $0.40/1M tokens (~₹33.60) |
| **Backend Compute** | Render / Railway / VPS | 750 free compute hours (Render) | $5.00 - $7.00/mo (~₹420 - ₹590/mo) |
| **PostgreSQL Database**| Supabase / Neon | 500 MB DB + 1 GB storage free | $25.00/mo (~₹2,100/mo) for Pro tier |
| **Notifications** | Firebase (FCM) / Web Push | Unlimited free push notifications | ₹0.00 |
| **Logging / Sentry** | Sentry Developer Free | 5,000 errors / month free | ₹0.00 |
| **Domain & DNS** | Cloudflare DNS + Registrar| Free CDN & SSL | Domain: ~₹900 - ₹1,200 / year |

---

## 3. Three Operating Cost Scenarios

---

### Scenario 1: Prototype / Private Testing
- **User Scale:** Founder + 25 Private Alpha Testers
- **Target Geography:** 2 Test Micro-Zones (e.g., Rohini/North Delhi + Indiranagar/East Bengaluru)
- **Polling Cadence:** Weather every 60 min; Traffic every 15 min; Alerts every 15 min.
- **Estimated API Consumption:**
  - Weather: 2 zones $\times$ 24 calls = 48 calls/day (1,440 calls/mo) $\to$ **₹0** (Free Tier)
  - HERE Traffic: 2 zones $\times$ 96 calls = 192 calls/day (5,760 calls/mo) $\to$ **₹0** (Free Tier)
  - OpenAQ: 2 zones $\times$ 24 calls = 48 calls/day (1,440 calls/mo) $\to$ **₹0** (Free Tier)
  - Gemini Flash: ~50 synthesis calls/day $\times$ 500 tokens = 25,000 tokens/day (750k tokens/mo) $\to$ **₹0** (AI Studio Free Tier)
  - Backend & DB: Free tiers on Render + Supabase $\to$ **₹0**

#### Monthly Cost Breakdown (Scenario 1)
| Line Item | Category | Monthly Cost (INR) | Mandatory / Optional |
|---|---|:---:|:---:|
| External APIs (Weather, HERE, OpenAQ) | Data Ingestion | ₹0 | Mandatory |
| LLM Synthesis (Gemini AI Studio Free) | AI Engine | ₹0 | Mandatory |
| Backend Compute (Render Free Web Service)| Hosting | ₹0 | Mandatory |
| Database (Supabase Free PostgreSQL) | Data Store | ₹0 | Mandatory |
| Web Push / FCM | Notifications | ₹0 | Mandatory |
| Domain Name (.in or .com amortized) | Branding | ₹100 | Mandatory |
| **Total Mandatory Monthly Cost** | | **₹100** | |
| *Optional: Render Starter Instance ($7)* | *No cold starts* | *₹588* | *Optional* |

---

### Scenario 2: Small Public Beta
- **User Scale:** 1,000–2,500 Active Registered Beta Users
- **Target Geography:** 2 Full Metro Regions (Delhi-NCR and Bengaluru Urban, covering ~25 key municipal/transit sectors)
- **Polling Cadence:** Weather every 30 min; Traffic every 10 min during peak hours, 30 min off-peak; AQI hourly.
- **Estimated API Consumption:**
  - Weather: 25 sectors $\times$ 48 calls = 1,200 calls/day (36,000 calls/mo) $\to$ Well within 100k free tier (**₹0**)
  - HERE Traffic: 25 sectors $\times$ 100 calls = 2,500 calls/day (75,000 calls/mo) $\to$ Within 250k free tier (**₹0**)
  - Mapbox Geocoding: ~15,000 searches/mo $\to$ Within 100k free tier (**₹0**)
  - Gemini Flash (Paid Pay-As-You-Go API): ~300 triggered compound insights/day $\times$ 800 tokens = 240,000 tokens/day (7.2M tokens/mo) $\to$ ~₹120/mo
  - Backend Compute: Render Starter Instance ($7/mo = ₹588/mo) for 24/7 background worker & API
  - Database: Supabase Free Tier (500 MB handles ~500k alert records with rolling 30-day purge)

#### Monthly Cost Breakdown (Scenario 2)
| Line Item | Category | Monthly Cost (INR) | Mandatory / Optional |
|---|---|:---:|:---:|
| WeatherAPI (Free Tier) | Data Ingestion | ₹0 | Mandatory |
| HERE Traffic API (Freemium Tier) | Data Ingestion | ₹0 | Mandatory |
| NDMA SACHET + OpenAQ (Open Data) | Data Ingestion | ₹0 | Mandatory |
| Mapbox Search / Geocoding (Free Tier) | Location Search | ₹0 | Mandatory |
| Gemini 1.5 Flash (Commercial Pay-as-you-go) | AI Synthesis | ₹120 | Mandatory |
| Render Web Service ($7/mo Starter) | Backend Hosting | ₹588 | Mandatory |
| Supabase PostgreSQL (Free Tier) | Database | ₹0 | Mandatory |
| Cloudflare CDN / DNS | Security / Edge | ₹0 | Mandatory |
| Firebase Cloud Messaging (Web Push) | Notifications | ₹0 | Mandatory |
| Sentry Error Tracking (Developer Free) | Monitoring | ₹0 | Mandatory |
| Domain Amortized | Infrastructure | ₹100 | Mandatory |
| **Total Mandatory Monthly Cost** | | **₹808** | |
| *Optional: WeatherAPI Starter Plan ($4)* | *Buffer to 1M calls* | *₹336* | *Optional* |
| *Optional: Google Play Console (One-time $25)*| *Android Store APK* | *₹2,100 (One-time)*| *Optional* |

---

### Scenario 3: Early Growth
- **User Scale:** 25,000–50,000 Monthly Active Users
- **Target Geography:** 6 Major Metro Areas (Delhi-NCR, Bengaluru, Mumbai, Pune, Hyderabad, Chennai; ~120 urban corridors)
- **Estimated API Consumption:**
  - Weather: 120 corridors $\times$ 48 calls = 5,760 calls/day (172,800 calls/mo) $\to$ Requires WeatherAPI Starter Plan ($4/mo = ₹336)
  - HERE Traffic: 120 corridors $\times$ 120 calls = 14,400 calls/day (432,000 calls/mo) $\to$ 250k free + 182k overage @ $1/1k calls = $182 (~₹15,288/mo)
    * *Traffic Cost Optimization:* Switch to selective polling (poll only corridors with active users or active rainfall), reducing consumption back under 250,000 free calls!
    * *Budgeted unoptimized:* ₹15,288 | *Optimized with active corridor filters:* **₹0–₹3,500**
  - Mapbox Geocoding: 150,000 searches/mo $\to$ 100k free + 50k overage @ $0.75/1k = $37.50 (~₹3,150)
  - Gemini Flash: ~2,500 compound insights/day (60M tokens/mo) $\to$ ~₹1,200/mo
  - Compute: Render Pro / DigitalOcean Droplet ($24/mo = ₹2,016)
  - Database: Supabase Pro Tier ($25/mo = ₹2,100) with 8 GB database and point-in-time recovery

#### Monthly Cost Breakdown (Scenario 3 — Optimized Growth)
| Line Item | Category | Monthly Cost (INR) | Mandatory / Optional |
|---|---|:---:|:---:|
| WeatherAPI Starter Tier ($4) | Data Ingestion | ₹336 | Mandatory |
| HERE Traffic (Selective Polling + Overage) | Traffic Ingestion | ₹3,500 | Mandatory |
| OpenAQ + NDMA SACHET | Public Alerts | ₹0 | Mandatory |
| Mapbox Geocoding (Overage Buffer) | Location Search | ₹3,150 | Mandatory |
| Google Gemini Flash API | AI Synthesis | ₹1,200 | Mandatory |
| Cloud Compute (VPS / Render) | Backend Workers | ₹2,016 | Mandatory |
| Managed PostgreSQL (Supabase Pro) | Database | ₹2,100 | Mandatory |
| Cloudflare Pro Plan ($20/mo) | Edge / DDoS | ₹1,680 | Optional |
| Sentry Team Tier ($26/mo) | Observability | ₹2,184 | Optional |
| **Total Mandatory Monthly Cost** | | **₹12,302** | |
| **Total with Optional Add-ons** | | **₹16,166** | |

---

## 4. Cost Comparison Matrix Across Stages

```
┌─────────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│ Stage                   │ Active Users         │ Target Cities        │ Est. Monthly Cost    │
├─────────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ 1. Private Prototype    │ 1 - 25 users         │ 2 micro-zones        │ ₹100 / month         │
│ 2. Small Public Beta    │ 1,000 - 2,500 users  │ Delhi-NCR, Bengaluru │ ₹808 - ₹1,144 / month│
│ 3. Early Growth         │ 25,000 - 50,000 users│ 6 Metros (120 zones) │ ₹12,300 / month      │
└─────────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 5. Mandatory Budget Controls & Safety Circuit Breakers

To guarantee that no runaway API bug drains the founder's personal bank account:

1. **Provider Hard Spending Caps:**
   - **Google Cloud Platform:** Set daily spend budget alert at ₹100, hard quota limit on Gemini Flash requests (max 10,000 requests/day).
   - **HERE Technologies:** Enable "Pre-paid Credit Only" mode without automatic credit card recharge. When free 250,000 transactions expire, gracefully degrade to TomTom fallback.
   - **Mapbox:** Enable "Usage Limits" in Account Security to cut off requests at 100,000 free operations.
2. **Architecture Decoupling (The "Pull vs Push" Law):**
   - User app opens **NEVER** trigger external third-party API calls directly.
   - Users query **ONLY** the internal cached database.
   - A dedicated background cron worker performs batch ingestion on a fixed, predictable schedule. This means 1,000,000 active app opens consume **0 additional third-party API calls**.
3. **Database Purge Automation:**
   - Expire and delete raw sensor readings older than 48 hours via automated PostgreSQL partition dropping (`pg_partman` or daily cron cleanup), keeping storage within free 500 MB tiers indefinitely.
