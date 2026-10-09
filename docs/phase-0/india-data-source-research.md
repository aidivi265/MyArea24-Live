# India-Wide Data Source Feasibility Research

**Document Version:** 1.0  
**Phase:** Phase 0 (Product & Data Feasibility Validation)  
**Author:** Technical Researcher & Data Feasibility Analyst  
**Verification Date:** Current as of October 2026  

---

## 1. Executive Research Summary

This document presents an exhaustive, legally verified data source investigation across nine operational domains in India. Every candidate provider is evaluated based on official terms of service, developer documentation, pricing transparency, rate limits, caching legality, and solo-founder engineering overhead.

### Key Research Findings
1. **Weather:** Commercial-grade, hyper-local weather with clear commercial rights is readily accessible via **WeatherAPI.com** (100k calls/mo free, $4/mo starter) with strict, lawful caching rules (60 min current, 24 hr forecast). Open-Meteo is strictly non-commercial on its free tier (€29/mo for commercial).
2. **Traffic:** **HERE Technologies** provides an exceptional Freemium allowance (**250,000 transactions/month**) with explicit commercial rights and robust incident/flow APIs in major Indian metros. **TomTom** offers a viable secondary fallback (2,500 daily requests free).
3. **Air Quality:** Official CPCB data can be reliably ingested via **OpenAQ API v3** (free tier: 60 req/min, 2,000 req/hr) and **data.gov.in** National AQI API under Government Open Data License (GODL-India).
4. **Government Notices:** The **NDMA SACHET platform** provides standardized **CAP v1.2 (Common Alerting Protocol XML)** RSS feeds for disaster and extreme weather alerts with spatial bounding polygons, requiring zero API fees.
5. **Events & Hyperlocal Pricing:** High commercial friction. Ticketing platforms (BookMyShow, Insider) have **no public APIs** and prohibit scraping. Mandi prices on Agmarknet are wholesale agriculture rates, not retail. Hyperlocal event discovery must use curated admin/community intake during MVP.

---

## 2. Category-by-Category Source Deep Dive

---

### Category A: Weather and Forecasts

