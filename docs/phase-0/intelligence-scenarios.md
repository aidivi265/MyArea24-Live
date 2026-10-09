# Cross-Signal Intelligence Scenarios & Feasibility Validation

**Document Version:** 1.0  
**Phase:** Phase 0 (Product & Data Feasibility Validation)  
**Author:** Product Architect & Technical Researcher  

---

## 1. Principles of Cross-Signal Intelligence

The defining differentiator of MyArea24 is **compound intelligence**—synthesizing multiple orthogonal data streams into high-confidence, actionable neighborhood insights.

To prevent hallucinations, false alarms, and spurious correlations, the engine follows three strict mathematical and architectural rules:

1. **Deterministic Correlation Precedes AI Synthesis:** Spatio-temporal alignment is evaluated entirely by mathematical geometry (spatial distance $\le D$ km, temporal overlap $\Delta T \le T_{\max}$, threshold gates). The LLM is NEVER allowed to guess whether two events are related.
2. **Strict Provenance & Transparency:** Every insight explicitly embeds its source IDs, observation timestamps, freshness age, and an algorithmic Confidence Score ($0.0 \text{ to } 1.0$).
3. **The "Insufficient Evidence" Gate:** If incoming data fails threshold bounds (e.g., rainfall is $< 2.5\text{ mm/hr}$ or incident report is stale $> 60\text{ min}$), the system suppresses compound insight generation and emits either isolated cards or an explicit "Normal conditions" state.

---

## 2. Deep Investigation of the Four Intelligence Scenarios

---

### Scenario A: Event + Weather (Outdoor Gathering Hazard)

#### User Problem
A resident plans to attend an outdoor cultural mela, college fest, or cricket match in Rohini, Delhi at 7:00 PM. A thunderstorm or heavy downpour is forecast during the event window.

#### Detailed Specification
- **Required Inputs:**
  1. `Event`: Title, venue coordinates, start/end timestamps, outdoor/indoor flag.
  2. `Weather`: Hourly forecast precipitation probability ($\%$) and precipitation amount ($\text{mm/hr}$), convective storm alert.
- **Realistic Data Sources:**
  - *Event Source:* MyArea24 Curated/Community Event Store.
  - *Weather Source:* WeatherAPI.com `/forecast.json` (hourly) + NDMA SACHET thunderstorm CAP alert.
- **Geographic & Temporal Precision:**
  - *Spatial:* Event venue point with a $2.5\text{ km}$ spatial bounding radius.
  - *Temporal:* $\pm 2\text{ hours}$ around event start/end window.
- **Data Freshness Requirements:** Weather forecast $\le 90\text{ minutes}$ old; active radar/alert $\le 30\text{ minutes}$ old.
- **Correlation Logic (Deterministic Rule):**
  $$\text{IF } \text{Distance}(\text{Event}_{\text{loc}}, \text{Weather}_{\text{loc}}) \le 3.0\text{ km}$$
  $$\text{AND } \text{Overlap}(\text{Event}_{\text{time}}, \text{Weather}_{\text{window}}) = \text{TRUE}$$
  $$\text{AND } \text{Precipitation} \ge 5.0\text{ mm/hr} \text{ OR } \text{StormRisk} = \text{HIGH}$$
  $$\text{AND } \text{Event}_{\text{venue\_type}} = \text{OUTDOOR}$$
  $$\implies \text{Trigger Scenario A Impact Generator}$$
- **Confidence Scoring Formula:**
  $$C_A = 0.5 \times \text{SourceReliability}(\text{Weather}) + 0.3 \times \text{FreshnessDecay} + 0.2 \times \text{EventVerificationScore}$$
- **MVP Implementation Boundary:**
  - *Feasible in MVP:* Fully feasible using curated/admin-entered events and hourly WeatherAPI forecast data.
  - *Not Feasible:* Automated ingestion of all minor local club events from unverified social media.
- **Expected Cost:** Negligible. Weather API cached hourly (1 call per locality per hour). Ingest cost = ₹0.

