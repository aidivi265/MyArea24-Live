from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.database.session import get_db
from backend.app.database.models import DataSource

router = APIRouter(tags=["Health & Readiness"])


@router.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, Any]:
    """Basic liveness probe."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "env": settings.APP_ENV,
        "ingestion_enabled": settings.INGESTION_ENABLED,
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
def readiness_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Readiness probe checking database connectivity and provider status."""
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "not_ready", "database": db_status},
        )

    # Inspect data sources
    sources = db.query(DataSource).all()
    source_statuses = {
        s.id: {
            "status": s.last_status or "UNINITIALIZED",
            "last_sync": s.last_sync_at.isoformat() if s.last_sync_at else None,
            "errors": s.error_count,
        }
        for s in sources
    }

    return {
        "status": "ready",
        "database": db_status,
        "sources": source_statuses,
    }
