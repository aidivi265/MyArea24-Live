import datetime
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.app.core.config import settings
from backend.app.database.models import WeatherObservation, TrafficObservation, GovernmentNotice
from backend.app.intelligence.schemas import (
    AreaInfo,
    IntelligenceInsightOutput,
    RuleEvaluationResult,
    SignalProvenance,
)

IST_TIMEZONE = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.asin(math.sqrt(a))
    return R * c


def point_in_geojson_polygon(lat: float, lon: float, polygon_geojson: Dict[str, Any]) -> bool:
    """Ray-casting algorithm for GeoJSON Polygon [lon, lat] coordinates."""
    try:
        coords = polygon_geojson.get("coordinates", [])
        if not coords:
            return False
        ring = coords[0]
        n = len(ring)
        if n < 3:
            return False
        inside = False
        p1x, p1y = ring[0][0], ring[0][1]  # p1x is lon, p1y is lat
        for i in range(1, n + 1):
            p2x, p2y = ring[i % n][0], ring[i % n][1]
            if lat > min(p1y, p2y):
                if lat <= max(p1y, p2y):
                    if lon <= max(p1x, p2x):
                        if p1y != p2y:
                            xints = (lat - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or lon <= xints:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside
    except Exception:
        return False


def is_point_in_circle(
    lat: float,
    lon: float,
    circle_geojson: Dict[str, Any],
    buffer_km: float = 5.0,
) -> bool:
    """Checks whether a point falls within a circle geometry plus buffer."""
    try:
        c_lat = float(circle_geojson.get("latitude", 0.0))
        c_lon = float(circle_geojson.get("longitude", 0.0))
        radius_km = float(circle_geojson.get("radius_km", 0.0))
        dist = haversine_distance_km(lat, lon, c_lat, c_lon)
        return dist <= (radius_km + buffer_km)
    except Exception:
        return False


def is_notice_relevant_to_locality(
    notice: GovernmentNotice,
    loc_name: str,
    loc_lat: float,
    loc_lon: float,
    buffer_km: float = 10.0,
) -> bool:
    """Determines if an official notice is geographically relevant to a locality."""
    if notice.circle_geojson and is_point_in_circle(loc_lat, loc_lon, notice.circle_geojson, buffer_km):
        return True
    if notice.polygon_geojson and point_in_geojson_polygon(loc_lat, loc_lon, notice.polygon_geojson):
        return True
    norm_area = (notice.area_description or "").lower()
    norm_loc = loc_name.lower()
    keywords = [k.strip() for k in norm_loc.replace(",", " ").split() if len(k.strip()) > 3]
    if norm_loc in norm_area or any(kw in norm_area for kw in keywords):
        return True
    if "all india" in norm_area or "national" in norm_area or "delhi" in norm_area and "delhi" in norm_loc:
        return True
    return False


def is_valid_coordinate(lat: Optional[float], lon: Optional[float]) -> bool:
    """Verifies that latitude and longitude are non-null and within valid Earth bounds."""
    if lat is None or lon is None:
        return False
    if math.isnan(lat) or math.isnan(lon):
        return False
    return -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0


def is_within_time_window(
    eval_time_utc: datetime.datetime,
    start_str: str = "17:30",
    end_str: str = "20:30",
) -> bool:
    """Checks whether the evaluation time falls within the configured IST time window."""
    ist_time = eval_time_utc.replace(tzinfo=datetime.timezone.utc).astimezone(IST_TIMEZONE)
    start_h, start_m = map(int, start_str.split(":"))
    end_h, end_m = map(int, end_str.split(":"))

    current_minutes = ist_time.hour * 60 + ist_time.minute
    start_minutes = start_h * 60 + start_m
    end_minutes = end_h * 60 + end_m

    return start_minutes <= current_minutes <= end_minutes


# ============================================================================
# Scenario A: Weather + Traffic Correlation (Monsoon Commute & Congestion)
# ============================================================================

def evaluate_scenario_a_rule(
    weather: WeatherObservation,
    traffic: TrafficObservation,
    area_label: str,
    reference_time_utc: Optional[datetime.datetime] = None,
    enforce_time_window: bool = True,
    rain_threshold: Optional[float] = None,
    jam_threshold: Optional[float] = None,
    max_radius_km: Optional[float] = None,
    max_age_minutes: Optional[int] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario A: Weather + Traffic Cross-Signal Correlation.
    Identifies when adverse weather and traffic bottlenecks intersect geographically and temporally.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()
    rain_thresh = rain_threshold if rain_threshold is not None else settings.RULE_RAIN_THRESHOLD_MM_PER_HR
    jam_thresh = jam_threshold if jam_threshold is not None else settings.RULE_JAM_FACTOR_THRESHOLD
    radius_km = max_radius_km if max_radius_km is not None else settings.RULE_SPATIAL_RADIUS_KM
    max_age = max_age_minutes if max_age_minutes is not None else settings.RULE_SIGNAL_MAX_AGE_MINUTES

    # 1. Geographic Coordinate Validity Check
    if not is_valid_coordinate(weather.latitude, weather.longitude):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing weather geographic coordinates")
    if not is_valid_coordinate(traffic.latitude, traffic.longitude):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing traffic geographic coordinates")

    # 2. Freshness Check
    weather_age_min = (ref_time - weather.observed_at).total_seconds() / 60.0
    traffic_age_min = (ref_time - traffic.observed_at).total_seconds() / 60.0

    if weather_age_min > max_age:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Stale weather signal: age {weather_age_min:.1f}m exceeds max {max_age}m",
        )
    if traffic_age_min > max_age:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Stale traffic signal: age {traffic_age_min:.1f}m exceeds max {max_age}m",
        )

    # 3. Geospatial Proximity Check
    dist_km = haversine_distance_km(
        weather.latitude, weather.longitude, traffic.latitude, traffic.longitude
    )
    if dist_km > radius_km:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Geographically unrelated: signals separated by {dist_km:.2f} km (limit: {radius_km} km)",
        )

    # 4. Optional Time Window Check (Evening Peak Commute)
    if enforce_time_window:
        in_window = is_within_time_window(
            ref_time,
            settings.RULE_EVALUATION_WINDOW_START,
            settings.RULE_EVALUATION_WINDOW_END,
        )
        if not in_window:
            return RuleEvaluationResult(
                matched=False,
                reason=f"Outside evaluation window ({settings.RULE_EVALUATION_WINDOW_START} - {settings.RULE_EVALUATION_WINDOW_END} IST)",
            )

    # 5. Rainfall Threshold Check
    is_rainy = weather.precipitation_mm >= rain_thresh
    cond_lower = (weather.condition_text or "").lower()
    has_storm_condition = any(w in cond_lower for w in ["thunder", "heavy rain", "torrential", "downpour", "storm"])
    if not is_rainy and not has_storm_condition:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Precipitation {weather.precipitation_mm:.1f} mm/hr below threshold {rain_thresh:.1f} mm/hr",
        )

    # 6. Traffic Congestion Threshold Check (TomTom delay/criticality or HERE jamFactor)
    jam_val = traffic.jam_factor
    delay_val = traffic.delay_seconds or 0
    crit_val = (traffic.criticality or "").lower()

    is_congested = False
    if jam_val is not None and jam_val >= jam_thresh:
        is_congested = True
    elif delay_val >= settings.RULE_DELAY_THRESHOLD_SECONDS:
        is_congested = True
    elif crit_val in ("major", "critical"):
        is_congested = True

    if not is_congested:
        if jam_val is not None:
            reason = f"Traffic below congestion threshold (jam_factor={jam_val:.1f} < {jam_thresh}, delay={delay_val}s)"
        else:
            reason = f"Traffic below congestion threshold (delay={delay_val}s < {settings.RULE_DELAY_THRESHOLD_SECONDS}s, criticality={traffic.criticality or 'none'})"
        return RuleEvaluationResult(matched=False, reason=reason)

    # 7. Composite Severity & Description
    severity = "severe" if (
        weather.precipitation_mm >= 15.0
        or (jam_val is not None and jam_val >= 8.0)
        or delay_val >= 2400
        or crit_val == "critical"
    ) else "high"

    delay_desc = f", reported delay +{delay_val // 60} mins" if delay_val > 0 else ""
    road_desc = f" near {traffic.road_name}" if traffic.road_name else ""

    if jam_val is not None:
        traffic_metric_text = f"Jam Factor {jam_val:.1f}/10{delay_desc}"
        traffic_provenance_summary = f"Jam Factor: {jam_val:.1f}/10 | Type: {traffic.incident_type}{delay_desc}"
    elif delay_val > 0:
        crit_label = f" ({traffic.criticality})" if traffic.criticality else ""
        traffic_metric_text = f"delay +{delay_val // 60} mins{crit_label}"
        traffic_provenance_summary = f"Delay: +{delay_val // 60} mins | Criticality: {traffic.criticality or 'N/A'} | Type: {traffic.incident_type}"
    else:
        traffic_metric_text = f"criticality {traffic.criticality or 'elevated'}"
        traffic_provenance_summary = f"Type: {traffic.incident_type} | Criticality: {traffic.criticality or 'N/A'}"

    summary = (
        f"Rainfall ({weather.precipitation_mm:.1f} mm/hr) and elevated traffic conditions "
        f"({traffic_metric_text}) overlap within {dist_km:.1f} km of {area_label}{road_desc}."
    )
    potential_impact = (
        "Travel along connecting corridors may take substantially longer due to reduced visibility "
        "and surface water accumulation. Low-lying underpasses and junctions face increased bottleneck risk."
    )
    recommendation = (
        "Allow 25-45 minutes additional travel time. Consider deferring non-essential road travel "
        "or utilizing metro rail transit where available."
    )

    signals = [
        SignalProvenance(
            type="weather",
            source=weather.source_id or "weatherapi",
            observation_id=weather.id,
            observed_at=weather.observed_at,
            freshness_minutes=round(weather_age_min, 1),
            metric_summary=f"Precipitation: {weather.precipitation_mm:.1f} mm/hr ({weather.condition_text})",
        ),
        SignalProvenance(
            type="traffic",
            source=traffic.source_id or "tomtom_traffic",
            observation_id=traffic.id,
            observed_at=traffic.observed_at,
            freshness_minutes=round(traffic_age_min, 1),
            metric_summary=traffic_provenance_summary,
        ),
    ]

    expires_at = ref_time + datetime.timedelta(minutes=90)
    next_review_at = ref_time + datetime.timedelta(minutes=30)
    observed_at = max(weather.observed_at, traffic.observed_at)

    data_quality_notes = (
        f"Corroborated across 2 independent operational streams (WeatherAPI & {traffic.source_id}). "
        f"Separation: {dist_km:.2f} km. Weather freshness: {weather_age_min:.0f}m, Traffic freshness: {traffic_age_min:.0f}m."
    )

    insight = IntelligenceInsightOutput(
        insight_type="weather_traffic_correlation",
        area=AreaInfo(
            label=area_label,
            latitude=weather.latitude,
            longitude=weather.longitude,
            radius_km=radius_km,
        ),
        headline=f"Monsoon Commute Alert: Heavy Rain & Congestion at {area_label}",
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=severity,
        confidence_level="HIGH (Multi-Source Corroborated)",
        rule_identifier="SCENARIO_A_WEATHER_TRAFFIC",
        rule_version="1.0",
        data_quality_notes=data_quality_notes,
        observed_at=observed_at,
        created_at=ref_time,
        expires_at=expires_at,
        next_review_at=next_review_at,
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason="Scenario A criteria satisfied: Rain and Traffic thresholds exceeded in overlapping spatiotemporal window.",
        insight=insight,
        supporting_weather_id=weather.id,
        supporting_traffic_id=traffic.id,
    )


