# Comprehensive Risk Register & Mitigation Architecture

**Document Version:** 1.0  
**Phase:** Phase 0 (Product & Data Feasibility Validation)  
**Author:** Technical Researcher & Data Feasibility Analyst  

---

## 1. Risk Evaluation Framework

Risks are categorized into six critical operational domains:
- **LEG:** Legal, Licensing & Regulatory Compliance
- **DAT:** Data Quality, Freshness & Sensor Coverage
- **TEC:** Technical & Architectural Resilience
- **CST:** Financial & Cost Explosion
- **PRV:** Privacy & Data Protection (DPDPA 2023 Compliance)
- **OPS:** Operational & Solo-Founder Sustainability

Severity and Likelihood are scored on a standard matrix (**High, Medium, Low**), producing an overall **Risk Rating (Critical, Major, Moderate, Low)**.

---

## 2. Risk Register

| Risk ID | Category | Risk Description | Severity | Likelihood | Rating | Mitigation Strategy & Safeguards |
|---|:---:|---|:---:|:---:|:---:|---|
| **LEG-01** | Legal | **Commercial License Breach on Free APIs:** Using non-commercial APIs (e.g. Open-Meteo Free) in a commercial app invites legal takedown or retroactive billing. | High | High | **CRITICAL** | Mandate WeatherAPI.com (explicit commercial rights on free tier) as primary. Prohibit unvetted free APIs without documented commercial terms in `india-data-source-research.md`. |
| **LEG-02** | Legal | **Web Scraping Liability (IT Act Section 66 / CFAA equivalent):** Attempting to scrape BookMyShow, Zepto, or Blinkit triggers IP bans, Cloudflare lawsuits, or police FIRs. | High | Medium | **MAJOR** | Strict architectural ban on unpermitted web scraping. Defer retail prices; use curated admin/community intake for public events. |
| **PRV-01** | Privacy | **Non-Compliance with India DPDPA (Digital Personal Data Protection Act 2023):** Unregulated collection of continuous user GPS tracking data creates severe statutory penalties. | High | Medium | **MAJOR** | Zero continuous background GPS tracking. Store user locations strictly as anonymized **Locality / Pincode Centroids** or coarse $3\text{ km}$ Geohash cells. No precise personal telemetry is stored. |
| **DAT-01** | Data | **Hallucinatory or Spurious Correlations:** LLM claiming causal linkage between unrelated events (e.g., falsely stating a religious gathering caused a water main burst). | High | High | **CRITICAL** | **Strict Separation of Concerns:** Deterministic code performs all spatio-temporal joins. LLM is strictly constrained via JSON schema to only summarize supplied facts. "Insufficient Evidence" gate suppresses unverified links. |
| **DAT-02** | Data | **Sparse Sensor Coverage in Tier-2/3 Towns:** AQI or traffic incident APIs have near-zero real-time monitors in smaller towns, leading to blank or broken feeds. | Medium | High | **MAJOR** | **Graceful Degradation Architecture:** Implement explicit coverage tiers (Tier A: Full Sensors, Tier B: Weather + Govt Alert only). Display transparent coverage indicators: *"Hyperlocal traffic sensors offline in this sector; displaying verified regional weather."* |
| **DAT-03** | Data | **Stale Traffic Data Generating Outdated Advisories:** Commuter routed away from a jam that cleared 45 minutes ago. | High | Medium | **MAJOR** | Strict TTL (Time-To-Live) on traffic incidents: Discard and purge incident records older than 30 minutes unless confirmed by active feed. |
| **CST-01** | Cost | **Runaway API Loops / Denial of Wallet Attack:** High traffic or infinite loops trigger tens of thousands of paid Maps or LLM calls, draining founder's account. | High | Medium | **MAJOR** | **Decouple App Reads from Provider Calls:** Users only query the internal Postgres database. Ingestion workers run on fixed cron schedules. Set hard billing alerts and zero-overage caps on all provider accounts. |
| **TEC-01** | Technical| **Third-Party Provider API Downtime:** WeatherAPI or HERE Experiences regional outage, crashing the MyArea24 feed. | Medium | Medium | **MODERATE**| Circuit breaker pattern with multi-provider fallbacks (WeatherAPI $\to$ OpenWeatherMap; HERE $\to$ TomTom). Cache last known good readings for up to 60 minutes with an explicit "Cached" indicator. |
| **TEC-02** | Technical| **CAP XML Parsing Failures on Malformed Feeds:** NDMA SACHET RSS feed changes polygon structure, crashing background ingestion worker. | Medium | Low | **MODERATE**| Robust Pydantic / Zod schema validation with sandbox XML error catching. Failed alerts are logged to Sentry without halting the worker loop. |
| **OPS-01** | Ops | **Solo-Founder Operational Burnout:** Attempting to maintain 10 features, moderate community forums, and fix scraping scripts single-handedly. | High | High | **CRITICAL** | Ruthlessly restrict MVP to 4 essential modules (Weather, Traffic, Govt Alerts, AQI). Use AI coding agents for boilerplate generation; reject custom bespoke features. |

---

## 3. Deep Architectural Safeguards

### 3.1 DPDPA 2023 Privacy Compliance Architecture
Under India's **Digital Personal Data Protection Act (2023)**, storing real-time geolocation is classified as sensitive processing requiring explicit purpose specification, verifiable consent, and immediate erasure upon cessation of purpose.

**MyArea24 Mitigation Architecture:**
1. **No Background GPS Tracking:** The application requests coarse location permission (`approximate_location`) only on initial setup or explicit manual search.
2. **Spatial Anonymization:** Raw coordinates are mapped immediately to a **Spatial Grid ID** (e.g., Uber H3 Index Resolution 7, corresponding to an area of $\sim 5\text{ km}^2$, or Indian Postal Pincode).
3. **Database Schema:** The `users` table stores `saved_locality_h3_index` rather than latitude and longitude floating-point pairs.

### 3.2 The Anti-Hallucination Guardrail Pipeline

```
[ Ingested Raw Signals ]
          │
          ▼
┌───────────────────────────────────────────────┐
│ DETERMINISTIC FILTER ENGINE (Go / TypeScript) │
│ - Distance check: Haversine <= 3.0 km         │
│ - Time check: |t_event - t_now| <= 60 min     │
│ - Freshness check: data_age <= MaxTTL         │
│ - Threshold: Rain > 5mm OR Jam > 7.0          │
└───────────────────────────────────────────────┘
          │
          ├── Fail (No correlation) ──────────► [ Emit Standard Single Signals ]
          │                                     [ OR "Normal Conditions" State ]
          ▼ Pass (Correlation Verified)
┌───────────────────────────────────────────────┐
│ STRICT JSON PAYLOAD COMPILATION               │
│ - Extracts verified metrics only              │
│ - Discards subjective text                    │
└───────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────┐
│ LLM SYNTHESIZER (Gemini Flash)                │
│ System Prompt: "You are a factual summarizer. │
│ Formulate a 2-sentence alert using ONLY facts │
│ in this JSON. Never hypothesize causes not    │
│ stated. Output JSON Schema only."             │
└───────────────────────────────────────────────┘
          │
          ▼
[ Final Published Insight with Source Badges & Confidence ]
```

### 3.3 Financial Circuit Breakers
To prevent unexpected credit card charges:
- **Google Cloud:** Programmatic budget alert configured at ₹500. Automated Cloud Function triggers disabled billing if budget threshold exceeds 100%.
- **HERE Developer Console:** Explicitly set to free Freemium plan without automated post-paid billing.
- **Mapbox Account:** Set max daily threshold to 3,000 geocodes.
