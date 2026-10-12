import datetime
import math
import re
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, and_

from backend.app.api.deps import get_current_user, get_optional_user
from backend.app.database.models import Business, Product, Offer, ServiceListing, User, AnalyticsEvent
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.business_discovery_service import sync_live_businesses, extract_locality_tokens

router = APIRouter(prefix="/api/v1/businesses", tags=["Local Businesses & Directory"])


class BusinessCreateRequest(BaseModel):
    name: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    address: str
    locality: str
    city: str
    state: str = "Delhi NCR"
    pincode: Optional[str] = None
    latitude: float
    longitude: float
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    opening_time: str = "09:00"
    closing_time: str = "21:30"
    days_open: str = "Mon-Sun"
    image_url: Optional[str] = None


class BusinessUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    locality: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    days_open: Optional[str] = None
    image_url: Optional[str] = None


class BusinessItemResponse(BaseModel):
    id: int
    slug: str
    name: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    address: str
    locality: str
    city: str
    state: str
    pincode: Optional[str] = None
    latitude: float
    longitude: float
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    opening_time: str
    closing_time: str
    days_open: str
    image_url: Optional[str] = None
    is_verified: bool
    status: str
    rating: float
    review_count: int
    view_count: int
    call_clicks: int
    direction_clicks: int
    distance_km: Optional[float] = None
    is_open_now: bool = True
    active_products_count: int = 0
    active_offers_count: int = 0


def generate_slug(name: str, locality: str, db: Session) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "-", f"{name}-{locality}").strip("-").lower()
    slug = base
    counter = 1
    while db.query(Business).filter(Business.slug == slug).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


IST_TZ = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def check_is_open_now(opening_str: str, closing_str: str) -> bool:
    try:
        now = datetime.datetime.now(IST_TZ)
        cur_min = now.hour * 60 + now.minute
        
        o_h, o_m = map(int, opening_str.split(":"))
        c_h, c_m = map(int, closing_str.split(":"))
        
        o_min = o_h * 60 + o_m
        c_min = c_h * 60 + c_m
        
        if c_min > o_min:
            return o_min <= cur_min <= c_min
        else:
            return cur_min >= o_min or cur_min <= c_min
    except Exception:
        return True


