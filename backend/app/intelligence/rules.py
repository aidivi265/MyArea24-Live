import datetime
import math
from typing import Optional, Tuple
from backend.app.core.config import settings
from backend.app.database.models import WeatherObservation, TrafficObservation
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


def evaluate_scenario_d_rule(
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
    Evaluates Scenario D: Monsoon Commute & Congestion Correlation.
    Deterministic, mathematical rule with strict provenance tracking.
    """
    ref_time = reference_time_utc or datetime.datetime.utcnow()
    rain_thresh = rain_threshold if rain_threshold is not None else settings.RULE_RAIN_THRESHOLD_MM_PER_HR
    jam_thresh = jam_threshold if jam_threshold is not None else settings.RULE_JAM_FACTOR_THRESHOLD
    radius_km = max_radius_km if max_radius_km is not None else settings.RULE_SPATIAL_RADIUS_KM
    max_age = max_age_minutes if max_age_minutes is not None else settings.RULE_SIGNAL_MAX_AGE_MINUTES

    # 1. Freshness Check
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

    # 2. Geospatial Proximity Check
    dist_km = haversine_distance_km(
        weather.latitude, weather.longitude, traffic.latitude, traffic.longitude
    )
    if dist_km > radius_km:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Geographically unrelated: signals separated by {dist_km:.2f} km (limit: {radius_km} km)",
        )

    # 3. Time Window Check (Evening Peak Commute)
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

    # 4. Rainfall Threshold Check
    if weather.precipitation_mm < rain_thresh:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Precipitation {weather.precipitation_mm:.1f} mm/hr below threshold {rain_thresh:.1f} mm/hr",
        )

    # 5. Traffic Congestion Threshold Check
    jam_val = traffic.jam_factor or 0.0
    delay_val = traffic.delay_seconds or 0
    if jam_val < jam_thresh and delay_val < settings.RULE_DELAY_THRESHOLD_SECONDS:
        return RuleEvaluationResult(
            matched=False,
            reason=f"Traffic below congestion threshold (jam_factor={jam_val:.1f} < {jam_thresh}, delay={delay_val}s)",
        )

    # 6. Build Grounded Intelligence Output
    severity = "severe" if (weather.precipitation_mm >= 15.0 or jam_val >= 8.0) else "high"
    delay_desc = f", reported delay +{delay_val // 60} mins" if delay_val > 0 else ""
    road_desc = f" near {traffic.road_name}" if traffic.road_name else ""

    summary = (
        f"Rainfall ({weather.precipitation_mm:.1f} mm/hr) and elevated traffic conditions "
        f"(Jam Factor {jam_val:.1f}/10{delay_desc}) overlap within {dist_km:.1f} km of {area_label}{road_desc}."
    )
    potential_impact = (
        "Travel along connecting corridors may take substantially longer due to reduced visibility "
        "and surface water accumulation. Underpasses and low-lying junctions face increased bottleneck risk."
    )
    recommendation = (
        "Allow 25-45 minutes additional travel time. Consider deferring non-essential road travel "
        "or utilizing metro rail transit where available."
    )

    signals = [
        SignalProvenance(
            type="weather",
            source="weatherapi",
            observation_id=weather.id,
            observed_at=weather.observed_at,
            metric_summary=f"Precipitation: {weather.precipitation_mm:.1f} mm/hr ({weather.condition_text})",
        ),
        SignalProvenance(
            type="traffic",
            source="here_traffic",
            observation_id=traffic.id,
            observed_at=traffic.observed_at,
            metric_summary=f"Jam Factor: {jam_val:.1f}/10 | Type: {traffic.incident_type}{delay_desc}",
        ),
    ]

    expires_at = ref_time + datetime.timedelta(minutes=90)

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
        signals=signals,
        created_at=ref_time,
        expires_at=expires_at,
        rule_version="1.0",
    )

    return RuleEvaluationResult(
        matched=True,
        reason="Scenario D criteria satisfied: Rain and Traffic thresholds exceeded in overlapping spatiotemporal window.",
        insight=insight,
        supporting_weather_id=weather.id,
        supporting_traffic_id=traffic.id,
    )
