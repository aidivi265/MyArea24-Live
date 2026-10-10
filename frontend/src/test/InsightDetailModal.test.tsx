import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsightDetailModal } from '../components/InsightDetailModal';
import type { IntelligenceInsight } from '../types/intelligence';

const mockDetailInsight: IntelligenceInsight = {
  id: 42,
  insight_type: 'weather_traffic_correlation',
  area: {
    label: 'Outer Ring Road (Bengaluru Silk Board)',
    latitude: 12.9176,
    longitude: 77.6233,
    radius_km: 5.0,
  },
  headline: 'Travel Advisory: Waterlogging & Heavy Traffic Congestion',
  summary: 'Intense rain (35.5mm/h) combined with heavy traffic delays (+45 mins) observed along Outer Ring Road.',
  potential_impact: 'Severe traffic bottleneck; expected travel delays exceeding 45 minutes.',
  recommendation: 'Allow 45+ mins extra travel time or defer transit until rainfall subsides.',
  composite_severity: 'severe',
  confidence_level: 'HIGH (Multi-Source Corroborated)',
  rule_identifier: 'SCENARIO_A_WEATHER_TRAFFIC',
  rule_version: '1.0',
  data_quality_notes: 'Corroborated across 2 distinct data sources (weatherapi, tomtom_traffic_v5).',
  signals: [
    {
      type: 'weather',
      source: 'weatherapi',
      observation_id: 101,
      observed_at: '2026-10-09T14:00:00Z',
      metric_summary: 'Precipitation: 35.5 mm/h | Condition: Heavy Rain',
      freshness_minutes: 8,
    },
    {
      type: 'traffic',
      source: 'tomtom_traffic_v5',
      observation_id: 202,
      observed_at: '2026-10-09T14:05:00Z',
      metric_summary: 'Delay: +45 mins | Length: 3.2 km | Road: Outer Ring Road',
      freshness_minutes: 3,
    },
  ],
  created_at: '2026-10-09T14:10:00Z',
  expires_at: '2026-10-09T16:10:00Z',
  next_review_at: '2026-10-09T14:40:00Z',
};

describe('InsightDetailModal Component', () => {
  it('renders nothing when insight is null', () => {
    const { container } = render(
      <InsightDetailModal insight={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with detailed evidence and provenance', () => {
    render(<InsightDetailModal insight={mockDetailInsight} onClose={vi.fn()} />);

    expect(screen.getByText('Travel Advisory: Waterlogging & Heavy Traffic Congestion')).toBeInTheDocument();
    expect(screen.getByText(/12.9176°N, 77.6233°E/)).toBeInTheDocument();
    expect(screen.getByText(/Severe traffic bottleneck/)).toBeInTheDocument();
    expect(screen.getByText(/Allow 45\+ mins extra travel time/)).toBeInTheDocument();
    
    // Provenance signals
    expect(screen.getByText('weatherapi')).toBeInTheDocument();
    expect(screen.getByText('tomtom_traffic_v5')).toBeInTheDocument();
    expect(screen.getByText(/#101/)).toBeInTheDocument();
    expect(screen.getByText(/#202/)).toBeInTheDocument();
    expect(screen.getByText(/Precipitation: 35.5 mm\/h/)).toBeInTheDocument();

    // Confidence & quality assessment
    expect(screen.getByText('HIGH (Multi-Source Corroborated)')).toBeInTheDocument();
    expect(screen.getByText(/SCENARIO_A_WEATHER_TRAFFIC/)).toBeInTheDocument();
    expect(screen.getByText(/Corroborated across 2 distinct data sources/)).toBeInTheDocument();
  });

  it('calls onClose when clicking close button or backdrop', () => {
    const handleClose = vi.fn();
    render(<InsightDetailModal insight={mockDetailInsight} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape key press', () => {
    const handleClose = vi.fn();
    render(<InsightDetailModal insight={mockDetailInsight} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
