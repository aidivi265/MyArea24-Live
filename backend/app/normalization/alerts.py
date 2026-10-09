import datetime
from typing import Any, Dict, List, Optional
from dateutil import parser as dt_parser
from defusedxml import ElementTree as ET
from pydantic import BaseModel, Field


class NormalizedAlertRecord(BaseModel):
    source_id: str = "sachet_cap"
    alert_identifier: str
    sender: str
    event_type: str
    severity: str  # 'Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'
    urgency: str
    certainty: str
    headline: str
    description: Optional[str] = None
    instruction: Optional[str] = None
    area_description: str
    polygon_geojson: Optional[Dict[str, Any]] = None
    circle_geojson: Optional[Dict[str, Any]] = None
    effective_at: datetime.datetime  # UTC
    expires_at: datetime.datetime  # UTC
    is_active: bool = True


def _parse_iso_utc(date_str: Optional[str], default: datetime.datetime) -> datetime.datetime:
    if not date_str:
        return default
    try:
        dt = dt_parser.parse(date_str)
        if dt.tzinfo is not None:
            return dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return default


def _clean_tag(tag: str) -> str:
    """Strips XML namespace from tag name (e.g. '{urn:...}headline' -> 'headline')."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def extract_rss_item_links(xml_content: str | bytes) -> List[tuple[str, str]]:
    """
    Extracts (identifier, link) tuples from an RSS 2.0 or Atom feed.
    Guaranteed safe XML parsing via defusedxml.
    """
    results: List[tuple[str, str]] = []
    try:
        if isinstance(xml_content, str):
            xml_bytes = xml_content.encode("utf-8")
        else:
            xml_bytes = xml_content

        root = ET.fromstring(xml_bytes)
    except Exception:
        return []

    for item in root.findall(".//item"):
        link = (item.findtext("link") or "").strip()
        guid = (item.findtext("guid") or "").strip()
        if link:
            results.append((guid or link, link))

    return results


def parse_cap_polygon(polygon_text: str) -> Optional[Dict[str, Any]]:
    """
    Parses CAP polygon string ("lat1,lon1 lat2,lon2 ...") into GeoJSON Polygon.
    Note: CAP specifies lat,lon order; GeoJSON requires [lon, lat] order.
    """
    if not polygon_text:
        return None
    try:
        pairs = polygon_text.strip().split()
        coords: List[List[float]] = []
        for pair in pairs:
            parts = pair.split(",")
            if len(parts) == 2:
                lat = float(parts[0].strip())
                lon = float(parts[1].strip())
                coords.append([lon, lat])

        if len(coords) < 3:
            return None

        # Close polygon if not closed
        if coords[0] != coords[-1]:
            coords.append(coords[0])

        return {"type": "Polygon", "coordinates": [coords]}
    except Exception:
        return None


def parse_cap_circle(circle_text: str) -> Optional[Dict[str, Any]]:
    """
    Parses CAP circle string ("lat,lon radius_km") into GeoJSON representation.
    """
    if not circle_text:
        return None
    try:
        parts = circle_text.strip().split()
        if len(parts) >= 2:
            coord_parts = parts[0].split(",")
            lat = float(coord_parts[0].strip())
            lon = float(coord_parts[1].strip())
            radius_km = float(parts[1].strip())
            return {
                "type": "Circle",
                "center": [lon, lat],
                "radius_km": radius_km,
            }
        return None
    except Exception:
        return None


def parse_cap_xml_payload(xml_content: str | bytes) -> List[NormalizedAlertRecord]:
    """
    Safely parses CAP v1.1 / v1.2 XML or RSS/Atom feed containing CAP alerts using defusedxml.
    """
    records: List[NormalizedAlertRecord] = []
    now = datetime.datetime.utcnow()

    try:
        if isinstance(xml_content, str):
            xml_bytes = xml_content.encode("utf-8")
        else:
            xml_bytes = xml_content

        root = ET.fromstring(xml_bytes)
    except Exception as e:
        # Malformed XML
        return []

    # Find all <alert> elements regardless of namespace or feed wrapper (RSS/Atom)
    alert_elements = []
    root_tag = _clean_tag(root.tag)
    if root_tag == "alert":
        alert_elements.append(root)
    else:
        # Search all descendants
        for elem in root.iter():
            if _clean_tag(elem.tag) == "alert":
                alert_elements.append(elem)

    for alert in alert_elements:
        alert_dict: Dict[str, Any] = {}
        info_dict: Dict[str, Any] = {}
        area_dict: Dict[str, Any] = {}

        for child in alert:
            tag = _clean_tag(child.tag)
            if tag == "info":
                # Extract info tags
                for info_child in child:
                    itag = _clean_tag(info_child.tag)
                    if itag == "area":
                        for area_child in info_child:
                            atag = _clean_tag(area_child.tag)
                            area_dict[atag] = (area_child.text or "").strip()
                    else:
                        info_dict[itag] = (info_child.text or "").strip()
            else:
                alert_dict[tag] = (child.text or "").strip()

        identifier = alert_dict.get("identifier")
        if not identifier:
            continue

        sender = alert_dict.get("sender", "NDMA SACHET")
        event_type = info_dict.get("event", "Public Advisory")
        severity = info_dict.get("severity", "Moderate")
        urgency = info_dict.get("urgency", "Expected")
        certainty = info_dict.get("certainty", "Observed")
        headline = info_dict.get("headline") or f"Government Advisory: {event_type}"
        description = info_dict.get("description")
        instruction = info_dict.get("instruction")
        area_desc = area_dict.get("areaDesc") or "Affected District / State"

        # Dates
        effective_at = _parse_iso_utc(info_dict.get("effective") or info_dict.get("onset"), now)
        expires_at = _parse_iso_utc(info_dict.get("expires"), now + datetime.timedelta(hours=24))

        # Geometries
        polygon_geojson = parse_cap_polygon(area_dict.get("polygon", ""))
        circle_geojson = parse_cap_circle(area_dict.get("circle", ""))

        is_active = expires_at > now

        records.append(
            NormalizedAlertRecord(
                source_id="sachet_cap",
                alert_identifier=identifier,
                sender=sender,
                event_type=event_type,
                severity=severity,
                urgency=urgency,
                certainty=certainty,
                headline=headline,
                description=description,
                instruction=instruction,
                area_description=area_desc,
                polygon_geojson=polygon_geojson,
                circle_geojson=circle_geojson,
                effective_at=effective_at,
                expires_at=expires_at,
                is_active=is_active,
            )
        )

    # Fallback for pure RSS 2.0 feeds without embedded <alert> tags
    if not records and root_tag == "rss":
        for item in root.findall(".//item"):
            guid = (item.findtext("guid") or item.findtext("link") or "").strip()
            title = (item.findtext("title") or "").strip()
            if not title:
                continue
            identifier = guid or f"rss:{abs(hash(title))}"
            author = (item.findtext("author") or "NDMA SACHET").strip()
            category = (item.findtext("category") or "Public Advisory").strip()
            description = (item.findtext("description") or "").strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            effective_at = _parse_iso_utc(pub_date, now)
            expires_at = effective_at + datetime.timedelta(hours=6)
            is_active = expires_at > now

            records.append(
                NormalizedAlertRecord(
                    source_id="sachet_cap",
                    alert_identifier=identifier,
                    sender=author,
                    event_type=category,
                    severity="Moderate",
                    urgency="Expected",
                    certainty="Likely",
                    headline=title,
                    description=description or None,
                    instruction="Follow official district disaster management guidelines.",
                    area_description="Affected Region / District",
                    polygon_geojson=None,
                    circle_geojson=None,
                    effective_at=effective_at,
                    expires_at=expires_at,
                    is_active=is_active,
                )
            )

    return records
