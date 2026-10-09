from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.intelligence.schemas import IntelligenceInsightOutput
from backend.app.services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/api/v1/intelligence", tags=["Local Intelligence"])


class PaginatedInsightsResponse(BaseModel):
    items: List[IntelligenceInsightOutput]
    total: int
    page: int
    page_size: int


@router.get("", response_model=PaginatedInsightsResponse)
def list_insights(
    area: Optional[str] = Query(None, description="Filter by locality or pilot area name"),
    insight_type: Optional[str] = Query(None, description="Filter by insight type (e.g. weather_traffic_correlation, severe_public_alert, single_signal_traffic_notice)"),
    severity: Optional[str] = Query(None, description="Filter by composite severity (minor, moderate, high, severe)"),
    confidence: Optional[str] = Query(None, description="Filter by confidence level (e.g. HIGH, MEDIUM)"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """
    Retrieves cross-signal intelligence insights with source provenance and multi-dimensional filtering.
    """
    service = IntelligenceService(db)
    skip = (page - 1) * page_size
    items, total = service.get_insights(
        area=area,
        insight_type=insight_type,
        severity=severity,
        confidence=confidence,
        is_active=is_active,
        skip=skip,
        limit=page_size,
    )

    return PaginatedInsightsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{insight_id}", response_model=IntelligenceInsightOutput)
def get_insight_detail(
    insight_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieves a single intelligence insight by ID with full signal provenance.
    """
    service = IntelligenceService(db)
    insight = service.get_insight_by_id(insight_id)
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intelligence insight #{insight_id} not found.",
        )
    return insight
