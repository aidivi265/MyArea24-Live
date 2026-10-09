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

    def get_insights(
        self,
        area: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[IntelligenceInsightOutput], int]:
        """Queries intelligence insights with filtering and pagination."""
        query = self.db.query(IntelligenceInsight)

        if area:
            query = query.filter(IntelligenceInsight.area_label.ilike(f"%{area}%"))
        if is_active is not None:
            query = query.filter(IntelligenceInsight.is_active == is_active)

        total = query.count()
        rows = (
            query.order_by(desc(IntelligenceInsight.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        results: List[IntelligenceInsightOutput] = []
        for r in rows:
            signals = [
                SignalProvenance(
                    type=s.signal_type,
                    source=s.source_name,
                    observation_id=s.observation_id,
                    observed_at=s.observed_at,
                    metric_summary=s.metric_summary,
                )
                for s in r.signals
            ]
            results.append(
                IntelligenceInsightOutput(
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
                    signals=signals,
                    created_at=r.created_at,
                    expires_at=r.expires_at,
                    rule_version=r.rule_version,
                )
            )

        return results, total

    def get_insight_by_id(self, insight_id: int) -> Optional[IntelligenceInsightOutput]:
        """Retrieves single insight with full signal provenance."""
        r = self.db.query(IntelligenceInsight).filter(IntelligenceInsight.id == insight_id).first()
        if not r:
            return None

        signals = [
            SignalProvenance(
                type=s.signal_type,
                source=s.source_name,
                observation_id=s.observation_id,
                observed_at=s.observed_at,
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
            signals=signals,
            created_at=r.created_at,
            expires_at=r.expires_at,
            rule_version=r.rule_version,
        )
