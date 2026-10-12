import datetime
from typing import Dict, List, Optional, Tuple
from backend.app.core.config import settings
from backend.app.core.errors import ProviderAuthError, ProviderError
from backend.app.core.logging import logger
from backend.app.integrations.base import BaseProviderClient
from backend.app.normalization.weather import NormalizedWeatherRecord, normalize_weatherapi_response


class WeatherAPIClient(BaseProviderClient):
    """
    Client for WeatherAPI.com forecast endpoint with in-memory TTL caching.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        super().__init__(provider_name="weatherapi")
        self.api_key = api_key if api_key is not None else settings.WEATHERAPI_API_KEY
        self.base_url = (base_url or settings.WEATHERAPI_BASE_URL).rstrip("/")
        # In-memory cache: (rounded_lat, rounded_lon) -> (records, expires_at_utc)
        self._cache: Dict[Tuple[float, float], Tuple[List[NormalizedWeatherRecord], datetime.datetime]] = {}

    def _get_cache_key(self, lat: float, lon: float) -> Tuple[float, float]:
        return (round(lat, 3), round(lon, 3))

    async def fetch_forecast(
        self,
        lat: float,
        lon: float,
        days: int = 1,
        bypass_cache: bool = False,
    ) -> List[NormalizedWeatherRecord]:
        """
        Fetches current weather and hourly forecast for latitude/longitude.
        Complies with 60-minute current conditions caching policy.
        """
        if not self.api_key:
            raise ProviderAuthError("weatherapi", "WEATHERAPI_API_KEY is not configured.")

        cache_key = self._get_cache_key(lat, lon)
        now = datetime.datetime.utcnow()

        # Check in-memory cache
        if not bypass_cache and cache_key in self._cache:
            records, expires_at = self._cache[cache_key]
            if now < expires_at:
                logger.debug(f"[weatherapi] Cache HIT for coords ({lat:.3f}, {lon:.3f})")
                return records

        url = f"{self.base_url}/forecast.json"
        params = {
            "key": self.api_key,
            "q": f"{lat},{lon}",
            "days": days,
            "aqi": "no",
            "alerts": "no",
        }

        logger.info(f"[weatherapi] Fetching live forecast for ({lat:.4f}, {lon:.4f})")
        response = await self._get(url, params=params)

        try:
            data = response.json()
        except Exception as e:
            raise ProviderError("weatherapi", f"Failed to parse JSON response: {str(e)}") from e

        records = normalize_weatherapi_response(data)

        # Cache for 60 minutes as permitted by Terms of Service
        cache_ttl = datetime.timedelta(minutes=60)
        self._cache[cache_key] = (records, now + cache_ttl)

        return records

    async def fetch_air_quality(
        self,
        lat: float,
        lon: float,
        area_name: Optional[str] = None,
    ) -> Optional[Any]:
        """
        Fetches live air quality pollutants (PM2.5, PM10, NO2, SO2, CO, O3) from WeatherAPI.com
        (forecast.json with aqi=yes) and computes official Indian CPCB 2014 NAQI.
        """
        if not self.api_key:
            raise ProviderAuthError("weatherapi", "WEATHERAPI_API_KEY is not configured.")

        from backend.app.normalization.air_quality import NormalizedAQIRecord
        from backend.app.normalization.aqi_calculator import (
            calculate_cpcb_aqi,
            convert_pollutant_concentration,
        )

        url = f"{self.base_url}/forecast.json"
        params = {
            "key": self.api_key,
            "q": f"{lat},{lon}",
            "days": 1,
            "aqi": "yes",
            "alerts": "no",
        }

        logger.info(f"[weatherapi] Fetching live AQI telemetry for ({lat:.4f}, {lon:.4f})")
        response = await self._get(url, params=params)
        data = response.json()

        loc = data.get("location") or {}
        curr = data.get("current") or {}
        aq = curr.get("air_quality") or {}
        if not aq:
            return None

        pollutants: Dict[str, Optional[float]] = {}
        if aq.get("pm2_5") is not None:
            pollutants["PM2.5"] = round(float(aq["pm2_5"]), 1)
        if aq.get("pm10") is not None:
            pollutants["PM10"] = round(float(aq["pm10"]), 1)
        if aq.get("no2") is not None:
            pollutants["NO2"] = round(float(aq["no2"]), 1)
        if aq.get("so2") is not None:
            pollutants["SO2"] = round(float(aq["so2"]), 1)
        if aq.get("co") is not None:
            pollutants["CO"] = convert_pollutant_concentration("CO", float(aq["co"]), "µg/m³")
        if aq.get("o3") is not None:
            pollutants["O3"] = round(float(aq["o3"]), 1)

        calc_res = calculate_cpcb_aqi(pollutants)
        if not calc_res:
            return None

        now = datetime.datetime.utcnow()
        city_name = loc.get("name") or area_name or "Local District"
        state_name = loc.get("region") or "India"
        station_id = f"WAPI-{round(lat, 2)}-{round(lon, 2)}"

        return NormalizedAQIRecord(
            source_id="openaq",
            source_record_id=f"weatherapi_aqi:{station_id}:{now.strftime('%Y%m%d%H')}",
            station_id=station_id,
            station_name=f"{city_name} Ambient Air Monitoring Grid ({state_name})",
            city=city_name,
            state=state_name,
            latitude=float(loc.get("lat", lat)),
            longitude=float(loc.get("lon", lon)),
            observed_at=now,
            aqi_value=calc_res.aqi_value,
            aqi_category=calc_res.aqi_category,
            prominent_pollutant=calc_res.prominent_pollutant,
            pm25=pollutants.get("PM2.5"),
            pm10=pollutants.get("PM10"),
            no2=pollutants.get("NO2"),
            so2=pollutants.get("SO2"),
            co=pollutants.get("CO"),
            o3=pollutants.get("O3"),
            is_naqi_compliant=calc_res.is_naqi_compliant,
            raw_data=aq,
        )

