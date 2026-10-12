import datetime
import json
import os
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.models import (
    AirQualityObservation,
    CivicBulletin,
    CommunitySignal,
    EmergencyFacility,
    GovernmentNotice,
    IntelligenceInsight,
    MandiPrice,
    Offer,
    TrafficObservation,
    WeatherObservation,
)
from backend.app.intelligence.rules import haversine_distance_km


class GeminiAssistantSchema(BaseModel):
    response_text: str = Field(description="Direct, warm, empathetic, companion-like response in natural language (Hinglish/Hindi/English matching user style). Speaks like a caring local friend ('Saathi').")
    key_findings: List[str] = Field(description="2 to 4 grounded bullet points cited strictly from the database observations.")
    recommendations: List[str] = Field(description="2 to 4 practical, actionable, caring recommendations for the citizen.")
    grounded_sources: List[str] = Field(description="List of verified upstream sources cited (e.g. WeatherAPI, TomTom Traffic API v5, NDMA SACHET, APMC Mandi, CPCB, Community Signals, Emergency Services).")
    confidence: str = Field(description="Confidence rating with source provenance, e.g. HIGH (MyArea24 Saathi RAG).")


def _gather_grounded_context(
    area_name: str,
    target_lat: float,
    target_lon: float,
    db: Session,
) -> Dict[str, Any]:
    """
    Collects real, verified database observations around the target coordinates
    for grounding the Gemini LLM. Zero hallucinated figures.
    """
    now_utc = datetime.datetime.utcnow()

    # 1. Nearest Weather Observation
    all_weather = (
        db.query(WeatherObservation)
        .order_by(WeatherObservation.observed_at.desc())
        .limit(20)
        .all()
    )
    weather_data = None
    if all_weather:
        closest_w = min(
            all_weather,
            key=lambda w: haversine_distance_km(target_lat, target_lon, w.latitude, w.longitude)
        )
        dist_w = haversine_distance_km(target_lat, target_lon, closest_w.latitude, closest_w.longitude)
        weather_data = {
            "location": closest_w.location_name,
            "temp_c": closest_w.temperature_c,
            "precipitation_mm": closest_w.precipitation_mm,
            "condition": closest_w.condition_text,
            "humidity": closest_w.humidity,
            "wind_kph": closest_w.wind_kph,
            "distance_km": round(dist_w, 1),
            "observed_at": closest_w.observed_at.strftime("%Y-%m-%d %H:%M UTC"),
        }

    # 2. Nearby Traffic Incidents (within 25 km)
    all_traffic = db.query(TrafficObservation).order_by(TrafficObservation.observed_at.desc()).limit(100).all()
    nearby_traffic = []
    for t in all_traffic:
        d = haversine_distance_km(target_lat, target_lon, t.latitude, t.longitude)
        if d <= 25.0:
            nearby_traffic.append({
                "road": t.road_name or "Arterial Corridor",
                "type": t.incident_type,
                "criticality": t.criticality,
                "delay_minutes": round((t.delay_seconds or 0) / 60),
                "distance_km": round(d, 1),
            })
    nearby_traffic.sort(key=lambda x: x["delay_minutes"], reverse=True)
    top_traffic = nearby_traffic[:8]

    # 3. Active Government Notices (NDMA SACHET CAP)
    notices = (
        db.query(GovernmentNotice)
        .filter(GovernmentNotice.is_active == True, GovernmentNotice.expires_at > now_utc)
        .order_by(GovernmentNotice.effective_at.desc())
        .limit(6)
        .all()
    )
    notices_data = [
        {
            "sender": n.sender,
            "headline": n.headline,
            "severity": n.severity,
            "urgency": n.urgency,
            "area": n.area_description,
            "instruction": n.instruction,
        }
        for n in notices
    ]

    # 4. Air Quality Observations (closest within 50km)
    all_aqi = (
        db.query(AirQualityObservation)
        .order_by(AirQualityObservation.observed_at.desc())
        .limit(20)
        .all()
    )
    aqi_data = None
    if all_aqi:
        closest_aqi = min(
            all_aqi,
            key=lambda a: haversine_distance_km(target_lat, target_lon, a.latitude, a.longitude)
        )
        dist_aqi = haversine_distance_km(target_lat, target_lon, closest_aqi.latitude, closest_aqi.longitude)
        aqi_data = {
            "station": closest_aqi.station_name,
            "city": closest_aqi.city,
            "aqi": closest_aqi.aqi_value,
            "category": closest_aqi.aqi_category,
            "pm25": closest_aqi.pm25,
            "pm10": closest_aqi.pm10,
            "distance_km": round(dist_aqi, 1),
        }

    # 5. Mandi Wholesale Prices
    mandi_records = db.query(MandiPrice).order_by(MandiPrice.commodity.asc()).limit(8).all()
    mandi_data = [
        {
            "commodity": m.commodity,
            "mandi": m.mandi_name,
            "price": f"₹{m.modal_price}/{m.unit}",
            "trend": m.price_trend,
        }
        for m in mandi_records
    ]

    # 6. Active Cross-Signal Insights
    insights = (
        db.query(IntelligenceInsight)
        .filter(IntelligenceInsight.is_active == True)
        .order_by(IntelligenceInsight.created_at.desc())
        .limit(3)
        .all()
    )
    insights_data = [
        {
            "headline": i.headline,
            "severity": i.composite_severity,
            "recommendation": i.recommendation,
        }
        for i in insights
    ]

    # 7. Community Signals (Potholes, Waterlogging, Road Hazards within 25km)
    all_signals = (
        db.query(CommunitySignal)
        .filter(CommunitySignal.status != "RESOLVED")
        .order_by(CommunitySignal.upvotes.desc())
        .limit(20)
        .all()
    )
    nearby_signals = []
    for s in all_signals:
        d = haversine_distance_km(target_lat, target_lon, s.latitude, s.longitude)
        if d <= 25.0:
            nearby_signals.append({
                "type": s.signal_type,
                "title": s.title,
                "locality": s.locality,
                "upvotes": s.upvotes,
                "distance_km": round(d, 1),
            })
    nearby_signals.sort(key=lambda x: x["distance_km"])

    # 8. Emergency Facilities (Hospitals, Trauma Centers within 25km)
    all_facilities = db.query(EmergencyFacility).limit(20).all()
    nearby_facilities = []
    for ef in all_facilities:
        d = haversine_distance_km(target_lat, target_lon, ef.latitude, ef.longitude)
        if d <= 25.0:
            nearby_facilities.append({
                "name": ef.name,
                "type": ef.facility_type,
                "phone": ef.phone,
                "address": ef.address,
                "is_24_7": ef.is_24_7,
                "distance_km": round(d, 1),
            })
    nearby_facilities.sort(key=lambda x: x["distance_km"])

    # 9. Active Local Deals & Offers
    offers = db.query(Offer).filter(Offer.is_active == True).limit(4).all()
    offers_data = [
        {
            "title": o.title,
            "discount": o.discount_text,
            "category": o.category,
        }
        for o in offers
    ]

    return {
        "locality": area_name,
        "coordinates": {"lat": target_lat, "lon": target_lon},
        "weather": weather_data,
        "traffic_incidents_count": len(nearby_traffic),
        "traffic_top_incidents": top_traffic,
        "active_disaster_notices": notices_data,
        "air_quality": aqi_data,
        "mandi_prices": mandi_data,
        "cross_signal_insights": insights_data,
        "community_signals": nearby_signals[:4],
        "emergency_facilities": nearby_facilities[:4],
        "local_offers": offers_data,
        "emergency_helpline_numbers": {
            "national_emergency": "112",
            "ambulance": "108",
            "traffic_helpline": "1095",
            "disaster_helpline": "1070",
            "women_helpline": "1090",
        },
    }