#### Sample Grounded Output Card
```json
{
  "insight_id": "INS-DEL-2026-A01",
  "scenario_type": "EVENT_WEATHER_HAZARD",
  "headline": "Outdoor Event Disruption Risk: Rohini Mela Grounds",
  "summary": "Heavy rain (12-16 mm/hr) and thunderstorm activity forecast between 6:30 PM and 9:00 PM will directly impact the open-air Dussehra Exhibition at Sector 11.",
  "impact_level": "HIGH",
  "confidence_score": 0.88,
  "recommendations": [
    "Carry waterproof protection or expect early closure of open-air stalls.",
    "Expect waterlogging at the Sector 11 entry gate and adjoining service road."
  ],
  "evidence_sources": [
    {
      "provider": "WeatherAPI.com",
      "metric": "Precipitation 14.2 mm/hr, Thunderstorm Likely",
      "timestamp": "2026-10-09T17:15:00+05:30",
      "freshness_minutes": 20
    },
    {
      "provider": "MyArea24 Curated Events",
      "event_name": "Rohini Annual Cultural Mela",
      "venue": "Sector 11 District Park (Outdoor)",
      "scheduled_time": "18:00 - 22:00 IST",
      "verified_by": "Admin Verification"
    }
  ]
}
```

---

### Scenario B: Event + Traffic (Congestion Bottleneck)

#### User Problem
A major public gathering (IPL match, trade exhibition at Bharat Mandapam, or political rally) will draw 25,000+ attendees, bottlenecking surrounding arterial transit routes.

#### Detailed Specification
- **Required Inputs:**
  1. `Event`: Venue coordinates, capacity/expected footfall, access corridors.
  2. `Traffic`: HERE Traffic Flow speed factor, HERE Traffic Incidents (road closures, congestion queues).
- **Realistic Data Sources:**
  - *Event Source:* Curated High-Impact Event Store.
  - *Traffic Source:* HERE Traffic API v7 (`/v7/incidents` and `/v7/flow`).
- **Geographic & Temporal Precision:**
  - *Spatial:* Bounding box of $3.0\text{ km}$ along primary arterial access corridors.
  - *Temporal:* $T_{\text{start}} - 2.5\text{ hours}$ to $T_{\text{end}} + 1.5\text{ hours}$.
- **Data Freshness Requirements:** Traffic incident and flow data $\le 10\text{ minutes}$ old.
- **Correlation Logic (Deterministic Rule):**
  $$\text{IF } \text{Event}_{\text{footfall}} \ge 5000$$
  $$\text{AND } \text{Distance}(\text{CorridorSegment}, \text{Venue}) \le 2.5\text{ km}$$
  $$\text{AND } \text{HERE}_{\text{JamFactor}} \ge 7.0 \text{ (Severe Congestion)}$$
  $$\implies \text{Emit Scenario B Corridor Bottleneck Warning}$$
- **MVP Implementation Boundary:**
  - *Feasible in MVP:* Polling HERE Incidents around 5–10 known major venues in target pilot zones (e.g., JLN Stadium, Pragati Maidan, Chinnaswamy Stadium, BKC).
  - *Not Feasible:* Dynamic predictive microsimulation of traffic diversion for spontaneous unannounced gatherings.
- **Expected Cost:** 1 HERE API query every 10 minutes per active high-impact event window (~36 queries per event day = ~₹0 within the 250,000 free transaction pool).

#### Sample Grounded Output Card
```json
{
  "insight_id": "INS-DEL-2026-B04",
  "scenario_type": "EVENT_TRAFFIC_CONGESTION",
  "headline": "Severe Corridor Bottleneck: Mathura Road / Pragati Maidan",
  "summary": "Trade Expo entry queues combined with reported lane restriction at Bhairon Marg have caused severe gridlock (Jam Factor 8.4/10). Transit delays exceed 35 minutes.",
  "impact_level": "SEVERE",
  "confidence_score": 0.92,
  "recommendations": [
    "Avoid Mathura Road and Bhairon Marg until 20:30 IST.",
    "Commuters bound for South Delhi should divert via Ring Road or utilize the Delhi Metro Supreme Court station."
  ],
  "evidence_sources": [
    {
      "provider": "HERE Traffic API v7",
      "incident_id": "HERE-INC-DEL-9921",
      "jam_factor": 8.4,
      "delay_seconds": 2180,
      "timestamp": "2026-10-09T18:10:00+05:30",
      "freshness_minutes": 5
    },
    {
      "provider": "MyArea24 Curated Events",
      "event_name": "International Trade Conclave",
      "expected_footfall": "35,000 attendees",
      "timestamp": "2026-10-09T10:00:00+05:30"
    }
  ]
}
```

