import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocationView } from '../components/views/LocationView';
import { AssistantView } from '../components/views/AssistantView';
import { WeatherView } from '../components/views/WeatherView';
import { TrafficView } from '../components/views/TrafficView';
import { AirQualityView } from '../components/views/AirQualityView';
import { EmergencyView } from '../components/views/EmergencyView';
import { AlertsView } from '../components/views/AlertsView';
import * as api from '../services/api';
import type { LocalityOption } from '../types/intelligence';

const sampleLocalities: LocalityOption[] = [
  {
    id: 'delhi-connaught-place',
    name: 'Delhi Connaught Place',
    city: 'Delhi',
    state: 'Delhi',
    latitude: 28.6304,
    longitude: 77.2177,
    coverage_status: 'Active Pilot',
    is_live_supported: true,
  },
  {
    id: 'mumbai-andheri-east',
    name: 'Mumbai Andheri East (WEH)',
    city: 'Mumbai',
    state: 'Maharashtra',
    latitude: 19.1136,
    longitude: 72.8697,
    coverage_status: 'Coverage Unavailable',
    is_live_supported: false,
  },
];

describe('Multipage Views Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders LocationView and allows selecting a locality', () => {
    const handleSelect = vi.fn();
    render(
      <LocationView
        localities={sampleLocalities}
        selectedArea="Delhi Connaught Place"
        onSelectArea={handleSelect}
        onNavigateHome={vi.fn()}
      />
    );

    expect(screen.getByText(/Location Selection & Detection/i)).toBeInTheDocument();
    expect(screen.getByText('Delhi Connaught Place')).toBeInTheDocument();
    expect(screen.getByText('Mumbai Andheri East (WEH)')).toBeInTheDocument();

    const mumbaiCard = screen.getByText('Mumbai Andheri East (WEH)');
    fireEvent.click(mumbaiCard);
    expect(handleSelect).toHaveBeenCalledWith('Mumbai Andheri East (WEH)');
  });

  it('renders AssistantView and queries grounded assistant', async () => {
    vi.spyOn(api, 'fetchAssistantResponse').mockResolvedValue({
      query: 'traffic status',
      area: 'Delhi Connaught Place',
      is_live_supported: true,
      response_text: 'Heavy congestion on Barakhamba Road.',
      key_findings: ['3 active TomTom incidents'],
      recommendations: ['Avoid Barakhamba Road'],
      grounded_sources: ['TomTom Traffic API v5'],
      confidence: 'HIGH (Multi-Source Corroborated)',
      timestamp: new Date().toISOString(),
    });

    render(
      <AssistantView
        selectedArea="Delhi Connaught Place"
        isLiveSupported={true}
        onNavigateToLocation={vi.fn()}
      />
    );

    expect(screen.getByText(/Ask MyArea24/i)).toBeInTheDocument();
    const input = screen.getByPlaceholderText(/Ask anything about/i);
    fireEvent.change(input, { target: { value: 'traffic status' } });

    const sendBtn = screen.getByRole('button', { name: /Send Query/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('Heavy congestion on Barakhamba Road.')).toBeInTheDocument();
    });
    expect(screen.getByText('3 active TomTom incidents')).toBeInTheDocument();
    expect(screen.getByText('TomTom Traffic API v5')).toBeInTheDocument();
  });

  it('renders WeatherView with live observations', async () => {
    vi.spyOn(api, 'fetchWeatherStatus').mockResolvedValue({
      is_available: true,
      location_name: 'Delhi Connaught Place',
      temperature_c: 28.5,
      precipitation_mm: 0.0,
      condition_text: 'Partly Cloudy',
      wind_kph: 12.0,
      humidity: 55,
      source: 'WeatherAPI',
      message: 'Live weather telemetry',
    });

    render(
      <WeatherView
        selectedArea="Delhi Connaught Place"
        isLiveSupported={true}
        onNavigateToLocation={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('28.5°C')).toBeInTheDocument();
    });
    expect(screen.getByText('Partly Cloudy')).toBeInTheDocument();
    expect(screen.getByText(/Source: WeatherAPI/i)).toBeInTheDocument();
  });

  it('renders TrafficView with TomTom incidents', async () => {
    vi.spyOn(api, 'fetchTrafficStatus').mockResolvedValue({
      is_available: true,
      total_incidents: 1,
      area: 'Delhi Connaught Place',
      incidents: [
        {
          id: 101,
          incident_type: 'CONGESTION',
          road_name: 'Janpath Road',
          description: 'Slow moving traffic',
          latitude: 28.625,
          longitude: 77.218,
          delay_seconds: 360,
          observed_at: new Date().toISOString(),
        },
      ],
      source: 'TomTom Traffic API v5',
      message: 'Active incidents',
    });

    render(
      <TrafficView
        selectedArea="Delhi Connaught Place"
        isLiveSupported={true}
        onNavigateToLocation={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Janpath Road')).toBeInTheDocument();
    });
    expect(screen.getByText('+6 min delay')).toBeInTheDocument();
    expect(screen.getByText('Slow moving traffic')).toBeInTheDocument();
  });

  it('renders AirQualityView with honest AWAITING_CONFIG state', async () => {
    vi.spyOn(api, 'fetchAirQuality').mockResolvedValue({
      status: 'AWAITING_CONFIG',
      is_stale: false,
      attribution: 'Central Pollution Control Board (CPCB) / OpenAQ',
      message: 'Awaiting CPCB API key configuration.',
    });

    render(
      <AirQualityView
        selectedArea="Delhi Connaught Place"
        isLiveSupported={true}
        onNavigateToLocation={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Integration Status: Awaiting CPCB/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Strict Data Integrity Policy/i)).toBeInTheDocument();
  });

  it('renders EmergencyView with 112, 108, and local casualty hospitals', () => {
    render(<EmergencyView selectedArea="Delhi Connaught Place" />);

    expect(screen.getByText(/Health & Emergency Life Services/i)).toBeInTheDocument();
    expect(screen.getAllByText('112').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('108 / 102')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText(/AIIMS New Delhi — Apex Trauma Center/i)).toBeInTheDocument();
  });

  it('renders AlertsView with official NDMA bulletins', async () => {
    vi.spyOn(api, 'fetchGovernmentAlerts').mockResolvedValue([
      {
        id: 1,
        alert_identifier: 'SACHET-2026-001',
        sender: 'IMD New Delhi',
        event_type: 'Heavy Rainfall',
        severity: 'Severe',
        urgency: 'Expected',
        headline: 'Heavy rain advisory for Central Delhi',
        description: 'Intense rain spell expected in next 2 hours.',
        instruction: 'Avoid low-lying areas.',
        area_description: 'Delhi NCR',
        effective_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        is_active: true,
      },
    ]);

    render(<AlertsView selectedArea="Delhi Connaught Place" />);

    await waitFor(() => {
      expect(screen.getByText('Heavy rain advisory for Central Delhi')).toBeInTheDocument();
    });
    expect(screen.getByText('Severe')).toBeInTheDocument();
    expect(screen.getByText(/IMD New Delhi/i)).toBeInTheDocument();
  });
});