def query_gemini_assistant(
    query: str,
    area_name: str,
    target_lat: float,
    target_lon: float,
    is_live_supported: bool,
    db: Session,
) -> Optional[Dict[str, Any]]:
    """
    Executes a grounded RAG query via Google Gemini API using verified local database records.
    Trained as 'MyArea24 Saathi' — the user's caring companion, friend, and neighborhood guardian.
    Returns None if GEMINI_API_KEY is not configured or if an error occurs.
    """
    api_key = (
        settings.GEMINI_API_KEY
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key or api_key.strip().lower() in ("your_key", "placeholder", "none", ""):
        return None

    try:
        from google import genai

        client = genai.Client(api_key=api_key.strip())
        grounded_context = _gather_grounded_context(area_name, target_lat, target_lon, db)

        system_instruction = (
            "You are 'MyArea24 Saathi' (साथी) — the user's most trusted, caring local companion, friend, and neighborhood guardian in India.\n\n"
            "YOUR CORE IDENTITY & MISSION:\n"
            "1. You are NOT a cold, robotic bureaucrat or dry sensor database. You are a genuine, helpful 'Saathi' (companion and friend) who truly cares about the user's safety, comfort, time, money, family, and daily routine.\n"
            "2. You know the user's neighborhood, streets, traffic bottlenecks, weather quirks, sabzi mandi rates, and local culture inside out.\n\n"
            "LANGUAGE & COMMUNICATION STYLE:\n"
            "1. Match the user's language style naturally:\n"
            "   - If the user talks in Hinglish (e.g., 'bhai kaisa hai', 'office jana safe hai kya', 'aaj ka scene batao'): Respond in natural, warm, conversational Hinglish using friendly and respectful words like 'Bhai', 'Dost', 'Aap', 'Fikar mat karo'.\n"
            "   - If the user talks in Hindi (e.g., 'आज मौसम कैसा रहेगा?', 'नमस्ते'): Respond in polite, warm, conversational Hindi.\n"
            "   - If the user talks in English: Respond in warm, engaging, and friendly English.\n"
            "2. Never start with robotic disclaimers like 'As an AI language model...' or 'According to telemetry feeds...'. Speak directly, warmly, and naturally, just like a smart, caring local friend.\n\n"
            "COMPANION BEHAVIORS ('SAATHI' ATTRIBUTES):\n"
            "1. Safety Guardian: If there is rain, thunderstorm, flood alert, or bad air, warn them gently: 'Bhai chhaata zaroor le lena', 'Waterlogged underpasses se bach ke rehna', 'Phone charge rakhna'.\n"
            "2. Commute & Route Savior: If there are traffic jams on specific roads, clearly name the jammed road and advise a practical alternative (metro, ring road, or extra travel buffer).\n"
            "3. Budget & Mandi Advisor: If asked about groceries, cooking, or mandi rates, share current prices and smart buying advice.\n"
            "4. Emergency Support: If asked about medical emergencies or accidents, immediately share the emergency helplines (112, 108) and nearest hospitals with contact numbers.\n"
            "5. Emotional & Casual Warmth: If the user greets you ('Hello bhai', 'kaise ho'), asks casually ('kya haal hai', 'bored hoon', 'kya karun'), or says thanks, respond with genuine warmth, positivity, and a supportive boost before giving any local updates.\n"
            "6. 100% Grounded Honesty: Never hallucinate or invent fake sensor numbers. Base factual claims strictly on the verified database context below. If a sensor (like local AQI) is unavailable, explain it affectionately without making up figures.\n"
        )

        user_content = (
            f"User Question: \"{query}\"\n\n"
            f"Active Locality: {area_name} (Coordinates: {target_lat}, {target_lon})\n"
            f"Verified Database Context:\n"
            f"{json.dumps(grounded_context, indent=2)}\n\n"
            f"Please generate a grounded, companion-style response matching the required schema."
        )

        candidate_models = [
            settings.GEMINI_MODEL or "gemini-3.5-flash-lite",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ]
        # Deduplicate while preserving order
        unique_models = list(dict.fromkeys(candidate_models))

        response = None
        for model_name in unique_models:
            try:
                logger.info(f"[gemini_assistant] Calling Gemini API model='{model_name}' for area='{area_name}'...")
                resp = client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config={
                        "system_instruction": system_instruction,
                        "response_mime_type": "application/json",
                        "response_schema": GeminiAssistantSchema,
                        "temperature": 0.3,
                    },
                )
                if resp and resp.text:
                    response = resp
                    break
            except Exception as model_err:
                logger.warning(f"[gemini_assistant] Model {model_name} failed ({model_err}). Trying fallback model...")

        if not response or not response.text:
            return None

        parsed = json.loads(response.text)
        logger.info("[gemini_assistant] Successfully received grounded Gemini response.")
        return {
            "query": query,
            "area": area_name,
            "is_live_supported": is_live_supported,
            "response_text": parsed.get("response_text", ""),
            "key_findings": parsed.get("key_findings", []),
            "recommendations": parsed.get("recommendations", []),
            "grounded_sources": parsed.get("grounded_sources", ["WeatherAPI", "TomTom Traffic API v5", "NDMA SACHET"]),
            "confidence": parsed.get("confidence", "HIGH (MyArea24 Saathi RAG)"),
            "timestamp": datetime.datetime.utcnow(),
        }

    except Exception as e:
        logger.warning(f"[gemini_assistant] Gemini API call failed: {e}. Falling back to deterministic engine.")
        return None


