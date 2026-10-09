import datetime
import hashlib
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.models import (
    WeatherObservation,
    TrafficObservation,
    IntelligenceInsight,
    IntelligenceSignal,
)
from backend.app.intelligence.rules import evaluate_scenario_d_rule
from backend.app.intelligence.schemas import IntelligenceInsightOutput, RuleEvaluationResult


class CorrelationEngine:
    """
    Executes cross-signal correlation across persisted observation streams.
    Ensures idempotency, provenance preservation, and lifecycle expiry.
    """

    def __init__(self, db: Session):
        self.db = db

    def generate_dedup_hash(
        self,
        area_label: str,
        weather_id: int,
        traffic_id: int,
        ref_date: datetime.date,
    ) -> str:
        raw_key = f"{area_label}:{weather_id}:{traffic_id}:{ref_date.isoformat()}"
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

    def run_correlation(
        self,
        reference_time_utc: Optional[datetime.datetime] = None,
        enforce_time_window: bool = True,
    ) -> List[IntelligenceInsight]:
        """
        Scans active observations and creates new insights when deterministic rules match.
        """
        ref_time = reference_time_utc or datetime.datetime.utcnow()
        self.expire_stale_insights(ref_time)

        created_insights: List[IntelligenceInsight] = []
        max_age = datetime.timedelta(minutes=settings.RULE_SIGNAL_MAX_AGE_MINUTES)
        min_observed_time = ref_time - max_age

        # Fetch recent weather observations
        recent_weather = (
            self.db.query(WeatherObservation)
            .filter(WeatherObservation.observed_at >= min_observed_time)
            .order_by(desc(WeatherObservation.observed_at))
            .all()
        )

        # Fetch recent traffic observations
        recent_traffic = (
            self.db.query(TrafficObservation)
            .filter(TrafficObservation.observed_at >= min_observed_time)
            .order_by(desc(TrafficObservation.observed_at))
            .all()
        )

        if not recent_weather or not recent_traffic:
            logger.debug("[correlation] Insufficient signals in database to perform correlation.")
            return []

        # Evaluate pairs
        for w in recent_weather:
            for t in recent_traffic:
                res: RuleEvaluationResult = evaluate_scenario_d_rule(
                    weather=w,
                    traffic=t,
                    area_label=w.location_name,
                    reference_time_utc=ref_time,
                    enforce_time_window=enforce_time_window,
                )

                if res.matched and res.insight:
                    dedup_hash = self.generate_dedup_hash(
                        area_label=w.location_name,
                        weather_id=w.id,
                        traffic_id=t.id,
                        ref_date=ref_time.date(),
                    )

                    # Check if already generated
                    existing = (
                        self.db.query(IntelligenceInsight)
                        .filter(IntelligenceInsight.dedup_hash == dedup_hash)
                        .first()
                    )
                    if existing:
                        continue

                    # Persist new insight
                    out = res.insight
                    db_insight = IntelligenceInsight(
                        insight_type=out.insight_type,
                        area_label=out.area.label,
                        latitude=out.area.latitude or w.latitude,
                        longitude=out.area.longitude or w.longitude,
                        radius_km=out.area.radius_km,
                        headline=out.headline,
                        summary=out.summary,
                        potential_impact=out.potential_impact,
                        recommendation=out.recommendation,
                        evidence_quality=out.evidence_quality,
                        composite_severity=out.composite_severity,
                        dedup_hash=dedup_hash,
                        is_active=True,
                        created_at=ref_time,
                        expires_at=out.expires_at,
                        rule_version=out.rule_version,
                    )
                    self.db.add(db_insight)
                    self.db.flush()  # populate db_insight.id

                    # Persist signals
                    for sig in out.signals:
                        obs_table = "weather_observations" if sig.type == "weather" else "traffic_observations"
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
                    created_insights.append(db_insight)
                    logger.info(
                        f"[correlation] Emitted new insight #{db_insight.id} for {db_insight.area_label} (hash: {dedup_hash[:8]})"
                    )

        return created_insights
