from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database.models import EmergencyFacility
from backend.app.database.session import get_db
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.emergency_poi_service import sync_live_emergency_facilities

router = APIRouter(prefix="/api/v1/emergency", tags=["Emergency Health & Casualty Facilities"])


@router.get("/facilities", response_model=Dict[str, Any])
def get_emergency_facilities(
    locality: Optional[str] = Query(None, description="Search locality name (e.g. AIIMS, Koramangala, Bandra)"),
    city: Optional[str] = Query(None, description="City name (e.g. Delhi, Bengaluru, Mumbai, Pune, Lucknow, Patna)"),
    state: Optional[str] = Query(None, description="State name (e.g. Karnataka, Maharashtra, Delhi)"),
    blood_bank_only: bool = Query(False, description="Filter facilities with operational blood bank"),
    facility_type: Optional[str] = Query(None, description="Filter by facility type"),
    latitude: Optional[float] = Query(None, description="Latitude for distance sorting"),
    longitude: Optional[float] = Query(None, description="Longitude for distance sorting"),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """
    Returns verified casualty & trauma centers filtered by locality, city, or proximity.
    Pan-India coverage ensuring non-Delhi residents receive appropriate local casualty contacts.
    """
    query = db.query(EmergencyFacility)

    # Filter by city, locality, state, or area tokens (handles composite strings like 'Delhi Connaught Place')
    tokens = []
    if city and city.strip():
        tokens.extend([t for t in city.strip().lower().replace("/", " ").replace(",", " ").split() if len(t) > 2])
    if locality and locality.strip():
        tokens.extend([t for t in locality.strip().lower().replace("/", " ").replace(",", " ").split() if len(t) > 2])

    filters = []
    if city and city.strip():
        c_clean = city.strip().lower()
        filters.append(EmergencyFacility.city.ilike(f"%{c_clean}%"))
        filters.append(EmergencyFacility.locality.ilike(f"%{c_clean}%"))
    if state and state.strip():
        s_clean = state.strip().lower()
        filters.append(EmergencyFacility.state.ilike(f"%{s_clean}%"))

    for t in tokens:
        filters.append(EmergencyFacility.city.ilike(f"%{t}%"))
        filters.append(EmergencyFacility.locality.ilike(f"%{t}%"))
        filters.append(EmergencyFacility.state.ilike(f"%{t}%"))

    if filters:
        query = query.filter(or_(*filters))

    # Optional attribute filters
    if blood_bank_only:
        query = query.filter(EmergencyFacility.blood_bank_available == True)
    if facility_type and facility_type.strip():
        query = query.filter(EmergencyFacility.facility_type.ilike(f"%{facility_type.strip()}%"))

    # Auto-sync real live facilities around coordinates if DB results are low
    if latitude is not None and longitude is not None:
        try:
            # Check if there are at least 4 facilities within 15 km
            nearby_count = db.query(EmergencyFacility).filter(
                (EmergencyFacility.latitude - latitude) * (EmergencyFacility.latitude - latitude)
                + (EmergencyFacility.longitude - longitude) * (EmergencyFacility.longitude - longitude) <= 0.04
            ).count()
            if nearby_count < 4:
                sync_live_emergency_facilities(db, latitude, longitude, city or locality, state)
        except Exception:
            pass

    if latitude is not None and longitude is not None:
        import math
        rad_lat = math.radians(latitude)
        cos_lat = math.cos(rad_lat)
        cos_lat_sq = cos_lat * cos_lat
        dist_expr = (
            (EmergencyFacility.latitude - latitude) * (EmergencyFacility.latitude - latitude)
            + (EmergencyFacility.longitude - longitude) * (EmergencyFacility.longitude - longitude) * cos_lat_sq
        )
        query = query.order_by(dist_expr.asc(), EmergencyFacility.name.asc())
    else:
        dist_expr = None
        query = query.order_by(EmergencyFacility.name.asc())

    records = query.limit(limit).all()

    # If no specific matches found, fall back to all registered facilities
    if not records:
        fallback_query = db.query(EmergencyFacility)
        if blood_bank_only:
            fallback_query = fallback_query.filter(EmergencyFacility.blood_bank_available == True)
        if facility_type and facility_type.strip():
            fallback_query = fallback_query.filter(EmergencyFacility.facility_type.ilike(f"%{facility_type.strip()}%"))

        if dist_expr is not None:
            fallback_query = fallback_query.order_by(dist_expr.asc(), EmergencyFacility.name.asc())
        else:
            fallback_query = fallback_query.order_by(EmergencyFacility.name.asc())
        records = fallback_query.limit(limit).all()

    results = []
    for r in records:
        dist_km = None
        if latitude is not None and longitude is not None:
            dist_km = round(haversine_distance_km(latitude, longitude, r.latitude, r.longitude), 1)

        results.append({
            "id": r.id,
            "name": r.name,
            "facility_type": r.facility_type,
            "phone": r.phone,
            "secondary_phone": r.secondary_phone,
            "address": r.address,
            "locality": r.locality,
            "city": r.city,
            "state": r.state,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "is_24_7": r.is_24_7,
            "trauma_level": r.trauma_level,
            "blood_bank_available": r.blood_bank_available,
            "distance_km": dist_km,
        })

    sliced = results

    return {
        "total": len(sliced),
        "national_emergency_number": "112",
        "ambulance_number": "108 / 102",
        "fire_number": "101",
        "disaster_number": "1077",
        "nhai_highway_helpline": "1033",
        "railway_security_helpline": "139",
        "women_safety_helpline": "1091 / 181",
        "ndma_disaster_helpline": "1078",
        "sdma_state_control": "1070",
        "flood_maritime_rescue": "1554",
        "expressway_emergency_desks": [
            {"name": "NHAI National Highway Emergency", "route": "All National Highways & Expressways", "phone": "1033"},
            {"name": "Yamuna Expressway Control Room", "route": "Greater Noida – Agra (165 km)", "phone": "1800-102-7777"},
            {"name": "Mumbai-Pune Expressway Highway Police", "route": "Mumbai – Pune (94 km)", "phone": "98224-98224"},
            {"name": "Eastern Peripheral Expressway (NE-2)", "route": "Kundli – Ghaziabad – Palwal", "phone": "1800-180-2444"},
            {"name": "Samruddhi Mahamarg Highway Help", "route": "Mumbai – Nagpur (701 km)", "phone": "1800-233-2233"},
            {"name": "Delhi-Meerut Expressway Helpline", "route": "Delhi – Meerut Corridor", "phone": "1033"},
        ],
        "facilities": sliced,
    }
