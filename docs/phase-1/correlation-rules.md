# Deterministic Cross-Signal Correlation Specification

**Phase:** Phase 1 (Milestone 1)  
**Implemented Rule:** Scenario D — Monsoon Commute & Congestion Correlation  
**Rule Engine Version:** 1.0  

---

## 1. Principles of Deterministic Intelligence

MyArea24 does not use an LLM or statistical guesswork to decide whether events are related. The engine evaluates correlation strictly through **deterministic mathematical constraints**:
1. Spatial Proximity ($\le R_{\max}$)
2. Temporal Window Overlap ($\Delta T \le T_{\max}$)
3. Independent Signal Freshness ($\text{Age} \le 60\text{ min}$)
4. Compound Friction Thresholds ($\text{Rain} \ge \theta_{\text{rain}} \text{ AND } \text{Jam} \ge \theta_{\text{jam}}$)

---

## 2. Mathematical Rule Formulation (Scenario D)

### 2.1 Inputs
- Let $W = (lat_w, lon_w, t_w, P_{\text{mm}}, C_w)$ be a valid `WeatherObservation`.
- Let $T = (lat_t, lon_t, t_t, J_f, D_s, R_{\text{name}})$ be a valid `TrafficObservation`.
- Let $t_{\text{ref}}$ be the current evaluation timestamp in UTC.

### 2.2 Threshold Parameters (Configurable via `.env`)
- Rainfall Threshold: $\theta_{\text{rain}} = 8.0\text{ mm/hr}$ (`RULE_RAIN_THRESHOLD_MM_PER_HR`)
- Congestion Factor Threshold: $\theta_{\text{jam}} = 6.5\text{ / 10.0}$ (`RULE_JAM_FACTOR_THRESHOLD`)
- Queue Delay Threshold: $\theta_{\text{delay}} = 900\text{ seconds (15 min)}$ (`RULE_DELAY_THRESHOLD_SECONDS`)
- Maximum Spatial Radius: $R_{\max} = 5.0\text{ km}$ (`RULE_SPATIAL_RADIUS_KM`)
- Maximum Signal Age: $A_{\max} = 60\text{ minutes}$ (`RULE_SIGNAL_MAX_AGE_MINUTES`)
- Active Commute Window: $17:30 \le \text{Time}_{\text{IST}}(t_{\text{ref}}) \le 20:30$

### 2.3 Evaluation Pipeline

```
┌──────────────────────────────────────────────┐
│ Gate 1: Signal Freshness                     │
│ |t_ref - t_w| <= 60m  AND  |t_ref - t_t| <= 60m
└──────────────────────┬───────────────────────┘
                       │ PASS
                       ▼
┌──────────────────────────────────────────────┐
│ Gate 2: Geospatial Proximity                 │
│ Haversine(W, T) <= 5.0 km                    │
└──────────────────────┬───────────────────────┘
                       │ PASS
                       ▼
┌──────────────────────────────────────────────┐
│ Gate 3: Commute Window                       │
│ 17:30 <= Time_IST(t_ref) <= 20:30            │
└──────────────────────┬───────────────────────┘
                       │ PASS
                       ▼
┌──────────────────────────────────────────────┐
│ Gate 4: Compound Thresholds                  │
│ P_mm >= 8.0 mm/hr                            │
│ AND (                                        │
│   (J_f is not None AND J_f >= 6.5)           │
│   OR (D_s >= 900s)                           │
│   OR (Criticality in ("major", "critical"))  │
│ )                                            │
└──────────────────────┬───────────────────────┘
                       │ PASS
                       ▼
[ EMIT Scenario D Intelligence Insight Card ]
```

### 2.4 Provider Metric Handling & Alternative Rules

| Provider | Available Metrics | Evaluated Congestion Rule | Jam Factor Handling |
|---|---|---|---|
| **HERE Technologies** | `jamFactor` (0.0 - 10.0), `delay` (seconds) | $J_f \ge 6.5$ OR $D_s \ge 900\text{s}$ | Stored as reported |
| **TomTom Traffic** | `magnitudeOfDelay` (0-4), `delay` (seconds) | $D_s \ge 900\text{s}$ OR $\text{Criticality} \in \{\text{"major"}, \text{"critical"}\}$ | **Strictly None** (Never fabricated) |

### 2.5 Composite Severity Escalation
- **`severe`**: If $P_{\text{mm}} \ge 15.0\text{ mm/hr}$ OR $J_f \ge 8.0$ OR $D_s \ge 2400\text{s (40 min)}$ OR $\text{Criticality} = \text{"critical"}$
- **`high`**: Standard Scenario D match meeting all Gate 1-4 thresholds.

---

## 3. Geospatial Calculation: The Haversine Formula

To compute accurate spherical distances on WGS-84 without requiring PostGIS on local development machines, the engine uses the Haversine formula:

$$\Delta\phi = \text{radians}(lat_t - lat_w), \quad \Delta\lambda = \text{radians}(lon_t - lon_w)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\text{radians}(lat_w)) \cos(\text{radians}(lat_t)) \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \arcsin(\sqrt{a}), \quad d = R_{\text{earth}} \cdot c \quad (R_{\text{earth}} = 6371.0\text{ km})$$

If $d > 5.0\text{ km}$, the pair is rejected as geographically unrelated.

---

## 4. Idempotency & Deduplication

To prevent flooding user feeds with duplicate cards during repeated worker runs, the engine computes a deterministic SHA-256 fingerprint:

$$\text{DedupHash} = \text{SHA256}\Big(\text{AreaLabel} \,\|\, \text{WeatherID} \,\|\, \text{TrafficID} \,\|\, \text{Date}_{\text{ISO}}\Big)$$

If an insight with an identical `DedupHash` already exists in the database, the engine suppresses emission.

---

## 5. Expiry & Lifecycle Policy

Each generated insight is stamped with an explicit `expires_at` timestamp set to:

$$t_{\text{expires}} = t_{\text{ref}} + 90\text{ minutes}$$

When the background worker or API executes, any insight where $t_{\text{expires}} \le t_{\text{now}}$ is automatically marked `is_active = FALSE`, ensuring that users never view outdated advisories.