# Alias for backwards compatibility with Milestone 1
evaluate_scenario_d_rule = evaluate_scenario_a_rule


# ============================================================================
# Scenario B: Severe Public Alert (Official Disaster & Safety Warning)
# ============================================================================

def evaluate_scenario_b_rule(
    notice: GovernmentNotice,
    area_label: str,
    area_lat: float,
    area_lon: float,
    reference_time_utc: Optional[datetime.datetime] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario B: Severe Public Alert from NDMA SACHET.
    Surfaces official government emergency notices geographically relevant to the locality.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()

    # 1. Geographic Coordinate Validity Check
    if not is_valid_coordinate(area_lat, area_lon):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing locality geographic coordinates")

    # 2. Active & Temporal Validity Check
    if not notice.is_active:
        return RuleEvaluationResult(matched=False, reason="Notice is marked inactive")
    if notice.expires_at <= ref_time:
        return RuleEvaluationResult(matched=False, reason="Government notice has expired")
    if notice.effective_at > ref_time + datetime.timedelta(hours=6):
        return RuleEvaluationResult(matched=False, reason="Notice effective time is too far in the future")

    # 3. Geographic Relevance Check
    if not is_notice_relevant_to_locality(notice, area_label, area_lat, area_lon):
        return RuleEvaluationResult(
            matched=False,
            reason=f"Notice is not geographically relevant to locality {area_label}",
        )

    # 4. Severity Assessment
    severity_lower = (notice.severity or "").lower()
    if severity_lower not in ("extreme", "severe", "moderate"):
        return RuleEvaluationResult(
            matched=False,
            reason=f"Notice severity '{notice.severity}' is below public warning threshold",
        )

    composite_severity = "severe" if severity_lower in ("extreme", "severe") else "moderate"

    # 5. Extract Instructions and Recommendations
    official_instruction = (notice.instruction or "").strip()
    if official_instruction:
        recommendation = official_instruction
    else:
        recommendation = (
            "Heed official advisories issued by NDMA and local district disaster management authorities. "
            "Remain in safe shelter until the advisory expires."
        )

    summary = notice.headline or f"Official {notice.severity} warning issued for {notice.event_type}."
    potential_impact = (
        notice.description
        or f"Potential significant public safety and movement disruption due to {notice.event_type} in {notice.area_description}."
    )

    age_min = max(0.0, (ref_time - notice.effective_at).total_seconds() / 60.0) if notice.effective_at <= ref_time else 0.0

    signals = [
        SignalProvenance(
            type="alert",
            source=notice.source_id or "sachet_cap",
            observation_id=notice.id,
            observed_at=notice.effective_at,
            freshness_minutes=round(age_min, 1),
            metric_summary=f"Event: {notice.event_type} | Severity: {notice.severity} | Urgency: {notice.urgency}",
        )
    ]

    data_quality_notes = (
        f"Direct official OASIS CAP v1.2 bulletin issued by {notice.sender}. "
        f"Identifier: {notice.alert_identifier}. Certainty: {notice.certainty}, Urgency: {notice.urgency}."
    )

    insight = IntelligenceInsightOutput(
        insight_type="severe_public_alert",
        area=AreaInfo(
            label=area_label,
            latitude=area_lat,
            longitude=area_lon,
            radius_km=10.0,
        ),
        headline=f"Official Public Alert: {notice.event_type} - {area_label}",
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=composite_severity,
        confidence_level="HIGH (Official Emergency Authority)",
        rule_identifier="SCENARIO_B_PUBLIC_ALERT",
        rule_version="1.0",
        data_quality_notes=data_quality_notes,
        observed_at=notice.effective_at,
        created_at=ref_time,
        expires_at=notice.expires_at,
        next_review_at=min(ref_time + datetime.timedelta(hours=1), notice.expires_at),
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason="Scenario B criteria satisfied: Active official emergency bulletin for locality.",
        insight=insight,
        supporting_notice_id=notice.id,
    )


# ============================================================================
# Scenario C: Single-Signal Alerts (Standalone High-Impact Events)
# ============================================================================

def evaluate_scenario_c_traffic_rule(
    traffic: TrafficObservation,
    area_label: str,
    reference_time_utc: Optional[datetime.datetime] = None,
    correlated_traffic_ids: Optional[Set[int]] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario C (Traffic): Standalone major traffic disruption without weather corroboration.
    Explicitly labeled as single-source notice rather than fabricating multi-source consensus.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()

    # 1. Geographic Coordinate Validity Check
    if not is_valid_coordinate(traffic.latitude, traffic.longitude):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing traffic geographic coordinates")

    # 2. Check if already part of multi-signal insight
    if correlated_traffic_ids and traffic.id in correlated_traffic_ids:
        return RuleEvaluationResult(
            matched=False,
            reason="Traffic observation already included in multi-signal correlation",
        )

    # 3. Freshness Check
    max_age = settings.RULE_SIGNAL_MAX_AGE_MINUTES
    traffic_age_min = (ref_time - traffic.observed_at).total_seconds() / 60.0
    if traffic_age_min > max_age:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Stale traffic signal: age {traffic_age_min:.1f}m exceeds max {max_age}m",
        )

    # 4. Standalone Severity Threshold Check (Delay >= 30m OR critical OR closure/accident with >= 15m delay)
    delay_sec = traffic.delay_seconds or 0
    crit = (traffic.criticality or "").lower()
    inc_type = (traffic.incident_type or "").upper()

    is_significant = False
    if delay_sec >= 1800:  # 30 mins delay
        is_significant = True
    elif crit == "critical":
        is_significant = True
    elif crit == "major" and delay_sec >= 900:
        is_significant = True
    elif inc_type in ("ROAD_CLOSURE", "ACCIDENT") and delay_sec >= 600:
        is_significant = True

    if not is_significant:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Traffic incident below standalone threshold (delay={delay_sec}s, criticality={traffic.criticality})",
        )

    # 5. Build Grounded Single-Signal Insight
    severity = "severe" if (delay_sec >= 2400 or crit == "critical") else "high"
    road = traffic.road_name or area_label
    delay_min = delay_sec // 60

    headline = f"Traffic Advisory: Major Delay on {road}"
    summary = (
        f"Significant traffic delay (+{delay_min} mins, {traffic.incident_type}) reported along {road}. "
        f"Observed via {traffic.source_id} traffic telemetry."
    )
    potential_impact = (
        f"Commuters using this corridor face extended transit times. Bottlenecks expected around {road}."
    )
    recommendation = (
        "Seek alternate routes or avoid this corridor until delays clear."
    )

    signals = [
        SignalProvenance(
            type="traffic",
            source=traffic.source_id or "tomtom_traffic",
            observation_id=traffic.id,
            observed_at=traffic.observed_at,
            freshness_minutes=round(traffic_age_min, 1),
            metric_summary=f"Delay: +{delay_min} mins | Criticality: {traffic.criticality or 'N/A'} | Type: {traffic.incident_type}",
        )
    ]

    data_quality_notes = (
        f"Single-source telemetry from {traffic.source_id}. "
        "No corroborating adverse weather signals detected in this locality."
    )

    insight = IntelligenceInsightOutput(
        insight_type="single_signal_traffic_notice",
        area=AreaInfo(
            label=area_label,
            latitude=traffic.latitude,
            longitude=traffic.longitude,
            radius_km=settings.RULE_SPATIAL_RADIUS_KM,
        ),
        headline=headline,
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=severity,
        confidence_level="MEDIUM (Single Credible Source)",
        rule_identifier="SCENARIO_C_TRAFFIC_ALERT",
        rule_version="1.0",
        data_quality_notes=data_quality_notes,
        observed_at=traffic.observed_at,
        created_at=ref_time,
        expires_at=ref_time + datetime.timedelta(minutes=60),
        next_review_at=ref_time + datetime.timedelta(minutes=20),
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason="Scenario C (Traffic) criteria satisfied: Standalone severe traffic disruption.",
        insight=insight,
        supporting_traffic_id=traffic.id,
    )


