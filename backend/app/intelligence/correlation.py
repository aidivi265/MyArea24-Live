import datetime
import hashlib
from typing import Any, List, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.models import (
    WeatherObservation,
    TrafficObservation,
    GovernmentNotice,
    AirQualityObservation,
    IntelligenceInsight,
    IntelligenceSignal,
    Event,
    CommunitySignal,
)
from backend.app.intelligence.rules import (
    evaluate_scenario_a_rule,
    evaluate_scenario_b_rule,
    evaluate_scenario_c_traffic_rule,
    evaluate_scenario_c_weather_rule,
    evaluate_scenario_d_rule,
    evaluate_scenario_e_aqi_rule,
    evaluate_scenario_f_event_correlation,
    evaluate_scenario_g_community_signal_correlation,
    haversine_distance_km,
)
from backend.app.intelligence.schemas import IntelligenceInsightOutput, RuleEvaluationResult


class CorrelationEngine:
    """
    Executes cross-signal correlation across persisted observation streams.
    Implements the full intelligence pipeline:
    Collect -> Normalize -> Match Signals -> Assess Impact -> Generate Insight -> Attach Evidence.
    Ensures idempotency, provenance preservation, and lifecycle expiry.
    """

    def __init__(self, db: Session):
        self.db = db

    def generate_dedup_hash(
        self,
        arg1: str,
        arg2: Any,
        arg3: Optional[Any] = None,
        arg4: Optional[Any] = None,
        ref_date: Optional[datetime.date] = None,
    ) -> str:
        """
        Generates a deterministic SHA-256 deduplication key.
        Supports both legacy (area_label, weather_id, traffic_id, date) signature
        and general multi-scenario (insight_type, area_label, primary_id, secondary_id, date) format.
        """
        # Legacy Scenario A signature check: (area_label, weather_id, traffic_id, ref_date)
        if isinstance(arg2, int) and (arg3 is None or isinstance(arg3, int)) and isinstance(arg4, datetime.date):
            raw_key = f"{arg1}:{arg2}:{arg3}:{arg4.isoformat()}"
            return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

        # Multi-scenario signature: (insight_type, area_label, primary_id, secondary_id, ref_date)
        insight_type = str(arg1)
        area_label = str(arg2)
        primary_id = str(arg3) if arg3 is not None else "0"
        secondary_id = str(arg4) if arg4 is not None else "none"
        date_str = (ref_date or datetime.date.today()).isoformat()
        raw_key = f"{insight_type}:{area_label}:{primary_id}:{secondary_id}:{date_str}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def expire_stale_insights(self, now: Optional[datetime.datetime] = None) -> int:
        """Flags past-expiry insights as inactive."""
        ref_time = now or datetime.datetime.utcnow()
        count = (
            self.db.query(IntelligenceInsight)
            .filter(
                IntelligenceInsight.expires_at <= ref_time,
                IntelligenceInsight.is_active == True,
            )
            .update({"is_active": False})
        )
        if count > 0:
            self.db.commit()
            logger.info(f"[correlation] Expired {count} stale intelligence insights.")
        return count

    def expire_stale_notices(self, now: Optional[datetime.datetime] = None) -> int:
        """Flags past-expiry government notices as inactive in database."""
        ref_time = now or datetime.datetime.utcnow()
        count = (
            self.db.query(GovernmentNotice)
            .filter(
                GovernmentNotice.expires_at <= ref_time,
                GovernmentNotice.is_active == True,
            )
            .update({"is_active": False})
        )
        if count > 0:
            self.db.commit()
            logger.debug(f"[correlation] Marked {count} expired government notices as inactive.")
        return count

    def _persist_insight(
        self,
        out: IntelligenceInsightOutput,
        dedup_hash: str,
        ref_time: datetime.datetime,
    ) -> IntelligenceInsight:
        """Persists a generated insight and its signal provenance atomically."""
        db_insight = IntelligenceInsight(
            insight_type=out.insight_type,
            area_label=out.area.label,
            latitude=out.area.latitude if out.area.latitude is not None else 0.0,
            longitude=out.area.longitude if out.area.longitude is not None else 0.0,
            radius_km=out.area.radius_km,
            headline=out.headline,
            summary=out.summary,
            potential_impact=out.potential_impact,
            recommendation=out.recommendation,
            evidence_quality=out.evidence_quality,
            composite_severity=out.composite_severity,
            confidence_level=out.confidence_level,
            rule_identifier=out.rule_identifier,
            rule_version=out.rule_version,
            data_quality_notes=out.data_quality_notes,
            observed_at=out.observed_at,
            created_at=ref_time,
            expires_at=out.expires_at,
            next_review_at=out.next_review_at,
            dedup_hash=dedup_hash,
            is_active=True,
        )
        self.db.add(db_insight)
        self.db.flush()

        for sig in out.signals:
            if sig.type == "weather":
                obs_table = "weather_observations"
            elif sig.type == "traffic":
                obs_table = "traffic_observations"
            elif sig.type == "alert":
                obs_table = "government_notices"
            elif sig.type == "air_quality":
                obs_table = "air_quality_observations"
            elif sig.type == "event":
                obs_table = "events"
            elif sig.type == "community":
                obs_table = "community_signals"
            else:
                obs_table = "unknown"

            db_sig = IntelligenceSignal(
                insight_id=db_insight.id,
                signal_type=sig.type,
                source_name=sig.source,
                observation_table=obs_table,
                observation_id=int(sig.observation_id),
                observed_at=sig.observed_at,
                metric_summary=sig.metric_summary,
            )
            self.db.add(db_sig)

        self.db.commit()
        logger.info(
            f"[correlation] Emitted {out.insight_type} insight #{db_insight.id} for {db_insight.area_label} (hash: {dedup_hash[:8]})"
        )
        return db_insight

    def run_correlation(
        self,
        reference_time_utc: Optional[datetime.datetime] = None,
        enforce_time_window: bool = True,
        run_scenario_a: bool = True,
        run_scenario_b: bool = True,
        run_scenario_c: bool = True,
        run_scenario_d: bool = True,
        run_scenario_e: bool = True,
        run_scenario_g: bool = True,
    ) -> List[IntelligenceInsight]:
        """
        Executes complete multi-scenario intelligence pipeline across all active observation streams.
        Evaluates Scenario A (Weather + Traffic), Scenario B (Severe Public Alert),
        Scenario C (Single-Signal Notices), Scenario D (Event + Weather + Traffic),
        Scenario E (Air Quality Intelligence), and Scenario G (Community Signal Mesh).
        """
        ref_time = reference_time_utc or datetime.datetime.utcnow()
        self.expire_stale_insights(ref_time)
        self.expire_stale_notices(ref_time)

        created_insights: List[IntelligenceInsight] = []
        max_age = datetime.timedelta(minutes=settings.RULE_SIGNAL_MAX_AGE_MINUTES)
        min_observed_time = ref_time - max_age

        # 1. Collect Recent Observations
        recent_weather = (
            self.db.query(WeatherObservation)
            .filter(WeatherObservation.observed_at >= min_observed_time)
            .order_by(desc(WeatherObservation.observed_at))
            .all()
        )

        recent_traffic = (
            self.db.query(TrafficObservation)
            .filter(TrafficObservation.observed_at >= min_observed_time)
            .order_by(desc(TrafficObservation.observed_at))
            .all()
        )

        active_notices = (
            self.db.query(GovernmentNotice)
            .filter(
                GovernmentNotice.is_active == True,
                GovernmentNotice.expires_at > ref_time,
                GovernmentNotice.effective_at <= ref_time + datetime.timedelta(hours=6),
            )
            .order_by(desc(GovernmentNotice.effective_at))
            .all()
        )

        aqi_max_age = datetime.timedelta(minutes=settings.AQI_OBSERVATION_MAX_AGE_MINUTES)
        min_aqi_time = ref_time - aqi_max_age
        recent_aqi = (
            self.db.query(AirQualityObservation)
            .filter(AirQualityObservation.observed_at >= min_aqi_time)
            .order_by(desc(AirQualityObservation.observed_at))
            .all()
        )

        min_community_time = ref_time - datetime.timedelta(hours=12)
        active_community_signals = (
            self.db.query(CommunitySignal)
            .filter(
                CommunitySignal.status != "RESOLVED",
                CommunitySignal.created_at >= min_community_time,
            )
            .order_by(desc(CommunitySignal.upvotes), desc(CommunitySignal.created_at))
            .all()
        )

        correlated_weather_ids: Set[int] = set()
        correlated_traffic_ids: Set[int] = set()
        correlated_aqi_ids: Set[int] = set()

        # ====================================================================
        # Stage 1: Scenario A — Weather + Traffic Cross-Signal Correlation
        # ====================================================================
        if run_scenario_a and recent_weather and recent_traffic:
            for w in recent_weather:
                for t in recent_traffic:
                    res: RuleEvaluationResult = evaluate_scenario_a_rule(
                        weather=w,
                        traffic=t,
                        area_label=w.location_name,
                        reference_time_utc=ref_time,
                        enforce_time_window=enforce_time_window,
                    )

                    if res.matched and res.insight:
                        # Legacy dedup key preserved for Scenario A
                        dedup_hash = self.generate_dedup_hash(
                            w.location_name,
                            w.id,
                            t.id,
                            ref_time.date(),
                        )

                        existing = (
                            self.db.query(IntelligenceInsight)
                            .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                            .first()
                        )
                        if existing:
                            correlated_weather_ids.add(w.id)
                            correlated_traffic_ids.add(t.id)
                            continue

                        persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                        created_insights.append(persisted)
                        correlated_weather_ids.add(w.id)
                        correlated_traffic_ids.add(t.id)

        # ====================================================================
        # Stage 2: Scenario B — Severe Public Alerts (NDMA SACHET)
        # ====================================================================
        if run_scenario_b and active_notices:
            pilot_locations = settings.parsed_pilot_locations
            for notice in active_notices:
                for loc in pilot_locations:
                    res = evaluate_scenario_b_rule(
                        notice=notice,
                        area_label=loc.name,
                        area_lat=loc.lat,
                        area_lon=loc.lon,
                        reference_time_utc=ref_time,
                    )

                    if res.matched and res.insight:
                        dedup_hash = self.generate_dedup_hash(
                            "severe_public_alert",
                            loc.name,
                            notice.alert_identifier,
                            None,
                            ref_time.date(),
                        )

                        existing = (
                            self.db.query(IntelligenceInsight)
                            .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                            .first()
                        )
                        if existing:
                            continue

                        persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                        created_insights.append(persisted)

        # ====================================================================
        # Stage 3: Scenario C — Single-Signal Alerts (Standalone High Impact)
        # ====================================================================
        if run_scenario_c:
            # C1: Standalone Critical Traffic
            pilot_locations = settings.parsed_pilot_locations
            for t in recent_traffic:
                if t.id in correlated_traffic_ids:
                    continue

                nearest_loc = None
                min_dist = float("inf")
                for loc in pilot_locations:
                    dist = haversine_distance_km(t.latitude, t.longitude, loc.lat, loc.lon)
                    if dist < min_dist:
                        min_dist = dist
                        nearest_loc = loc

                if nearest_loc and min_dist <= (settings.RULE_SPATIAL_RADIUS_KM + 3.0):
                    loc_label = f"{t.road_name} ({nearest_loc.name})" if t.road_name else nearest_loc.name
                else:
                    loc_label = t.road_name or "Local Corridor"

                res = evaluate_scenario_c_traffic_rule(
                    traffic=t,
                    area_label=loc_label,
                    reference_time_utc=ref_time,
                    correlated_traffic_ids=correlated_traffic_ids,
                )

                if res.matched and res.insight:
                    dedup_hash = self.generate_dedup_hash(
                        "single_signal_traffic_notice",
                        t.road_name or "corridor",
                        t.id,
                        None,
                        ref_time.date(),
                    )

                    existing = (
                        self.db.query(IntelligenceInsight)
                        .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                        .first()
                    )
                    if existing:
                        continue

                    persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                    created_insights.append(persisted)

            # C2: Standalone Severe Weather
            for w in recent_weather:
                if w.id in correlated_weather_ids:
                    continue

                res = evaluate_scenario_c_weather_rule(
                    weather=w,
                    area_label=w.location_name,
                    reference_time_utc=ref_time,
                    correlated_weather_ids=correlated_weather_ids,
                )

                if res.matched and res.insight:
                    dedup_hash = self.generate_dedup_hash(
                        "single_signal_weather_notice",
                        w.location_name,
                        w.id,
                        None,
                        ref_time.date(),
                    )

                    existing = (
                        self.db.query(IntelligenceInsight)
                        .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                        .first()
                    )
                    if existing:
                        continue

                    persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                    created_insights.append(persisted)

        # ====================================================================
        # Stage 4: Scenario E — Air Quality Intelligence (Severe / Very Poor AQI)
        # ====================================================================
        if run_scenario_e and recent_aqi:
            pilot_locations = settings.parsed_pilot_locations
            for aqi in recent_aqi:
                for loc in pilot_locations:
                    res = evaluate_scenario_e_aqi_rule(
                        aqi_obs=aqi,
                        area_label=loc.name,
                        area_lat=loc.lat,
                        area_lon=loc.lon,
                        reference_time_utc=ref_time,
                        correlated_aqi_ids=correlated_aqi_ids,
                    )

                    if res.matched and res.insight:
                        dedup_hash = self.generate_dedup_hash(
                            "air_quality_alert",
                            loc.name,
                            aqi.station_id,
                            None,
                            ref_time.date(),
                        )

                        existing = (
                            self.db.query(IntelligenceInsight)
                            .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                            .first()
                        )
                        if existing:
                            correlated_aqi_ids.add(aqi.id)
                            continue

                        persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                        created_insights.append(persisted)
                        correlated_aqi_ids.add(aqi.id)

        # ====================================================================
        # Stage 5: Scenario D — Event + Weather + Traffic + Parking Correlation (PPT Slide 03)
        # ====================================================================
        if run_scenario_d:
            upcoming_events = (
                self.db.query(Event)
                .filter(
                    Event.start_time <= ref_time + datetime.timedelta(hours=10),
                    Event.start_time >= ref_time - datetime.timedelta(hours=2),
                )
                .all()
            )
            for ev in upcoming_events:
                # Find nearest weather observation (< 35 km)
                nearest_w = None
                min_w_dist = float("inf")
                for w in recent_weather:
                    wd = haversine_distance_km(ev.latitude, ev.longitude, w.latitude, w.longitude)
                    if wd < min_w_dist:
                        min_w_dist = wd
                        nearest_w = w
                if min_w_dist > 35.0:
                    nearest_w = None

                # Find nearest traffic observation (< 15 km)
                nearest_t = None
                min_t_dist = float("inf")
                for t in recent_traffic:
                    td = haversine_distance_km(ev.latitude, ev.longitude, t.latitude, t.longitude)
                    if td < min_t_dist:
                        min_t_dist = td
                        nearest_t = t
                if min_t_dist > 15.0:
                    nearest_t = None

                res = evaluate_scenario_f_event_correlation(
                    event=ev,
                    weather=nearest_w,
                    traffic=nearest_t,
                    area_label=f"{ev.venue_name}, {ev.locality or ev.city}",
                    area_lat=ev.latitude,
                    area_lon=ev.longitude,
                    reference_time_utc=ref_time,
                )

                if res.matched and res.insight:
                    dedup_hash = self.generate_dedup_hash(
                        "event_weather_traffic_correlation",
                        f"{ev.venue_name}:{ev.id}",
                        ev.id,
                        (nearest_w.id if nearest_w else 0),
                        ref_time.date(),
                    )

                    existing = (
                        self.db.query(IntelligenceInsight)
                        .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                        .first()
                    )
                    if existing:
                        continue

                    persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                    created_insights.append(persisted)

        # ====================================================================
        # Stage 6: Scenario G — Community Ground-Truth Signal Mesh Correlation (PPT Slide 09)
        # ====================================================================
        if run_scenario_g and active_community_signals:
            for sig in active_community_signals:
                nearest_w = None
                min_w_dist = float("inf")
                for w in recent_weather:
                    wd = haversine_distance_km(sig.latitude, sig.longitude, w.latitude, w.longitude)
                    if wd < min_w_dist:
                        min_w_dist = wd
                        nearest_w = w
                if min_w_dist > 25.0:
                    nearest_w = None

                nearest_t = None
                min_t_dist = float("inf")
                for t in recent_traffic:
                    td = haversine_distance_km(sig.latitude, sig.longitude, t.latitude, t.longitude)
                    if td < min_t_dist:
                        min_t_dist = td
                        nearest_t = t
                if min_t_dist > 15.0:
                    nearest_t = None

                res = evaluate_scenario_g_community_signal_correlation(
                    signal=sig,
                    weather=nearest_w,
                    traffic=nearest_t,
                    reference_time_utc=ref_time,
                )

                if res.matched and res.insight:
                    dedup_hash = self.generate_dedup_hash(
                        "community_ground_truth_correlation",
                        f"{sig.locality}:{sig.id}",
                        sig.id,
                        (nearest_t.id if nearest_t else (nearest_w.id if nearest_w else 0)),
                        ref_time.date(),
                    )

                    existing = (
                        self.db.query(IntelligenceInsight)
                        .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                        .first()
                    )
                    if existing:
                        continue

                    persisted = self._persist_insight(res.insight, dedup_hash, ref_time)
                    created_insights.append(persisted)

        return created_insights

