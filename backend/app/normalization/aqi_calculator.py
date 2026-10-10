"""
Official Central Pollution Control Board (CPCB) National Air Quality Index (NAQI) Calculator.
Based on the official Ministry of Environment, Forest & Climate Change (MoEFCC) 2014 guidelines.

Formula:
    Ip = [(I_hi - I_lo) / (B_hi - B_lo)] * (Cp - B_lo) + I_lo
Where:
    Cp = Pollutant concentration
    B_lo, B_hi = Breakpoint concentrations lower and upper bounds
    I_lo, I_hi = AQI index breakpoints lower and upper bounds
"""

from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel


# Breakpoint tables: List of (B_lo, B_hi, I_lo, I_hi)
CPCB_BREAKPOINTS: Dict[str, List[Tuple[float, float, float, float]]] = {
    "PM2.5": [
        (0.0, 30.0, 0.0, 50.0),
        (30.0, 60.0, 51.0, 100.0),
        (60.0, 90.0, 101.0, 200.0),
        (90.0, 120.0, 201.0, 300.0),
        (120.0, 250.0, 301.0, 400.0),
        (250.0, 380.0, 401.0, 500.0),
    ],
    "PM10": [
        (0.0, 50.0, 0.0, 50.0),
        (50.0, 100.0, 51.0, 100.0),
        (100.0, 250.0, 101.0, 200.0),
        (250.0, 350.0, 201.0, 300.0),
        (350.0, 430.0, 301.0, 400.0),
        (430.0, 510.0, 401.0, 500.0),
    ],
    "NO2": [
        (0.0, 40.0, 0.0, 50.0),
        (40.0, 80.0, 51.0, 100.0),
        (80.0, 180.0, 101.0, 200.0),
        (180.0, 280.0, 201.0, 300.0),
        (280.0, 400.0, 301.0, 400.0),
        (400.0, 530.0, 401.0, 500.0),
    ],
    "SO2": [
        (0.0, 40.0, 0.0, 50.0),
        (40.0, 80.0, 51.0, 100.0),
        (80.0, 380.0, 101.0, 200.0),
        (380.0, 800.0, 201.0, 300.0),
        (800.0, 1600.0, 301.0, 400.0),
        (1600.0, 2400.0, 401.0, 500.0),
    ],
    "CO": [
        (0.0, 1.0, 0.0, 50.0),
        (1.0, 2.0, 51.0, 100.0),
        (2.0, 10.0, 101.0, 200.0),
        (10.0, 17.0, 201.0, 300.0),
        (17.0, 34.0, 301.0, 400.0),
        (34.0, 50.0, 401.0, 500.0),
    ],
    "O3": [
        (0.0, 50.0, 0.0, 50.0),
        (50.0, 100.0, 51.0, 100.0),
        (100.0, 168.0, 101.0, 200.0),
        (168.0, 208.0, 201.0, 300.0),
        (208.0, 748.0, 301.0, 400.0),
        (748.0, 1000.0, 401.0, 500.0),
    ],
    "NH3": [
        (0.0, 200.0, 0.0, 50.0),
        (200.0, 400.0, 51.0, 100.0),
        (400.0, 800.0, 101.0, 200.0),
        (800.0, 1200.0, 201.0, 300.0),
        (1200.0, 1800.0, 301.0, 400.0),
        (1800.0, 2400.0, 401.0, 500.0),
    ],
    "Pb": [
        (0.0, 0.5, 0.0, 50.0),
        (0.5, 1.0, 51.0, 100.0),
        (1.0, 2.0, 101.0, 200.0),
        (2.0, 3.0, 201.0, 300.0),
        (3.0, 3.5, 301.0, 400.0),
        (3.5, 5.0, 401.0, 500.0),
    ],
}


def get_aqi_category(aqi: float) -> str:
    """Returns the official CPCB classification category for an AQI value."""
    if aqi <= 50.0:
        return "Good"
    elif aqi <= 100.0:
        return "Satisfactory"
    elif aqi <= 200.0:
        return "Moderate"
    elif aqi <= 300.0:
        return "Poor"
    elif aqi <= 400.0:
        return "Very Poor"
    else:
        return "Severe"


def convert_pollutant_concentration(
    pollutant: str, raw_value: float, unit: Optional[str] = None
) -> Optional[float]:
    """
    Normalizes raw pollutant readings into standard CPCB concentration units:
    - PM2.5, PM10, NO2, SO2, O3, NH3, Pb -> µg/m³
    - CO -> mg/m³
    Handles unit conversions from ppm, ppb, and µg/m³.
    """
    if raw_value is None or raw_value < 0.0:
        return None

    p_norm = pollutant.strip().upper()
    u_norm = (unit or "").strip().lower()

    # Carbon Monoxide (Target: mg/m³)
    if p_norm == "CO":
        if u_norm in ("mg/m3", "mg/m³", "milligram/m3", "milligrams/m3"):
            return round(raw_value, 2)
        elif u_norm in ("µg/m3", "µg/m³", "ug/m3", "microgram/m3", "micrograms/m3"):
            return round(raw_value / 1000.0, 2)
        elif u_norm == "ppm":
            # 1 ppm CO ≈ 1.145 mg/m³ at standard 25°C, 1 atm
            return round(raw_value * 1.145, 2)
        elif u_norm == "ppb":
            return round((raw_value / 1000.0) * 1.145, 2)
        else:
            # Defensive heuristic: Ambient CO rarely exceeds 30-50 mg/m³ even in severe episodes.
            # If raw value > 50.0 without unit, it is almost certainly reported in µg/m³ or ppb.
            if raw_value > 50.0:
                return round(raw_value / 1000.0, 2)
            return round(raw_value, 2)

    # Gaseous Pollutants (Target: µg/m³)
    if p_norm in ("NO2", "NOX", "SO2", "O3", "OZONE"):
        if u_norm in ("µg/m3", "µg/m³", "ug/m3", "microgram/m3", "micrograms/m3", ""):
            return round(raw_value, 1)
        elif u_norm == "ppm":
            factor = 1880.0 if "NO" in p_norm else (2620.0 if "SO" in p_norm else 1960.0)
            return round(raw_value * factor, 1)
        elif u_norm == "ppb":
            factor = 1.88 if "NO" in p_norm else (2.62 if "SO" in p_norm else 1.96)
            return round(raw_value * factor, 1)
        return round(raw_value, 1)

    # Particulate Matter (Target: µg/m³)
    return round(raw_value, 1)