#### Candidate 1: WeatherAPI.com (Primary Recommendation)
- **Provider Name:** WeatherAPI (Bluesky Capital Ltd)
- **Website & Documentation:** [weatherapi.com](https://www.weatherapi.com/) | [Docs](https://www.weatherapi.com/docs/)
- **Exact API / Data Product:** Realtime Weather API (`/current.json`) & Forecast API (`/forecast.json`)
- **Data Provided:** Current temp, feels like, humidity, precipitation (mm/hr), cloud cover, wind speed/direction, 14-day hourly forecast, severe weather alerts.
- **Geographic Coverage in India:** Comprehensive India-wide coverage across all states, union territories, cities, and pincodes via global numerical weather models and station interpolation.
- **Query Resolution:** Supports exact latitude/longitude coordinates, city names, and Indian 6-digit Pincodes (Postal codes).
- **Update Frequency & Freshness:** Current conditions updated every 15–30 minutes; hourly forecasts updated every 1–3 hours.
- **Authentication:** API Key passed via query parameter (`key=...`) or HTTP header.
- **Free-Tier Limits:** **100,000 calls per month**, 5,000,000 calls/month on paid. No credit card required to start.
- **Paid Pricing:** Starter Plan at **$4/month (~₹335/mo)** for 1,000,000 calls/month; Pro Plan at **$15/month (~₹1,250/mo)** for 2,000,000 calls/month.
- **Commercial-Use Permissions:** **Explicitly allowed** on both Free and Paid plans.
- **Attribution Requirements:** Mandatory for Free plan users: must include a visible link back or "Powered by WeatherAPI.com" text/badge.
- **Caching & Storage Restrictions:** Legally permitted in Terms of Service: Current conditions data may be cached for **up to 60 minutes**; forecast data may be cached for **up to 24 hours**.
- **Rate Limits & Quota:** Rate limit generous (typically ~5 calls/sec on free tier).
- **Production Suitability:** **Yes.** Highly stable 99.9% uptime SLA on paid, excellent JSON response structure.
- **Integration Complexity:** **Very Low (1–2 days).** Single REST GET request.
- **Known Limitations & Fallbacks:** Microclimate convective rain cells (<1 km) in Indian monsoon can occasionally evade global model interpolation. Fallback: Open-Meteo or IMD SACHET warnings.

#### Candidate 2: Open-Meteo (Fallback Option)
- **Provider Name:** Open-Meteo GmbH
- **Website & Documentation:** [open-meteo.com](https://open-meteo.com/) | [Docs](https://open-meteo.com/en/docs)
- **Exact API / Data Product:** Weather Forecast API (`api.open-meteo.com/v1/forecast`)
- **Data Provided:** Temperature, precipitation probability, rain, convective showers, wind speed, solar radiation.
- **Geographic Coverage in India:** India-wide via ECMWF IFS (9 km), GFS (13 km), and DWD ICON global models.
- **Query Resolution:** Coordinate-based (`latitude`, `longitude`).
- **Update Frequency:** Models refresh 4 times daily (every 6 hours).
- **Authentication:** No API key required for non-commercial free tier; API key required for commercial paid tier.
- **Free-Tier Limits:** Up to 10,000 requests/day for **strictly non-commercial** personal/open-source use.
- **Commercial-Use Permissions:** **STRICT PROHIBITION on Free Tier.** Commercial applications **must** subscribe to paid plan starting at **€29/month (~₹2,650/mo)** for 1,000,000 calls/month.
- **Attribution:** Open-Meteo attribution and Creative Commons BY 4.0 for model data.
- **Caching Restrictions:** Permitted locally as long as redistributed data respects CC-BY 4.0.
- **Production Suitability:** **Yes**, on paid commercial subscription.
- **Solo-Founder Verdict:** Keep as secondary fallback. Do not use free tier in a commercial startup.

#### Candidate 3: IMD (India Meteorological Department) / Mausam Portal
- **Provider Name:** Ministry of Earth Sciences, Govt of India
- **Website:** [mausam.imd.gov.in](https://mausam.imd.gov.in/)
- **API Status:** **No unified, stable public REST API with developer keys.** Data is primarily published as district bulleted PDFs, web GIS layers, and RSS notices on NDMA SACHET.
- **Production Suitability:** **Unsuitable for direct REST integration.** Use indirect IMD warnings via NDMA SACHET CAP XML feed.

---

### Category B: Traffic and Routing

#### Candidate 1: HERE Technologies (Primary Recommendation)
- **Provider Name:** HERE Global B.V.
- **Website & Documentation:** [developer.here.com](https://developer.here.com/) | [Docs](https://www.here.com/docs/)
- **Exact API / Data Product:** 
  1. HERE Traffic API v7 — Incidents (`/v7/incidents`)
  2. HERE Traffic API v7 — Flow (`/v7/flow`)
  3. HERE Routing API v8 (`/v8/routes`)
- **Data Provided:** Real-time traffic congestion, jams, incidents (road construction, accidents, lane closures), estimated delay (seconds), speed vs free-flow speed, jam factor (0–10).
- **Geographic Coverage in India:** Tier-1 and Tier-2 urban metropolitan regions (Delhi-NCR, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, Jaipur, Lucknow, Chandigarh, etc.) and major National Highway networks.
- **Query Resolution:** Bounding box (`in=bbox:minLon,minLat,maxLon,maxLat`), corridor, or circle around coordinate.
- **Update Frequency:** Real-time; flow refreshed every 1–2 minutes; incident feeds refreshed continuously.
- **Authentication:** API Key passed as query parameter `apiKey={YOUR_KEY}`.
- **Free-Tier Limits:** **Freemium plan includes 250,000 platform transactions per month at ₹0.**
- **Paid Pricing:** Pay-As-You-Grow: **$1.00 per additional 1,000 transactions** (~₹84 per 1k calls). Pro plan starts at $449/mo (1M calls).
- **Commercial-Use Permissions:** **Explicitly allowed on Freemium plan** for public and commercial commercial products.
- **Attribution Requirements:** Must display HERE logo/copyright on map outputs if displayed visually; for raw data processing, standard license compliance.
- **Caching & Storage Restrictions:** Caching allowed for performance optimization (e.g., in-memory 5-minute cache), but permanent offline storage of traffic data is prohibited.
- **Rate Limits:** Default rate limit of ~50 requests/sec.
- **Production Suitability:** **Excellent.** Enterprise-grade availability and documentation.
- **Integration Complexity:** **Medium (3–4 days).** GeoJSON / Protocol Buffers parsing.
- **Known Limitations & Fallbacks:** Coverage drops to basic arterial roads in Tier-3/rural districts. Fallback: TomTom Traffic API.

#### Candidate 2: TomTom (Fallback Option)
- **Provider Name:** TomTom International BV
- **Website & Documentation:** [developer.tomtom.com](https://developer.tomtom.com/) | [Traffic API](https://developer.tomtom.com/traffic-api/documentation/traffic-api/product-overview)
- **Exact API / Data Product:** Traffic Incidents API (`/traffic/services/5/incidentDetails`) & Traffic Flow API
- **Data Provided:** Incident details (type, severity, delay, description), flow segments, road closures.
- **Geographic Coverage in India:** Major Indian cities and expressways.
- **Free-Tier Limits:** **2,500 non-tile requests/day (~75,000 calls/month)** free.
- **Commercial-Use Permissions:** **Permitted** on Freemium tier.
- **Paid Pricing:** Pay-As-You-Grow at **$0.50 per 1,000 requests** above free allowance.
- **Solo-Founder Verdict:** Strong alternative. 2,500 daily requests provides an instant redundancy fallback if HERE experiences outage or quota pressure.

#### Candidate 3: Google Maps Platform (Directions / Routes API)
- **Provider Name:** Google LLC
- **Status for Early MVP:** **High Cost Barrier.** Routes API costs **$5.00 to $10.00 per 1,000 requests** (with limited $200 recurring credit). Strict caching terms (cannot cache lat/long coordinates or route polylines past 30 days; cannot store live traffic data).
- **Solo-Founder Verdict:** Not recommended as primary traffic poller for background intelligence due to runaway cost risk.

---

### Category C: Public Events

#### Candidate 1: BookMyShow & Paytm Insider
- **Status:** **NO Public Developer API.**
- **Licensing & Terms:** Both platforms strictly prohibit programmatic automated crawling or scraping in their Terms of Use. Active Cloudflare bot protections will lead to IP blacklisting and potential legal notice.
- **Verdict:** **Completely Infeasible for Automated API Ingestion.**

#### Candidate 2: Eventbrite API
- **Provider Name:** Eventbrite, Inc.
- **Website & Documentation:** [eventbrite.com/platform/api](https://www.eventbrite.com/platform/api/)
- **Data Provided:** Events, venues, categories, start/end timestamps.
- **Coverage in India:** **Critically poor.** Covers fewer than 2–5% of actual local events in India (almost exclusively corporate webinars, expatriate networking, or Bengaluru developer summits). Lacks local melas, college fests, sporting matches, religious events.
- **Pricing:** Free API access (monetizes on ticketing fee). Rate limit: 2,000 calls/hour.
- **Verdict:** Unsuitable for hyper-local civic/neighborhood intelligence in India.

#### Candidate 3: AllEvents.in API
- **Website:** [allevents.developer.azure-api.net](https://allevents.developer.azure-api.net/)
- **Terms & Cost:** **Explicitly prohibits hobbyist/early prototype access.** Requires enterprise licensing inquiry typically starting at **$500/month (~₹42,000/mo)**.
- **Verdict:** Prohibitive for a bootstrapped solo founder.

#### Candidate 4: Curated Admin Ingest & Community Submission Form (Recommended MVP Solution)
- **Mechanism:** Internal database table (`local_events`) populated via:
  1. Founder/Admin manual entry of high-impact scheduled gatherings (e.g., Delhi Half Marathon, Dussehra processions, IPL match traffic advisories, Pragati Maidan exhibitions).
  2. Verified organizer submission portal (free web form where event organizers submit venue, expected footfall, and hours, subject to admin one-click approval).
- **Cost:** **₹0.**
- **Accuracy:** **100% verified**, zero scraping liability, guaranteed hyper-local relevance.

---

### Category D: Government Notices and Public Advisories

#### Candidate 1: NDMA SACHET Platform (Primary Recommendation)
- **Provider Name:** National Disaster Management Authority (NDMA) & Centre for Development of Telematics (C-DOT)
- **Website & Documentation:** [sachet.ndma.gov.in](https://sachet.ndma.gov.in/)
- **Exact Product:** Common Alerting Protocol (CAP) v1.2 Compliant RSS Feeds (`sachet.ndma.gov.in/rss/...`)
- **Data Provided:** Integrated disaster alerts from IMD (severe rain, cyclone, heatwave, thunderstorm), Central Water Commission (CWC - flood alerts), INCOIS (tsunami/ocean surge), Forest Survey of India (forest fire), and DGRE (avalanche). Includes severity (Extreme, Severe, Moderate), urgency, certainty, affected polygon/geocodes, and recommended public actions.
- **Geographic Coverage in India:** **100% Nationwide coverage across all 28 states and 8 union territories at district level.**
- **Query Resolution:** Feeds published by State / National level with embedded geo-targeted polygons and district FIPS/Census codes.
- **Update Frequency:** Real-time updates pushed immediately upon hazard issuance.
- **Authentication:** Publicly accessible RSS/XML endpoints.
- **Free-Tier Limits / Cost:** **100% Free public service (₹0).**
- **Commercial-Use Permissions:** Standard public safety dissemination mandate. Data is public government alert information designed for universal redistribution.
- **Attribution:** "Source: National Disaster Management Authority (NDMA) / SACHET".
- **Caching & Storage:** Freely cacheable and archival for audit provenance.
- **Integration Complexity:** **Medium (2–3 days).** Requires parsing CAP v1.2 XML tags (`<info>`, `<area>`, `<polygon>`, `<severity>`, `<headline>`).
- **Production Suitability:** **High.** The single most authoritative public alert feed in the Republic of India.

#### Candidate 2: Press Information Bureau (PIB) RSS Feeds
- **Website:** [pib.gov.in](https://pib.gov.in/)
- **Product:** Ministry-wise RSS feeds (e.g., Ministry of Power, Road Transport & Highways).
- **Format:** Unstructured press releases in English and regional languages. Requires NLP entity extraction to identify locations and dates.
- **Verdict:** Phase 2 candidate for civic policy intelligence.

---

### Category E: Air Quality Index (AQI)

#### Candidate 1: OpenAQ API v3 (Primary Recommendation)
- **Provider Name:** OpenAQ, Inc. (501(c)(3) open data collective)
- **Website & Documentation:** [openaq.org](https://openaq.org/) | [Docs](https://docs.openaq.org/)
- **Exact API / Data Product:** OpenAQ REST API v3 (`/v3/locations`, `/v3/sensors`, `/v3/measurements`)
- **Data Provided:** Real-time and historical concentrations of PM2.5, PM10, NO2, SO2, CO, O3 from official government monitoring stations.
- **Geographic Coverage in India:** Ingests official continuous monitoring stations from CPCB (Central Pollution Control Board), State Pollution Control Boards (SPCBs - DPCC, KSPCB, MPCB), and US State Department monitors across 250+ Indian cities.
- **Query Resolution:** Station coordinates (`coordinates`), radius search (`radius=10000`), country (`country_id=IN`).
- **Update Frequency:** Hourly to 15-minute sensor updates.
- **Authentication:** Free API Key via HTTP header (`X-API-Key: ...`).
- **Free-Tier Limits:** **60 requests per minute, 2,000 requests per hour (~1.4M requests/month)**.
- **Cost:** **100% Free** under standard tier. Custom pricing for higher enterprise throughput.
- **Commercial-Use Permissions:** Permitted with attribution under open data licensing (CC BY 4.0 / Open Government Data).
- **Attribution:** Must state "Data provided by OpenAQ / CPCB".
- **Caching Restrictions:** Caching permitted; hourly caching recommended.
- **Production Suitability:** **Very High.** Clean, highly normalized JSON schema.
- **Integration Complexity:** **Low (1 day).**

#### Candidate 2: data.gov.in (National Air Quality Index API)
- **Provider Name:** National Informatics Centre (NIC) / CPCB
- **Website:** [data.gov.in](https://data.gov.in/)
- **Product:** Real-time National Air Quality Index by CPCB
- **Data Provided:** Station-wise AQI value, prominent pollutant, sub-index values.
- **Licensing:** Government Open Data License — India (GODL). Free commercial use with attribution.
- **Limitations:** Portal availability occasionally suffers from intermittent latency or maintenance downtime.
- **Verdict:** Excellent secondary backend fallback for OpenAQ.

---

### Category F: Geocoding, Locality Search, and Maps

#### Candidate 1: Mapbox (Primary Recommendation for Search & Vector Maps)
- **Provider Name:** Mapbox, Inc.
- **Website & Documentation:** [mapbox.com](https://www.mapbox.com/) | [Docs](https://docs.mapbox.com/)
- **Exact Products:** Mapbox Geocoding v6, Search Box API, Vector Tile SDKs.
- **Coverage in India:** Extensive street and locality index.
- **Free-Tier Limits:** **100,000 temporary geocoding requests/month free; 50,000 map loads/month free.**
- **Paid Pricing:** $0.75 per 1,000 geocoding requests thereafter.
- **Commercial Use:** Allowed on free and pay-as-you-go tiers.
- **Caching:** Temporary geocodes for display may not be permanently stored, but session caching is permitted. Permanent storage of lat/long requires Mapbox Permanent Geocoding API ($5/1k calls).

#### Candidate 2: OpenStreetMap Nominatim (Self-Hosted / Photon Fallback)
- **Provider / License:** OpenStreetMap Foundation / ODbL (Open Database License)
- **Public Server Rules:** `nominatim.openstreetmap.org` has a strict usage policy: **Max 1 request per second**, strictly no heavy automated batching, requires valid User-Agent header. Public server cannot be used for commercial production traffic.
- **Production Solution:** Deploy a lightweight self-hosted **Photon geocoder** (Elasticsearch-based OSM index) or use **Geoapify** free tier (3,000 credits/day).

#### Candidate 3: Mappls (MapmyIndia)
- **Website:** [mappls.com](https://about.mappls.com/api/)
- **Coverage:** The gold standard for house-number and pin-point village/sub-locality accuracy in India.
- **Pricing:** No public, self-serve transparent free tier. Commercial usage requires manual sales inquiry and monthly enterprise retainers.
- **Verdict:** Phase 2 candidate once unit economics and commercial revenues support minimum spend.

---

### Category G: Local Prices and Product Availability

#### Candidate 1: Agmarknet via data.gov.in
- **Data Provided:** Daily APMC Mandi wholesale commodity prices (wheat, rice, potato, onion, tomato) across agricultural markets.
- **Coverage:** Rural and semi-urban agricultural mandis.
- **Consumer Hyperlocal Reality:** **Irrelevant for urban retail consumers.** Wholesale mandi prices do not reflect local retail kirana, supermarket, or quick-commerce shelf prices in Rohini or Indiranagar.

#### Candidate 2: Quick Commerce (Blinkit, Zepto, Swiggy Instamart)
- **API Status:** **Zero public APIs.**
- **Legal/Technical Reality:** Highly protected private APIs with aggressive Cloudflare/DataDome bot protection, token rotation, and dynamic dark-store routing. Automated scraping violates Terms of Service, risks criminal/civil complaints under the Indian Information Technology Act (2000), and introduces acute fragility.
- **Verdict:** **DEFER ENTIRELY.** Not viable for a solo founder.

---

### Category H: Community Reports and Local Incidents

#### Architecture & Source: In-House Moderated Event Store
- **Mechanism:** Since no unified open civic API exists across India's 4,000+ urban local bodies, MyArea24 must host an internal PostgreSQL table (`community_signals`).
- **Input Strategy:** In early MVP, restrict user input to **"Signal Verification"** (e.g., clicking *"Confirm waterlogging here"* or *"Report road cleared"*) rather than freeform text/social posting. This eliminates defamation, hate speech, spam, and manual moderation burdens.
- **Operating Cost:** Included in primary backend database.
- **Solo-Founder Feasibility:** **High** when restricted to structured boolean/enum verification.

---

## 3. Data Source Architecture Summary Table

| Domain | Primary Source | Fallback Source | Monthly Free Cap | Commercial License | Production Ready |
|---|---|---|---|---|---|
| **Weather** | WeatherAPI.com | Open-Meteo (Paid) / OWM | 100,000 calls | Yes (Explicit) | **Yes** |
| **Traffic** | HERE Traffic API v7 | TomTom Traffic API | 250,000 calls | Yes (Explicit) | **Yes** |
| **Government Notices** | NDMA SACHET (CAP XML) | State DMA Portals | Unlimited (Public RSS) | Yes (Open Public Alert) | **Yes** |
| **Air Quality** | OpenAQ API v3 | data.gov.in (CPCB) | 1,400,000 calls | Yes (CC BY 4.0 / GODL) | **Yes** |
| **Locality / Geocoding** | Mapbox Search / Pelias | Geoapify / OSM Photon | 100,000 calls | Yes (Explicit) | **Yes** |
| **Public Events** | Curated Admin / User Ingest | N/A | N/A (Internal DB) | Full Ownership | **Yes** |
| **Local Prices** | *None viable* | *Deferred* | N/A | N/A | **DEFERRED** |
| **Community Reports** | In-House Verification Engine | N/A | N/A (Internal DB) | Full Ownership | **Yes** |
