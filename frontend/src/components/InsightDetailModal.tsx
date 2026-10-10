import React, { useEffect } from 'react';
import type { IntelligenceInsight } from '../types/intelligence';

interface InsightDetailModalProps {
  insight: IntelligenceInsight | null;
  onClose: () => void;
}

export const InsightDetailModal: React.FC<InsightDetailModalProps> = ({
  insight,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (insight) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [insight, onClose]);

  if (!insight) return null;

  const isOfficial = insight.insight_type === 'severe_public_alert';
  const isMultiSource = insight.insight_type === 'weather_traffic_correlation';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-type-tag">
              {isOfficial ? '🏛️ Official Public Emergency Warning' : isMultiSource ? '⚡ Correlated Cross-Signal Alert' : '📡 Single-Source Local Telemetry'}
            </span>
            <h2 id="modal-title" className="modal-headline">{insight.headline}</h2>
            <div className="modal-location">
              <span>📍 {insight.area.label}</span>
              {insight.area.latitude && insight.area.longitude && (
                <span className="coord-text">
                  ({insight.area.latitude.toFixed(4)}°N, {insight.area.longitude.toFixed(4)}°E)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Section 1: Core Situation & Impact */}
          <section className="detail-section">
            <h3 className="section-title">What Is Happening</h3>
            <p className="detail-text">{insight.summary}</p>

            {insight.potential_impact && (
              <div className="detail-callout impact-callout">
                <h4>⚠️ Potential Neighborhood Impact</h4>
                <p>{insight.potential_impact}</p>
              </div>
            )}

            {insight.recommendation && (
              <div className="detail-callout action-callout">
                <h4>💡 Recommended Action</h4>
                <p>{insight.recommendation}</p>
              </div>
            )}
          </section>

          {/* Section 2: Supporting Evidence & Provenance */}
          <section className="detail-section">
            <h3 className="section-title">Supporting Evidence & Data Provenance</h3>
            <div className="signals-grid">
              {insight.signals.map((sig, idx) => {
                const obsDate = new Date(sig.observed_at);
                return (
                  <div key={idx} className="signal-card">
                    <div className="signal-header">
                      <span className="signal-badge">
                        {sig.type === 'weather' ? '⛅ Weather Signal' : sig.type === 'traffic' ? '🚗 Traffic Telemetry' : '📢 Government CAP Notice'}
                      </span>
                      <span className="signal-source">{sig.source}</span>
                    </div>

                    <div className="signal-metric">
                      <strong>Observation:</strong> {sig.metric_summary}
                    </div>

                    <div className="signal-meta">
                      <div><strong>Recorded At:</strong> {obsDate.toLocaleTimeString()} IST</div>
                      <div><strong>Observation ID:</strong> #{sig.observation_id}</div>
                      {sig.freshness_minutes !== undefined && sig.freshness_minutes !== null && (
                        <div><strong>Freshness Age:</strong> ~{sig.freshness_minutes} mins ago</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Evidence Strength & Uncertainty */}
          <section className="detail-section">
            <h3 className="section-title">Confidence & Quality Assessment</h3>
            <div className="confidence-assessment-card">
              <div className="confidence-row">
                <span className="confidence-label">Evidence Strength:</span>
                <span className="confidence-badge">{insight.confidence_level}</span>
              </div>

              {insight.data_quality_notes && (
                <div className="notes-box">
                  <strong>Telemetry & Quality Notes:</strong>
                  <p>{insight.data_quality_notes}</p>
                </div>
              )}

              <div className="audit-meta">
                <span><strong>Rule:</strong> {insight.rule_identifier} (v{insight.rule_version})</span>
                <span><strong>Severity Level:</strong> {insight.composite_severity.toUpperCase()}</span>
                {insight.next_review_at && (
                  <span><strong>Next Review:</strong> {new Date(insight.next_review_at).toLocaleTimeString()} IST</span>
                )}
                <span><strong>Expires At:</strong> {new Date(insight.expires_at).toLocaleTimeString()} IST</span>
              </div>
            </div>
          </section>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
