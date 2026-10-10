import React from 'react';
import type { IntelligenceInsight } from '../types/intelligence';

interface IntelligenceBriefProps {
  insights: IntelligenceInsight[];
  selectedArea: string;
  totalResults: number;
  isLiveSupported?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const IntelligenceBrief: React.FC<IntelligenceBriefProps> = ({
  insights,
  selectedArea,
  totalResults,
  isLiveSupported = true,
  onRefresh,
  isRefreshing = false,
}) => {
  // Deterministic summary calculations
  const severeCount = insights.filter((i) => i.composite_severity === 'severe').length;
  const highCount = insights.filter((i) => i.composite_severity === 'high').length;
  const priorityInsight = insights.find((i) => i.composite_severity === 'severe') ||
    insights.find((i) => i.composite_severity === 'high') ||
    insights[0];

  const hasArea = Boolean(selectedArea && selectedArea.trim());
  const hasDisruptions = totalResults > 0 && priorityInsight;

  return (
    <section className="ai-local-brief-card" aria-label="AI Local Brief">
      <div className="brief-card-header">
        <div className="brief-card-header-left">
          <div className="brief-sparkle-circle">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>
          </div>
          <div className="brief-header-text">
            <div className="brief-title-row">
              <h2 className="brief-card-title">AI Local Brief</h2>
              <span className="brief-synthesis-badge">Executive Synthesis</span>
            </div>
            <p className="brief-card-subtitle">
              {hasArea ? `Localized synthesis for ${selectedArea}` : 'India wide intelligent local synthesis'}
            </p>
          </div>
        </div>

        <div className="brief-card-header-right">
          <button
            type="button"
            className="brief-refresh-btn"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh AI Local Brief"
          >
            <span className={`refresh-glyph ${isRefreshing ? 'spinning' : ''}`}>↻</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="brief-card-body">
        {!hasArea ? (
          <div className="brief-placeholder-state">
            <p className="brief-placeholder-text">
              Set an active location above to generate your daily AI Local Brief for weather, pollution alerts, road transit, and civic notices.
            </p>
          </div>
        ) : !isLiveSupported ? (
          <div className="brief-active-state">
            <h3 className="brief-state-title">
              Expansion Corridor — Monitoring Pending
            </h3>
            <p className="brief-state-narrative">
              Telemetry feeds are currently in development for <strong>{selectedArea}</strong>. Live cross-signal correlation operates across Delhi NCR and Bengaluru corridors.
            </p>
          </div>
        ) : hasDisruptions ? (
          <div className="brief-active-state">
            <h3 className="brief-state-title">
              {severeCount > 0 ? `Priority Advisory: ${priorityInsight.headline}` : priorityInsight.headline}
            </h3>
            <p className="brief-state-narrative">
              {priorityInsight.summary}{' '}
              {priorityInsight.potential_impact && <span><strong>Impact:</strong> {priorityInsight.potential_impact} </span>}
              {priorityInsight.recommendation && <span><strong>Advice:</strong> {priorityInsight.recommendation}</span>}
            </p>
            <div className="brief-tags-row">
              <span className="brief-metric-tag">
                📊 {totalResults} Active Corridor Signals
              </span>
              {severeCount > 0 && (
                <span className="brief-metric-tag tag-severe">
                  🚨 {severeCount} Critical Disruption
                </span>
              )}
              {highCount > 0 && (
                <span className="brief-metric-tag tag-high">
                  ⚠️ {highCount} Major Delays
                </span>
              )}
              <span className="brief-metric-tag tag-source">
                Source: WeatherAPI · TomTom v5 · NDMA SACHET
              </span>
            </div>
          </div>
        ) : (
          <div className="brief-active-state">
            <h3 className="brief-state-title">
              Normal Operational Thresholds across {selectedArea}
            </h3>
            <p className="brief-state-narrative">
              No severe meteorological hazards, unusual traffic gridlocks, or government emergency bulletins have been detected by live sensor telemetry across this corridor.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default IntelligenceBrief;
