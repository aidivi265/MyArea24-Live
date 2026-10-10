import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from '../App';
import * as api from '../services/api';
import type { PaginatedInsightsResponse, LocalityOption, IntelligenceInsight } from '../types/intelligence';

const mockLocalities: LocalityOption[] = [
  { id: 'delhi-aiims-ring-road', name: 'Delhi AIIMS Ring Road', state: 'Delhi', latitude: 28.5672, longitude: 77.2100, coverage_status: 'Active Pilot' },
  { id: 'delhi-connaught-place', name: 'Delhi Connaught Place', state: 'Delhi', latitude: 28.6304, longitude: 77.2177, coverage_status: 'Active Pilot' },
];

const mockInsight: IntelligenceInsight = {
  id: 1,
  insight_type: 'single_signal_traffic_notice',
  area: {
    label: 'AH1 (Delhi AIIMS Ring Road)',
    latitude: 28.5689,
    longitude: 77.2156,
    radius_km: 5.0,
  },
  headline: 'Traffic Advisory: Major Delay on AH1',
  summary: 'Significant traffic delay (+25 mins) reported on AH1 near Delhi AIIMS Ring Road.',
  potential_impact: 'Expect delays of 25+ minutes along this corridor.',
  recommendation: 'Allow extra transit time or consider alternate route.',
  composite_severity: 'high',
  confidence_level: 'MEDIUM (Single Credible Source)',
  rule_identifier: 'SCENARIO_C_STANDALONE_TRAFFIC',
  rule_version: '1.0',
  data_quality_notes: 'Observation from single source (tomtom_traffic_v5).',
  signals: [
    {
      type: 'traffic',
      source: 'tomtom_traffic_v5',
      observation_id: 182,
      observed_at: '2026-10-09T12:00:00Z',
      metric_summary: 'Delay: +25 mins | Criticality: major',
    },
  ],
  created_at: '2026-10-09T12:05:00Z',
  expires_at: '2026-10-09T14:05:00Z',
};

const mockSuccessResponse: PaginatedInsightsResponse = {
  items: [mockInsight],
  total: 1,
  page: 1,
  page_size: 10,
};

describe('App Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders header, pilot banner, locality pills, and insights feed', async () => {
    vi.spyOn(api, 'fetchLocalities').mockResolvedValue(mockLocalities);
    vi.spyOn(api, 'fetchInsights').mockResolvedValue(mockSuccessResponse);

    render(<App />);

    // Header & Banner
    expect(screen.getAllByText('MyArea24').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Pilot Scope/i).length).toBeGreaterThanOrEqual(1);

    // Wait for feed to load
    await waitFor(() => {
      expect(screen.getByText('Traffic Advisory: Major Delay on AH1')).toBeInTheDocument();
    });

    expect(screen.getByText('AH1 (Delhi AIIMS Ring Road)')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('opens detail modal when clicking an insight card and closes it', async () => {
    vi.spyOn(api, 'fetchLocalities').mockResolvedValue(mockLocalities);
    vi.spyOn(api, 'fetchInsights').mockResolvedValue(mockSuccessResponse);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Traffic Advisory: Major Delay on AH1')).toBeInTheDocument();
    });

    // Click card
    const card = screen.getByRole('button', { name: /Insight: Traffic Advisory/i });
    fireEvent.click(card);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Supporting Evidence & Data Provenance/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders empty state when no insights are available', async () => {
    vi.spyOn(api, 'fetchLocalities').mockResolvedValue(mockLocalities);
    vi.spyOn(api, 'fetchInsights').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Normal Conditions Reported/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No active weather anomalies, traffic disruptions, or emergency bulletins/i)).toBeInTheDocument();
  });

  it('renders error state with retry button when backend fails', async () => {
    vi.spyOn(api, 'fetchLocalities').mockResolvedValue(mockLocalities);
    vi.spyOn(api, 'fetchInsights').mockRejectedValue(
      new api.ApiError('Connection refused at http://localhost:8000')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to Load Intelligence Feed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Connection refused at http:\/\/localhost:8000/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeInTheDocument();
  });
});