---

### Scenario C: Government Notice + Location (Civic Disruption Context)

#### User Problem
A district disaster bulletin or municipal advisory announces a localized Section 144 order, major water/power supply maintenance, or flood evacuation watch. Users need to know instantly if their home or office is within the affected polygon.

#### Detailed Specification
- **Required Inputs:**
  1. `Gov Notice`: Official CAP v1.2 XML payload containing `<area>`, `<polygon>`, `<circle>`, `<headline>`, `<description>`, `<severity>`, `<effective>`, `<expires>`.
  2. `User Saved Locations`: User home/work coordinates and active GPS locality.
- **Realistic Data Sources:**
  - NDMA SACHET CAP XML RSS Feeds (`sachet.ndma.gov.in`).
- **Geographic & Temporal Precision:**
  - *Spatial:* Point-in-Polygon (PIP) ray-casting algorithm matching user coordinate inside CAP polygon or district FIPS/Census code.
  - *Temporal:* Match active window between `<effective>` and `<expires>` ISO-8601 timestamps.
- **Data Freshness Requirements:** SACHET XML parsed every 15 minutes.
- **Correlation Logic (Deterministic Rule):**
  $$\text{PointInPolygon}(\text{User}_{\text{lat,lon}}, \text{Alert}_{\text{polygon}}) = \text{TRUE}$$
  $$\text{AND } \text{Alert}_{\text{effective}} \le \text{CurrentTime} \le \text{Alert}_{\text{expires}}$$
  $$\implies \text{Generate High-Priority Civic Bulletin}$$
- **Confidence Scoring:** $1.00$ (Authoritative Government Instrument). Zero AI ambiguity.
- **MVP Implementation Boundary:**
  - *Feasible in MVP:* 100% Nationwide coverage for all NDMA/IMD CAP disaster advisories.
  - *Not Feasible:* Unstructured ward-level municipal PDF circulars (e.g., local 3-hour water pipe repairs published in local languages without machine-readable geocodes).
- **Expected Cost:** ₹0 (Public government RSS feed, minimal CPU parsing).

#### Sample Grounded Output Card
```json
{
  "insight_id": "INS-CAP-2026-C19",
  "scenario_type": "GOVERNMENT_CIVIC_ADVISORY",
  "headline": "Official Disaster Warning: Severe Waterlogging & Inundation Alert",
  "summary": "NDMA / IMD Orange Alert issued for North-West Delhi districts. Anticipated localized flooding of underpasses and low-lying residential sectors until 23:00 IST.",
  "impact_level": "SEVERE",
  "confidence_score": 1.0,
  "recommendations": [
    "Avoid non-essential travel in low-lying zones.",
    "Keep emergency civic helplines accessible (Disaster Control Room 1077)."
  ],
  "evidence_sources": [
    {
      "provider": "NDMA SACHET (Govt of India)",
      "cap_identifier": "NDMA-CAP-2026-DEL-0841",
      "severity": "Severe",
      "certainty": "Observed",
      "timestamp": "2026-10-09T16:00:00+05:30",
      "freshness_minutes": 35
    }
  ]
}
```

---

### Scenario D: Weather + Traffic + Local Activity (The Compound Master Scenario)

#### User Problem
The hallmark Indian urban crisis: Heavy evening rain strikes precisely during peak commute hours, compounding existing construction bottlenecks into crippling gridlock.

#### Detailed Specification
- **Required Inputs:**
  1. `Weather`: Current precipitation rate $> 8\text{ mm/hr}$ or heavy rain forecast in next 60 min.
  2. `Traffic`: HERE Jam Factor $\ge 6.5$ or active road restriction/incident.
  3. `Local Activity`: Active peak commute window ($17:30\text{--}20:30\text{ IST}$) or nearby scheduled public exit.
