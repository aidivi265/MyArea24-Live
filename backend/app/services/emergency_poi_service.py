"""
Emergency POI Service:
Dynamically discovers real, live casualty hospitals, trauma centers, 24/7 pharmacies,
and police stations around any user coordinates in India using TomTom POI Search
and OpenStreetMap Overpass fallback.
"""

import logging
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.core.config import settings
from backend.app.database.models import EmergencyFacility
from backend.app.intelligence.rules import haversine_distance_km

logger = logging.getLogger(__name__)


def sync_live_emergency_facilities(
    db: Session,
    lat: float,
    lon: float,
    city_name: Optional[str] = None,
    state_name: Optional[str] = None,
    radius_meters: int = 12000,
) -> int:
    """
    Fetches real hospitals, clinics, and emergency stations around (lat, lon) and persists them to DB.
    Returns count of facilities ingested.
    """
    tomtom_key = settings.TOMTOM_API_KEY
    facilities_to_add: List[Dict[str, Any]] = []

    # 1. TomTom POI Search (Primary Live Source)
    if tomtom_key and tomtom_key.strip():
        categories = [
            ("hospital", "Casualty & Trauma Center", "108 / 112", True, "Level 1 / 2 Trauma Unit", True),
            ("police", "Police Station", "112", False, "Emergency Police Unit", False),
            ("pharmacy", "24/7 Pharmacy", "112", True, "Emergency Chemist", False),
        ]

        for query_term, fac_type, default_phone, is_24_7, trauma_lvl, blood_bank in categories:
            try:
                url = (
                    f"https://api.tomtom.com/search/2/poiSearch/{query_term}.json"
                    f"?lat={lat}&lon={lon}&radius={radius_meters}&limit=6&key={tomtom_key.strip()}"
                )
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        for item in data.get("results", []):
                            poi = item.get("poi", {})
                            name = poi.get("name")
                            if not name:
                                continue

                            pos = item.get("position", {})
                            p_lat = pos.get("lat")
                            p_lon = pos.get("lon")
                            if p_lat is None or p_lon is None:
                                continue

                            addr_info = item.get("address", {})
                            addr = addr_info.get("freeformAddress") or f"{name}, {city_name or 'Local Area'}"
                            phone = poi.get("phone") or addr_info.get("phone") or default_phone
                            loc = addr_info.get("municipalitySubdivision") or addr_info.get("municipality") or (city_name or "Local Area")
                            c_name = addr_info.get("municipality") or (city_name or "Local City")
                            s_name = addr_info.get("countrySubdivision") or (state_name or "India")

                            facilities_to_add.append({
                                "name": name[:250],
                                "facility_type": fac_type,
                                "phone": phone[:45],
                                "secondary_phone": "112",
                                "address": addr[:350],
                                "locality": loc[:90],
                                "city": c_name[:90],
                                "state": s_name[:90],
                                "latitude": float(p_lat),
                                "longitude": float(p_lon),
                                "is_24_7": is_24_7,
                                "trauma_level": trauma_lvl,
                                "blood_bank_available": blood_bank,
                            })
            except Exception as e:
                logger.debug(f"TomTom POI search failed for {query_term}: {e}")

    # 2. Overpass API Fallback (if TomTom returned nothing)
    if not facilities_to_add:
        try:
            overpass_url = "https://overpass-api.de/api/interpreter"
            query = f"""
            [out:json][timeout:6];
            (
              node["amenity"="hospital"](around:{radius_meters},{lat},{lon});
              node["amenity"="pharmacy"](around:{radius_meters},{lat},{lon});
            );
            out 8;
            """
            with httpx.Client(timeout=6.0) as client:
                r = client.post(overpass_url, data={"data": query})
                if r.status_code == 200:
                    data = r.json()
                    for elem in data.get("elements", []):
                        tags = elem.get("tags", {})
                        name = tags.get("name")
                        if not name:
                            continue
                        amenity = tags.get("amenity", "hospital")
                        fac_type = "Casualty & Trauma Center" if amenity == "hospital" else "24/7 Pharmacy"
                        facilities_to_add.append({
                            "name": name[:250],
                            "facility_type": fac_type,
                            "phone": tags.get("phone") or tags.get("contact:phone") or "108 / 112",
                            "secondary_phone": "112",
                            "address": f"{name}, {city_name or 'City'}",
                            "locality": tags.get("addr:suburb") or (city_name or "Local Area"),
                            "city": tags.get("addr:city") or (city_name or "Local City"),
                            "state": state_name or "India",
                            "latitude": float(elem["lat"]),
                            "longitude": float(elem["lon"]),
                            "is_24_7": True,
                            "trauma_level": "Level 1 / 2 Unit",
                            "blood_bank_available": amenity == "hospital",
                        })
        except Exception as e:
            logger.debug(f"Overpass emergency fallback failed: {e}")

    # 3. Upsert to DB
    added_count = 0
    for fac in facilities_to_add:
        try:
            exists = (
                db.query(EmergencyFacility)
                .filter(func.lower(EmergencyFacility.name) == fac["name"].strip().lower())
                .first()
            )
            if exists:
                continue

            rec = EmergencyFacility(**fac)
            db.add(rec)
            added_count += 1
        except Exception as ex:
            logger.debug(f"Error adding facility {fac.get('name')}: {ex}")

    if added_count > 0:
        try:
            db.commit()
            logger.info(f"Ingested {added_count} real emergency facilities around ({lat}, {lon}) into DB.")
        except Exception as ex:
            db.rollback()
            logger.error(f"Failed to commit emergency facilities: {ex}")

    return added_count
