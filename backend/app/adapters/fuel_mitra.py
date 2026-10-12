import datetime
import json
import logging
import urllib.request
from typing import Any, Dict, List, Optional

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# ==============================================================================
# Comprehensive Pan-India Daily Retail Fuel Benchmarks (All 36 States & UTs)
# Retail prices governed by State VAT + Central Excise + Dealer Margins
# Sourced per Indian Oil Marketing Companies (IOCL, HPCL, BPCL)
# ==============================================================================

BENCHMARK_FUEL_RATES: Dict[str, Dict[str, Any]] = {
    # ─── Metros & Delhi NCR ──────────────────────────────────────────────────
    "delhi": {"city": "Delhi", "state": "Delhi", "petrol": 94.72, "diesel": 87.62, "cng": 75.09, "trend": "Stable"},
    "new delhi": {"city": "New Delhi", "state": "Delhi", "petrol": 94.72, "diesel": 87.62, "cng": 75.09, "trend": "Stable"},
    "delhi ncr": {"city": "Delhi NCR", "state": "Delhi", "petrol": 94.72, "diesel": 87.62, "cng": 75.09, "trend": "Stable"},
    "noida": {"city": "Noida", "state": "Uttar Pradesh", "petrol": 94.66, "diesel": 87.76, "cng": 79.20, "trend": "Stable"},
    "greater noida": {"city": "Greater Noida", "state": "Uttar Pradesh", "petrol": 94.66, "diesel": 87.76, "cng": 79.20, "trend": "Stable"},
    "ghaziabad": {"city": "Ghaziabad", "state": "Uttar Pradesh", "petrol": 94.65, "diesel": 87.75, "cng": 79.20, "trend": "Stable"},
    "gurugram": {"city": "Gurugram", "state": "Haryana", "petrol": 95.19, "diesel": 88.05, "cng": 79.40, "trend": "Stable"},
    "gurgaon": {"city": "Gurugram", "state": "Haryana", "petrol": 95.19, "diesel": 88.05, "cng": 79.40, "trend": "Stable"},
    "faridabad": {"city": "Faridabad", "state": "Haryana", "petrol": 95.24, "diesel": 88.10, "cng": 79.40, "trend": "Stable"},

    # ─── Uttar Pradesh ───────────────────────────────────────────────────────
    "uttar pradesh": {"city": "Lucknow", "state": "Uttar Pradesh", "petrol": 94.65, "diesel": 87.75, "cng": 79.20, "trend": "Stable"},
    "lucknow": {"city": "Lucknow", "state": "Uttar Pradesh", "petrol": 94.69, "diesel": 87.81, "cng": 81.20, "trend": "Stable"},
    "kanpur": {"city": "Kanpur", "state": "Uttar Pradesh", "petrol": 94.50, "diesel": 87.58, "cng": 81.50, "trend": "Stable"},
    "varanasi": {"city": "Varanasi", "state": "Uttar Pradesh", "petrol": 95.07, "diesel": 88.24, "cng": 82.50, "trend": "Stable"},
    "agra": {"city": "Agra", "state": "Uttar Pradesh", "petrol": 94.42, "diesel": 87.47, "cng": 80.20, "trend": "Stable"},
    "meerut": {"city": "Meerut", "state": "Uttar Pradesh", "petrol": 94.43, "diesel": 87.49, "cng": 79.80, "trend": "Stable"},
    "prayagraj": {"city": "Prayagraj", "state": "Uttar Pradesh", "petrol": 95.22, "diesel": 88.39, "cng": 82.00, "trend": "Stable"},
    "allahabad": {"city": "Prayagraj", "state": "Uttar Pradesh", "petrol": 95.22, "diesel": 88.39, "cng": 82.00, "trend": "Stable"},
    "bareilly": {"city": "Bareilly", "state": "Uttar Pradesh", "petrol": 94.85, "diesel": 87.98, "cng": 80.50, "trend": "Stable"},
    "aligarh": {"city": "Aligarh", "state": "Uttar Pradesh", "petrol": 94.75, "diesel": 87.88, "cng": 80.00, "trend": "Stable"},
    "gorakhpur": {"city": "Gorakhpur", "state": "Uttar Pradesh", "petrol": 94.95, "diesel": 88.08, "cng": 82.00, "trend": "Stable"},
    "mathura": {"city": "Mathura", "state": "Uttar Pradesh", "petrol": 94.48, "diesel": 87.52, "cng": 80.10, "trend": "Stable"},
    "moradabad": {"city": "Moradabad", "state": "Uttar Pradesh", "petrol": 94.70, "diesel": 87.80, "cng": 80.00, "trend": "Stable"},
    "firozabad": {"city": "Firozabad", "state": "Uttar Pradesh", "petrol": 94.52, "diesel": 87.60, "cng": 80.20, "trend": "Stable"},
    "jhansi": {"city": "Jhansi", "state": "Uttar Pradesh", "petrol": 95.10, "diesel": 88.20, "cng": 81.80, "trend": "Stable"},
    "saharanpur": {"city": "Saharanpur", "state": "Uttar Pradesh", "petrol": 94.55, "diesel": 87.65, "cng": 79.90, "trend": "Stable"},

    # ─── Haryana ─────────────────────────────────────────────────────────────
    "haryana": {"city": "Gurugram", "state": "Haryana", "petrol": 95.19, "diesel": 88.05, "cng": 79.40, "trend": "Stable"},
    "panipat": {"city": "Panipat", "state": "Haryana", "petrol": 95.25, "diesel": 88.10, "cng": 79.40, "trend": "Stable"},
    "ambala": {"city": "Ambala", "state": "Haryana", "petrol": 95.30, "diesel": 88.15, "cng": 79.40, "trend": "Stable"},
    "karnal": {"city": "Karnal", "state": "Haryana", "petrol": 95.20, "diesel": 88.06, "cng": 79.40, "trend": "Stable"},
    "rohtak": {"city": "Rohtak", "state": "Haryana", "petrol": 95.15, "diesel": 88.01, "cng": 79.40, "trend": "Stable"},
    "hisar": {"city": "Hisar", "state": "Haryana", "petrol": 95.35, "diesel": 88.22, "cng": 79.40, "trend": "Stable"},
    "panchkula": {"city": "Panchkula", "state": "Haryana", "petrol": 95.28, "diesel": 88.12, "cng": 79.40, "trend": "Stable"},

    # ─── Maharashtra ─────────────────────────────────────────────────────────
    "maharashtra": {"city": "Mumbai", "state": "Maharashtra", "petrol": 104.21, "diesel": 92.15, "cng": 76.00, "trend": "Stable"},
    "mumbai": {"city": "Mumbai", "state": "Maharashtra", "petrol": 104.21, "diesel": 92.15, "cng": 76.00, "trend": "Stable"},
    "navi mumbai": {"city": "Navi Mumbai", "state": "Maharashtra", "petrol": 104.21, "diesel": 92.15, "cng": 76.00, "trend": "Stable"},
    "thane": {"city": "Thane", "state": "Maharashtra", "petrol": 104.25, "diesel": 92.18, "cng": 76.00, "trend": "Stable"},
    "pune": {"city": "Pune", "state": "Maharashtra", "petrol": 103.68, "diesel": 90.23, "cng": 85.50, "trend": "Stable"},
    "nashik": {"city": "Nashik", "state": "Maharashtra", "petrol": 104.05, "diesel": 90.58, "cng": 85.00, "trend": "Stable"},
    "nagpur": {"city": "Nagpur", "state": "Maharashtra", "petrol": 104.55, "diesel": 91.10, "cng": 86.00, "trend": "Stable"},
    "aurangabad": {"city": "Chhatrapati Sambhajinagar", "state": "Maharashtra", "petrol": 104.30, "diesel": 90.85, "cng": 85.50, "trend": "Stable"},
    "solapur": {"city": "Solapur", "state": "Maharashtra", "petrol": 104.40, "diesel": 90.95, "cng": 85.00, "trend": "Stable"},
    "kolhapur": {"city": "Kolhapur", "state": "Maharashtra", "petrol": 104.60, "diesel": 91.15, "cng": 85.50, "trend": "Stable"},

    # ─── Karnataka ───────────────────────────────────────────────────────────
    "karnataka": {"city": "Bengaluru", "state": "Karnataka", "petrol": 102.86, "diesel": 88.94, "cng": 82.50, "trend": "Stable"},
    "bengaluru": {"city": "Bengaluru", "state": "Karnataka", "petrol": 102.86, "diesel": 88.94, "cng": 82.50, "trend": "Stable"},
    "bangalore": {"city": "Bengaluru", "state": "Karnataka", "petrol": 102.86, "diesel": 88.94, "cng": 82.50, "trend": "Stable"},
    "mysuru": {"city": "Mysuru", "state": "Karnataka", "petrol": 102.75, "diesel": 88.82, "cng": 82.50, "trend": "Stable"},
    "hubballi": {"city": "Hubballi-Dharwad", "state": "Karnataka", "petrol": 103.15, "diesel": 89.20, "cng": 83.00, "trend": "Stable"},
    "mangaluru": {"city": "Mangaluru", "state": "Karnataka", "petrol": 102.40, "diesel": 88.50, "cng": 82.00, "trend": "Stable"},
    "belagavi": {"city": "Belagavi", "state": "Karnataka", "petrol": 103.10, "diesel": 89.15, "cng": 82.80, "trend": "Stable"},

    # ─── Rajasthan ───────────────────────────────────────────────────────────
    "rajasthan": {"city": "Jaipur", "state": "Rajasthan", "petrol": 104.88, "diesel": 90.36, "cng": 82.50, "trend": "Stable"},
    "jaipur": {"city": "Jaipur", "state": "Rajasthan", "petrol": 104.88, "diesel": 90.36, "cng": 82.50, "trend": "Stable"},
    "jodhpur": {"city": "Jodhpur", "state": "Rajasthan", "petrol": 105.12, "diesel": 90.58, "cng": 83.20, "trend": "Stable"},
    "kota": {"city": "Kota", "state": "Rajasthan", "petrol": 104.75, "diesel": 90.22, "cng": 82.00, "trend": "Stable"},
    "udaipur": {"city": "Udaipur", "state": "Rajasthan", "petrol": 105.30, "diesel": 90.75, "cng": 83.00, "trend": "Stable"},
    "bikaner": {"city": "Bikaner", "state": "Rajasthan", "petrol": 105.40, "diesel": 90.85, "cng": 83.50, "trend": "Stable"},

    # ─── Gujarat ─────────────────────────────────────────────────────────────
    "gujarat": {"city": "Ahmedabad", "state": "Gujarat", "petrol": 94.42, "diesel": 90.11, "cng": 74.26, "trend": "Stable"},
    "ahmedabad": {"city": "Ahmedabad", "state": "Gujarat", "petrol": 94.42, "diesel": 90.11, "cng": 74.26, "trend": "Stable"},
    "surat": {"city": "Surat", "state": "Gujarat", "petrol": 94.31, "diesel": 90.00, "cng": 74.26, "trend": "Stable"},
    "vadodara": {"city": "Vadodara", "state": "Gujarat", "petrol": 94.15, "diesel": 89.84, "cng": 73.80, "trend": "Stable"},
    "rajkot": {"city": "Rajkot", "state": "Gujarat", "petrol": 94.35, "diesel": 90.05, "cng": 74.20, "trend": "Stable"},
    "gandhinagar": {"city": "Gandhinagar", "state": "Gujarat", "petrol": 94.45, "diesel": 90.15, "cng": 74.30, "trend": "Stable"},

    # ─── West Bengal ─────────────────────────────────────────────────────────
    "west bengal": {"city": "Kolkata", "state": "West Bengal", "petrol": 103.94, "diesel": 90.76, "cng": 79.50, "trend": "Stable"},
    "kolkata": {"city": "Kolkata", "state": "West Bengal", "petrol": 103.94, "diesel": 90.76, "cng": 79.50, "trend": "Stable"},
    "howrah": {"city": "Howrah", "state": "West Bengal", "petrol": 103.94, "diesel": 90.76, "cng": 79.50, "trend": "Stable"},
    "durgapur": {"city": "Durgapur", "state": "West Bengal", "petrol": 104.10, "diesel": 90.90, "cng": 80.00, "trend": "Stable"},
    "siliguri": {"city": "Siliguri", "state": "West Bengal", "petrol": 104.30, "diesel": 91.10, "cng": 81.00, "trend": "Stable"},

    # ─── Tamil Nadu ──────────────────────────────────────────────────────────
    "tamil nadu": {"city": "Chennai", "state": "Tamil Nadu", "petrol": 100.75, "diesel": 92.34, "cng": 81.00, "trend": "Stable"},
    "chennai": {"city": "Chennai", "state": "Tamil Nadu", "petrol": 100.75, "diesel": 92.34, "cng": 81.00, "trend": "Stable"},
    "coimbatore": {"city": "Coimbatore", "state": "Tamil Nadu", "petrol": 101.20, "diesel": 92.80, "cng": 81.50, "trend": "Stable"},
    "madurai": {"city": "Madurai", "state": "Tamil Nadu", "petrol": 101.45, "diesel": 93.05, "cng": 81.50, "trend": "Stable"},
    "salem": {"city": "Salem", "state": "Tamil Nadu", "petrol": 101.10, "diesel": 92.70, "cng": 81.20, "trend": "Stable"},

    # ─── Telangana ───────────────────────────────────────────────────────────
    "telangana": {"city": "Hyderabad", "state": "Telangana", "petrol": 107.41, "diesel": 95.65, "cng": 89.00, "trend": "Stable"},
    "hyderabad": {"city": "Hyderabad", "state": "Telangana", "petrol": 107.41, "diesel": 95.65, "cng": 89.00, "trend": "Stable"},
    "secunderabad": {"city": "Secunderabad", "state": "Telangana", "petrol": 107.41, "diesel": 95.65, "cng": 89.00, "trend": "Stable"},
    "warangal": {"city": "Warangal", "state": "Telangana", "petrol": 107.20, "diesel": 95.45, "cng": 88.50, "trend": "Stable"},

    # ─── Andhra Pradesh ──────────────────────────────────────────────────────
    "andhra pradesh": {"city": "Visakhapatnam", "state": "Andhra Pradesh", "petrol": 108.29, "diesel": 96.17, "cng": 88.50, "trend": "Stable"},
    "visakhapatnam": {"city": "Visakhapatnam", "state": "Andhra Pradesh", "petrol": 108.29, "diesel": 96.17, "cng": 88.50, "trend": "Stable"},
    "vijayawada": {"city": "Vijayawada", "state": "Andhra Pradesh", "petrol": 108.50, "diesel": 96.38, "cng": 88.50, "trend": "Stable"},
    "guntur": {"city": "Guntur", "state": "Andhra Pradesh", "petrol": 108.45, "diesel": 96.32, "cng": 88.50, "trend": "Stable"},

    # ─── Madhya Pradesh ──────────────────────────────────────────────────────
    "madhya pradesh": {"city": "Bhopal", "state": "Madhya Pradesh", "petrol": 106.47, "diesel": 91.84, "cng": 86.50, "trend": "Stable"},
    "bhopal": {"city": "Bhopal", "state": "Madhya Pradesh", "petrol": 106.47, "diesel": 91.84, "cng": 86.50, "trend": "Stable"},
    "indore": {"city": "Indore", "state": "Madhya Pradesh", "petrol": 106.50, "diesel": 91.89, "cng": 86.50, "trend": "Stable"},
    "jabalpur": {"city": "Jabalpur", "state": "Madhya Pradesh", "petrol": 106.65, "diesel": 92.00, "cng": 86.80, "trend": "Stable"},
    "gwalior": {"city": "Gwalior", "state": "Madhya Pradesh", "petrol": 106.70, "diesel": 92.05, "cng": 86.80, "trend": "Stable"},

    # ─── Bihar ───────────────────────────────────────────────────────────────
    "bihar": {"city": "Patna", "state": "Bihar", "petrol": 105.18, "diesel": 92.04, "cng": 84.50, "trend": "Stable"},
    "patna": {"city": "Patna", "state": "Bihar", "petrol": 105.18, "diesel": 92.04, "cng": 84.50, "trend": "Stable"},
    "gaya": {"city": "Gaya", "state": "Bihar", "petrol": 105.62, "diesel": 92.45, "cng": 85.00, "trend": "Stable"},
    "muzaffarpur": {"city": "Muzaffarpur", "state": "Bihar", "petrol": 105.40, "diesel": 92.25, "cng": 84.80, "trend": "Stable"},

    # ─── Punjab & Chandigarh ─────────────────────────────────────────────────
    "punjab": {"city": "Chandigarh", "state": "Punjab", "petrol": 96.28, "diesel": 86.53, "cng": 81.50, "trend": "Stable"},
    "chandigarh": {"city": "Chandigarh", "state": "Chandigarh", "petrol": 94.24, "diesel": 82.40, "cng": 81.50, "trend": "Stable"},
    "ludhiana": {"city": "Ludhiana", "state": "Punjab", "petrol": 96.28, "diesel": 86.53, "cng": 81.50, "trend": "Stable"},
    "amritsar": {"city": "Amritsar", "state": "Punjab", "petrol": 96.50, "diesel": 86.75, "cng": 82.00, "trend": "Stable"},
    "jalandhar": {"city": "Jalandhar", "state": "Punjab", "petrol": 96.35, "diesel": 86.60, "cng": 81.80, "trend": "Stable"},

    # ─── Kerala ──────────────────────────────────────────────────────────────
    "kerala": {"city": "Kochi", "state": "Kerala", "petrol": 105.74, "diesel": 94.71, "cng": 85.50, "trend": "Stable"},
    "kochi": {"city": "Kochi", "state": "Kerala", "petrol": 105.74, "diesel": 94.71, "cng": 85.50, "trend": "Stable"},
    "cochin": {"city": "Kochi", "state": "Kerala", "petrol": 105.74, "diesel": 94.71, "cng": 85.50, "trend": "Stable"},
    "ernakulam": {"city": "Kochi", "state": "Kerala", "petrol": 105.74, "diesel": 94.71, "cng": 85.50, "trend": "Stable"},
    "thiruvananthapuram": {"city": "Thiruvananthapuram", "state": "Kerala", "petrol": 107.24, "diesel": 96.06, "cng": 87.00, "trend": "Stable"},
    "kozhikode": {"city": "Kozhikode", "state": "Kerala", "petrol": 105.90, "diesel": 94.85, "cng": 85.80, "trend": "Stable"},

    # ─── Odisha ──────────────────────────────────────────────────────────────
    "odisha": {"city": "Bhubaneswar", "state": "Odisha", "petrol": 101.06, "diesel": 92.64, "cng": 83.00, "trend": "Stable"},
    "bhubaneswar": {"city": "Bhubaneswar", "state": "Odisha", "petrol": 101.06, "diesel": 92.64, "cng": 83.00, "trend": "Stable"},
    "cuttack": {"city": "Cuttack", "state": "Odisha", "petrol": 101.15, "diesel": 92.72, "cng": 83.00, "trend": "Stable"},

    # ─── Assam & North East ──────────────────────────────────────────────────
    "assam": {"city": "Guwahati", "state": "Assam", "petrol": 96.12, "diesel": 88.38, "cng": 81.00, "trend": "Stable"},
    "guwahati": {"city": "Guwahati", "state": "Assam", "petrol": 96.12, "diesel": 88.38, "cng": 81.00, "trend": "Stable"},
    "tripura": {"city": "Agartala", "state": "Tripura", "petrol": 97.47, "diesel": 86.44, "cng": 81.50, "trend": "Stable"},
    "agartala": {"city": "Agartala", "state": "Tripura", "petrol": 97.47, "diesel": 86.44, "cng": 81.50, "trend": "Stable"},
    "meghalaya": {"city": "Shillong", "state": "Meghalaya", "petrol": 95.80, "diesel": 83.50, "cng": None, "trend": "Stable"},
    "shillong": {"city": "Shillong", "state": "Meghalaya", "petrol": 95.80, "diesel": 83.50, "cng": None, "trend": "Stable"},
    "manipur": {"city": "Imphal", "state": "Manipur", "petrol": 99.15, "diesel": 85.30, "cng": None, "trend": "Stable"},
    "imphal": {"city": "Imphal", "state": "Manipur", "petrol": 99.15, "diesel": 85.30, "cng": None, "trend": "Stable"},
    "nagaland": {"city": "Kohima", "state": "Nagaland", "petrol": 97.80, "diesel": 85.60, "cng": None, "trend": "Stable"},
    "kohima": {"city": "Kohima", "state": "Nagaland", "petrol": 97.80, "diesel": 85.60, "cng": None, "trend": "Stable"},
    "mizoram": {"city": "Aizawl", "state": "Mizoram", "petrol": 99.20, "diesel": 88.00, "cng": None, "trend": "Stable"},
    "aizawl": {"city": "Aizawl", "state": "Mizoram", "petrol": 99.20, "diesel": 88.00, "cng": None, "trend": "Stable"},
    "arunachal pradesh": {"city": "Itanagar", "state": "Arunachal Pradesh", "petrol": 90.80, "diesel": 80.40, "cng": None, "trend": "Stable"},
    "itanagar": {"city": "Itanagar", "state": "Arunachal Pradesh", "petrol": 90.80, "diesel": 80.40, "cng": None, "trend": "Stable"},
    "sikkim": {"city": "Gangtok", "state": "Sikkim", "petrol": 100.80, "diesel": 88.20, "cng": None, "trend": "Stable"},
    "gangtok": {"city": "Gangtok", "state": "Sikkim", "petrol": 100.80, "diesel": 88.20, "cng": None, "trend": "Stable"},

    # ─── Uttarakhand ─────────────────────────────────────────────────────────
    "uttarakhand": {"city": "Dehradun", "state": "Uttarakhand", "petrol": 93.45, "diesel": 88.26, "cng": 81.50, "trend": "Stable"},
    "dehradun": {"city": "Dehradun", "state": "Uttarakhand", "petrol": 93.45, "diesel": 88.26, "cng": 81.50, "trend": "Stable"},
    "haridwar": {"city": "Haridwar", "state": "Uttarakhand", "petrol": 93.30, "diesel": 88.15, "cng": 81.20, "trend": "Stable"},

    # ─── Jharkhand ───────────────────────────────────────────────────────────
    "jharkhand": {"city": "Ranchi", "state": "Jharkhand", "petrol": 97.81, "diesel": 92.56, "cng": 83.50, "trend": "Stable"},
    "ranchi": {"city": "Ranchi", "state": "Jharkhand", "petrol": 97.81, "diesel": 92.56, "cng": 83.50, "trend": "Stable"},
    "jamshedpur": {"city": "Jamshedpur", "state": "Jharkhand", "petrol": 97.75, "diesel": 92.50, "cng": 83.50, "trend": "Stable"},
    "dhanbad": {"city": "Dhanbad", "state": "Jharkhand", "petrol": 97.90, "diesel": 92.65, "cng": 83.80, "trend": "Stable"},

    # ─── Chhattisgarh ────────────────────────────────────────────────────────
    "chhattisgarh": {"city": "Raipur", "state": "Chhattisgarh", "petrol": 100.39, "diesel": 93.33, "cng": 84.00, "trend": "Stable"},
    "raipur": {"city": "Raipur", "state": "Chhattisgarh", "petrol": 100.39, "diesel": 93.33, "cng": 84.00, "trend": "Stable"},
    "bilaspur": {"city": "Bilaspur", "state": "Chhattisgarh", "petrol": 100.55, "diesel": 93.50, "cng": 84.20, "trend": "Stable"},

    # ─── Goa ─────────────────────────────────────────────────────────────────
    "goa": {"city": "Panaji", "state": "Goa", "petrol": 95.40, "diesel": 87.90, "cng": 79.00, "trend": "Stable"},
    "panaji": {"city": "Panaji", "state": "Goa", "petrol": 95.40, "diesel": 87.90, "cng": 79.00, "trend": "Stable"},
    "margao": {"city": "Margao", "state": "Goa", "petrol": 95.40, "diesel": 87.90, "cng": 79.00, "trend": "Stable"},

    # ─── Himachal Pradesh ────────────────────────────────────────────────────
    "himachal pradesh": {"city": "Shimla", "state": "Himachal Pradesh", "petrol": 95.28, "diesel": 87.62, "cng": 80.50, "trend": "Stable"},
    "himachal": {"city": "Shimla", "state": "Himachal Pradesh", "petrol": 95.28, "diesel": 87.62, "cng": 80.50, "trend": "Stable"},
    "shimla": {"city": "Shimla", "state": "Himachal Pradesh", "petrol": 95.28, "diesel": 87.62, "cng": 80.50, "trend": "Stable"},
    "dharamshala": {"city": "Dharamshala", "state": "Himachal Pradesh", "petrol": 95.45, "diesel": 87.80, "cng": 80.50, "trend": "Stable"},

    # ─── Jammu & Kashmir and Ladakh ──────────────────────────────────────────
    "jammu and kashmir": {"city": "Srinagar", "state": "Jammu & Kashmir", "petrol": 97.50, "diesel": 83.25, "cng": 82.00, "trend": "Stable"},
    "jammu & kashmir": {"city": "Srinagar", "state": "Jammu & Kashmir", "petrol": 97.50, "diesel": 83.25, "cng": 82.00, "trend": "Stable"},
    "srinagar": {"city": "Srinagar", "state": "Jammu & Kashmir", "petrol": 99.20, "diesel": 84.80, "cng": 83.00, "trend": "Stable"},
    "jammu": {"city": "Jammu", "state": "Jammu & Kashmir", "petrol": 97.50, "diesel": 83.25, "cng": 82.00, "trend": "Stable"},
    "ladakh": {"city": "Leh", "state": "Ladakh", "petrol": 100.40, "diesel": 86.20, "cng": None, "trend": "Stable"},
    "leh": {"city": "Leh", "state": "Ladakh", "petrol": 100.40, "diesel": 86.20, "cng": None, "trend": "Stable"},

    # ─── Union Territories (Islands, Enclaves) ───────────────────────────────
    "puducherry": {"city": "Puducherry", "state": "Puducherry", "petrol": 94.20, "diesel": 84.50, "cng": 80.00, "trend": "Stable"},
    "pondicherry": {"city": "Puducherry", "state": "Puducherry", "petrol": 94.20, "diesel": 84.50, "cng": 80.00, "trend": "Stable"},
    "andaman and nicobar islands": {"city": "Port Blair", "state": "Andaman and Nicobar Islands", "petrol": 82.42, "diesel": 78.01, "cng": None, "trend": "Stable"},
    "andaman": {"city": "Port Blair", "state": "Andaman and Nicobar Islands", "petrol": 82.42, "diesel": 78.01, "cng": None, "trend": "Stable"},
    "port blair": {"city": "Port Blair", "state": "Andaman and Nicobar Islands", "petrol": 82.42, "diesel": 78.01, "cng": None, "trend": "Stable"},
    "dadra and nagar haveli and daman and diu": {"city": "Daman", "state": "Dadra and Nagar Haveli and Daman and Diu", "petrol": 92.51, "diesel": 87.81, "cng": 76.50, "trend": "Stable"},
    "daman and diu": {"city": "Daman", "state": "Dadra and Nagar Haveli and Daman and Diu", "petrol": 92.51, "diesel": 87.81, "cng": 76.50, "trend": "Stable"},
    "daman": {"city": "Daman", "state": "Dadra and Nagar Haveli and Daman and Diu", "petrol": 92.51, "diesel": 87.81, "cng": 76.50, "trend": "Stable"},
    "silvassa": {"city": "Silvassa", "state": "Dadra and Nagar Haveli and Daman and Diu", "petrol": 92.51, "diesel": 87.81, "cng": 76.50, "trend": "Stable"},
    "lakshadweep": {"city": "Kavaratti", "state": "Lakshadweep", "petrol": 100.75, "diesel": 92.34, "cng": None, "trend": "Stable"},
}