- **Realistic Data Sources:**
  - WeatherAPI.com (Realtime + Forecast)
  - HERE Traffic API v7 (Incidents & Flow)
  - Deterministic Urban Clock & Node Registry (known historical bottleneck nodes)
- **Geographic & Temporal Precision:**
  - *Spatial:* $3.0\text{ km}$ radius buffer around known urban transit nodes (e.g., AIIMS Circle, Silk Board, Cyber Hub, Hinjewadi Phase 1).
  - *Temporal:* Real-time active window ($\Delta t \le 15\text{ minutes}$).
- **Correlation Logic (Deterministic Rule):**
  $$\text{IF } \text{Weather}_{\text{rain\_rate}} \ge 8.0\text{ mm/hr}$$
  $$\text{AND } \text{Traffic}_{\text{jam\_factor}} \ge 6.5 \text{ within } 3.0\text{ km}$$
  $$\text{AND } \text{TimeOfDay} \in [\text{PeakRushHours}]$$
  $$\implies \text{Trigger Scenario D Compound Insight Generator}$$
- **AI Synthesis Guardrail:**
  The LLM receives a strictly typed JSON payload containing:
  ```json
  {
    "rain_mm_hr": 14.5,
    "traffic_delay_min": 32,
    "jam_factor": 8.1,
    "incident_desc": "Water accumulation reported at Moolchand underpass",
    "transit_corridor": "Ring Road Southbound"
  }
  ```
  The prompt instructs: *"Summarize the compound friction strictly based on the above facts. Do not invent road names or casualty numbers. Output in 3 sentences."*
- **MVP Implementation Boundary:**
  - *Feasible in MVP:* This is the **flagship MVP demonstration**. Implemented across 10 defined commuter corridors in Delhi-NCR and Bengaluru.
- **Expected Cost:** 
  - Weather API: Ingested every 30 min = 48 calls/corridor/day.
  - HERE Traffic: Ingested every 10 min = 144 calls/corridor/day.
  - Gemini 1.5 Flash: 1 call per compound event (~500 tokens = ~₹0.005). Total monthly cost for 10 corridors < ₹250.

#### Sample Grounded Output Card
```json
{
  "insight_id": "INS-DEL-2026-D88",
  "scenario_type": "COMPOUND_WEATHER_TRAFFIC",
  "headline": "Monsoon Gridlock Alert: South Ring Road Corridor",
  "summary": "Heavy rainfall (14.5 mm/hr) has coincided with evening peak traffic, triggering acute delays (+32 min) between Lajpat Nagar and AIIMS. Surface water accumulation is reducing carriageway capacity.",
  "impact_level": "SEVERE",
  "confidence_score": 0.94,
  "recommendations": [
    "Expect 30-45 minute additional transit time across South Ring Road.",
    "Prioritize Delhi Metro Pink/Yellow line interchanges over surface road transit."
  ],
  "evidence_sources": [
    {
      "provider": "WeatherAPI.com",
      "metric": "Precipitation 14.5 mm/hr, Heavy Rain",
      "timestamp": "2026-10-09T18:15:00+05:30",
      "freshness_minutes": 8
    },
    {
      "provider": "HERE Traffic API v7",
      "metric": "Jam Factor 8.1/10, Delay +32 min",
      "timestamp": "2026-10-09T18:18:00+05:30",
      "freshness_minutes": 5
    }
  ]
}
```

---

## 3. Feasibility Summary & Comparison

| Scenario | Core Signals | Data Sources Required | Feasible in MVP? | Est. Monthly Cost (Beta) |
|---|---|---|:---:|:---:|
| **Scenario A** | Event + Weather | Curated DB + WeatherAPI | **YES** | < ₹50 |
| **Scenario B** | Event + Traffic | Curated DB + HERE Incidents | **YES** | < ₹100 |
| **Scenario C** | Govt Notice + Location | NDMA SACHET CAP XML | **YES** | ₹0 |
| **Scenario D** | Weather + Traffic + Commute | WeatherAPI + HERE + Urban Clock | **YES (Flagship)** | < ₹250 |
