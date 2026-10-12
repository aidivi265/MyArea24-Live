from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.app.api.deps import get_current_user
from backend.app.database.models import Business, CommunitySignal, CustomerEnquiry, Offer, Product, User
from backend.app.database.session import get_db

router = APIRouter(prefix="/api/v1/admin", tags=["Admin & Moderation"])


class UpdateStatusRequest(BaseModel):
    status: str  # 'active', 'pending_approval', 'suspended'


@router.get("/overview")
def get_admin_overview(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")

    total_businesses = db.query(Business).count()
    verified_businesses = db.query(Business).filter(Business.is_verified == True).count()
    pending_businesses = db.query(Business).filter(Business.status == "pending_approval").count()
    total_products = db.query(Product).count()
    total_offers = db.query(Offer).filter(Offer.is_active == True).count()
    total_enquiries = db.query(CustomerEnquiry).count()
    total_users = db.query(User).count()
    total_signals = db.query(CommunitySignal).count()
    pending_signals = db.query(CommunitySignal).filter(CommunitySignal.status != "RESOLVED").count()

    recent_businesses = (
        db.query(Business)
        .order_by(Business.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "metrics": {
            "total_businesses": total_businesses,
            "verified_businesses": verified_businesses,
            "pending_businesses": pending_businesses,
            "total_products": total_products,
            "total_offers": total_offers,
            "active_offers": total_offers,
            "total_enquiries": total_enquiries,
            "total_users": total_users,
            "total_signals": total_signals,
            "pending_signals": pending_signals,
        },
        "recent_businesses": [
            {
                "id": b.id,
                "name": b.name,
                "category": b.category,
                "locality": b.locality,
                "city": b.city,
                "is_verified": b.is_verified,
                "status": b.status,
                "created_at": b.created_at.isoformat(),
            }
            for b in recent_businesses
        ],
    }


@router.post("/businesses/{business_id}/verify")
def toggle_verify_business(
    business_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.is_verified = not b.is_verified
    db.commit()
    return {"success": True, "is_verified": b.is_verified, "message": f"{b.name} verification status updated"}


@router.put("/businesses/{business_id}/status")
def update_business_status(
    business_id: int,
    req: UpdateStatusRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    b = db.query(Business).filter(Business.id == business_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Business not found")

    b.status = req.status
    db.commit()
    return {"success": True, "status": b.status, "message": f"{b.name} status updated to {req.status}"}


class UpdateUserRoleRequest(BaseModel):
    role: str  # 'resident', 'merchant', 'admin'


@router.get("/businesses")
def list_admin_businesses(
    status_filter: Optional[str] = Query(None, alias="status"),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    query = db.query(Business)
    if status_filter:
        query = query.filter(Business.status == status_filter)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(or_(Business.name.ilike(term), Business.city.ilike(term), Business.locality.ilike(term)))

    total = query.count()
    items = query.order_by(Business.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": b.id,
                "name": b.name,
                "category": b.category,
                "locality": b.locality,
                "city": b.city,
                "phone": b.phone,
                "is_verified": b.is_verified,
                "status": b.status,
                "rating": b.rating,
                "created_at": b.created_at.isoformat(),
            }
            for b in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/users")
def list_admin_users(
    role: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(or_(User.email.ilike(term), User.full_name.ilike(term)))

    total = query.count()
    items = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_verified": u.is_verified,
                "created_at": u.created_at.isoformat(),
            }
            for u in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    req: UpdateUserRoleRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if req.role not in ("resident", "merchant", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'resident', 'merchant', or 'admin'.")

    target.role = req.role
    db.commit()
    return {"success": True, "user_id": target.id, "role": target.role}


@router.delete("/products/{product_id}")
def delete_moderated_product(
    product_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(prod)
    db.commit()
    return {"success": True, "message": f"Product #{product_id} successfully removed"}


@router.get("/community-signals")
def list_admin_community_signals(
    status_filter: Optional[str] = Query(None, alias="status"),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    query = db.query(CommunitySignal)
    if status_filter:
        query = query.filter(CommunitySignal.status == status_filter)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(or_(CommunitySignal.title.ilike(term), CommunitySignal.locality.ilike(term), CommunitySignal.city.ilike(term)))

    total = query.count()
    items = query.order_by(CommunitySignal.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": s.id,
                "signal_type": s.signal_type,
                "title": s.title,
                "description": s.description,
                "locality": s.locality,
                "city": s.city,
                "state": s.state,
                "upvotes": s.upvotes,
                "status": s.status,
                "severity": s.severity,
                "created_at": s.created_at.isoformat(),
            }
            for s in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.put("/community-signals/{signal_id}/status")
def update_signal_status(
    signal_id: int,
    req: UpdateStatusRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    sig = db.query(CommunitySignal).filter(CommunitySignal.id == signal_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Community signal not found")

    sig.status = req.status
    db.commit()
    return {"success": True, "signal_id": sig.id, "status": sig.status}