def synthesize_civic_safety_briefing(
    area_name: str,
    incidents: List[Dict[str, Any]],
    weather_desc: Optional[str] = None,
) -> Optional[str]:
    """
    Synthesizes an executive civic briefing for a corridor/neighborhood
    combining active incidents and telemetry (inspired by CityGuardAlert).
    """
    api_key = (
        settings.GEMINI_API_KEY
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key:
        return None

    try:
        from google import genai
        client = genai.Client(api_key=api_key.strip())

        items = "\n".join([
            f"- {inc.get('title') or inc.get('headline') or 'Incident'}: {inc.get('description') or inc.get('instruction') or ''}"
            for inc in incidents[:6]
        ]) or "No severe active bottlenecks reported."

        prompt = (
            f"You are the MyArea24 Civic Intelligence Dispatcher for {area_name}. "
            f"Create a concise 2-sentence civic safety & commute briefing for residents.\n"
            f"Weather: {weather_desc or 'Nominal'}\n"
            f"Active Local Signals:\n{items}\n"
            f"Tone: Factual, calm, safety-first Indian civic guidance."
        )

        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL or "gemini-3.5-flash",
            contents=prompt,
        )
        return resp.text.strip() if resp and resp.text else None
    except Exception as err:
        logger.warning(f"[gemini_assistant] Failed to synthesize safety briefing: {err}")
        return None

