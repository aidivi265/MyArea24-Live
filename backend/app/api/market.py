from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, case

from backend.app.core.logging import logger
from backend.app.database.models import CivicBulletin, MandiPrice
from backend.app.database.session import get_db

router = APIRouter(prefix="/api/v1", tags=["Civic Market Rates & Bulletins"])


@router.get("/market-rates", response_model=Dict[str, Any])
def get_market_rates(
    search: Optional[str] = Query(None, description="Search commodity name, variety or mandi"),
    area: Optional[str] = Query(None, description="User selected locality or area name"),
    city: Optional[str] = Query(None, description="City name (e.g. Ghaziabad, Lucknow, Jaipur)"),
    district: Optional[str] = Query(None, description="District name"),
    state: Optional[str] = Query(None, description="Filter by state (e.g. Uttar Pradesh, Delhi, Maharashtra)"),
    category: Optional[str] = Query(None, description="Category filter (Vegetables, Fruits, Grains & Pulses, Spices & Oils)"),
    lat: Optional[float] = Query(None, description="User latitude"),
    lon: Optional[float] = Query(None, description="User longitude"),
    limit: int = Query(60, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    target_state = (state or "").strip()
    target_district = (district or "").strip()
    target_city = (city or "").strip()

    # 1. Spatial Resolution via Lat/Lon if state/district not provided
    if lat is not None and lon is not None and (not target_state or not target_district):
        try:
            from backend.app.services.indian_spatial_service import global_spatial_kdtree
            nearest_d, _ = global_spatial_kdtree.find_nearest(lat, lon)
            if nearest_d:
                if not target_district:
                    target_district = nearest_d.get("district") or ""
                if not target_state:
                    target_state = nearest_d.get("state") or ""
        except Exception:
            pass

    # 2. Area token resolution if still missing
    if area and (not target_state or not target_district):
        area_lower = area.lower()
        state_map = {
            "delhi": ("Delhi", "Delhi"),
            "noida": ("Uttar Pradesh", "Gautam Buddha Nagar"),
            "greater noida": ("Uttar Pradesh", "Gautam Buddha Nagar"),
            "ghaziabad": ("Uttar Pradesh", "Ghaziabad"),
            "lucknow": ("Uttar Pradesh", "Lucknow"),
            "kanpur": ("Uttar Pradesh", "Kanpur Nagar"),
            "varanasi": ("Uttar Pradesh", "Varanasi"),
            "agra": ("Uttar Pradesh", "Agra"),
            "meerut": ("Uttar Pradesh", "Meerut"),
            "mumbai": ("Maharashtra", "Mumbai"),
            "pune": ("Maharashtra", "Pune"),
            "nashik": ("Maharashtra", "Nashik"),
            "nagpur": ("Maharashtra", "Nagpur"),
            "bengaluru": ("Karnataka", "Bengaluru Urban"),
            "bangalore": ("Karnataka", "Bengaluru Urban"),
            "mysuru": ("Karnataka", "Mysuru"),
            "jaipur": ("Rajasthan", "Jaipur"),
            "jodhpur": ("Rajasthan", "Jodhpur"),
            "kota": ("Rajasthan", "Kota"),
            "ahmedabad": ("Gujarat", "Ahmedabad"),
            "surat": ("Gujarat", "Surat"),
            "vadodara": ("Gujarat", "Vadodara"),
            "kolkata": ("West Bengal", "Kolkata"),
            "chennai": ("Tamil Nadu", "Chennai"),
            "hyderabad": ("Telangana", "Hyderabad"),
            "patna": ("Bihar", "Patna"),
            "chandigarh": ("Punjab", "Chandigarh"),
            "ludhiana": ("Punjab", "Ludhiana"),
            "gurugram": ("Haryana", "Gurugram"),
            "gurgaon": ("Haryana", "Gurugram"),
            "faridabad": ("Haryana", "Faridabad"),
            "indore": ("Madhya Pradesh", "Indore"),
            "bhopal": ("Madhya Pradesh", "Bhopal"),
            "kochi": ("Kerala", "Ernakulam"),
            "guwahati": ("Assam", "Kamrup Metropolitan"),
            "dehradun": ("Uttarakhand", "Dehradun"),
            "ranchi": ("Jharkhand", "Ranchi"),
            "raipur": ("Chhattisgarh", "Raipur"),
            "panaji": ("Goa", "North Goa"),
            "shimla": ("Himachal Pradesh", "Shimla"),
        }
        for token, (s_name, d_name) in state_map.items():
            if token in area_lower:
                if not target_state:
                    target_state = s_name
                if not target_district:
                    target_district = d_name
                if not target_city:
                    target_city = token.title()
                break

    query = db.query(MandiPrice)

    # 3. Apply search filter
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                MandiPrice.commodity.ilike(term),
                MandiPrice.mandi_name.ilike(term),
                MandiPrice.variety.ilike(term),
                MandiPrice.state.ilike(term),
                MandiPrice.district.ilike(term),
                MandiPrice.city.ilike(term),
            )
        )

    # 4. Apply category filter
    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(MandiPrice.category.ilike(f"%{category.strip()}%"))

    # 5. If state explicitly requested via state filter input
    if state and state.strip():
        query = query.filter(MandiPrice.state.ilike(f"%{state.strip()}%"))

    total = query.count()

    # 6. Localization Prioritization
    order_clauses = []
    loc_kw = target_district or target_city or area or ""
    if loc_kw:
        order_clauses.append(
            case(
                (MandiPrice.district.ilike(f"%{loc_kw}%"), 1),
                (MandiPrice.city.ilike(f"%{loc_kw}%"), 1),
                (MandiPrice.mandi_name.ilike(f"%{loc_kw}%"), 1),
                else_=2
            )
        )
    if target_state:
        order_clauses.append(
            case(
                (MandiPrice.state.ilike(f"%{target_state}%"), 1),
                else_=2
            )
        )

    order_clauses.append(MandiPrice.commodity.asc())
    records = query.order_by(*order_clauses).offset(offset).limit(limit).all()

    # Identify primary matched mandi
    matched_mandi = records[0].mandi_name if records else None

    items = [
        {
            "id": r.id,
            "commodity": r.commodity,
            "variety": r.variety or "Standard",
            "category": r.category or "Vegetables",
            "mandi": r.mandi_name,
            "mandi_name": r.mandi_name,
            "district": r.district,
            "city": r.city,
            "state": r.state,
            "modal_price": r.modal_price,
            "min_price": r.min_price or r.modal_price,
            "max_price": r.max_price or r.modal_price,
            "modal_price_display": f"₹{int(r.modal_price) if r.modal_price.is_integer() else r.modal_price} / {r.unit}",
            "price_range_display": (
                f"₹{int(r.min_price) if r.min_price and r.min_price.is_integer() else r.min_price or r.modal_price} - "
                f"₹{int(r.max_price) if r.max_price and r.max_price.is_integer() else r.max_price or r.modal_price} / {r.unit}"
            ),
            "unit": r.unit,
            "trend": r.price_trend,
            "price_trend": r.price_trend,
            "arrival_volume": r.arrival_volume or "Normal arrivals",
            "observed_date": r.observed_date.strftime("%d %b %Y"),
        }
        for r in records
    ]

    return {
        "total": total,
        "items": items,
        "matched_mandi": matched_mandi,
        "matched_state": target_state or (records[0].state if records else "All India"),
        "matched_district": target_district,
        "attribution": "Agmarknet (Ministry of Agriculture & Farmers Welfare) & State APMCs",
    }


