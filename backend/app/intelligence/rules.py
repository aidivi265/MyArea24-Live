import datetime
import math
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.app.core.config import settings
from backend.app.database.models import (
    WeatherObservation,
    TrafficObservation,
    GovernmentNotice,
    AirQualityObservation,
    Event,
    CommunitySignal,
)
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
        center = circle_geojson.get("center")
        if isinstance(center, (list, tuple)) and len(center) >= 2:
            c_lon = float(center[0])
            c_lat = float(center[1])
        else:
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
    severity = "severe" if (delay_sec >= 2400 or crit == "critical" or inc_type == "ROAD_CLOSURE") else "high"
    road = traffic.road_name or area_label
    delay_min = delay_sec // 60

    if inc_type == "ROAD_CLOSURE":
        headline = f"Traffic Advisory: Road Closure on {road}"
        summary = (
            f"Road closure reported along {road}. "
            f"Observed via {traffic.source_id} traffic telemetry."
        )
        potential_impact = (
            f"Corridor is closed to vehicular traffic. Severe bottleneck and diversions expected around {road}."
        )
        recommendation = (
            "Avoid this corridor. Use designated bypass routes or alternate arterial roads."
        )
        metric_summary = f"Criticality: {traffic.criticality or 'critical'} | Type: {traffic.incident_type} (Closed)"
    elif delay_min > 0:
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
        metric_summary = f"Delay: +{delay_min} mins | Criticality: {traffic.criticality or 'N/A'} | Type: {traffic.incident_type}"
    else:
        headline = f"Traffic Advisory: Critical Incident on {road}"
        summary = (
            f"Critical traffic incident ({traffic.incident_type}) reported along {road}. "
            f"Observed via {traffic.source_id} traffic telemetry."
        )
        potential_impact = (
            f"Traffic disruptions expected around {road}."
        )
        recommendation = (
            "Exercise caution and allow additional travel time."
        )
        metric_summary = f"Criticality: {traffic.criticality or 'N/A'} | Type: {traffic.incident_type}"

    signals = [
        SignalProvenance(
            type="traffic",
            source=traffic.source_id or "tomtom_traffic",
            observation_id=traffic.id,
            observed_at=traffic.observed_at,
            freshness_minutes=round(traffic_age_min, 1),
            metric_summary=metric_summary,
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


def evaluate_scenario_e_aqi_rule(
    aqi_obs: AirQualityObservation,
    area_label: str,
    area_lat: float,
    area_lon: float,
    reference_time_utc: Optional[datetime.datetime] = None,
    correlated_aqi_ids: Optional[Set[int]] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario E: Air Quality Intelligence / Severe Pollution Advisory.
    Triggers when an official CAAQMS monitoring station within maximum allowable distance
    (default 15 km) records 'Very Poor' (AQI >= 301) or 'Severe' (AQI >= 401) pollution.
    Respects strict data freshness limits (default 180 min) and ground-truth station provenance.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()

    # 1. Coordinate Validity
    if not is_valid_coordinate(aqi_obs.latitude, aqi_obs.longitude):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing station geographic coordinates")
    if not is_valid_coordinate(area_lat, area_lon):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing locality geographic coordinates")

    # 2. Duplicate Correlation Check
    if correlated_aqi_ids and aqi_obs.id in correlated_aqi_ids:
        return RuleEvaluationResult(matched=False, reason="Air quality observation already correlated in this cycle")

    # 3. Spatial Distance Check (Station must be within max allowable distance of locality)
    dist_km = haversine_distance_km(aqi_obs.latitude, aqi_obs.longitude, area_lat, area_lon)
    max_dist = settings.AQI_MAX_STATION_DISTANCE_KM
    if dist_km > max_dist:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Station '{aqi_obs.station_name}' distance ({dist_km:.1f} km) exceeds max allowable radius ({max_dist:.1f} km)",
        )

    # 4. Freshness Check
    max_age = settings.AQI_OBSERVATION_MAX_AGE_MINUTES
    age_min = (ref_time - aqi_obs.observed_at).total_seconds() / 60.0
    if age_min > max_age:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Stale air quality telemetry: age {age_min:.1f}m exceeds max {max_age}m",
        )
    if age_min < -15.0:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Future-dated observation timestamp: {age_min:.1f}m in the future",
        )

    # 5. AQI Severity Check (Only trigger for Very Poor >= 301 or Severe >= 401)
    aqi_val = aqi_obs.aqi_value or 0.0
    if aqi_val < 301.0:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Air quality ({aqi_val:.0f}, {aqi_obs.aqi_category or 'Moderate'}) is below advisory threshold (301)",
        )

    # 6. Compose Grounded Advisory Insight
    is_severe = aqi_val >= 401.0
    severity = "severe" if is_severe else "high"
    pollutant = aqi_obs.prominent_pollutant or "PM2.5"

    if is_severe:
        headline = f"Severe Air Quality Alert: Hazardous Pollution in {area_label}"
        potential_impact = (
            f"Hazardous concentration of {pollutant} (AQI {int(aqi_val)}, Severe) poses critical respiratory risks "
            f"to all healthy individuals and severe risks to sensitive populations. Triggers Emergency GRAP Stage IV protocol."
        )
        recommendation = (
            "Avoid all non-essential outdoor movement and exercise. Keep doors and windows sealed and operate HEPA purifiers. "
            "Children, elderly citizens, and respiratory patients should remain strictly indoors. Use certified N95 masks if transit is required."
        )
    else:
        headline = f"Very Poor Air Quality Advisory in {area_label}"
        potential_impact = (
            f"Elevated {pollutant} levels (AQI {int(aqi_val)}, Very Poor) may cause respiratory illness and eye irritation "
            f"upon prolonged outdoor exposure, especially for daily commuters and children."
        )
        recommendation = (
            "Avoid intense outdoor physical activity during morning and late evening hours. "
            "Wear N95/FFP2 masks during commute. Sensitive groups should minimize outdoor exposure."
        )

    summary = (
        f"Continuous Ambient Air Quality Monitoring Station '{aqi_obs.station_name}' ({dist_km:.1f} km away in {aqi_obs.city}) "
        f"recorded an official CPCB NAQI of {int(aqi_val)} ({aqi_obs.aqi_category}). "
        f"Prominent pollutant: {pollutant}."
    )

    signals = [
        SignalProvenance(
            type="air_quality",
            source=aqi_obs.source_id or "openaq",
            observation_id=aqi_obs.id,
            observed_at=aqi_obs.observed_at,
            freshness_minutes=round(max(0.0, age_min), 1),
            metric_summary=f"AQI {int(aqi_val)} ({aqi_obs.aqi_category}) · {pollutant} · Station: {aqi_obs.station_name} ({dist_km:.1f}km)",
        )
    ]

    data_quality_notes = (
        f"Verified telemetry from {aqi_obs.station_name} ({aqi_obs.city}, {aqi_obs.state or 'India'}). "
        f"CPCB 2014 NAQI standard applied. Telemetry age: {age_min:.0f}m."
    )

    insight = IntelligenceInsightOutput(
        insight_type="air_quality_alert",
        area=AreaInfo(
            label=area_label,
            latitude=area_lat,
            longitude=area_lon,
            radius_km=settings.RULE_SPATIAL_RADIUS_KM,
        ),
        headline=headline,
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=severity,
        confidence_level="HIGH (CPCB CAAQMS Station Telemetry)",
        rule_identifier="SCENARIO_E_AIR_QUALITY_ADVISORY",
        rule_version="1.0",
        data_quality_notes=data_quality_notes,
        observed_at=aqi_obs.observed_at,
        created_at=ref_time,
        expires_at=ref_time + datetime.timedelta(minutes=60),
        next_review_at=ref_time + datetime.timedelta(minutes=20),
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason=f"Scenario E criteria satisfied: {aqi_obs.aqi_category} AQI ({int(aqi_val)}) at {aqi_obs.station_name}",
        insight=insight,
        supporting_aqi_id=aqi_obs.id,
    )