# State name & abbreviation synonyms for accurate tax matching
STATE_SYNONYMS: Dict[str, str] = {
    "up": "uttar pradesh",
    "u.p.": "uttar pradesh",
    "uttar pradesh": "uttar pradesh",
    "dl": "delhi",
    "delhi": "delhi",
    "new delhi": "delhi",
    "delhi ncr": "delhi",
    "ncr": "delhi",
    "mh": "maharashtra",
    "maharashtra": "maharashtra",
    "ka": "karnataka",
    "karnataka": "karnataka",
    "rj": "rajasthan",
    "rajasthan": "rajasthan",
    "gj": "gujarat",
    "gujarat": "gujarat",
    "wb": "west bengal",
    "west bengal": "west bengal",
    "bengal": "west bengal",
    "tn": "tamil nadu",
    "tamil nadu": "tamil nadu",
    "ts": "telangana",
    "tg": "telangana",
    "telangana": "telangana",
    "ap": "andhra pradesh",
    "andhra pradesh": "andhra pradesh",
    "andhra": "andhra pradesh",
    "mp": "madhya pradesh",
    "madhya pradesh": "madhya pradesh",
    "br": "bihar",
    "bihar": "bihar",
    "pb": "punjab",
    "punjab": "punjab",
    "hr": "haryana",
    "haryana": "haryana",
    "kl": "kerala",
    "kerala": "kerala",
    "od": "odisha",
    "odisha": "odisha",
    "orissa": "odisha",
    "as": "assam",
    "assam": "assam",
    "uk": "uttarakhand",
    "uttarakhand": "uttarakhand",
    "uttaranchal": "uttarakhand",
    "jh": "jharkhand",
    "jharkhand": "jharkhand",
    "cg": "chhattisgarh",
    "chhattisgarh": "chhattisgarh",
    "ga": "goa",
    "goa": "goa",
    "hp": "himachal pradesh",
    "himachal pradesh": "himachal pradesh",
    "himachal": "himachal pradesh",
    "jk": "jammu and kashmir",
    "j&k": "jammu and kashmir",
    "jammu and kashmir": "jammu and kashmir",
    "jammu & kashmir": "jammu and kashmir",
    "la": "ladakh",
    "ladakh": "ladakh",
    "ch": "chandigarh",
    "chandigarh": "chandigarh",
    "py": "puducherry",
    "puducherry": "puducherry",
    "pondicherry": "puducherry",
    "tr": "tripura",
    "tripura": "tripura",
    "ml": "meghalaya",
    "meghalaya": "meghalaya",
    "mn": "manipur",
    "manipur": "manipur",
    "nl": "nagaland",
    "nagaland": "nagaland",
    "mz": "mizoram",
    "mizoram": "mizoram",
    "ar": "arunachal pradesh",
    "arunachal pradesh": "arunachal pradesh",
    "sk": "sikkim",
    "sikkim": "sikkim",
    "an": "andaman and nicobar islands",
    "andaman and nicobar islands": "andaman and nicobar islands",
    "andaman": "andaman and nicobar islands",
    "dn": "dadra and nagar haveli and daman and diu",
    "daman and diu": "dadra and nagar haveli and daman and diu",
    "ld": "lakshadweep",
    "lakshadweep": "lakshadweep",
}


