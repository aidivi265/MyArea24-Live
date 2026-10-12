from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_optional_user
from backend.app.database.models import (
    Business,
    CivicBulletin,
    Event,
    Offer,
    Product,
    SavedItem,
    ServiceListing,
    User,
)
from backend.app.database.session import get_db

router = APIRouter(prefix="/api/v1/saved", tags=["User Saved Items & Bookmarks"])


class SaveItemRequest(BaseModel):
    item_type: str  # 'business', 'product', 'service', 'offer', 'bulletin', 'event'
    item_id: int


class SyncSavedItemsRequest(BaseModel):
    items: List[SaveItemRequest]


@router.get("", response_model=Dict[str, Any])
def get_user_saved_items(
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    if not user:
        return {
            "total": 0,
            "businesses": [],
            "products": [],
            "services": [],
            "offers": [],
            "bulletins": [],
            "events": [],
        }

    saved_records = (
        db.query(SavedItem)
        .filter(SavedItem.user_id == user.id)
        .order_by(SavedItem.created_at.desc())
        .all()
    )

    biz_ids = [r.item_id for r in saved_records if r.item_type == "business"]
    prod_ids = [r.item_id for r in saved_records if r.item_type == "product"]
    svc_ids = [r.item_id for r in saved_records if r.item_type == "service"]
    offer_ids = [r.item_id for r in saved_records if r.item_type == "offer"]
    bulletin_ids = [r.item_id for r in saved_records if r.item_type == "bulletin"]
    event_ids = [r.item_id for r in saved_records if r.item_type == "event"]

    biz_map = {b.id: b for b in db.query(Business).filter(Business.id.in_(biz_ids)).all()} if biz_ids else {}
    prod_map = {p.id: p for p in db.query(Product).filter(Product.id.in_(prod_ids)).all()} if prod_ids else {}
    svc_map = {s.id: s for s in db.query(ServiceListing).filter(ServiceListing.id.in_(svc_ids)).all()} if svc_ids else {}
    offer_map = {o.id: o for o in db.query(Offer).filter(Offer.id.in_(offer_ids)).all()} if offer_ids else {}
    bulletin_map = {b.id: b for b in db.query(CivicBulletin).filter(CivicBulletin.id.in_(bulletin_ids)).all()} if bulletin_ids else {}
    event_map = {e.id: e for e in db.query(Event).filter(Event.id.in_(event_ids)).all()} if event_ids else {}

    businesses = []
    products = []
    services = []
    offers = []
    bulletins = []
    events = []

    for r in saved_records:
        if r.item_type == "business":
            b = biz_map.get(r.item_id)
            if b:
                businesses.append({
                    "id": b.id,
                    "slug": b.slug,
                    "name": b.name,
                    "category": b.category,
                    "address": b.address,
                    "locality": b.locality,
                    "city": b.city,
                    "phone": b.phone,
                    "rating": b.rating,
                    "saved_at": r.created_at.isoformat(),
                })
        elif r.item_type == "product":
            p = prod_map.get(r.item_id)
            if p:
                businesses_name = p.business.name if p.business else ""
                business_loc = p.business.locality if p.business else ""
                products.append({
                    "id": p.id,
                    "name": p.name,
                    "brand": p.brand,
                    "category": p.category,
                    "local_price": p.local_price,
                    "online_price": p.online_price,
                    "availability_status": p.availability_status,
                    "image_url": p.image_url,
                    "store_name": businesses_name,
                    "locality": business_loc,
                    "saved_at": r.created_at.isoformat(),
                })
        elif r.item_type == "service":
            s = svc_map.get(r.item_id)
            if s:
                services.append({
                    "id": s.id,
                    "provider_name": s.provider_name,
                    "category": s.category,
                    "service_area": s.service_area,
                    "phone": s.phone,
                    "rating": s.rating,
                    "saved_at": r.created_at.isoformat(),
                })
        elif r.item_type == "offer":
            o = offer_map.get(r.item_id)
            if o:
                store_name = o.business.name if o.business else ""
                offers.append({
                    "id": o.id,
                    "title": o.title,
                    "discount_text": o.discount_text,
                    "coupon_code": o.coupon_code,
                    "store_name": store_name,
                    "valid_until": o.valid_until.isoformat(),
                    "saved_at": r.created_at.isoformat(),
                })
        elif r.item_type == "bulletin":
            b = bulletin_map.get(r.item_id)
            if b:
                bulletins.append({
                    "id": b.id,
                    "title": b.title,
                    "summary": b.summary,
                    "source_agency": b.source_agency,
                    "category": b.category,
                    "locality": b.locality,
                    "city": b.city,
                    "priority": b.priority,
                    "saved_at": r.created_at.isoformat(),
                })
        elif r.item_type == "event":
            e = event_map.get(r.item_id)
            if e:
                events.append({
                    "id": e.id,
                    "title": e.title,
                    "category": e.category,
                    "organizer": e.organizer,
                    "venue_name": e.venue_name,
                    "address": e.address,
                    "locality": e.locality,
                    "city": e.city,
                    "timing_text": e.timing_text,
                    "saved_at": r.created_at.isoformat(),
                })

    return {
        "total": len(saved_records),
        "businesses": businesses,
        "products": products,
        "services": services,
        "offers": offers,
        "bulletins": bulletins,
        "events": events,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def toggle_save_item(
    req: SaveItemRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(SavedItem)
        .filter(
            SavedItem.user_id == user.id,
            SavedItem.item_type == req.item_type,
            SavedItem.item_id == req.item_id,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False, "message": f"Removed from saved {req.item_type}s"}
    else:
        new_item = SavedItem(
            user_id=user.id,
            item_type=req.item_type,
            item_id=req.item_id,
        )
        db.add(new_item)
        db.commit()
        return {"saved": True, "message": f"Saved {req.item_type} to your bookmarks"}


@router.post("/sync")
def sync_saved_items(
    req: SyncSavedItemsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Synchronizes locally bookmarked items (e.g. from guest mode) to the user's permanent account.
    """
    added_count = 0
    for item in req.items:
        exists = (
            db.query(SavedItem)
            .filter(
                SavedItem.user_id == user.id,
                SavedItem.item_type == item.item_type,
                SavedItem.item_id == item.item_id,
            )
            .first()
        )
        if not exists:
            db.add(SavedItem(user_id=user.id, item_type=item.item_type, item_id=item.item_id))
            added_count += 1

    if added_count > 0:
        db.commit()

    total = db.query(SavedItem).filter(SavedItem.user_id == user.id).count()
    return {"success": True, "added": added_count, "total": total}


@router.delete("/all")
def clear_all_saved_items(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Removes all bookmarked items for the current user.
    """
    deleted_count = db.query(SavedItem).filter(SavedItem.user_id == user.id).delete()
    db.commit()
    return {"success": True, "deleted_count": deleted_count, "message": "All saved bookmarks cleared"}


@router.delete("/{item_type}/{item_id}")
def delete_saved_item(
    item_type: str,
    item_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = (
        db.query(SavedItem)
        .filter(
            SavedItem.user_id == user.id,
            SavedItem.item_type == item_type,
            SavedItem.item_id == item_id,
        )
        .first()
    )
    if item:
        db.delete(item)
        db.commit()
    return {"success": True, "message": "Item unsaved"}
