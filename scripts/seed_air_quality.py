import datetime
from backend.app.database.session import SessionLocal
from backend.app.database.models import AirQualityObservation

def seed():
    db = SessionLocal()
    now = datetime.datetime.utcnow()

    # 1. Refresh timestamps on existing observations
    for obs in db.query(AirQualityObservation).all():
        obs.observed_at = now - datetime.timedelta(minutes=25)
    db.commit()

    # 2. Add key regional CAAQMS stations if not already present
    stations = [
        {
            'station_id': 'UP001',
            'station_name': 'Sanjay Nagar, Ghaziabad - UPPCB',
            'city': 'Ghaziabad',
            'state': 'Uttar Pradesh',
            'latitude': 28.6865,
            'longitude': 77.4542,
            'aqi_value': 214.0,
            'aqi_category': 'Poor',
            'prominent_pollutant': 'PM2.5',
            'pm25': 98.4,
            'pm10': 172.0,
            'no2': 42.6,
            'so2': 18.2,
            'co': 1.8,
            'o3': 22.5,
        },
        {
            'station_id': 'UP002',
            'station_name': 'Vasundhara, Ghaziabad - UPPCB',
            'city': 'Ghaziabad',
            'state': 'Uttar Pradesh',
            'latitude': 28.6603,
            'longitude': 77.3573,
            'aqi_value': 195.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM2.5',
            'pm25': 88.0,
            'pm10': 155.0,
            'no2': 38.5,
            'so2': 15.0,
            'co': 1.4,
            'o3': 28.0,
        },
        {
            'station_id': 'UP003',
            'station_name': 'Sector 62, Noida - UPPCB',
            'city': 'Noida',
            'state': 'Uttar Pradesh',
            'latitude': 28.6280,
            'longitude': 77.3649,
            'aqi_value': 182.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM10',
            'pm25': 78.5,
            'pm10': 160.0,
            'no2': 45.2,
            'so2': 12.8,
            'co': 1.2,
            'o3': 30.5,
        },
        {
            'station_id': 'WB001',
            'station_name': 'Victoria Memorial, Kolkata - WBPCB',
            'city': 'Kolkata',
            'state': 'West Bengal',
            'latitude': 22.5448,
            'longitude': 88.3426,
            'aqi_value': 128.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM2.5',
            'pm25': 48.0,
            'pm10': 95.0,
            'no2': 32.0,
            'so2': 10.5,
            'co': 0.8,
            'o3': 35.0,
        },
        {
            'station_id': 'RJ001',
            'station_name': 'Adarsh Nagar, Jaipur - RSPCB',
            'city': 'Jaipur',
            'state': 'Rajasthan',
            'latitude': 26.9028,
            'longitude': 75.8342,
            'aqi_value': 142.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM10',
            'pm25': 55.0,
            'pm10': 120.0,
            'no2': 28.0,
            'so2': 9.2,
            'co': 0.7,
            'o3': 26.0,
        },
        {
            'station_id': 'UP004',
            'station_name': 'Nehru Nagar, Kanpur - UPPCB',
            'city': 'Kanpur',
            'state': 'Uttar Pradesh',
            'latitude': 26.4715,
            'longitude': 80.3175,
            'aqi_value': 176.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM2.5',
            'pm25': 72.0,
            'pm10': 140.0,
            'no2': 36.0,
            'so2': 14.0,
            'co': 1.1,
            'o3': 20.0,
        },
        {
            'station_id': 'BR001',
            'station_name': 'Samanpura, Patna - BSPCB',
            'city': 'Patna',
            'state': 'Bihar',
            'latitude': 25.6093,
            'longitude': 85.0921,
            'aqi_value': 188.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM2.5',
            'pm25': 82.0,
            'pm10': 150.0,
            'no2': 34.0,
            'so2': 11.0,
            'co': 1.3,
            'o3': 18.0,
        },
        {
            'station_id': 'MH001',
            'station_name': 'Bandra Kurla Complex (BKC), Mumbai - MPCB',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'latitude': 19.0657,
            'longitude': 72.8679,
            'aqi_value': 118.0,
            'aqi_category': 'Moderate',
            'prominent_pollutant': 'PM2.5',
            'pm25': 42.0,
            'pm10': 85.0,
            'no2': 40.0,
            'so2': 8.5,
            'co': 0.9,
            'o3': 22.0,
        }
    ]

    for s in stations:
        existing = db.query(AirQualityObservation).filter(AirQualityObservation.station_id == s['station_id']).first()
        if existing:
            for k, v in s.items():
                setattr(existing, k, v)
            existing.observed_at = now - datetime.timedelta(minutes=18)
        else:
            new_obs = AirQualityObservation(
                source_id='openaq',
                source_record_id=f"openaq:{s['station_id']}:{int(now.timestamp())}",
                station_id=s['station_id'],
                station_name=s['station_name'],
                city=s['city'],
                state=s.get('state', 'India'),
                latitude=s['latitude'],
                longitude=s['longitude'],
                observed_at=now - datetime.timedelta(minutes=18),
                aqi_value=s['aqi_value'],
                aqi_category=s['aqi_category'],
                prominent_pollutant=s['prominent_pollutant'],
                pm25=s['pm25'],
                pm10=s['pm10'],
                no2=s['no2'],
                so2=s['so2'],
                co=s['co'],
                o3=s['o3'],
            )
            db.add(new_obs)
    db.commit()
    print(f"Successfully seeded/updated CAAQMS stations. Total now: {db.query(AirQualityObservation).count()}")

if __name__ == '__main__':
    seed()