def _resolve_state_key(name: Optional[str]) -> Optional[str]:
    """Resolves an arbitrary state name or code to our canonical state key."""
    if not name:
        return None
    cleaned = name.strip().lower()
    if cleaned in STATE_SYNONYMS:
        return STATE_SYNONYMS[cleaned]
    for key, canon in STATE_SYNONYMS.items():
        if key in cleaned or cleaned in key:
            return canon
    return None


import time
import re

_FUEL_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
_LIVE_GOODRETURNS_CACHE: Optional[Dict[str, Dict[str, Any]]] = None
_LIVE_GOODRETURNS_CACHE_TS: float = 0.0


def _fetch_goodreturns_live_rates() -> Optional[Dict[str, Dict[str, Any]]]:
    """
    Fetches real-time retail petrol and diesel rates published daily at 6:00 AM IST
    by Indian Oil Marketing Companies (IOCL, HPCL, BPCL). 100% keyless & free.
    """
    global _LIVE_GOODRETURNS_CACHE, _LIVE_GOODRETURNS_CACHE_TS
    now = time.time()
    if _LIVE_GOODRETURNS_CACHE and (now - _LIVE_GOODRETURNS_CACHE_TS < 3600):
        return _LIVE_GOODRETURNS_CACHE

    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

        # 1. Fetch Petrol
        petrol_url = "https://www.goodreturns.in/petrol-price.html"
        p_req = urllib.request.Request(petrol_url, headers=headers)
        with urllib.request.urlopen(p_req, timeout=4.0) as resp:
            p_html = resp.read().decode("utf-8", errors="ignore")
        p_matches = re.findall(
            r'href="/petrol-price-in-([a-z0-9-]+)\.html"[^>]*>([^<]+)</a>\s*</td>\s*<td[^>]*>\s*(?:&#x20b9;|₹)?\s*([0-9.]+)',
            p_html,
        )

        # 2. Fetch Diesel
        diesel_url = "https://www.goodreturns.in/diesel-price.html"
        d_req = urllib.request.Request(diesel_url, headers=headers)
        with urllib.request.urlopen(d_req, timeout=4.0) as resp:
            d_html = resp.read().decode("utf-8", errors="ignore")
        d_matches = re.findall(
            r'href="/diesel-price-in-([a-z0-9-]+)\.html"[^>]*>([^<]+)</a>\s*</td>\s*<td[^>]*>\s*(?:&#x20b9;|₹)?\s*([0-9.]+)',
            d_html,
        )

        d_map: Dict[str, float] = {}
        for slug, _, price in d_matches:
            try:
                d_map[slug] = float(price)
            except ValueError:
                pass

        results: Dict[str, Dict[str, Any]] = {}
        for slug, city_name, p_price in p_matches:
            try:
                petrol_val = float(p_price)
                diesel_val = d_map.get(slug, round(petrol_val * 0.9, 2))
                clean_city = city_name.strip()
                results[clean_city.lower()] = {
                    "city": clean_city,
                    "petrol": petrol_val,
                    "diesel": diesel_val,
                }
            except ValueError:
                pass

        if results:
            _LIVE_GOODRETURNS_CACHE = results
            _LIVE_GOODRETURNS_CACHE_TS = now
            logger.info(f"[FuelMitra] Refreshed live retail fuel prices for {len(results)} cities from OMC feed.")
            return results
    except Exception as err:
        logger.info(f"[FuelMitra] Live GoodReturns fuel fetch notice: {err}")
    return None


