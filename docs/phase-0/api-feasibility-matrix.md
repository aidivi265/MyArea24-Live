# API Feasibility Matrix & Provider Scoring

**Document Version:** 1.0  
**Phase:** Phase 0 (Product & Data Feasibility Validation)  
**Author:** Technical Researcher & Data Feasibility Analyst  

---

## 1. Scoring Methodology & Rubric Definition

To eliminate subjective guesswork, candidate providers are evaluated across eight criteria on an explicit **1 to 5 scale**:

| Score | Meaning | Standard for Criteria |
|:---:|:---|:---|
| **5** | **Excellent / Industry Leader** | Flawless India-wide coverage, explicit commercial license, ₹0/very low cost, simple REST API, sub-15m freshness, 99.9% uptime. |
| **4** | **Good / Highly Viable** | Broad metro/tier-2 coverage, clear commercial terms, minor cost/attribution caveat, hourly updates, stable SLA. |
| **3** | **Moderate / Workaround Required** | Adequate coverage, non-commercial restrictions on free tier (paid upgrade needed), complex pagination/format (XML/SOAP), or moderate latency. |
| **2** | **Poor / High Friction** | Sparse coverage outside top 3 cities, expensive enterprise barrier ($300+/mo), ambiguous licensing, or manual sales approval. |
| **1** | **Disqualifying / Prohibitive** | Zero legal API, actively blocks access, no commercial terms, completely non-viable for a solo founder. |

### The Evaluated Dimensions:
1. **India Coverage (Cov):** Geographic depth across metros, Tier-2/3 cities, and rural corridors.
2. **Data Quality (Qual):** Accuracy, precision, error rates, and schema cleanliness.
3. **Licensing Clarity (Lic):** Explicit, legally documented commercial rights and unambiguous caching policies.
4. **Cost Efficiency (Cost):** Generosity of free allowance and affordability of scaling tiers for a solo founder.
5. **Integration Ease (Int):** Developer ergonomics, JSON schema, modern SDKs, and concise documentation.
6. **Freshness (Frsh):** Real-time to sub-hourly latency vs multi-hour delay.
7. **Reliability (Rel):** Uptime track record, server stability, and consistent response times.
8. **Overall Commercial Suitability (Suit):** Weighted readiness for a production launch by an AI-assisted solo founder.

---

## 2. Master API Feasibility Matrix

*Note: All ratings are grounded in verified documentation and current terms of service.*

| Provider & Product | Domain | Cov | Qual | Lic | Cost | Int | Frsh | Rel | Suit | Verdict & Role |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **WeatherAPI.com** | Weather | 5 | 5 | 5 | 5 | 5 | 4 | 5 | **4.9** | **PRIMARY** — 100k calls free, $4/mo starter, legal caching. |
| **Open-Meteo** | Weather | 4 | 4 | 3 | 3 | 4 | 3 | 4 | **3.6** | **FALLBACK** — Free tier is strictly non-commercial; €29/mo paid. |
| **OpenWeatherMap (3.0)**| Weather | 5 | 4 | 4 | 4 | 4 | 4 | 4 | **4.1** | **SECONDARY** — 1k calls/day free, $0.0015/call overage. |
| **IMD Mausam (Direct)**| Weather | 4 | 3 | 2 | 5 | 1 | 2 | 2 | **2.4** | **DISQUALIFIED** — No public REST API; use via NDMA SACHET. |
| **HERE Traffic API v7** | Traffic | 4 | 5 | 5 | 5 | 4 | 5 | 5 | **4.8** | **PRIMARY** — 250k free transactions/mo with commercial rights. |
| **TomTom Traffic API** | Traffic | 4 | 4 | 5 | 4 | 4 | 4 | 4 | **4.1** | **FALLBACK** — 2,500 daily requests free, pay-as-you-grow. |
| **Google Maps Routes** | Traffic | 5 | 5 | 4 | 2 | 4 | 5 | 5 | **3.6** | **DEFER** — $5–$10 per 1k calls; prohibitive cost & caching bans. |
| **Mappls (MapmyIndia)**| Traffic/Maps | 5 | 5 | 2 | 2 | 2 | 4 | 4 | **3.0** | **DEFER (Phase 2)** — Enterprise sales gated; no public free tier. |
| **NDMA SACHET (CAP)** | Govt Alerts | 5 | 5 | 5 | 5 | 3 | 5 | 4 | **4.6** | **PRIMARY** — Free official CAP v1.2 XML feed; all-India hazards. |
| **PIB RSS Feeds** | Govt Notices | 4 | 3 | 5 | 5 | 3 | 3 | 4 | **3.4** | **PHASE 2** — Unstructured text; requires NLP entity extraction. |
| **OpenAQ API v3** | Air Quality | 4 | 5 | 5 | 5 | 5 | 4 | 4 | **4.6** | **PRIMARY** — CPCB data aggregated; 2,000 req/hr free, CC-BY 4.0. |
| **data.gov.in (CPCB)** | Air Quality | 4 | 4 | 5 | 5 | 3 | 3 | 3 | **3.4** | **FALLBACK** — Official GODL-India license; sporadic portal latency. |
| **Mapbox Search / Geo** | Geocoding | 4 | 5 | 5 | 5 | 5 | 4 | 5 | **4.8** | **PRIMARY** — 100k free searches/mo; premier mobile vector tiles. |
| **Geoapify / Photon** | Geocoding | 4 | 3 | 4 | 5 | 4 | 3 | 4 | **3.9** | **FALLBACK** — 3k requests/day free OSM geocoding alternative. |
| **BookMyShow / Insider**| Events | 5 | 5 | 1 | 1 | 1 | 5 | 5 | **1.0** | **DISQUALIFIED** — No public API; crawling illegal/blocked. |
| **AllEvents.in** | Events | 3 | 3 | 2 | 1 | 3 | 3 | 3 | **2.3** | **DISQUALIFIED** — $500/mo enterprise fee; rejects hobbyist/early. |
| **Eventbrite API** | Events | 1 | 4 | 4 | 4 | 4 | 4 | 4 | **2.6** | **DISQUALIFIED** — Near-zero event coverage in Indian cities. |
| **Curated / Community** | Events | 3 | 5 | 5 | 5 | 5 | 4 | 5 | **4.6** | **PRIMARY** — Zero cost; 100% legal; verified hyper-local intake. |
| **Agmarknet Mandi** | Local Prices | 3 | 4 | 5 | 5 | 3 | 2 | 3 | **2.5** | **DEFER** — Wholesale agriculture only; not consumer retail prices. |
| **Quick Commerce Scrape**| Local Prices | 4 | 4 | 1 | 1 | 1 | 5 | 3 | **1.0** | **DISQUALIFIED** — Severe legal, technical, and maintenance risks. |

