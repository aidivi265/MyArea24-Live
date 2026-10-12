import datetime
import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.app.api.deps import get_current_user
from backend.app.database.models import Business, Offer, User
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.business_discovery_service import sync_live_businesses, extract_locality_tokens

router = APIRouter(prefix="/api/v1/offers", tags=["Local Offers & Deals"])


class OfferCreateRequest(BaseModel):
    business_id: int
    title: str
    description: Optional[str] = None
    discount_text: str  # e.g., '25% OFF', 'Flat ₹200 Off'
    coupon_code: Optional[str] = None
    category: str
    valid_days: int = 14
    terms_conditions: Optional[str] = None
    banner_image_url: Optional[str] = None


@router.get("", response_model=Dict[str, Any])
def list_offers(
    business_id: Optional[int] = Query(None, description="Filter offers by business ID"),
    category: Optional[str] = Query(None),
    locality: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    user_lat: Optional[float] = Query(None, description="User latitude for distance calculation"),
    user_lon: Optional[float] = Query(None, description="User longitude for distance calculation"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # Resolve coordinates and canonical city/locality across all 780+ Indian districts
    target_loc = (city or locality or "").strip()
    disp_city = (city or "").strip()
    disp_locality = (locality or "").strip()
    if target_loc and business_id is None:
        try:
            from backend.app.services.event_ingestion_service import resolve_city_centroid_and_name
            _, res_city, res_loc, c_lat, c_lon = resolve_city_centroid_and_name(
                target_loc, lat=None, lon=None, locality_name=locality
            )
            disp_city = res_city or disp_city
            disp_locality = res_loc or disp_locality
            if user_lat is None or user_lon is None:
                user_lat, user_lon = c_lat, c_lon
            elif haversine_distance_km(user_lat, user_lon, c_lat, c_lon) > 100.0:
                user_lat, user_lon = c_lat, c_lon
        except Exception:
            pass

    # Dynamic live business discovery if coordinates provided and area deals are low
    if user_lat is not None and user_lon is not None and business_id is None:
        try:
            nearby_count = db.query(Business).filter(
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) <= 0.04
            ).count()
            if nearby_count < 4:
                sync_live_businesses(db, user_lat, user_lon, disp_city or city, disp_locality or locality)
        except Exception:
            pass

    query = (
        db.query(Offer)
        .join(Business, Offer.business_id == Business.id)
        .filter(Offer.is_active == True, Business.status == "active")
    )

    if business_id is not None:
        query = query.filter(Offer.business_id == business_id)

    if category:
        query = query.filter(func.lower(Offer.category) == category.strip().lower())

    tokens = [] if business_id is not None else extract_locality_tokens(locality, city)
    if tokens:
        token_filters = []
        for tok in tokens:
            pattern = f"%{tok.lower()}%"
            token_filters.append(func.lower(Business.locality).like(pattern))
            token_filters.append(func.lower(Business.city).like(pattern))
            token_filters.append(func.lower(Business.address).like(pattern))
        query = query.filter(or_(*token_filters))

    now = datetime.datetime.utcnow()
    query = query.filter(Offer.valid_until >= now)

    if user_lat is not None and user_lon is not None:
        rad_lat = math.radians(user_lat)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (Business.latitude - user_lat) * (Business.latitude - user_lat)
            + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
        )
        query = query.order_by(dist_expr.asc(), Offer.created_at.desc())
    else:
        query = query.order_by(Offer.created_at.desc())

    total = query.count()
    if total == 0 and (locality or city):
        fallback_q = (
            db.query(Offer)
            .join(Business, Offer.business_id == Business.id)
            .filter(Offer.is_active == True, Business.status == "active", Offer.valid_until >= now)
        )
        if category:
            fallback_q = fallback_q.filter(func.lower(Offer.category) == category.strip().lower())

        if user_lat is not None and user_lon is not None:
            rad_lat = math.radians(user_lat)
            cos_lat = math.cos(rad_lat)
            cos_lat_sq = cos_lat * cos_lat
            dist_expr = (
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
            )
            fallback_q = fallback_q.order_by(dist_expr.asc(), Offer.created_at.desc())
        else:
            fallback_q = fallback_q.order_by(Offer.created_at.desc())

        total = fallback_q.count()
        start = (page - 1) * page_size
        items = fallback_q.offset(start).limit(page_size).all()
    else:
        start = (page - 1) * page_size
        items = query.offset(start).limit(page_size).all()

    results = []
    for o in items:
        b = o.business
        days_left = max(0, (o.valid_until - now).days)
        dist = None
        if user_lat is not None and user_lon is not None and b.latitude and b.longitude:
            dist = round(haversine_distance_km(user_lat, user_lon, b.latitude, b.longitude), 2)

        results.append({
            "id": o.id,
            "title": o.title,
            "description": o.description,
            "discount_text": o.discount_text,
            "coupon_code": o.coupon_code,
            "category": o.category,
            "valid_from": o.valid_from.isoformat() if o.valid_from else None,
            "valid_until": o.valid_until.isoformat() if o.valid_until else None,
            "days_left": days_left,
            "terms_conditions": o.terms_conditions,
            "banner_image_url": o.banner_image_url,
            "distance_km": dist,
            "business": {
                "id": b.id,
                "slug": b.slug,
                "name": b.name,
                "category": b.category,
                "address": b.address,
                "locality": b.locality,
                "city": b.city,
                "phone": b.phone,
                "whatsapp": b.whatsapp,
                "distance_km": dist,
            },
        })

    return {
        "items": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{offer_id}")
def get_offer_detail(offer_id: int, db: Session = Depends(get_db)):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    b = offer.business
    now = datetime.datetime.utcnow()
    days_left = max(0, (offer.valid_until - now).days)

    return {
        "id": offer.id,
        "title": offer.title,
        "description": offer.description,
        "discount_text": offer.discount_text,
        "coupon_code": offer.coupon_code,
        "category": offer.category,
        "valid_until": offer.valid_until.isoformat(),
        "days_left": days_left,
        "terms_conditions": offer.terms_conditions,
        "banner_image_url": offer.banner_image_url,
        "business": {
            "id": b.id,
            "slug": b.slug,
            "name": b.name,
            "address": b.address,
            "locality": b.locality,
            "city": b.city,
            "phone": b.phone,
            "whatsapp": b.whatsapp,
        },
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_offer(
    req: OfferCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    business = db.query(Business).filter(Business.id == req.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if user.role != "admin" and business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to post offers for this business")

    valid_until = datetime.datetime.utcnow() + datetime.timedelta(days=req.valid_days)
    offer = Offer(
        business_id=req.business_id,
        title=req.title.strip(),
        description=req.description.strip() if req.description else None,
        discount_text=req.discount_text.strip(),
        coupon_code=req.coupon_code.strip() if req.coupon_code else None,
        category=req.category.strip(),
        valid_from=datetime.datetime.utcnow(),
        valid_until=valid_until,
        terms_conditions=req.terms_conditions,
        banner_image_url=req.banner_image_url,
        is_active=True,
    )
    db.add(offer)
    db.commit()
    db.refresh(offer)

    return {"success": True, "message": f"Offer '{offer.title}' published successfully", "offer_id": offer.id}


@router.delete("/{offer_id}")
def delete_offer(
    offer_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")

    if user.role != "admin" and offer.business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this offer")

    offer.is_active = False
    db.commit()
    return {"success": True, "message": "Offer deactivated"}
