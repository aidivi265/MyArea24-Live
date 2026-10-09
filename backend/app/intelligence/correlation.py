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
    IntelligenceInsight,
    IntelligenceSignal,
)
from backend.app.intelligence.rules import (
    evaluate_scenario_a_rule,
    evaluate_scenario_b_rule,
    evaluate_scenario_c_traffic_rule,
    evaluate_scenario_c_weather_rule,
    evaluate_scenario_d_rule,
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
    ) -> List[IntelligenceInsight]:
        """
        Executes complete multi-scenario intelligence pipeline across all active observation streams.
        Evaluates Scenario A (Weather + Traffic), Scenario B (Severe Public Alert),
        and Scenario C (Single-Signal Notices).
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

        correlated_weather_ids: Set[int] = set()
        correlated_traffic_ids: Set[int] = set()

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
            for t in recent_traffic:
                if t.id in correlated_traffic_ids:
                    continue

                res = evaluate_scenario_c_traffic_rule(
                    traffic=t,
                    area_label=t.road_name or "Local Corridor",
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

        return created_insights
