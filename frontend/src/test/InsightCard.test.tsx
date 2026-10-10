import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsightCard } from '../components/InsightCard';
import type { IntelligenceInsight } from '../types/intelligence';

const mockInsight: IntelligenceInsight = {
  id: 1,
  insight_type: 'single_signal_traffic_notice',
  area: {
    label: 'Janpath -> Ashoka Road (Delhi Connaught Place)',
    latitude: 28.6167,
    longitude: 77.2188,
    radius_km: 5.0,
  },
  headline: 'Traffic Advisory: Road Closure on Janpath -> Ashoka Road',
  summary: 'Significant traffic disruption reported along Janpath -> Ashoka Road. Road closure reported.',
  potential_impact: 'Corridor is closed to vehicular traffic. Expect severe localized bottlenecks.',
  recommendation: 'Corridor closed. Avoid Janpath -> Ashoka Road and use alternate arterials.',
  composite_severity: 'severe',
  confidence_level: 'MEDIUM (Single Credible Source)',
  rule_identifier: 'SCENARIO_C_STANDALONE_TRAFFIC',
  rule_version: '1.0',
  data_quality_notes: 'Observation from single source (tomtom_traffic_v5).',
  signals: [
    {
      type: 'traffic',
      source: 'tomtom_traffic_v5',
      observation_id: 116,
      observed_at: '2026-10-09T12:00:00Z',
      metric_summary: 'Delay: +0 mins | Criticality: critical | Type: ROAD_CLOSURE',
      freshness_minutes: 5,
    },
  ],
  created_at: '2026-10-09T12:05:00Z',
  expires_at: '2026-10-09T14:05:00Z',
};

describe('InsightCard Component', () => {
  it('renders headline, locality, impact, recommendation, and severity correctly', () => {
    const handleSelect = vi.fn();
    render(<InsightCard insight={mockInsight} onSelect={handleSelect} />);

    expect(screen.getByText('Traffic Advisory: Road Closure on Janpath -> Ashoka Road')).toBeInTheDocument();
    expect(screen.getByText('Janpath -> Ashoka Road (Delhi Connaught Place)')).toBeInTheDocument();
    expect(screen.getByText(/Corridor is closed to vehicular traffic/i)).toBeInTheDocument();
    expect(screen.getByText(/Corridor closed. Avoid Janpath/i)).toBeInTheDocument();
    expect(screen.getByText('SEVERE')).toBeInTheDocument();
    expect(screen.getByText(/Single-Source Telemetry/i)).toBeInTheDocument();
  });

  it('renders single-source disclaimer note for single signal insight', () => {
    const handleSelect = vi.fn();
    render(<InsightCard insight={mockInsight} onSelect={handleSelect} />);

    expect(screen.getByText(/Single-source observation. No corroborating secondary signals/i)).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const handleSelect = vi.fn();
    render(<InsightCard insight={mockInsight} onSelect={handleSelect} />);

    const card = screen.getByRole('button', { name: /Insight: Traffic Advisory/i });
    fireEvent.click(card);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(mockInsight);
  });

  it('calls onSelect on Enter key press', () => {
    const handleSelect = vi.fn();
    render(<InsightCard insight={mockInsight} onSelect={handleSelect} />);

    const card = screen.getByRole('button', { name: /Insight: Traffic Advisory/i });
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });

    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it('renders multi-signal badge when insight_type is weather_traffic_correlation', () => {
    const multiInsight: IntelligenceInsight = {
      ...mockInsight,
      insight_type: 'weather_traffic_correlation',
      composite_severity: 'high',
    };
    render(<InsightCard insight={multiInsight} onSelect={vi.fn()} />);

    expect(screen.getByText(/Correlated Multi-Signal/i)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('renders official emergency bulletin badge when insight_type is severe_public_alert', () => {
    const officialInsight: IntelligenceInsight = {
      ...mockInsight,
      insight_type: 'severe_public_alert',
      composite_severity: 'severe',
    };
    render(<InsightCard insight={officialInsight} onSelect={vi.fn()} />);

    expect(screen.getByText(/Official Emergency Bulletin/i)).toBeInTheDocument();
  });
});