---

## 3. Recommended Primary & Fallback Architecture

```
┌───────────────────────┬──────────────────────────────┬──────────────────────────────┐
│ Category              │ Recommended Primary Provider │ Designated Fallback Provider │
├───────────────────────┼──────────────────────────────┼──────────────────────────────┤
│ Weather & Forecasts   │ WeatherAPI.com (Free/Starter)│ Open-Meteo (Commercial Tier) │
│ Traffic & Incidents   │ HERE Technologies (Freemium) │ TomTom Traffic API           │
│ Government Alerts     │ NDMA SACHET (CAP XML Feed)   │ District Disaster Web/State  │
│ Air Quality (AQI)     │ OpenAQ API v3                │ data.gov.in (CPCB API)       │
│ Locality & Geocoding  │ Mapbox Search / Geocoding v6 │ Geoapify / OSM Photon        │
│ Local Public Events   │ In-House Curated Admin Store │ Community Submission Portal  │
│ Local Retail Prices   │ [FEATURE DEFERRED]           │ [FEATURE DEFERRED]           │
└───────────────────────┴──────────────────────────────┴──────────────────────────────┘
```

---

## 4. Analytical Commentary on Key Selections

### Why HERE Technologies Over Google Maps for Traffic
Google Maps Routes API costs $5.00 to $10.00 per 1,000 calls. A background poller checking 10 major transit corridors every 10 minutes would consume 1,440 calls daily (43,200 calls/month), immediately costing $216–$432 (₹18,000–₹36,000/month).
In contrast, **HERE Technologies grants 250,000 platform transactions per month for ₹0 under its Freemium tier**, with explicit commercial permissions. This single architectural decision preserves early-stage runway without sacrificing incident resolution in Delhi, Bengaluru, Mumbai, or Pune.

### Why WeatherAPI Over Open-Meteo
While Open-Meteo is widely celebrated in developer communities for its keyless free tier, its Terms of Service strictly forbid commercial use on that tier. Using Open-Meteo free tier in a commercial startup violates licensing and exposes the founder to retroactive invoicing (€29/mo minimum).
**WeatherAPI.com explicitly allows commercial use on its 100,000-call free tier**, clearly defines caching windows (60 min current, 24 hr forecast), and offers a predictable $4/mo (₹335/mo) upgrade to 1,000,000 calls.

### Why NDMA SACHET is an Architectural Superpower
NDMA SACHET provides the gold standard for disaster and hazardous weather data in India. Because it uses the international **CAP v1.2 XML standard**, alert payloads come pre-equipped with:
- Standardized severity (`Extreme`, `Severe`, `Moderate`)
- Urgency and certainty enumerations
- Affected geographic polygons and district codes
- Direct mitigation instructions from the Government of India
Parsing this free public feed delivers enterprise-level disaster intelligence with zero vendor lock-in or recurring API expense.
