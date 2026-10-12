import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.api.deps import get_current_user, get_optional_user
from backend.app.database.models import AnalyticsEvent, Business, CustomerEnquiry, Product, User
from backend.app.database.session import get_db

router = APIRouter(prefix="/api/v1/enquiries", tags=["Enquiries & Merchant Analytics"])


class SubmitEnquiryRequest(BaseModel):
    business_id: Optional[int] = None
    product_id: Optional[int] = None
    service_id: Optional[int] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    enquiry_type: str = "general"  # 'stock_check', 'price_quote', 'appointment', 'general'
    message: str


class TrackClickRequest(BaseModel):
    business_id: int
    product_id: Optional[int] = None
    event_type: str  # 'call_click', 'whatsapp_click', 'direction_click', 'page_view'


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_enquiry(
    req: SubmitEnquiryRequest,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    target_name = "the service provider"
    if req.business_id:
        business = db.query(Business).filter(Business.id == req.business_id).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found")
        target_name = business.name
    elif req.service_id:
        from backend.app.database.models import ServiceListing
        service = db.query(ServiceListing).filter(ServiceListing.id == req.service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service listing not found")
        target_name = service.provider_name
    else:
        raise HTTPException(status_code=400, detail="Must provide either business_id or service_id")

    enquiry = CustomerEnquiry(
        business_id=req.business_id,
        product_id=req.product_id,
        service_id=req.service_id,
        user_id=user.id if user else None,
        customer_name=req.customer_name.strip(),
        customer_phone=req.customer_phone.strip(),
        customer_email=req.customer_email.strip() if req.customer_email else None,
        enquiry_type=req.enquiry_type,
        message=req.message.strip(),
        status="pending",
    )
    db.add(enquiry)

    # Log analytics if associated with business
    if req.business_id:
        evt = AnalyticsEvent(
            business_id=req.business_id,
            product_id=req.product_id,
            event_type="enquiry_submitted",
        )
        db.add(evt)
    db.commit()
    db.refresh(enquiry)

    return {
        "success": True,
        "message": f"Your enquiry has been forwarded directly to {target_name}. You will be contacted shortly!",
        "enquiry_id": enquiry.id,
        "recipient_name": target_name,
        "business_id": enquiry.business_id,
    }


@router.post("/track-click")
def track_action_click(req: TrackClickRequest, db: Session = Depends(get_db)):
    """
    Tracks call clicks, WhatsApp clicks, and direction clicks to give merchants actionable insights.
    """
    business = db.query(Business).filter(Business.id == req.business_id).first()
    if not business:
        return {"success": False, "message": "Business not found"}

    if req.event_type == "call_click":
        business.call_clicks += 1
    elif req.event_type == "direction_click":
        business.direction_clicks += 1
    elif req.event_type == "page_view":
        business.view_count += 1

    evt = AnalyticsEvent(
        business_id=req.business_id,
        product_id=req.product_id,
        event_type=req.event_type,
    )
    db.add(evt)
    db.commit()

    return {"success": True, "event": req.event_type}


class UpdateEnquiryStatusRequest(BaseModel):
    status: str  # 'pending', 'contacted', 'fulfilled', 'closed'
    merchant_note: Optional[str] = None


@router.put("/{enquiry_id}/status")
def update_enquiry_status(
    enquiry_id: int,
    req: UpdateEnquiryStatusRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enquiry = db.query(CustomerEnquiry).filter(CustomerEnquiry.id == enquiry_id).first()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Customer enquiry not found")

    if user.role != "admin" and enquiry.business_id:
        biz = db.query(Business).filter(Business.id == enquiry.business_id).first()
        if not biz or biz.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to manage this enquiry")

    valid_statuses = ("pending", "contacted", "resolved", "fulfilled", "closed")
    if req.status.lower() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")

    enquiry.status = req.status.lower()
    if req.merchant_note and req.merchant_note.strip():
        enquiry.message += f"\n[Merchant Note: {req.merchant_note.strip()}]"

    db.commit()
    db.refresh(enquiry)

    return {
        "success": True,
        "enquiry_id": enquiry.id,
        "status": enquiry.status,
        "message": f"Lead status updated to '{enquiry.status}'",
    }


@router.get("/merchant/{business_id}")
def get_merchant_dashboard_analytics(
    business_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns merchant statistics: total views, call clicks, direction clicks,
    active catalogue items, full store profile/operating hours, and list of customer enquiries.
    """
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    if user.role != "admin" and business.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access analytics for this business")

    total_products = db.query(Product).filter(Product.business_id == business.id).count()
    enquiries = (
        db.query(CustomerEnquiry)
        .filter(CustomerEnquiry.business_id == business.id)
        .order_by(CustomerEnquiry.created_at.desc())
        .limit(50)
        .all()
    )

    # Pre-fetch product names if enquiries are attached to specific items
    prod_ids = [eq.product_id for eq in enquiries if eq.product_id]
    prod_map = {p.id: p.name for p in db.query(Product).filter(Product.id.in_(prod_ids)).all()} if prod_ids else {}

    from backend.app.api.businesses import check_is_open_now

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
            "is_open_now": check_is_open_now(business.opening_time, business.closing_time),
            "view_count": business.view_count,
            "call_clicks": business.call_clicks,
            "direction_clicks": business.direction_clicks,
            "rating": business.rating,
            "review_count": business.review_count,
            "total_products": total_products,
        },
        "enquiries": [
            {
                "id": eq.id,
                "customer_name": eq.customer_name,
                "customer_phone": eq.customer_phone,
                "customer_email": eq.customer_email,
                "enquiry_type": eq.enquiry_type,
                "product_id": eq.product_id,
                "product_name": prod_map.get(eq.product_id),
                "message": eq.message,
                "status": eq.status,
                "created_at": eq.created_at.isoformat(),
            }
            for eq in enquiries
        ],
    }