@router.get("", response_model=Dict[str, Any])
def list_businesses(
    q: Optional[str] = Query(None, description="Search term for name, category, or address"),
    category: Optional[str] = Query(None, description="Filter by business category"),
    locality: Optional[str] = Query(None, description="Filter by locality or area"),
    city: Optional[str] = Query(None, description="Filter by city"),
    user_lat: Optional[float] = Query(None, description="User latitude for distance sorting"),
    user_lon: Optional[float] = Query(None, description="User longitude for distance sorting"),
    open_now: Optional[bool] = Query(None, description="Filter only stores open now"),
    sort_by: Optional[str] = Query(None, description="Sort order: distance, rating, newest"),
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
                user_lat, user_lon = c_lat, c_lon
        except Exception:
            pass

    # Dynamic live business discovery if coordinates provided and businesses in area are low
    if user_lat is not None and user_lon is not None:
        try:
            nearby_count = db.query(Business).filter(
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) <= 0.04
            ).count()
            if nearby_count < 4:
                sync_live_businesses(db, user_lat, user_lon, disp_city or city, disp_locality or locality)
        except Exception:
            pass

    query = db.query(Business).filter(Business.status == "active")

    SYNONYM_MAP = {
        "dawa": "Pharmacy", "dawai": "Pharmacy", "medicine": "Pharmacy", "chemist": "Pharmacy", "medical": "Pharmacy",
        "sabzi": "Grocery", "vegetable": "Grocery", "ration": "Grocery", "kirana": "Grocery", "supermarket": "Grocery",
        "mithai": "Food & Dining", "sweets": "Food & Dining", "chai": "Food & Dining", "cafe": "Food & Dining", "restaurant": "Food & Dining",
        "phone": "Electronics", "mobile": "Electronics", "laptop": "Electronics",
        "bijli": "Electrician", "plumber": "Services", "salon": "Services", "parlour": "Services"
    }

    if q:
        cleaned_q = q.strip().lower()
        term = f"%{cleaned_q}%"
        q_clauses = [
            func.lower(Business.name).like(term),
            func.lower(Business.category).like(term),
            func.lower(Business.description).like(term),
            func.lower(Business.locality).like(term),
        ]
        for syn_word, syn_target in SYNONYM_MAP.items():
            if syn_word in cleaned_q:
                q_clauses.append(func.lower(Business.category).like(f"%{syn_target.lower()}%"))
                q_clauses.append(func.lower(Business.name).like(f"%{syn_target.lower()}%"))
        query = query.filter(or_(*q_clauses))

    if category:
        query = query.filter(func.lower(Business.category) == category.strip().lower())

    tokens = extract_locality_tokens(locality, city)
    if tokens:
        token_filters = []
        for tok in tokens:
            pattern = f"%{tok.lower()}%"
            token_filters.append(func.lower(Business.locality).like(pattern))
            token_filters.append(func.lower(Business.city).like(pattern))
            token_filters.append(func.lower(Business.address).like(pattern))
        query = query.filter(or_(*token_filters))

    if open_now is True:
        now_time_str = datetime.datetime.now().strftime("%H:%M")
        query = query.filter(
            or_(
                and_(
                    Business.opening_time <= Business.closing_time,
                    Business.opening_time <= now_time_str,
                    Business.closing_time >= now_time_str,
                ),
                and_(
                    Business.opening_time > Business.closing_time,
                    or_(
                        now_time_str >= Business.opening_time,
                        now_time_str <= Business.closing_time,
                    ),
                ),
            )
        )

    # SQL Distance & Relevance Ordering
    if sort_by == "rating":
        query = query.order_by(Business.rating.desc(), Business.review_count.desc(), Business.id.desc())
    elif sort_by == "newest":
        query = query.order_by(Business.created_at.desc(), Business.id.desc())
    elif user_lat is not None and user_lon is not None:
        rad_lat = math.radians(user_lat)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (Business.latitude - user_lat) * (Business.latitude - user_lat)
            + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
        )
        query = query.order_by(dist_expr.asc(), Business.rating.desc(), Business.id.desc())
    else:
        query = query.order_by(Business.rating.desc(), Business.review_count.desc(), Business.id.desc())

    # Direct SQL total count calculation
    total = query.count()

    # Graceful fallback: If strict token filter yielded 0 results, show closest active businesses
    if total == 0 and (locality or city):
        fallback_query = db.query(Business).filter(Business.status == "active")
        if category:
            fallback_query = fallback_query.filter(func.lower(Business.category) == category.strip().lower())
        if q:
            term = f"%{q.strip().lower()}%"
            fallback_query = fallback_query.filter(
                or_(
                    func.lower(Business.name).like(term),
                    func.lower(Business.category).like(term),
                    func.lower(Business.description).like(term),
                )
            )
        if user_lat is not None and user_lon is not None:
            rad_lat = math.radians(user_lat)
            cos_lat = math.cos(rad_lat)
            cos_lat_sq = cos_lat * cos_lat
            dist_expr = (
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
            )
            fallback_query = fallback_query.order_by(dist_expr.asc(), Business.rating.desc(), Business.id.desc())
        else:
            fallback_query = fallback_query.order_by(Business.rating.desc(), Business.review_count.desc(), Business.id.desc())
        total = fallback_query.count()
        query = fallback_query

    # Direct SQL OFFSET and LIMIT pagination
    start = (page - 1) * page_size
    paged_businesses = query.offset(start).limit(page_size).all()

    # Batch query product and offer counts for the sliced page only (eliminates 2N+1 query storm)
    biz_ids = [b.id for b in paged_businesses]
    prod_counts: Dict[int, int] = {}
    offer_counts: Dict[int, int] = {}
    if biz_ids:
        prod_counts = dict(
            db.query(Product.business_id, func.count(Product.id))
            .filter(Product.business_id.in_(biz_ids))
            .group_by(Product.business_id)
            .all()
        )
        offer_counts = dict(
            db.query(Offer.business_id, func.count(Offer.id))
            .filter(Offer.business_id.in_(biz_ids), Offer.is_active == True)
            .group_by(Offer.business_id)
            .all()
        )

    results = []
    for b in paged_businesses:
        dist = None
        if user_lat is not None and user_lon is not None:
            dist = round(haversine_distance_km(user_lat, user_lon, b.latitude, b.longitude), 2)

        open_status = check_is_open_now(b.opening_time, b.closing_time)

        results.append(
            BusinessItemResponse(
                id=b.id,
                slug=b.slug,
                name=b.name,
                category=b.category,
                subcategory=b.subcategory,
                description=b.description,
                address=b.address,
                locality=b.locality,
                city=b.city,
                state=b.state,
                pincode=b.pincode,
                latitude=b.latitude,
                longitude=b.longitude,
                phone=b.phone,
                whatsapp=b.whatsapp,
                email=b.email,
                website=b.website,
                opening_time=b.opening_time,
                closing_time=b.closing_time,
                days_open=b.days_open,
                image_url=b.image_url,
                is_verified=b.is_verified,
                status=b.status,
                rating=b.rating,
                review_count=b.review_count,
                view_count=b.view_count,
                call_clicks=b.call_clicks,
                direction_clicks=b.direction_clicks,
                distance_km=dist,
                is_open_now=open_status,
                active_products_count=prod_counts.get(b.id, 0),
                active_offers_count=offer_counts.get(b.id, 0),
            )
        )

    return {
        "items": [item.dict() for item in results],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/categories")
def list_business_categories(db: Session = Depends(get_db)):
    """Returns business categories with listing counts."""
    cats = (
        db.query(Business.category, func.count(Business.id))
        .filter(Business.status == "active")
        .group_by(Business.category)
        .all()
    )
    return [{"category": c[0], "count": c[1]} for c in cats]


@router.get("/{id_or_slug}")
def get_business_detail(
    id_or_slug: str,
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Returns public digital storefront data for a single business, including its
    catalogue products and active offers.
    """
    if id_or_slug.isdigit():
        business = db.query(Business).filter(Business.id == int(id_or_slug)).first()
    else:
        business = db.query(Business).filter(Business.slug == id_or_slug).first()

    if not business:
        raise HTTPException(status_code=404, detail="Business profile not found")

    # Increment view count
    business.view_count += 1
    db.commit()

    dist = None
    if user_lat is not None and user_lon is not None:
        dist = round(haversine_distance_km(user_lat, user_lon, business.latitude, business.longitude), 2)

    # Fetch products
    products = (
        db.query(Product)
        .filter(Product.business_id == business.id)
        .order_by(Product.is_featured.desc(), Product.created_at.desc())
        .all()
    )

    # Fetch active offers
    offers = (
        db.query(Offer)
        .filter(Offer.business_id == business.id, Offer.is_active == True)
        .order_by(Offer.created_at.desc())
        .all()
    )

    # Fetch service listings
    services = (
        db.query(ServiceListing)
        .filter(ServiceListing.business_id == business.id, ServiceListing.is_available == True)
        .order_by(ServiceListing.created_at.desc())
        .all()
    )

    return {
        "business": {
            "id": business.id,
            "slug": business.slug,
            "name": business.name,
            "category": business.category,
            "subcategory": business.subcategory,
            "description": business.description,
            "address": business.address,
            "locality": business.locality,
            "city": business.city,
            "state": business.state,
            "pincode": business.pincode,
            "latitude": business.latitude,
            "longitude": business.longitude,
            "phone": business.phone,
            "whatsapp": business.whatsapp,
            "email": business.email,
            "website": business.website,
            "opening_time": business.opening_time,
            "closing_time": business.closing_time,
            "days_open": business.days_open,
            "image_url": business.image_url,
            "is_verified": business.is_verified,
            "status": business.status,
            "rating": business.rating,
            "review_count": business.review_count,
            "view_count": business.view_count,
            "call_clicks": business.call_clicks,
            "direction_clicks": business.direction_clicks,
            "distance_km": dist,
            "is_open_now": check_is_open_now(business.opening_time, business.closing_time),
        },
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "brand": p.brand,
                "model_variant": p.model_variant,
                "category": p.category,
                "description": p.description,
                "local_price": p.local_price,
                "mrp": p.mrp,
                "online_price": p.online_price,
                "online_provider": p.online_provider,
                "online_url": p.online_url,
                "availability_status": p.availability_status,
                "stock_quantity": p.stock_quantity,
                "image_url": p.image_url,
                "price_updated_at": p.price_updated_at.isoformat() if p.price_updated_at else None,
                "is_featured": p.is_featured,
            }
            for p in products
        ],
        "offers": [
            {
                "id": o.id,
                "title": o.title,
                "description": o.description,
                "discount_text": o.discount_text,
                "coupon_code": o.coupon_code,
                "category": o.category,
                "valid_until": o.valid_until.isoformat() if o.valid_until else None,
                "terms_conditions": o.terms_conditions,
                "banner_image_url": o.banner_image_url,
            }
            for o in offers
        ],
        "services": [
            {
                "id": s.id,
                "business_id": s.business_id,
                "provider_name": s.provider_name,
                "category": s.category,
                "description": s.description,
                "price_starting_at": s.price_starting_at,
                "price_unit": s.price_unit,
                "experience_years": s.experience_years,
                "phone": s.phone,
                "whatsapp": s.whatsapp,
                "locality": s.locality,
                "city": s.city,
                "is_available": s.is_available,
                "rating": s.rating,
                "review_count": s.review_count,
            }
            for s in services
        ],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_business(
    req: BusinessCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Onboards a merchant and creates a digital storefront.
    """
    slug = generate_slug(req.name, req.locality, db)
    
    # Auto-upgrade user role to merchant if resident
    if user.role == "resident":
        user.role = "merchant"

    business = Business(
        slug=slug,
        name=req.name.strip(),
        owner_id=user.id,
        category=req.category.strip(),
        subcategory=req.subcategory.strip() if req.subcategory else None,
        description=req.description.strip() if req.description else None,
        address=req.address.strip(),
        locality=req.locality.strip(),
        city=req.city.strip(),
        state=req.state.strip(),
        pincode=req.pincode.strip() if req.pincode else None,
        latitude=req.latitude,
        longitude=req.longitude,
        phone=req.phone or user.phone,
        whatsapp=req.whatsapp or user.phone,
        email=req.email or user.email,
        website=req.website,
        opening_time=req.opening_time,
        closing_time=req.closing_time,
        days_open=req.days_open,
        image_url=req.image_url,
        is_verified=True,
        status="active",
    )
    db.add(business)
    db.commit()
    db.refresh(business)

    return {
        "success": True,
        "message": f"Storefront created for {business.name}!",
        "business": {
            "id": business.id,
            "slug": business.slug,
            "name": business.name,
            "category": business.category,
        },
    }


@router.put("/{business_id}")
@router.patch("/{business_id}", include_in_schema=False)
def update_business(
    business_id: int,
    req: BusinessUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Allows a merchant (or admin) to update their store profile, operating hours
    (opening_time, closing_time, days_open), contact numbers (phone, whatsapp), and address.
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if user.role != "admin" and business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this business profile")

    if req.name is not None and req.name.strip():
        business.name = req.name.strip()
    if req.category is not None and req.category.strip():
        business.category = req.category.strip()
    if req.subcategory is not None:
        business.subcategory = req.subcategory.strip() or None
    if req.description is not None:
        business.description = req.description.strip() or None
    if req.address is not None and req.address.strip():
        business.address = req.address.strip()
    if req.locality is not None and req.locality.strip():
        business.locality = req.locality.strip()
    if req.city is not None and req.city.strip():
        business.city = req.city.strip()
    if req.state is not None and req.state.strip():
        business.state = req.state.strip()
    if req.pincode is not None:
        business.pincode = req.pincode.strip() or None
    if req.latitude is not None:
        business.latitude = req.latitude
    if req.longitude is not None:
        business.longitude = req.longitude
    if req.phone is not None:
        business.phone = req.phone.strip() or None
    if req.whatsapp is not None:
        business.whatsapp = req.whatsapp.strip() or None
    if req.email is not None:
        business.email = req.email.strip() or None
    if req.website is not None:
        business.website = req.website.strip() or None
    if req.opening_time is not None and req.opening_time.strip():
        business.opening_time = req.opening_time.strip()
    if req.closing_time is not None and req.closing_time.strip():
        business.closing_time = req.closing_time.strip()
    if req.days_open is not None and req.days_open.strip():
        business.days_open = req.days_open.strip()
    if req.image_url is not None:
        business.image_url = req.image_url.strip() or None

    db.commit()
    db.refresh(business)

    return {
        "success": True,
        "message": f"Business profile for '{business.name}' updated successfully!",
        "business": {
            "id": business.id,
            "slug": business.slug,
            "name": business.name,
            "category": business.category,
            "description": business.description,
            "address": business.address,
            "locality": business.locality,
            "city": business.city,
            "state": business.state,
            "phone": business.phone,
            "whatsapp": business.whatsapp,
            "opening_time": business.opening_time,
            "closing_time": business.closing_time,
            "days_open": business.days_open,
            "is_open_now": check_is_open_now(business.opening_time, business.closing_time),
        },
    }