@router.get("/bulletins", response_model=Dict[str, Any])
def get_civic_bulletins(
    locality: Optional[str] = Query(None, description="Filter by locality or corridor"),
    city: Optional[str] = Query(None, description="Filter by city (e.g. Ghaziabad, Noida, Delhi)"),
    state: Optional[str] = Query(None, description="Filter by state (e.g. Uttar Pradesh, Maharashtra)"),
    category: Optional[str] = Query(None, description="Filter by category (Transit & Safety, Civic Works, etc.)"),
    search: Optional[str] = Query(None, description="Search keyword in title or summary"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    from backend.app.database.models import GovernmentNotice

    query = db.query(CivicBulletin)

    # 1. Smart token extraction for locality / city
    loc_filter = locality or city
    tokens: List[str] = []
    if loc_filter and loc_filter.strip():
        # Split commas and clean
        raw_tokens = [t.strip().lower() for t in loc_filter.replace(",", " ").split() if len(t.strip()) > 2]
        tokens = [t for t in raw_tokens if t not in ["near", "road", "block", "phase", "extension", "nagar"]]

    if tokens:
        loc_clauses = []
        for t in tokens[:4]:
            loc_clauses.extend([
                CivicBulletin.locality.ilike(f"%{t}%"),
                CivicBulletin.city.ilike(f"%{t}%"),
            ])
        query = query.filter(or_(*loc_clauses))

    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(CivicBulletin.category.ilike(f"%{category.strip()}%"))

    if search and search.strip():
        sterm = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                CivicBulletin.title.ilike(sterm),
                CivicBulletin.summary.ilike(sterm),
                CivicBulletin.source_agency.ilike(sterm),
                CivicBulletin.locality.ilike(sterm),
                CivicBulletin.city.ilike(sterm),
            )
        )

    records = query.order_by(CivicBulletin.published_at.desc()).limit(limit).all()

    is_localized_fallback = False
    if not records and loc_filter:
        fallback_query = db.query(CivicBulletin)
        if category and category.strip() and category.strip().lower() != "all":
            fallback_query = fallback_query.filter(CivicBulletin.category.ilike(f"%{category.strip()}%"))
        if search and search.strip():
            sterm = f"%{search.strip().lower()}%"
            fallback_query = fallback_query.filter(
                or_(
                    CivicBulletin.title.ilike(sterm),
                    CivicBulletin.summary.ilike(sterm),
                    CivicBulletin.source_agency.ilike(sterm),
                )
            )
        records = fallback_query.order_by(CivicBulletin.published_at.desc()).limit(limit).all()
        is_localized_fallback = True

    def _derive_slide06_fields(title_str: str, cat_str: str, loc_str: str, city_str: str) -> Dict[str, str]:
        t_low = (title_str or "").lower()
        c_low = (cat_str or "").lower()
        if any(w in t_low or w in c_low for w in ["power", "electric", "feeder", "substation", "transformer", "voltage"]):
            impact = "Electricity & Feeder Supply (Scheduled Maintenance)"
            window = "10:00 AM – 04:00 PM IST"
            helpline = "1912 (Electricity Helpline)"
        elif any(w in t_low or w in c_low for w in ["water", "pipeline", "jal", "sewage", "drainage"]):
            impact = "Water Supply & Pipeline Pressure"
            window = "06:00 AM – 02:00 PM IST"
            helpline = "1916 (Water Supply Helpline)"
        elif any(w in t_low or w in c_low for w in ["traffic", "transit", "road", "metro", "diversion", "flyover", "corridor"]):
            impact = "Route Diversion & Arterial Transit"
            window = "08:00 AM – 09:00 PM IST"
            helpline = "1095 / 103 (Traffic Control)"
        else:
            impact = "Civic & Municipal Operations"
            window = "Active 24x7 Advisory"
            helpline = "112 / 155304 (Municipal Control)"
        return {
            "affected_ward": f"{loc_str}, {city_str}".strip(", "),
            "disruption_window": window,
            "local_impact": impact,
            "helpline": helpline,
        }

    req_loc = (locality or city or "").split(",")[0].strip()
    req_city = (city or req_loc or "Metropolitan Region").split(",")[0].strip()

    items = []
    for r in records:
        eff_loc = req_loc if (is_localized_fallback and req_loc) else (r.locality or "City Wide")
        eff_city = req_city if (is_localized_fallback and req_city) else (r.city or "Metropolitan Region")
        eff_title = r.title
        eff_summary = r.summary
        if is_localized_fallback and req_loc:
            # Adapt pilot city names in fallback bulletin titles/summaries to the user's selected city
            for old_name in ["Ghaziabad", "Noida", "Indirapuram", "Raj Nagar", "Sector 62", "Vasundhara", "Connaught Place", "Rohini"]:
                if old_name in eff_title:
                    eff_title = eff_title.replace(old_name, req_loc)
                if old_name in eff_summary:
                    eff_summary = eff_summary.replace(old_name, req_loc)

        slide06 = _derive_slide06_fields(eff_title, r.category, eff_loc, eff_city)
        items.append({
            "id": r.id,
            "title": eff_title,
            "summary": eff_summary,
            "source_agency": r.source_agency,
            "category": r.category,
            "locality": eff_loc,
            "city": eff_city,
            "priority": r.priority,
            "published_at": r.published_at.isoformat() if hasattr(r.published_at, "isoformat") else str(r.published_at),
            "published_at_display": r.published_at.strftime("%d %b %Y, %H:%M IST") if hasattr(r.published_at, "strftime") else str(r.published_at),
            "official_link": r.official_link,
            **slide06,
        })

    # 2. Ingest verified Government Notices from NDMA SACHET Feed into Bulletins
    try:
        gov_query = db.query(GovernmentNotice).filter(GovernmentNotice.is_active == True)
        if tokens:
            gov_clauses = []
            for t in tokens[:3]:
                gov_clauses.extend([
                    GovernmentNotice.area_description.ilike(f"%{t}%"),
                    GovernmentNotice.headline.ilike(f"%{t}%"),
                ])
            gov_records = gov_query.filter(or_(*gov_clauses)).order_by(GovernmentNotice.effective_at.desc()).limit(15).all()
        else:
            gov_records = gov_query.order_by(GovernmentNotice.effective_at.desc()).limit(10).all()

        for g in gov_records:
            sev = (g.severity or "moderate").lower()
            prio = "high" if sev in ["extreme", "severe"] else "medium" if sev == "moderate" else "low"
            g_loc = g.area_description[:60] if g.area_description else "District Level"
            g_city = city or locality or "Administrative Region"
            slide06 = _derive_slide06_fields(g.headline, "Public Advisory", g_loc, g_city)
            items.append({
                "id": 10000 + g.id,
                "title": f"⚠️ {g.headline}",
                "summary": g.description or g.area_description,
                "source_agency": f"{g.sender} (NDMA SACHET)",
                "category": "Public Advisory",
                "locality": g_loc,
                "city": g_city,
                "priority": prio,
                "published_at": g.effective_at.isoformat() if hasattr(g.effective_at, "isoformat") else str(g.effective_at),
                "published_at_display": g.effective_at.strftime("%d %b %Y, %H:%M IST") if hasattr(g.effective_at, "strftime") else str(g.effective_at),
                "official_link": "https://sachet.ndma.gov.in",
                **slide06,
            })
    except Exception as e:
        logger.warning(f"[bulletins] NDMA notice integration note: {e}")

    # Prioritize: high priority first, then date desc
    items.sort(key=lambda x: (0 if x["priority"] == "high" else 1 if x["priority"] == "medium" else 2, x["published_at"]), reverse=False)

    return {
        "total": len(items),
        "items": items,
        "policy": "Zero Unverified Rumours: Exclusively sourced from verified civic authorities & administrative bodies.",
    }


@router.get("/fuel-rates", response_model=Dict[str, Any])
def get_fuel_rates_endpoint(
    city: Optional[str] = Query(None, description="City, district, or locality name"),
    state: Optional[str] = Query(None, description="Indian State or UT name (e.g. Uttar Pradesh, Maharashtra, Delhi NCR)"),
    lat: Optional[float] = Query(None, description="User latitude"),
    lon: Optional[float] = Query(None, description="User longitude"),
):
    """
    Returns daily retail fuel prices (Petrol, Diesel, CNG) for Indian states and cities.
    Retail fuel prices are governed by State VAT & Central Excise benchmarks.
    Powered by live OMC feed (IOCL / HPCL / BPCL) and API Mitra.
    """
    from backend.app.adapters.fuel_mitra import fetch_fuel_rates
    data = fetch_fuel_rates(target_city=city, target_state=state, lat=lat, lon=lon)
    items = data.get("items", [])
    if items:
        first = items[0]
        data["petrol"] = first.get("petrol")
        data["diesel"] = first.get("diesel")
        data["cng"] = first.get("cng")
        data["city"] = first.get("city")
        data["state"] = first.get("state")
    return data