def evaluate_scenario_c_weather_rule(
    weather: WeatherObservation,
    area_label: str,
    reference_time_utc: Optional[datetime.datetime] = None,
    correlated_weather_ids: Optional[Set[int]] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario C (Weather): Standalone torrential rain / severe downpour without traffic corroboration.
    Explicitly labeled as single-source notice.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()

    # 1. Geographic Coordinate Validity Check
    if not is_valid_coordinate(weather.latitude, weather.longitude):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing weather geographic coordinates")

    # 2. Check if already part of multi-signal insight
    if correlated_weather_ids and weather.id in correlated_weather_ids:
        return RuleEvaluationResult(
            matched=False,
            reason="Weather observation already included in multi-signal correlation",
        )

    # 3. Freshness Check
    max_age = settings.RULE_SIGNAL_MAX_AGE_MINUTES
    weather_age_min = (ref_time - weather.observed_at).total_seconds() / 60.0
    if weather_age_min > max_age:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Stale weather signal: age {weather_age_min:.1f}m exceeds max {max_age}m",
        )

    # 4. Standalone Severity Threshold Check (Precipitation >= 20.0 mm/hr OR violent storm condition)
    precip = weather.precipitation_mm
    cond_lower = (weather.condition_text or "").lower()
    has_extreme_storm = any(w in cond_lower for w in ["violent", "cloudburst", "torrential", "squall", "severe storm"])

    if precip < 20.0 and not has_extreme_storm:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Weather observation below standalone alert threshold (precipitation={precip:.1f} mm/hr)",
        )

    # 5. Build Grounded Single-Signal Insight
    severity = "severe" if precip >= 30.0 else "high"
    headline = f"Severe Weather Alert: Torrential Downpour in {area_label}"
    summary = (
        f"Intense localized rainfall ({precip:.1f} mm/hr, {weather.condition_text}) reported in {area_label}. "
        f"Observed via WeatherAPI forecast station."
    )
    potential_impact = (
        "High risk of rapid waterlogging in low-lying areas and decreased road visibility."
    )
    recommendation = (
        "Exercise extreme caution outdoors. Avoid low-lying underpasses and monitor drainage conditions."
    )

    signals = [
        SignalProvenance(
            type="weather",
            source=weather.source_id or "weatherapi",
            observation_id=weather.id,
            observed_at=weather.observed_at,
            freshness_minutes=round(weather_age_min, 1),
            metric_summary=f"Precipitation: {precip:.1f} mm/hr ({weather.condition_text})",
        )
    ]

    data_quality_notes = (
        "Single-source weather telemetry from WeatherAPI. "
        "No corroborating traffic incidents reported in this locality yet."
    )

    insight = IntelligenceInsightOutput(
        insight_type="single_signal_weather_notice",
        area=AreaInfo(
            label=area_label,
            latitude=weather.latitude,
            longitude=weather.longitude,
            radius_km=settings.RULE_SPATIAL_RADIUS_KM,
        ),
        headline=headline,
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=severity,
        confidence_level="MEDIUM (Single Credible Source)",
        rule_identifier="SCENARIO_C_WEATHER_ALERT",
        rule_version="1.0",
        data_quality_notes=data_quality_notes,
        observed_at=weather.observed_at,
        created_at=ref_time,
        expires_at=ref_time + datetime.timedelta(minutes=60),
        next_review_at=ref_time + datetime.timedelta(minutes=20),
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason="Scenario C (Weather) criteria satisfied: Standalone severe precipitation.",
        insight=insight,
        supporting_weather_id=weather.id,
    )