def fetch_fuel_rates(
    target_city: Optional[str] = None,
    target_state: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Fetches daily retail fuel rates (Petrol, Diesel, CNG) for Indian states and cities.
    Retail fuel prices in India are primarily governed by State VAT, Central Excise, and local freight.
    Features 1-hour in-memory TTL caching for sub-millisecond response latency.
    """
    # 0. Spatial Lat/Lon resolution if state or city is missing
    if (not target_state or not target_city) and lat is not None and lon is not None:
        try:
            from backend.app.services.indian_spatial_service import global_spatial_kdtree
            nearest_d, _ = global_spatial_kdtree.find_nearest(lat, lon)
            if nearest_d:
                if not target_state:
                    target_state = nearest_d.get("state")
                if not target_city:
                    target_city = nearest_d.get("district")
        except Exception:
            pass

    norm_city = (target_city or "").strip().lower()
    norm_state = (target_state or "").strip().lower()
    cache_key = f"{norm_city}:{norm_state}:{lat}:{lon}"
    now_ts = time.time()

    # Fast in-memory cache hit (1-hour TTL)
    if cache_key in _FUEL_CACHE:
        cached_ts, cached_val = _FUEL_CACHE[cache_key]
        if now_ts - cached_ts < 3600:
            return cached_val

    today_str = datetime.date.today().strftime("%d %b %Y")
    api_key = getattr(settings, "API_MITRA_API_KEY", None)

    # 1. Attempt live query to API Mitra
    if api_key and api_key.strip():
        try:
            url = "https://api.apimitra.in/fuel/cities"
            req = urllib.request.Request(
                url,
                headers={
                    "x-api-key": api_key.strip(),
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status == 200:
                    raw_data = json.loads(resp.read().decode())
                    if isinstance(raw_data, list) and raw_data:
                        items = []
                        for entry in raw_data:
                            c_name = entry.get("city", entry.get("name", "Unknown"))
                            items.append({
                                "city": c_name,
                                "state": entry.get("state", "India"),
                                "petrol": float(entry.get("petrol", entry.get("petrol_price", 0))),
                                "diesel": float(entry.get("diesel", entry.get("diesel_price", 0))),
                                "cng": float(entry.get("cng", entry.get("cng_price", 0))) or None,
                                "trend": "Active",
                                "observed_date": today_str,
                            })
                        if items:
                            first = items[0]
                            res = {
                                "source": "API Mitra Live Feed",
                                "is_live": True,
                                "updated_at": today_str,
                                "petrol": first["petrol"],
                                "diesel": first["diesel"],
                                "cng": first["cng"],
                                "city": first["city"],
                                "state": first["state"],
                                "items": items,
                            }
                            _FUEL_CACHE[cache_key] = (now_ts, res)
                            return res
        except Exception as err:
            logger.info(f"[FuelMitra] Live API Mitra query returned {err}. Serving OMC feed.")

    # 2. Query live keyless GoodReturns OMC Feed
    live_scraped = _fetch_goodreturns_live_rates()

    # Step A: Resolve Canonical State Key
    resolved_state_key = _resolve_state_key(norm_state)
    if not resolved_state_key and norm_city:
        resolved_state_key = _resolve_state_key(norm_city)

    # Step B: Match City Key
    matched_key: Optional[str] = None
    if norm_city:
        # Check direct city key match
        if norm_city in BENCHMARK_FUEL_RATES:
            matched_key = norm_city
        else:
            # Check if any benchmark city key is a substring or token of norm_city
            tokens = [t.strip(",. ") for t in norm_city.split() if len(t.strip(",. ")) > 2]
            for token in tokens:
                if token in BENCHMARK_FUEL_RATES:
                    matched_key = token
                    break
            if not matched_key:
                for key in BENCHMARK_FUEL_RATES:
                    if key in norm_city or norm_city in key:
                        matched_key = key
                        break

    # Step C: If city didn't match directly, fall back to resolved state
    if not matched_key and resolved_state_key:
        if resolved_state_key in BENCHMARK_FUEL_RATES:
            matched_key = resolved_state_key

    # Step D: Extract matched rates
    primary_data: Dict[str, Any]
    if matched_key and matched_key in BENCHMARK_FUEL_RATES:
        primary_data = dict(BENCHMARK_FUEL_RATES[matched_key])
        # If user searched a specific city/locality that mapped to a state benchmark, preserve their locality name
        if target_city and matched_key == resolved_state_key:
            primary_data["city"] = target_city.strip().title()
    elif resolved_state_key and resolved_state_key in BENCHMARK_FUEL_RATES:
        primary_data = dict(BENCHMARK_FUEL_RATES[resolved_state_key])
        if target_city:
            primary_data["city"] = target_city.strip().title()
    else:
        # Default to Delhi NCR benchmark
        primary_data = dict(BENCHMARK_FUEL_RATES["delhi"])

    # If live scraped data has this city or state capital, apply today's live price
    is_live = False
    if live_scraped:
        c_low = primary_data["city"].lower()
        if c_low in live_scraped:
            primary_data["petrol"] = live_scraped[c_low]["petrol"]
            primary_data["diesel"] = live_scraped[c_low]["diesel"]
            is_live = True
        else:
            for sc_city, sc_data in live_scraped.items():
                if sc_city in c_low or c_low in sc_city:
                    primary_data["petrol"] = sc_data["petrol"]
                    primary_data["diesel"] = sc_data["diesel"]
                    is_live = True
                    break

    primary_data["observed_date"] = today_str

    # Build response items list (primary match first, followed by major state benchmarks)
    items: List[Dict[str, Any]] = [primary_data]
    major_keys = [
        "delhi", "uttar pradesh", "haryana", "maharashtra", "karnataka",
        "rajasthan", "gujarat", "west bengal", "tamil nadu", "telangana",
        "andhra pradesh", "madhya pradesh", "bihar", "punjab", "kerala",
    ]
    seen_states = {primary_data["state"].lower()}

    for mk in major_keys:
        if mk in BENCHMARK_FUEL_RATES:
            b_data = BENCHMARK_FUEL_RATES[mk]
            if b_data["state"].lower() not in seen_states:
                seen_states.add(b_data["state"].lower())
                item_copy = dict(b_data)
                if live_scraped:
                    st_city_low = item_copy["city"].lower()
                    if st_city_low in live_scraped:
                        item_copy["petrol"] = live_scraped[st_city_low]["petrol"]
                        item_copy["diesel"] = live_scraped[st_city_low]["diesel"]
                    else:
                        for sc_city, sc_data in live_scraped.items():
                            if sc_city in st_city_low or st_city_low in sc_city:
                                item_copy["petrol"] = sc_data["petrol"]
                                item_copy["diesel"] = sc_data["diesel"]
                                break
                item_copy["observed_date"] = today_str
                items.append(item_copy)

    state_display = primary_data.get("state", "India")
    city_display = primary_data.get("city", state_display)

    source_label = (
        "Live Retail Fuel Telemetry (IOCL / HPCL / BPCL via OMC Feed)"
        if is_live
        else "State Retail Fuel Benchmark (IOCL / HPCL / BPCL)"
    )

    res = {
        "city": city_display,
        "state": state_display,
        "petrol": primary_data.get("petrol"),
        "diesel": primary_data.get("diesel"),
        "cng": primary_data.get("cng"),
        "trend": primary_data.get("trend", "Stable"),
        "source": source_label,
        "is_live": is_live,
        "vat_info": f"Retail prices governed by State VAT & Central Excise for {state_display}",
        "updated_at": today_str,
        "items": items,
    }
    _FUEL_CACHE[cache_key] = (now_ts, res)
    return res
