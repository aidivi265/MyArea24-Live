import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocalConditionsGrid } from '../components/LocalConditionsGrid';
import type { AirQualityStatus, IntelligenceInsight } from '../types/intelligence';

describe('LocalConditionsGrid Component', () => {
  it('renders awaiting config state with honest disclosure', () => {
    const mockAqi: AirQualityStatus = {
      status: 'AWAITING_CONFIG',
      is_stale: false,
      attribution: 'Central Pollution Control Board (CPCB) / OpenAQ',
      message: 'Awaiting OPENAQ_API_KEY configuration in environment. Zero synthetic data shown.',
    };

    render(
      <LocalConditionsGrid
        insights={[]}
        selectedArea="Delhi Connaught Place"
        airQuality={mockAqi}
      />
    );

    expect(screen.getByText('Air Quality Index')).toBeInTheDocument();
    expect(screen.getByText('Integration Pending')).toBeInTheDocument();
    expect(
      screen.getByText(/Awaiting OPENAQ_API_KEY configuration in environment/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Zero synthetic data shown · Strict data integrity/i)).toBeInTheDocument();
  });

  it('renders active live air quality station telemetry', () => {
    const mockAqi: AirQualityStatus = {
      status: 'ACTIVE',
      station_id: '8118',
      station_name: 'Anand Vihar, Delhi - DPCC',
      city: 'Delhi',
      distance_km: 3.4,
      aqi_value: 412,
      aqi_category: 'Severe',
      prominent_pollutant: 'PM2.5',
      is_stale: false,
      attribution: 'Central Pollution Control Board (CPCB) / OpenAQ',
      message: 'Telemetry from station Anand Vihar',
    };

    render(
      <LocalConditionsGrid
        insights={[]}
        selectedArea="Delhi AIIMS Ring Road"
        airQuality={mockAqi}
      />
    );

    expect(screen.getByText('AQI 412 · Severe')).toBeInTheDocument();
    expect(screen.getByText(/Station: Anand Vihar, Delhi - DPCC \(3.4 km away\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Live CAAQMS telemetry · Delhi/i)).toBeInTheDocument();
  });

  it('renders stale air quality state when telemetry is expired', () => {
    const mockAqi: AirQualityStatus = {
      status: 'STALE',
      station_id: '8120',
      station_name: 'Mandir Marg CAAQMS',
      city: 'Delhi',
      distance_km: 1.5,
      aqi_value: 320,
      aqi_category: 'Very Poor',
      prominent_pollutant: 'PM2.5',
      is_stale: true,
      attribution: 'Central Pollution Control Board (CPCB)',
      message: 'Telemetry is stale',
    };

    render(
      <LocalConditionsGrid
        insights={[]}
        selectedArea="Delhi Connaught Place"
        airQuality={mockAqi}
      />
    );

    expect(screen.getByText('AQI 320 · Very Poor')).toBeInTheDocument();
    expect(screen.getByText(/Telemetry is older than 3 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Telemetry expired · Strict freshness policy/i)).toBeInTheDocument();
  });

  it('renders out of range state when no station is within threshold', () => {
    const mockAqi: AirQualityStatus = {
      status: 'UNAVAILABLE',
      distance_km: 45.2,
      is_stale: false,
      attribution: 'Central Pollution Control Board (CPCB)',
      message: 'No official CAAQMS monitoring station found within 15 km of Bengaluru Silk Board.',
    };

    render(
      <LocalConditionsGrid
        insights={[]}
        selectedArea="Bengaluru Silk Board"
        airQuality={mockAqi}
      />
    );

    expect(screen.getByText('Station Out of Range')).toBeInTheDocument();
    expect(
      screen.getByText(/No official CAAQMS monitoring station found within 15 km/i)
    ).toBeInTheDocument();
  });
});
