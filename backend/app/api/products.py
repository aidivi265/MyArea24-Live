import datetime
import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from backend.app.api.deps import get_current_user
from backend.app.database.models import Business, Product, User
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.business_discovery_service import sync_live_businesses, extract_locality_tokens

router = APIRouter(prefix="/api/v1/products", tags=["Nearby Products & Price Comparison"])


class ProductCreateRequest(BaseModel):
    business_id: int
    name: str
    brand: Optional[str] = None
    model_variant: Optional[str] = None
    category: str
    description: Optional[str] = None
    local_price: float
    mrp: Optional[float] = None
    online_price: Optional[float] = None
    online_provider: Optional[str] = None
    online_url: Optional[str] = None
    availability_status: str = "in_stock"  # 'in_stock', 'confirm_with_seller', 'low_stock', 'out_of_stock'
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    is_featured: bool = False


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model_variant: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    local_price: Optional[float] = None
    mrp: Optional[float] = None
    online_price: Optional[float] = None
    online_provider: Optional[str] = None
    online_url: Optional[str] = None
    availability_status: Optional[str] = None
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    is_featured: Optional[bool] = None


def format_relative_freshness(dt: Optional[datetime.datetime]) -> str:
    if not dt:
        return "Price recently verified"
    delta = datetime.datetime.utcnow() - dt
    if delta.total_seconds() < 3600:
        mins = max(1, int(delta.total_seconds() // 60))
        return f"Updated {mins}m ago"
    elif delta.total_seconds() < 86400:
        hrs = int(delta.total_seconds() // 3600)
        return f"Updated {hrs}h ago"
    else:
        days = int(delta.total_seconds() // 86400)
        return f"Updated {days}d ago"


@router.get("", response_model=Dict[str, Any])
def search_products(
    q: Optional[str] = Query(None, description="Search term across name, brand, model"),
    category: Optional[str] = Query(None, description="Category filter"),
    brand: Optional[str] = Query(None, description="Brand filter"),
    business_id: Optional[int] = Query(None, description="Filter by specific merchant business ID"),
    locality: Optional[str] = Query(None, description="Locality or area filter"),
    city: Optional[str] = Query(None, description="City filter"),
    min_price: Optional[float] = Query(None, description="Minimum local price"),
    max_price: Optional[float] = Query(None, description="Maximum local price"),
    in_stock_only: Optional[bool] = Query(False, description="Filter for in-stock products"),
    user_lat: Optional[float] = Query(None, description="User latitude for distance calculation"),
    user_lon: Optional[float] = Query(None, description="User longitude for distance calculation"),
    sort_by: str = Query("relevance", description="relevance, price_asc, price_desc, distance"),
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

    # Dynamic live business & product discovery if coordinates provided and area count is low
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

    query = db.query(Product).join(Business, Product.business_id == Business.id)
    if business_id is not None:
        query = query.filter(Product.business_id == business_id)
    else:
        query = query.filter(Business.status == "active")

    SYNONYM_MAP = {
        "dawa": "Pharmacy", "dawai": "Pharmacy", "medicine": "Pharmacy", "chemist": "Pharmacy",
        "sabzi": "Grocery", "vegetable": "Grocery", "ration": "Grocery", "kirana": "Grocery",
        "mithai": "Food & Dining", "sweets": "Food & Dining",
        "phone": "Electronics", "mobile": "Electronics", "smartphone": "Electronics", "laptop": "Electronics",
    }

    if q:
        cleaned_q = q.strip().lower()
        term = f"%{cleaned_q}%"
        q_clauses = [
            func.lower(Product.name).like(term),
            func.lower(Product.brand).like(term),
            func.lower(Product.model_variant).like(term),
            func.lower(Product.category).like(term),
            func.lower(Product.description).like(term),
            func.lower(Business.name).like(term),
        ]
        for syn_word, syn_target in SYNONYM_MAP.items():
            if syn_word in cleaned_q:
                q_clauses.append(func.lower(Product.category).like(f"%{syn_target.lower()}%"))
        query = query.filter(or_(*q_clauses))

    if category:
        query = query.filter(func.lower(Product.category) == category.strip().lower())

    if brand:
        query = query.filter(func.lower(Product.brand) == brand.strip().lower())

    tokens = extract_locality_tokens(locality, city) if business_id is None else []
    if tokens:
        token_filters = []
        for tok in tokens:
            pattern = f"%{tok.lower()}%"
            token_filters.append(func.lower(Business.locality).like(pattern))
            token_filters.append(func.lower(Business.city).like(pattern))
            token_filters.append(func.lower(Business.address).like(pattern))
        query = query.filter(or_(*token_filters))

    if min_price is not None:
        query = query.filter(Product.local_price >= min_price)

    if max_price is not None:
        query = query.filter(Product.local_price <= max_price)

    if in_stock_only:
        query = query.filter(Product.availability_status == "in_stock")

    # SQL Ordering
    if sort_by == "price_asc":
        query = query.order_by(Product.local_price.asc(), Product.id.desc())
    elif sort_by == "price_desc":
        query = query.order_by(Product.local_price.desc(), Product.id.desc())
    elif sort_by == "distance" and user_lat is not None and user_lon is not None:
        rad_lat = math.radians(user_lat)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (Business.latitude - user_lat) * (Business.latitude - user_lat)
            + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
        )
        query = query.order_by(dist_expr.asc(), Product.id.desc())
    else:
        # Default relevance (featured first, then recent)
        query = query.order_by(Product.is_featured.desc(), Product.id.desc())

    # Direct SQL total count calculation
    total = query.count()

    # Graceful fallback: If strict locality filter yielded 0 results, show surrounding area products
    if total == 0 and (locality or city) and business_id is None:
        fallback_query = db.query(Product).join(Business, Product.business_id == Business.id).filter(Business.status == "active")
        if q:
            term = f"%{q.strip().lower()}%"
            fallback_query = fallback_query.filter(
                or_(
                    func.lower(Product.name).like(term),
                    func.lower(Product.brand).like(term),
                    func.lower(Product.model_variant).like(term),
                    func.lower(Product.category).like(term),
                    func.lower(Product.description).like(term),
                    func.lower(Business.name).like(term),
                )
            )
        if category:
            fallback_query = fallback_query.filter(func.lower(Product.category) == category.strip().lower())
        if brand:
            fallback_query = fallback_query.filter(func.lower(Product.brand) == brand.strip().lower())
        if min_price is not None:
            fallback_query = fallback_query.filter(Product.local_price >= min_price)
        if max_price is not None:
            fallback_query = fallback_query.filter(Product.local_price <= max_price)
        if in_stock_only:
            fallback_query = fallback_query.filter(Product.availability_status == "in_stock")

        if sort_by == "price_asc":
            fallback_query = fallback_query.order_by(Product.local_price.asc(), Product.id.desc())
        elif sort_by == "price_desc":
            fallback_query = fallback_query.order_by(Product.local_price.desc(), Product.id.desc())
        elif sort_by == "distance" and user_lat is not None and user_lon is not None:
            rad_lat = math.radians(user_lat)
            cos_lat = math.cos(rad_lat)
            cos_lat_sq = cos_lat * cos_lat
            dist_expr = (
                (Business.latitude - user_lat) * (Business.latitude - user_lat)
                + (Business.longitude - user_lon) * (Business.longitude - user_lon) * cos_lat_sq
            )
            fallback_query = fallback_query.order_by(dist_expr.asc(), Product.id.desc())
        else:
            fallback_query = fallback_query.order_by(Product.is_featured.desc(), Product.id.desc())

        total = fallback_query.count()
        query = fallback_query

    # Direct SQL OFFSET and LIMIT pagination
    start = (page - 1) * page_size
    paged_products = query.offset(start).limit(page_size).all()

    items = []
    for p in paged_products:
        b = p.business
        dist = None
        if user_lat is not None and user_lon is not None:
            dist = round(haversine_distance_km(user_lat, user_lon, b.latitude, b.longitude), 2)

        # Price comparison analysis
        savings_amount = 0.0
        savings_percent = 0.0
        better_offline = False
        if p.online_price and p.online_price > 0:
            diff = p.online_price - p.local_price
            if diff > 0:
                savings_amount = round(diff, 2)
                savings_percent = round((diff / p.online_price) * 100, 1)
                better_offline = True

        items.append({
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
            "savings_amount": savings_amount,
            "savings_percent": savings_percent,
            "better_offline": better_offline,
            "availability_status": p.availability_status,
            "stock_quantity": p.stock_quantity,
            "image_url": p.image_url,
            "price_updated_at": p.price_updated_at.isoformat() if p.price_updated_at else None,
            "freshness_label": format_relative_freshness(p.price_updated_at),
            "is_featured": p.is_featured,
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
                "rating": b.rating,
                "latitude": b.latitude,
                "longitude": b.longitude,
                "distance_km": dist,
            },
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/categories")
def list_product_categories(db: Session = Depends(get_db)):
    """Returns product categories with active item counts."""
    cats = (
        db.query(Product.category, func.count(Product.id))
        .join(Business, Product.business_id == Business.id)
        .filter(Business.status == "active")
        .group_by(Product.category)
        .all()
    )
    return [{"category": c[0], "count": c[1]} for c in cats]


@router.get("/{product_id}")
def get_product_detail(
    product_id: int,
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    b = product.business
    dist = None
    if user_lat is not None and user_lon is not None:
        dist = round(haversine_distance_km(user_lat, user_lon, b.latitude, b.longitude), 2)

    savings_amount = 0.0
    savings_percent = 0.0
    better_offline = False
    if product.online_price and product.online_price > 0:
        diff = product.online_price - product.local_price
        if diff > 0:
            savings_amount = round(diff, 2)
            savings_percent = round((diff / product.online_price) * 100, 1)
            better_offline = True

    # Nearby stores with same brand/category
    similar = (
        db.query(Product)
        .join(Business, Product.business_id == Business.id)
        .filter(Product.category == product.category, Product.id != product.id)
        .limit(4)
        .all()
    )

    return {
        "product": {
            "id": product.id,
            "name": product.name,
            "brand": product.brand,
            "model_variant": product.model_variant,
            "category": product.category,
            "description": product.description,
            "local_price": product.local_price,
            "mrp": product.mrp,
            "online_price": product.online_price,
            "online_provider": product.online_provider,
            "online_url": product.online_url,
            "savings_amount": savings_amount,
            "savings_percent": savings_percent,
            "better_offline": better_offline,
            "availability_status": product.availability_status,
            "stock_quantity": product.stock_quantity,
            "image_url": product.image_url,
            "price_updated_at": product.price_updated_at.isoformat() if product.price_updated_at else None,
            "freshness_label": format_relative_freshness(product.price_updated_at),
            "is_featured": product.is_featured,
        },
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
            "rating": b.rating,
            "latitude": b.latitude,
            "longitude": b.longitude,
            "distance_km": dist,
            "opening_time": b.opening_time,
            "closing_time": b.closing_time,
        },
        "similar_products": [
            {
                "id": s.id,
                "name": s.name,
                "brand": s.brand,
                "local_price": s.local_price,
                "image_url": s.image_url,
                "store_name": s.business.name,
                "locality": s.business.locality,
            }
            for s in similar
        ],
    }


@router.get("/{product_id}/compare")
def compare_product_prices(
    product_id: int,
    user_lat: Optional[float] = Query(None),
    user_lon: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Compares a product's offline price at nearby local stores against online marketplace benchmarks (PPT Slide 07).
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    b = product.business
    online_price = product.online_price or product.mrp or round(product.local_price * 1.08, 2)
    savings = max(0.0, round(online_price - product.local_price, 2))

    # Find matching or category-peer products across nearby stores
    peers = (
        db.query(Product)
        .join(Business, Product.business_id == Business.id)
        .filter(Product.category == product.category)
        .limit(6)
        .all()
    )
    local_options = []
    for p in peers:
        dist = (
            round(haversine_distance_km(user_lat, user_lon, p.business.latitude, p.business.longitude), 2)
            if user_lat is not None and user_lon is not None
            else None
        )
        local_options.append({
            "product_id": p.id,
            "product_name": p.name,
            "store_name": p.business.name,
            "store_slug": p.business.slug,
            "locality": p.business.locality,
            "city": p.business.city,
            "local_price": p.local_price,
            "availability_status": p.availability_status,
            "distance_km": dist,
            "phone": p.business.phone,
        })

    prices = [opt["local_price"] for opt in local_options] or [product.local_price]
    return {
        "product_id": product.id,
        "product_name": product.name,
        "category": product.category,
        "price_range": {
            "min_local_price": min(prices),
            "max_local_price": max(prices),
            "online_benchmark_price": online_price,
            "online_provider": product.online_provider or "Amazon / Flipkart",
        },
        "savings_vs_online": savings,
        "better_offline": product.local_price <= online_price,
        "primary_store": {
            "id": b.id,
            "name": b.name,
            "slug": b.slug,
            "locality": b.locality,
            "local_price": product.local_price,
            "availability_status": product.availability_status,
        },
        "nearby_store_options": local_options,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(
    req: ProductCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Adds a new product to a merchant's digital storefront.
    """
    business = db.query(Business).filter(Business.id == req.business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if user.role != "admin" and business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to add products to this business")

    prod = Product(
        business_id=req.business_id,
        name=req.name.strip(),
        brand=req.brand.strip() if req.brand else None,
        model_variant=req.model_variant.strip() if req.model_variant else None,
        category=req.category.strip(),
        description=req.description.strip() if req.description else None,
        local_price=req.local_price,
        mrp=req.mrp,
        online_price=req.online_price,
        online_provider=req.online_provider,
        online_url=req.online_url,
        availability_status=req.availability_status,
        stock_quantity=req.stock_quantity,
        image_url=req.image_url,
        price_updated_at=datetime.datetime.utcnow(),
        is_featured=req.is_featured,
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)

    return {
        "success": True,
        "message": f"Product '{prod.name}' added to {business.name} catalogue",
        "product_id": prod.id,
    }


@router.put("/{product_id}")
def update_product(
    product_id: int,
    req: ProductUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if user.role != "admin" and prod.business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this product")

    if req.name is not None:
        prod.name = req.name.strip()
    if req.brand is not None:
        prod.brand = req.brand.strip()
    if req.model_variant is not None:
        prod.model_variant = req.model_variant.strip()
    if req.category is not None:
        prod.category = req.category.strip()
    if req.description is not None:
        prod.description = req.description.strip()
    if req.local_price is not None:
        prod.local_price = req.local_price
        prod.price_updated_at = datetime.datetime.utcnow()
    if req.mrp is not None:
        prod.mrp = req.mrp
    if req.online_price is not None:
        prod.online_price = req.online_price
    if req.online_provider is not None:
        prod.online_provider = req.online_provider
    if req.online_url is not None:
        prod.online_url = req.online_url
    if req.availability_status is not None:
        prod.availability_status = req.availability_status
    if req.stock_quantity is not None:
        prod.stock_quantity = req.stock_quantity
    if req.image_url is not None:
        prod.image_url = req.image_url
    if req.is_featured is not None:
        prod.is_featured = req.is_featured

    db.commit()
    db.refresh(prod)
    return {
        "success": True,
        "message": "Product updated successfully",
        "product": {
            "id": prod.id,
            "name": prod.name,
            "category": prod.category,
            "local_price": prod.local_price,
            "mrp": prod.mrp,
            "availability_status": prod.availability_status,
            "description": prod.description,
        },
    }


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if user.role != "admin" and prod.business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this product")

    db.delete(prod)
    db.commit()
    return {"success": True, "message": "Product deleted from catalogue"}
