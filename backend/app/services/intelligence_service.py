import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.models import IntelligenceInsight, IntelligenceSignal
from backend.app.intelligence.schemas import (
    AreaInfo,
    IntelligenceInsightOutput,
    SignalProvenance,
)


class IntelligenceService:
    def __init__(self, db: Session):
        self.db = db

    def _to_output(self, r: IntelligenceInsight) -> IntelligenceInsightOutput:
        signals = [
            SignalProvenance(
                type=s.signal_type,
                source=s.source_name,
                observation_id=s.observation_id,
                observed_at=s.observed_at,
                freshness_minutes=(
                    round((r.created_at - s.observed_at).total_seconds() / 60.0, 1)
                    if s.observed_at and s.observed_at <= r.created_at
                    else 0.0
                ),
                metric_summary=s.metric_summary,
            )
            for s in r.signals
        ]

        return IntelligenceInsightOutput(
            id=r.id,
            insight_type=r.insight_type,
            area=AreaInfo(
                label=r.area_label,
                latitude=r.latitude,
                longitude=r.longitude,
                radius_km=r.radius_km,
            ),
            headline=r.headline,
            summary=r.summary,
            potential_impact=r.potential_impact,
            recommendation=r.recommendation,
            evidence_quality=r.evidence_quality,
            composite_severity=r.composite_severity,
            confidence_level=getattr(r, "confidence_level", "HIGH (Multi-Source Corroborated)"),
            rule_identifier=getattr(r, "rule_identifier", "SCENARIO_A_WEATHER_TRAFFIC"),
            rule_version=r.rule_version,
            data_quality_notes=getattr(r, "data_quality_notes", None),
            observed_at=getattr(r, "observed_at", None),
            created_at=r.created_at,
            expires_at=r.expires_at,
            next_review_at=getattr(r, "next_review_at", None),
            signals=signals,
        )

    def get_insights(
        self,
        area: Optional[str] = None,
        insight_type: Optional[str] = None,
        severity: Optional[str] = None,
        confidence: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[IntelligenceInsightOutput], int]:
        """Queries intelligence insights with filtering across area, type, severity, and freshness."""
        query = self.db.query(IntelligenceInsight)

        if area:
            query = query.filter(IntelligenceInsight.area_label.ilike(f"%{area}%"))
        if insight_type:
            query = query.filter(IntelligenceInsight.insight_type == insight_type)
        if severity:
            query = query.filter(IntelligenceInsight.composite_severity == severity.lower())
        if confidence:
            query = query.filter(IntelligenceInsight.confidence_level.ilike(f"%{confidence}%"))
        if is_active is not None:
            query = query.filter(IntelligenceInsight.is_active == is_active)

        total = query.count()
        rows = (
            query.order_by(desc(IntelligenceInsight.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        results = [self._to_output(r) for r in rows]
        return results, total

    def get_insight_by_id(self, insight_id: int) -> Optional[IntelligenceInsightOutput]:
        """Retrieves single insight with full signal provenance."""
        r = self.db.query(IntelligenceInsight).filter(IntelligenceInsight.id == insight_id).first()
        if not r:
            return None
        return self._to_output(r)
