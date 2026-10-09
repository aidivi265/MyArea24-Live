#!/usr/bin/env python3
"""
MyArea24 — Live Provider Smoke Test Script (Opt-in)
Validates live connectivity against WeatherAPI, HERE Traffic, and NDMA SACHET feeds.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.integrations.weatherapi.client import WeatherAPIClient
from backend.app.integrations.here.client import HERETrafficClient
from backend.app.integrations.sachet.client import SACHETClient


async def smoke_test_weather():
    print("\n--- 1. Testing WeatherAPI.com ---")
    if not settings.WEATHERAPI_API_KEY:
        print("[-] WEATHERAPI_API_KEY is not configured in .env. Skipping live call.")
        return

    client = WeatherAPIClient()
    try:
        # Query Delhi AIIMS pilot node
        records = await client.fetch_forecast(lat=28.5672, lon=77.2100)
        print(f"[+] WeatherAPI SUCCESS: Received {len(records)} normalized records.")
        if records:
            r = records[0]
            print(f"    Location: {r.location_name} | Temp: {r.temperature_c}°C | Precip: {r.precipitation_mm} mm/hr ({r.condition_text})")
    except Exception as e:
        print(f"[!] WeatherAPI FAILED: {e}")


async def smoke_test_here_traffic():
    print("\n--- 2. Testing HERE Traffic API v7 ---")
    if not settings.HERE_API_KEY:
        print("[-] HERE_API_KEY is not configured in .env. Skipping live call.")
        return

    client = HERETrafficClient()
    try:
        bbox = settings.traffic_bbox_coords
        records = await client.fetch_incidents(bbox)
        print(f"[+] HERE Traffic SUCCESS: Received {len(records)} incidents in pilot bbox.")
        if records:
            r = records[0]
            print(f"    Type: {r.incident_type} | Jam Factor: {r.jam_factor} | Delay: {r.delay_seconds}s | Road: {r.road_name}")
    except Exception as e:
        print(f"[!] HERE Traffic FAILED: {e}")


async def smoke_test_sachet():
    print("\n--- 3. Testing NDMA SACHET Public CAP Feed ---")
    client = SACHETClient()
    try:
        records = await client.fetch_alerts()
        print(f"[+] NDMA SACHET SUCCESS: Received {len(records)} active public disaster notices.")
        if records:
            r = records[0]
            print(f"    Alert ID: {r.alert_identifier} | Severity: {r.severity} | Event: {r.event_type}")
            print(f"    Headline: {r.headline[:80]}...")
    except Exception as e:
        print(f"[!] NDMA SACHET FAILED: {e}")


async def main():
    print("=" * 60)
    print("MyArea24 — External Provider Smoke Test")
    print("=" * 60)
    await smoke_test_weather()
    await smoke_test_here_traffic()
    await smoke_test_sachet()
    print("\nSmoke test run completed.")


if __name__ == "__main__":
    asyncio.run(main())