def calculate_sub_index(pollutant: str, concentration: float) -> Optional[float]:
    """
    Calculates sub-index for a specific pollutant using CPCB linear interpolation.
    Returns None if pollutant unknown or concentration is negative.
    """
    if concentration is None or concentration < 0.0:
        return None

    norm_pollutant = pollutant.strip().upper()
    if norm_pollutant in ("PM25", "PM2.5"):
        key = "PM2.5"
    elif norm_pollutant == "PM10":
        key = "PM10"
    elif norm_pollutant in ("NO2", "NOX"):
        key = "NO2"
    elif norm_pollutant == "SO2":
        key = "SO2"
    elif norm_pollutant == "CO":
        key = "CO"
    elif norm_pollutant in ("O3", "OZONE"):
        key = "O3"
    elif norm_pollutant == "NH3":
        key = "NH3"
    elif norm_pollutant == "PB":
        key = "Pb"
    else:
        return None

    breakpoints = CPCB_BREAKPOINTS.get(key)
    if not breakpoints:
        return None

    # Find matching breakpoint bracket
    for b_lo, b_hi, i_lo, i_hi in breakpoints:
        if b_lo <= concentration <= b_hi:
            # Linear interpolation
            if b_hi == b_lo:
                return i_lo
            sub_index = ((i_hi - i_lo) / (b_hi - b_lo)) * (concentration - b_lo) + i_lo
            return round(sub_index, 1)

    # Beyond upper breakpoint: extrapolate linearly
    last_b_lo, last_b_hi, last_i_lo, last_i_hi = breakpoints[-1]
    if concentration > last_b_hi:
        slope = (last_i_hi - last_i_lo) / (last_b_hi - last_b_lo)
        overflow_index = last_i_hi + slope * (concentration - last_b_hi)
        return round(overflow_index, 1)

    return None


class SubIndexResult(BaseModel):
    pollutant: str
    concentration: float
    sub_index: float
    category: str


class AQICalculationResult(BaseModel):
    aqi_value: float
    aqi_category: str
    prominent_pollutant: str
    sub_indices: Dict[str, SubIndexResult]
    is_naqi_compliant: bool
    data_quality_notes: str


def calculate_pollutant_sub_indices(
    pollutants: Dict[str, Optional[float]]
) -> Dict[str, SubIndexResult]:
    """Calculates individual CPCB sub-indices for provided pollutants."""
    sub_indices: Dict[str, SubIndexResult] = {}
    for pol, conc in pollutants.items():
        if conc is not None and conc >= 0:
            si = calculate_sub_index(pol, conc)
            if si is not None:
                standard_name = "PM2.5" if pol.upper() in ("PM25", "PM2.5") else pol.upper()
                sub_indices[standard_name] = SubIndexResult(
                    pollutant=standard_name,
                    concentration=conc,
                    sub_index=si,
                    category=get_aqi_category(si),
                )
    return sub_indices


def calculate_cpcb_aqi(
    pollutants: Dict[str, Optional[float]],
    strict_minimum_requirements: bool = True,
) -> Optional[AQICalculationResult]:
    """
    Computes overall CPCB NAQI and identifies the prominent pollutant.

    CPCB Requirements for Official NAQI:
    1. At least 3 pollutants must be monitored.
    2. At least one must be PM10 or PM2.5.

    If strict_minimum_requirements is True and requirements are not met, returns None
    to prevent calculating an ungrounded or incomplete overall AQI.
    """
    sub_indices = calculate_pollutant_sub_indices(pollutants)
    if not sub_indices:
        return None

    has_pm = "PM2.5" in sub_indices or "PM10" in sub_indices
    is_compliant = len(sub_indices) >= 3 and has_pm

    if strict_minimum_requirements and not is_compliant:
        # Refuse to calculate an incomplete overall AQI per CPCB guidelines
        return None

    # Max sub-index is overall AQI
    max_pollutant = max(sub_indices.keys(), key=lambda k: sub_indices[k].sub_index)
    overall_aqi = sub_indices[max_pollutant].sub_index
    category = get_aqi_category(overall_aqi)

    notes = (
        f"Real-time CPCB 2014 breakpoint sub-index from {len(sub_indices)} monitored pollutants."
    )

    return AQICalculationResult(
        aqi_value=overall_aqi,
        aqi_category=category,
        prominent_pollutant=max_pollutant,
        sub_indices=sub_indices,
        is_naqi_compliant=is_compliant,
        data_quality_notes=notes,
    )
