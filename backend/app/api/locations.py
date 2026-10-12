from typing import Any, Dict, List, Optional
import math
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from backend.app.services.indian_spatial_service import (
    INDIAN_ADMINISTRATIVE_DISTRICTS,
    global_spatial_kdtree,
    global_geocode_cache,
    global_nominatim_limiter,
    reverse_geocode_hybrid,
    haversine_km,
)
import time
import httpx

router = APIRouter(prefix="/api/v1/location", tags=["Pan-India Location & Reverse Geocoding"])


# ==============================================================================
# Comprehensive Indian States & Union Territories Dataset (All 36 States/UTs)
# ==============================================================================

ALL_INDIAN_STATES: List[Dict[str, str]] = [
    {"code": "AN", "name": "Andaman and Nicobar Islands", "type": "Union Territory"},
    {"code": "AP", "name": "Andhra Pradesh", "type": "State"},
    {"code": "AR", "name": "Arunachal Pradesh", "type": "State"},
    {"code": "AS", "name": "Assam", "type": "State"},
    {"code": "BR", "name": "Bihar", "type": "State"},
    {"code": "CH", "name": "Chandigarh", "type": "Union Territory"},
    {"code": "CG", "name": "Chhattisgarh", "type": "State"},
    {"code": "DN", "name": "Dadra and Nagar Haveli and Daman and Diu", "type": "Union Territory"},
    {"code": "DL", "name": "Delhi NCR", "type": "National Capital Territory"},
    {"code": "GA", "name": "Goa", "type": "State"},
    {"code": "GJ", "name": "Gujarat", "type": "State"},
    {"code": "HR", "name": "Haryana", "type": "State"},
    {"code": "HP", "name": "Himachal Pradesh", "type": "State"},
    {"code": "JK", "name": "Jammu and Kashmir", "type": "Union Territory"},
    {"code": "JH", "name": "Jharkhand", "type": "State"},
    {"code": "KA", "name": "Karnataka", "type": "State"},
    {"code": "KL", "name": "Kerala", "type": "State"},
    {"code": "LA", "name": "Ladakh", "type": "Union Territory"},
    {"code": "LD", "name": "Lakshadweep", "type": "Union Territory"},
    {"code": "MP", "name": "Madhya Pradesh", "type": "State"},
    {"code": "MH", "name": "Maharashtra", "type": "State"},
    {"code": "MN", "name": "Manipur", "type": "State"},
    {"code": "ML", "name": "Meghalaya", "type": "State"},
    {"code": "MZ", "name": "Mizoram", "type": "State"},
    {"code": "NL", "name": "Nagaland", "type": "State"},
    {"code": "OD", "name": "Odisha", "type": "State"},
    {"code": "PY", "name": "Puducherry", "type": "Union Territory"},
    {"code": "PB", "name": "Punjab", "type": "State"},
    {"code": "RJ", "name": "Rajasthan", "type": "State"},
    {"code": "SK", "name": "Sikkim", "type": "State"},
    {"code": "TN", "name": "Tamil Nadu", "type": "State"},
    {"code": "TS", "name": "Telangana", "type": "State"},
    {"code": "TR", "name": "Tripura", "type": "State"},
    {"code": "UP", "name": "Uttar Pradesh", "type": "State"},
    {"code": "UK", "name": "Uttarakhand", "type": "State"},
    {"code": "WB", "name": "West Bengal", "type": "State"},
]

# 780+ Administrative Districts mapped across all 36 States & UTs (backward compatibility alias)
INDIAN_DISTRICTS_DATA: Dict[str, List[Dict[str, Any]]] = INDIAN_ADMINISTRATIVE_DISTRICTS


# ==============================================================================
# Endpoints
# ==============================================================================

@router.get("/states", response_model=List[Dict[str, str]])
def get_all_states():
    """Returns list of all 36 States and Union Territories of India."""
    return ALL_INDIAN_STATES


