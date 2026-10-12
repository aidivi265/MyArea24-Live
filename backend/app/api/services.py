import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from backend.app.api.deps import get_current_user
from backend.app.database.models import ServiceListing, User
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.business_discovery_service import (
    extract_locality_tokens,
    sync_live_services,
)

router = APIRouter(prefix="/api/v1/services", tags=["Local Services Marketplace"])


class ServiceCreateRequest(BaseModel):
    provider_name: str
    category: str
    description: Optional[str] = None
    service_area: str
    locality: str
    city: str
    latitude: float
    longitude: float
    phone: str
    whatsapp: Optional[str] = None
    price_starting_at: Optional[float] = None
    price_unit: str = "per visit"
    timing: str = "08:00 AM - 08:00 PM"
    experience_years: int = 5


@router.get("", response_model=Dict[str, Any])
def list_services(
    category: Optional[str] = Query(None, description="Category filter (e.g. Electrician, Plumber, AC Repair)"),
    locality: Optional[str] = Query(None, description="Locality filter"),
    city: Optional[str] = Query(None, description="City filter"),
    q: Optional[str] = Query(None, description="Search keyword"),
    sort_by: Optional[str] = Query("distance", description="distance | rating | price_asc | price_desc"),
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # Resolve coordinates and canonical city/locality across all 780+ Indian districts
    target_loc = (city or locality or "").strip()
    disp_city = (city or "").strip()
    disp_locality = (locality or "").strip()

    if target_loc:
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
                # Caller switched city/locality but passed stale coordinates from previous city
                user_lat, user_lon = c_lat, c_lon
        except Exception:
            pass
    elif user_lat is not None and user_lon is not None:
        try:
            from backend.app.services.event_ingestion_service import resolve_city_centroid_and_name
            _, res_city, res_loc, _, _ = resolve_city_centroid_and_name(
                "", lat=user_lat, lon=user_lon, locality_name=locality
            )
            disp_city = res_city or disp_city
            disp_locality = res_loc or disp_locality
        except Exception:
            pass

    # Dynamically discover/synthesize verified local services around (user_lat, user_lon) across India
    if user_lat is not None and user_lon is not None:
        try:
            nearby_count = (
                db.query(ServiceListing)
                .filter(
                    (ServiceListing.latitude - user_lat) * (ServiceListing.latitude - user_lat)
                    + (ServiceListing.longitude - user_lon) * (ServiceListing.longitude - user_lon)
                    <= 0.04
                )
                .count()
            )
            if nearby_count < 5:
                sync_live_services(
                    db,
                    user_lat,
                    user_lon,
                    disp_city or city,
                    disp_locality or locality,
                )
        except Exception:
            pass

    query = db.query(ServiceListing).filter(ServiceListing.is_available == True)

    if category:
        query = query.filter(func.lower(ServiceListing.category) == category.strip().lower())

    # Multi-token locality + city + proximity matching (so 'Delhi Connaught Place' matches 'Connaught Place')
    tokens = extract_locality_tokens(locality or disp_locality, city or disp_city)
    word_tokens: List[str] = []
    for tok in tokens:
        word_tokens.append(tok)
        for w in tok.replace("/", " ").replace("-", " ").split():
            if len(w.strip()) >= 3 and w.strip().lower() not in {"sector", "phase", "block", "nagar", "colony", "market", "area"}:
                word_tokens.append(w.strip())

    if word_tokens or (user_lat is not None and user_lon is not None):
        loc_filters = []
        for tok in set(word_tokens):
            pattern = f"%{tok.lower()}%"
            loc_filters.append(func.lower(ServiceListing.locality).like(pattern))
            loc_filters.append(func.lower(ServiceListing.city).like(pattern))
            loc_filters.append(func.lower(ServiceListing.service_area).like(pattern))
        if user_lat is not None and user_lon is not None:
            loc_filters.append(
                (ServiceListing.latitude - user_lat) * (ServiceListing.latitude - user_lat)
                + (ServiceListing.longitude - user_lon) * (ServiceListing.longitude - user_lon)
                <= 0.06
            )
        if loc_filters:
            query = query.filter(or_(*loc_filters))

    if q:
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(ServiceListing.provider_name).like(term),
                func.lower(ServiceListing.category).like(term),
                func.lower(ServiceListing.service_area).like(term),
                func.lower(ServiceListing.description).like(term),
            )
        )

    # SQL Ordering
    dist_expr = None
    if user_lat is not None and user_lon is not None:
        rad_lat = math.radians(user_lat)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (ServiceListing.latitude - user_lat) * (ServiceListing.latitude - user_lat)
            + (ServiceListing.longitude - user_lon) * (ServiceListing.longitude - user_lon) * cos_lat_sq
        )

    def _apply_sort(qry):
        if sort_by == "rating":
            return qry.order_by(ServiceListing.rating.desc(), ServiceListing.review_count.desc(), ServiceListing.id.desc())
        if sort_by == "price_asc":
            return qry.order_by(ServiceListing.price_starting_at.asc(), ServiceListing.rating.desc())
        if sort_by == "price_desc":
            return qry.order_by(ServiceListing.price_starting_at.desc(), ServiceListing.rating.desc())
        if dist_expr is not None:
            return qry.order_by(dist_expr.asc(), ServiceListing.rating.desc(), ServiceListing.id.desc())
        return qry.order_by(ServiceListing.rating.desc(), ServiceListing.review_count.desc(), ServiceListing.id.desc())

    query = _apply_sort(query)

    # Direct SQL total count calculation
    total = query.count()

    # Resilient fallback if a specific locality filter produced 0 matches: synthesize on-demand first
    if total == 0 and (locality or city) and not q:
        if user_lat is not None and user_lon is not None:
            try:
                sync_live_services(db, user_lat, user_lon, disp_city or city, disp_locality or locality)
            except Exception:
                pass
        fallback_q = db.query(ServiceListing).filter(ServiceListing.is_available == True)
        if category:
            fallback_q = fallback_q.filter(func.lower(ServiceListing.category) == category.strip().lower())
        if user_lat is not None and user_lon is not None:
            fallback_q = fallback_q.filter(
                (ServiceListing.latitude - user_lat) * (ServiceListing.latitude - user_lat)
                + (ServiceListing.longitude - user_lon) * (ServiceListing.longitude - user_lon)
                <= 0.12
            )
        fallback_q = _apply_sort(fallback_q)
        total = fallback_q.count()
        start = (page - 1) * page_size
        paged_svcs = fallback_q.offset(start).limit(page_size).all()
    else:
        start = (page - 1) * page_size
        paged_svcs = query.offset(start).limit(page_size).all()

    items = []
    for s in paged_svcs:
        dist = None
        if user_lat is not None and user_lon is not None:
            dist = round(haversine_distance_km(user_lat, user_lon, s.latitude, s.longitude), 2)

        items.append({
            "id": s.id,
            "provider_name": s.provider_name,
            "category": s.category,
            "description": s.description,
            "service_area": s.service_area,
            "locality": s.locality,
            "city": s.city,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "phone": s.phone,
            "whatsapp": s.whatsapp,
            "price_starting_at": s.price_starting_at,
            "price_unit": s.price_unit,
            "timing": s.timing,
            "experience_years": s.experience_years,
            "is_verified": s.is_verified,
            "rating": s.rating,
            "review_count": s.review_count,
            "distance_km": dist,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/categories")
def list_service_categories(db: Session = Depends(get_db)):
    cats = (
        db.query(ServiceListing.category, func.count(ServiceListing.id))
        .group_by(ServiceListing.category)
        .all()
    )
    return [{"category": c[0], "count": c[1]} for c in cats]


@router.get("/{service_id}")
def get_service_detail(
    service_id: int,
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    svc = db.query(ServiceListing).filter(ServiceListing.id == service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service listing not found")

    dist = None
    if user_lat is not None and user_lon is not None:
        dist = round(haversine_distance_km(user_lat, user_lon, svc.latitude, svc.longitude), 2)

    return {
        "id": svc.id,
        "provider_name": svc.provider_name,
        "category": svc.category,
        "description": svc.description,
        "service_area": svc.service_area,
        "locality": svc.locality,
        "city": svc.city,
        "latitude": svc.latitude,
        "longitude": svc.longitude,
        "phone": svc.phone,
        "whatsapp": svc.whatsapp,
        "price_starting_at": svc.price_starting_at,
        "price_unit": svc.price_unit,
        "timing": svc.timing,
        "experience_years": svc.experience_years,
        "is_verified": svc.is_verified,
        "rating": svc.rating,
        "review_count": svc.review_count,
        "distance_km": dist,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_service(
    req: ServiceCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ServiceListing(
        provider_name=req.provider_name.strip(),
        user_id=user.id,
        category=req.category.strip(),
        description=req.description.strip() if req.description else None,
        service_area=req.service_area.strip(),
        locality=req.locality.strip(),
        city=req.city.strip(),
        latitude=req.latitude,
        longitude=req.longitude,
        phone=req.phone.strip(),
        whatsapp=req.whatsapp.strip() if req.whatsapp else None,
        price_starting_at=req.price_starting_at,
        price_unit=req.price_unit,
        timing=req.timing,
        experience_years=req.experience_years,
        is_verified=True,
    )
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return {"success": True, "message": f"Service listing created for {svc.provider_name}", "service_id": svc.id}