def evaluate_scenario_f_event_correlation(
    event: Event,
    weather: Optional[WeatherObservation],
    traffic: Optional[TrafficObservation],
    area_label: str,
    area_lat: Optional[float] = None,
    area_lon: Optional[float] = None,
    reference_time_utc: Optional[datetime.datetime] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario F: Event + Weather + Traffic + Parking Cross-Signal Correlation (PPT Slide 03).
    Correlates an active/upcoming event gathering with live rainfall, rising traffic congestion,
    and escalating parking pressure around the venue.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()

    # 1. Temporal Relevance: Event occurs within 12 hours window
    event_start = event.start_time
    if event_start.tzinfo is not None:
        event_start = event_start.astimezone(datetime.timezone.utc).replace(tzinfo=None)

    # Event must be between 2 hours ago and 10 hours in the future
    if not (ref_time - datetime.timedelta(hours=2) <= event_start <= ref_time + datetime.timedelta(hours=10)):
        return RuleEvaluationResult(matched=False, reason="Event outside temporal window (+10h / -2h)")

    # 2. Check for Cross-Signal Stress
    attendance = getattr(event, "expected_attendance", 500) or 500
    parking_status = getattr(event, "parking_pressure", "NORMAL") or "NORMAL"
    precip_mm = (weather.precipitation_mm or 0.0) if weather else 0.0
    delay_sec = (traffic.delay_seconds or 0) if traffic else 0

    has_rain = precip_mm > 0.0
    has_traffic = delay_sec >= 300  # >= 5 minutes delay
    has_high_crowd = attendance >= 1000 or parking_status in ["ELEVATED", "CRITICAL"]

    # Match if event has high crowd and either rain or rising traffic is present
    if not (has_high_crowd and (has_rain or has_traffic or parking_status == "CRITICAL")):
        return RuleEvaluationResult(
            matched=False,
            reason="Insufficient cross-signal stress: event requires elevated crowd combined with rain or traffic congestion",
        )

    # Determine composite severity
    if (has_rain and precip_mm >= 10.0 and has_traffic) or parking_status == "CRITICAL" or attendance >= 4000:
        severity = "severe"
    elif has_rain and has_traffic:
        severity = "high"
    else:
        severity = "moderate"

    headline = f"Event Commute Alert: Heavy Traffic & Rising Parking Pressure near {event.venue_name} ({event.title})"
    summary = f"Heavy traffic expected near the {event.venue_name} area due to '{event.title}'. Rain and wet surfaces may increase travel time. Parking demand is also rising sharply."
    potential_impact = (
        f"Corridors approaching {event.venue_name} ({event.locality or event.city}) face +{round(delay_sec/60)}m delays. "
        f"Venue parking demand is {parking_status.lower()}; designated lots likely saturated."
    )
    recommendation = (
        "• Leave earlier (allow 30-45 minutes travel buffer)\n"
        "• Consider safer alternative route bypassing congested venue gates\n"
        "• Check parking availability or utilize designated satellite Metro transit parking"
    )

    signals: List[SignalProvenance] = []
    signals.append(
        SignalProvenance(
            type="event",
            source=event.source or "Verified Civic Events",
            observation_id=event.id,
            observed_at=event.start_time,
            metric_summary=f"Event '{event.title}' at {event.venue_name} (~{attendance} attendees, parking: {parking_status})",
        )
    )

    if weather:
        signals.append(
            SignalProvenance(
                type="weather",
                source=getattr(weather, "source_id", "weatherapi"),
                observation_id=weather.id,
                observed_at=weather.observed_at,
                metric_summary=f"Precipitation: {precip_mm}mm, Condition: {weather.condition_text}",
            )
        )

    if traffic:
        signals.append(
            SignalProvenance(
                type="traffic",
                source="tomtom_traffic",
                observation_id=traffic.id,
                observed_at=traffic.observed_at,
                metric_summary=f"Approach delay: +{round(delay_sec/60)} mins on {traffic.road_name or 'arterial corridor'}",
            )
        )

    insight = IntelligenceInsightOutput(
        insight_type="event_weather_traffic_correlation",
        area=AreaInfo(
            label=f"{event.venue_name}, {event.locality or event.city}",
            latitude=event.latitude,
            longitude=event.longitude,
            radius_km=settings.RULE_SPATIAL_RADIUS_KM,
        ),
        headline=headline,
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=severity,
        confidence_level="HIGH (Multi-Signal Fused: Event + Weather + Traffic + Parking)",
        rule_identifier="SCENARIO_D_EVENT_COMMUTE_CORRELATION",
        rule_version="1.0",
        data_quality_notes=f"Fused event attendance telemetry (~{attendance} pax) with live sensor streams",
        observed_at=event.start_time,
        created_at=ref_time,
        expires_at=ref_time + datetime.timedelta(hours=4),
        next_review_at=ref_time + datetime.timedelta(minutes=30),
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason=f"Scenario D satisfied: Event '{event.title}' correlated with rain={has_rain} ({precip_mm}mm) and delay={round(delay_sec/60)}m",
        insight=insight,
        supporting_event_id=event.id,
        supporting_weather_id=weather.id if weather else None,
        supporting_traffic_id=traffic.id if traffic else None,
    )


def evaluate_scenario_g_community_signal_correlation(
    signal: CommunitySignal,
    weather: Optional[WeatherObservation] = None,
    traffic: Optional[TrafficObservation] = None,
    reference_time_utc: Optional[datetime.datetime] = None,
) -> RuleEvaluationResult:
    """
    Evaluates Scenario G: Community Ground-Truth Signal Mesh Correlation (PPT Slide 09).
    Integrates citizen-reported ground conditions (WATERLOGGING, POTHOLE, ROAD_BLOCKAGE,
    ACCIDENT, LOCAL_MARKET) into the local intelligence signal mesh, fusing them with
    corroborating weather and arterial traffic telemetry.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()

    if not is_valid_coordinate(signal.latitude, signal.longitude):
        return RuleEvaluationResult(matched=False, reason="Invalid or missing community signal coordinates")

    if (signal.status or "").upper() == "RESOLVED":
        return RuleEvaluationResult(matched=False, reason="Community signal is already resolved")

    created_dt = signal.created_at.replace(tzinfo=None) if signal.created_at else ref_time
    age_minutes = max(0.0, (ref_time - created_dt).total_seconds() / 60.0)
    if age_minutes > 720.0:  # 12-hour relevance window
        return RuleEvaluationResult(
            matched=False,
            reason=f"Community signal age ({age_minutes:.0f}m) exceeds 720m active mesh window",
        )

    sig_type = (signal.signal_type or "ROAD_BLOCKAGE").upper().strip()
    sig_sev = (signal.severity or "moderate").lower().strip()
    upvotes = signal.upvotes or 1
    is_verified = (signal.status or "").upper() in ("COMMUNITY_VERIFIED", "ESCALATED_TO_MUNICIPALITY") or upvotes >= 2

    precip_mm = (weather.precipitation_mm or 0.0) if weather else 0.0
    delay_sec = (traffic.delay_seconds or 0) if traffic else 0
    delay_min = round(delay_sec / 60)

    has_corroborating_weather = weather is not None and (
        precip_mm >= 1.0 or (sig_type == "WATERLOGGING" and (weather.humidity or 0) >= 70)
    )
    has_corroborating_traffic = traffic is not None and (
        delay_sec >= 180 or (traffic.jam_factor or 0) >= 4.0 or (traffic.criticality or "").lower() in ("major", "critical")
    )

    if not (is_verified or sig_sev in ("high", "severe", "critical") or has_corroborating_weather or has_corroborating_traffic):
        return RuleEvaluationResult(
            matched=False,
            reason="Unverified low-severity community report without sensor corroboration",
        )

    area_label = f"{signal.locality}, {signal.city}" if signal.locality and signal.city and signal.city.lower() not in signal.locality.lower() else (signal.locality or signal.city or "Local Corridor")

    if sig_sev in ("severe", "critical") or upvotes >= 5 or (sig_type in ("WATERLOGGING", "ACCIDENT", "ROAD_BLOCKAGE") and has_corroborating_traffic and delay_min >= 20):
        composite_severity = "severe"
    elif sig_sev == "high" or upvotes >= 3 or has_corroborating_weather or has_corroborating_traffic:
        composite_severity = "high"
    else:
        composite_severity = "moderate"

    type_labels = {
        "WATERLOGGING": "Waterlogging Hazard",
        "POTHOLE": "Road Surface / Crater Hazard",
        "ROAD_BLOCKAGE": "Road Blockage & Diversion",
        "ACCIDENT": "Traffic Accident & Lane Obstruction",
        "LOCAL_MARKET": "Local Market Crowd Surge",
    }
    badge = type_labels.get(sig_type, "Community Ground Hazard")
    headline = f"Citizen Ground Alert ({badge}): {signal.title} at {area_label}"

    corroboration_parts = [f"Peer-verified citizen report ({upvotes} upvote{'s' if upvotes != 1 else ''}, status: {signal.status})"]
    if weather and precip_mm > 0:
        corroboration_parts.append(f"corroborated by {precip_mm:.1f}mm rainfall ({weather.condition_text})")
    if traffic and delay_min > 0:
        corroboration_parts.append(f"intersecting +{delay_min}m traffic delay on {traffic.road_name or 'nearby arterial'}")

    summary = (
        f"Ground-truth {sig_type.replace('_', ' ').lower()} reported in {area_label}: \"{signal.title}\". "
        f"{signal.description or ''} ({', '.join(corroboration_parts)})."
    ).strip()

    if sig_type == "WATERLOGGING":
        potential_impact = (
            f"Surface water accumulation near {signal.locality} poses stalling risks for two-wheelers and low-clearance vehicles"
            f"{f', compounded by +{delay_min}m corridor congestion' if delay_min > 0 else ''}."
        )
        recommendation = (
            f"Avoid low-lying underpasses and surface lanes near {signal.locality}. "
            "Use the Elevated Bypass / Ring Road or Rapid Metro corridor until drainage clearance is confirmed."
        )
    elif sig_type in ("ROAD_BLOCKAGE", "ACCIDENT"):
        potential_impact = (
            f"Active carriageway obstruction near {signal.locality} is restricting through-traffic"
            f"{f' with +{delay_min}m bottleneck delays' if delay_min > 0 else ''}."
        )
        recommendation = (
            f"Detour around {signal.locality} via parallel ring road links. Allow 15-25 minutes extra commute buffer."
        )
    elif sig_type == "POTHOLE":
        potential_impact = (
            f"Severe road surface damage / pothole cluster at {signal.locality} increases braking distance and two-wheeler skidding risk"
            f"{' especially on wet asphalt' if precip_mm > 0 else ''}."
        )
        recommendation = (
            f"Reduce speed below 25 km/h when approaching {signal.locality} or choose grade-separated arterial routes."
        )
    else:
        potential_impact = f"Elevated pedestrian and vehicular density near {signal.locality} causing localized slowdowns."
        recommendation = f"Expect slower last-mile movement near {signal.locality}; prefer two-wheeler or pedestrian access."

    signals: List[SignalProvenance] = [
        SignalProvenance(
            type="community",
            source="community_signal_mesh",
            observation_id=signal.id,
            observed_at=created_dt,
            freshness_minutes=round(age_minutes, 1),
            metric_summary=f"Community {sig_type}: {signal.title} ({upvotes} upvotes, severity={sig_sev}, status={signal.status})",
        )
    ]

    if weather:
        w_age = max(0.0, (ref_time - weather.observed_at.replace(tzinfo=None)).total_seconds() / 60.0)
        signals.append(
            SignalProvenance(
                type="weather",
                source=weather.source_id or "weatherapi",
                observation_id=weather.id,
                observed_at=weather.observed_at,
                freshness_minutes=round(w_age, 1),
                metric_summary=f"Precipitation: {precip_mm:.1f} mm/hr ({weather.condition_text}, {weather.temperature_c}°C)",
            )
        )

    if traffic:
        t_age = max(0.0, (ref_time - traffic.observed_at.replace(tzinfo=None)).total_seconds() / 60.0)
        signals.append(
            SignalProvenance(
                type="traffic",
                source=traffic.source_id or "tomtom_traffic",
                observation_id=traffic.id,
                observed_at=traffic.observed_at,
                freshness_minutes=round(t_age, 1),
                metric_summary=f"Traffic on {traffic.road_name or 'Corridor'}: delay +{delay_min} mins ({traffic.criticality or 'elevated'})",
            )
        )

    conf_str = (
        "HIGH (Citizen Ground-Truth + Multi-Sensor Corroborated)"
        if (weather or traffic)
        else "HIGH (Peer-Verified Citizen Ground Mesh)"
    )

    insight = IntelligenceInsightOutput(
        insight_type="community_ground_truth_correlation",
        area=AreaInfo(
            label=area_label,
            latitude=signal.latitude,
            longitude=signal.longitude,
            radius_km=settings.RULE_SPATIAL_RADIUS_KM,
        ),
        headline=headline,
        summary=summary,
        potential_impact=potential_impact,
        recommendation=recommendation,
        evidence_quality="supported",
        composite_severity=composite_severity,
        confidence_level=conf_str,
        rule_identifier="SCENARIO_G_COMMUNITY_SIGNAL_MESH",
        rule_version="1.0",
        data_quality_notes=f"Integrated from Community Signal Mesh (#{signal.id}, {upvotes} upvotes, {sig_type}).",
        observed_at=created_dt,
        created_at=ref_time,
        expires_at=ref_time + datetime.timedelta(hours=3),
        next_review_at=ref_time + datetime.timedelta(minutes=20),
        signals=signals,
    )

    return RuleEvaluationResult(
        matched=True,
        reason=f"Scenario G satisfied: Community signal #{signal.id} ({sig_type}) integrated into local signal mesh",
        insight=insight,
        supporting_community_signal_id=signal.id,
        supporting_weather_id=weather.id if weather else None,
        supporting_traffic_id=traffic.id if traffic else None,
    )