@router.get("/districts", response_model=List[Dict[str, Any]])
def get_districts_by_state(state: str = Query(..., description="Indian State or Union Territory")):
    """
    Returns administrative districts for a given Indian State or UT.
    Covers all 780+ districts across all 36 States & UTs of India.
    """
    state_clean = state.strip()
    districts = INDIAN_DISTRICTS_DATA.get(state_clean)

    if not districts:
        # Fallback partial case-insensitive match
        for s_name, d_list in INDIAN_DISTRICTS_DATA.items():
            if state_clean.lower() in s_name.lower() or s_name.lower() in state_clean.lower():
                return d_list
        return []

    return districts


@router.get("/reverse-geocode", response_model=Dict[str, Any])
async def reverse_geocode_coordinates(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
):
    """
    Auto-detect user's Village (Gao), Town, Tehsil, District, and State across India.
    Leverages multi-tier reverse geocoding engine:
    1. In-memory LRU + TTL Cache (100m grid resolution ~ sub-millisecond return)
    2. Google Maps Platform Geocoding API (high accuracy, reliable)
    3. OpenStreetMap Nominatim with strict rate limiting (prevents 429 bans)
    4. Offline 2D KD-Tree Spatial Index across all 780+ Indian districts (instant fallback)
    """
    return await reverse_geocode_hybrid(lat, lon)


_FORWARD_SEARCH_CACHE: Dict[str, Any] = {}


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_localities_and_districts(
    q: str = Query(..., min_length=2, description="Search pincode, village, town, district or state")
):
    """
    Search any district, city, village, pin code, or locality across India.
    Searches 780+ districts and administrative centroids, and falls back to
    high-precision live forward geocoding for remote villages, tehsils, and hamlets.
    """
    query = q.strip().lower()
    matches: List[Dict[str, Any]] = []

    # 1. Search in all 780+ district centroids across India
    for st_name, loc_list in INDIAN_DISTRICTS_DATA.items():
        for item in loc_list:
            name_match = query in item["name"].lower()
            dist_match = query in item["district"].lower()
            state_match = query in st_name.lower()
            pin_match = query in str(item.get("pincode", "")).lower()

            if name_match or dist_match or state_match or pin_match:
                matches.append({
                    "id": f"{item['district'].lower().replace(' ', '-')}-{len(matches)}",
                    "name": item["name"],
                    "district": item["district"],
                    "city": item["name"].split("/")[0].strip(),
                    "village": "",
                    "tehsil": item["district"],
                    "state": st_name,
                    "pincode": item.get("pincode", ""),
                    "latitude": item["lat"],
                    "longitude": item["lon"],
                    "display_label": f"{item['name']}, {item['district']}, {st_name}",
                    "coverage_status": "Active Coverage",
                    "accuracy": "district",
                    "is_live_supported": True,
                })
                if len(matches) >= 20:
                    break
        if len(matches) >= 20:
            break

    # 2. Live forward geocoding for remote Indian villages, hamlets, tehsils, and PIN codes
    if len(matches) < 6:
        cache_entry = _FORWARD_SEARCH_CACHE.get(query)
        if cache_entry and (time.time() - cache_entry[0] < 3600):
            live_items = cache_entry[1]
        else:
            live_items = []
            try:
                await global_nominatim_limiter.acquire()
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(
                        "https://nominatim.openstreetmap.org/search",
                        params={
                            "q": q.strip(),
                            "format": "jsonv2",
                            "countrycodes": "in",
                            "addressdetails": 1,
                            "limit": 10,
                        },
                        headers={
                            "User-Agent": "MyArea24-Hyperlocal-India-Engine/2.0 (contact: info@myarea24.in)"
                        },
                    )
                    if resp.status_code == 200:
                        for item in resp.json():
                            addr = item.get("address", {})
                            v_name = addr.get("village") or addr.get("hamlet") or ""
                            t_name = addr.get("town") or addr.get("suburb") or addr.get("neighbourhood") or addr.get("residential") or addr.get("city") or ""
                            tehsil_name = addr.get("county") or addr.get("subdistrict") or addr.get("tehsil") or ""
                            d_name = addr.get("state_district") or addr.get("county") or addr.get("city_district") or addr.get("district") or addr.get("city") or ""
                            s_name = addr.get("state") or ""
                            pin = addr.get("postcode") or ""
                            try:
                                lat = float(item["lat"])
                                lon = float(item["lon"])
                            except (ValueError, TypeError):
                                continue

                            raw_name = item.get("name") or v_name or t_name or item.get("display_name", "").split(",")[0].strip()
                            display = item.get("display_name") or f"{raw_name}, {d_name}, {s_name}"

                            live_items.append({
                                "id": f"live-{item.get('place_id', len(live_items))}",
                                "name": raw_name,
                                "district": d_name or t_name or "District",
                                "city": t_name or d_name or raw_name,
                                "village": v_name,
                                "tehsil": tehsil_name,
                                "state": s_name,
                                "pincode": pin,
                                "latitude": lat,
                                "longitude": lon,
                                "display_label": display,
                                "coverage_status": "Live Geocoded",
                                "accuracy": "exact_village" if v_name else ("town" if t_name else "district"),
                                "is_live_supported": True,
                            })
                _FORWARD_SEARCH_CACHE[query] = (time.time(), live_items)
            except Exception:
                pass

        # Deduplicate against static matches and append
        for item in live_items:
            lat = item["latitude"]
            lon = item["longitude"]
            if not any(haversine_km(lat, lon, m["latitude"], m["longitude"]) < 1.0 for m in matches):
                matches.append(item)
                if len(matches) >= 30:
                    break

    return matches


