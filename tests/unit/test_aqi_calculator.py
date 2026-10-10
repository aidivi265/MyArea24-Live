import pytest
from backend.app.normalization.aqi_calculator import (
    calculate_sub_index,
    get_aqi_category,
    calculate_cpcb_aqi,
    calculate_pollutant_sub_indices,
    convert_pollutant_concentration,
    CPCB_BREAKPOINTS,
)


def test_aqi_categories():
    assert get_aqi_category(0.0) == "Good"
    assert get_aqi_category(45.0) == "Good"
    assert get_aqi_category(50.0) == "Good"
    assert get_aqi_category(51.0) == "Satisfactory"
    assert get_aqi_category(100.0) == "Satisfactory"
    assert get_aqi_category(101.0) == "Moderate"
    assert get_aqi_category(200.0) == "Moderate"
    assert get_aqi_category(201.0) == "Poor"
    assert get_aqi_category(300.0) == "Poor"
    assert get_aqi_category(301.0) == "Very Poor"
    assert get_aqi_category(400.0) == "Very Poor"
    assert get_aqi_category(401.0) == "Severe"
    assert get_aqi_category(500.0) == "Severe"
    assert get_aqi_category(650.0) == "Severe"


def test_calculate_sub_index_pm25():
    # Good bracket: (0, 30) -> (0, 50)
    si_good = calculate_sub_index("PM2.5", 15.0)
    assert si_good == 25.0

    # Satisfactory bracket: (30, 60) -> (51, 100)
    si_sat = calculate_sub_index("PM2.5", 45.0)
    assert 75.0 <= si_sat <= 76.0

    # Moderate bracket: (60, 90) -> (101, 200)
    si_mod = calculate_sub_index("PM2.5", 75.0)
    assert 150.0 <= si_mod <= 151.0

    # Poor bracket: (90, 120) -> (201, 300)
    si_poor = calculate_sub_index("PM2.5", 105.0)
    assert 250.0 <= si_poor <= 251.0

    # Very Poor bracket: (120, 250) -> (301, 400)
    si_vp = calculate_sub_index("PM2.5", 185.0)
    assert 350.0 <= si_vp <= 351.0

    # Severe bracket: (250, 380) -> (401, 500)
    si_sev = calculate_sub_index("PM2.5", 315.0)
    assert 450.0 <= si_sev <= 451.0

    # Severe overflow
    si_over = calculate_sub_index("PM2.5", 450.0)
    assert si_over > 500.0


def test_calculate_sub_index_pm10():
    # Good bracket: (0, 50) -> (0, 50)
    assert calculate_sub_index("PM10", 25.0) == 25.0
    # Satisfactory: (50, 100) -> (51, 100)
    si = calculate_sub_index("PM10", 75.0)
    assert 75.0 <= si <= 76.0


def test_calculate_sub_index_other_pollutants():
    # NO2 (0, 40) -> (0, 50)
    assert calculate_sub_index("NO2", 20.0) == 25.0
    # SO2 (0, 40) -> (0, 50)
    assert calculate_sub_index("SO2", 20.0) == 25.0
    # CO (0, 1.0) -> (0, 50)
    assert calculate_sub_index("CO", 0.5) == 25.0
    # O3 (0, 50) -> (0, 50)
    assert calculate_sub_index("O3", 25.0) == 25.0
    # NH3 (0, 200) -> (0, 50)
    assert calculate_sub_index("NH3", 100.0) == 25.0
    # Pb (0, 0.5) -> (0, 50)
    assert calculate_sub_index("Pb", 0.25) == 25.0


def test_invalid_and_negative_inputs():
    assert calculate_sub_index("PM2.5", -5.0) is None
    assert calculate_sub_index("UNKNOWN_POLLUTANT", 50.0) is None
    assert calculate_sub_index("PM2.5", None) is None


def test_convert_pollutant_concentration_co():
    # CO in mg/m3
    assert convert_pollutant_concentration("CO", 1.5, "mg/m3") == 1.5
    assert convert_pollutant_concentration("CO", 1.5, "mg/m³") == 1.5
    # CO in µg/m3 -> converted to mg/m3
    assert convert_pollutant_concentration("CO", 1500.0, "µg/m³") == 1.5
    assert convert_pollutant_concentration("CO", 1500.0, "ug/m3") == 1.5
    # CO in ppm -> ~1.145 mg/m3
    assert convert_pollutant_concentration("CO", 2.0, "ppm") == 2.29
    # CO in ppb -> ~0.001145 mg/m3
    assert convert_pollutant_concentration("CO", 2000.0, "ppb") == 2.29
    # CO heuristic fallback: if > 50 without unit, treated as µg/m3
    assert convert_pollutant_concentration("CO", 800.0, "") == 0.8


def test_convert_pollutant_concentration_gases():
    # NO2 in ppb -> µg/m3
    assert convert_pollutant_concentration("NO2", 50.0, "ppb") == 94.0
    # SO2 in ppb -> µg/m3
    assert convert_pollutant_concentration("SO2", 10.0, "ppb") == 26.2
    # O3 in ppb -> µg/m3
    assert convert_pollutant_concentration("O3", 20.0, "ppb") == 39.2


def test_calculate_cpcb_aqi_compliant():
    pollutants = {
        "PM2.5": 185.0,  # ~350 (Very Poor)
        "PM10": 120.0,   # ~114 (Moderate)
        "NO2": 45.0,     # ~57 (Satisfactory)
        "SO2": 20.0,     # ~25 (Good)
    }
    result = calculate_cpcb_aqi(pollutants)
    assert result is not None
    assert result.is_naqi_compliant is True
    assert result.prominent_pollutant == "PM2.5"
    assert result.aqi_category == "Very Poor"
    assert 350.0 <= result.aqi_value <= 351.0
    assert "PM2.5" in result.sub_indices
    assert "PM10" in result.sub_indices
    assert "NO2" in result.sub_indices
    assert "SO2" in result.sub_indices


def test_calculate_cpcb_aqi_strict_rejection_fewer_than_three():
    # When fewer than 3 pollutants are available, strict overall AQI calculation is refused
    pollutants = {
        "PM2.5": 75.0,
        "NO2": 30.0,
    }
    assert calculate_cpcb_aqi(pollutants) is None

    # But individual sub-indices are calculable
    sub_indices = calculate_pollutant_sub_indices(pollutants)
    assert len(sub_indices) == 2
    assert "PM2.5" in sub_indices
    assert "NO2" in sub_indices


def test_calculate_cpcb_aqi_strict_rejection_missing_pm():
    # When 3 pollutants are available but missing PM2.5 and PM10, overall AQI is refused
    pollutants = {
        "NO2": 100.0,
        "SO2": 60.0,
        "CO": 5.0,
    }
    assert calculate_cpcb_aqi(pollutants) is None

    sub_indices = calculate_pollutant_sub_indices(pollutants)
    assert len(sub_indices) == 3


def test_calculate_cpcb_aqi_empty_or_all_none():
    assert calculate_cpcb_aqi({}) is None
    assert calculate_cpcb_aqi({"PM2.5": None, "PM10": None}) is None