class GPSDetectResponse(BaseModel):
    latitude: float
    longitude: float
    display_label: str          # e.g. "Sector 15, Noida, Uttar Pradesh"
    short_label: str            # e.g. "Sector 15, Noida"
    village: Optional[str] = None
    town: Optional[str] = None
    tehsil: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    accuracy: str = "district"  # "exact" | "town" | "district"


@router.get("/detect", response_model=GPSDetectResponse)
async def detect_location_from_gps(
    lat: float = Query(..., ge=-90.0, le=90.0, description="GPS latitude from browser"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="GPS longitude from browser"),
):
    """
    Convert raw GPS coordinates into a human-readable Indian address label.
    Used by the frontend to auto-detect the user's exact neighbourhood/locality.
    Returns a display_label suitable for the locality selector header.
    """
    geo = await reverse_geocode_hybrid(lat, lon)

    village = geo.get("village") or ""
    town = geo.get("town") or ""
    tehsil = geo.get("tehsil") or ""
    district = geo.get("district") or ""
    state = geo.get("state") or ""
    pincode = geo.get("pincode") or ""

    # Build the most specific label available
    parts_full = []
    parts_short = []
    accuracy = "district"

    if village and village != town and village != district:
        parts_full.append(village)
        parts_short.append(village)
        accuracy = "exact"
    elif town and town != district:
        parts_full.append(town)
        parts_short.append(town)
        accuracy = "town"

    if tehsil and tehsil not in parts_full and tehsil != district:
        parts_full.append(tehsil)

    if district:
        parts_full.append(district)
        if not parts_short:
            parts_short.append(district)

    if state:
        parts_full.append(state)
        if not parts_short:
            parts_short.append(state)

    display_label = ", ".join(p for p in parts_full if p) or f"Location ({lat:.4f}, {lon:.4f})"
    short_label = ", ".join(p for p in parts_short if p) or district or state or "Your Location"

    return GPSDetectResponse(
        latitude=lat,
        longitude=lon,
        display_label=display_label,
        short_label=short_label,
        village=village or None,
        town=town or None,
        tehsil=tehsil or None,
        district=district or None,
        state=state or None,
        pincode=pincode or None,
        accuracy=accuracy,
    )
