import type { IntelligenceInsight } from '../types/intelligence';

interface InsightCardProps {
  insight: IntelligenceInsight;
  onSelect: (insight: IntelligenceInsight) => void;
}

function formatFreshness(observedAtStr?: string | null, createdAtStr?: string): string {
  const timeStr = observedAtStr || createdAtStr;
  if (!timeStr) return 'Recent';
  try {
    const date = new Date(timeStr);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  } catch {
    return 'Recent';
  }
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight, onSelect }) => {
  const isSevere = insight.composite_severity === 'severe';
  const isHigh = insight.composite_severity === 'high';
  const isOfficial = insight.insight_type === 'severe_public_alert';
  const isMultiSource = insight.insight_type === 'weather_traffic_correlation';
  const isSingleSource = insight.insight_type.startsWith('single_signal_');

  const getCardTypeBadge = () => {
    if (isOfficial) {
      return <span className="type-badge official-badge">🏛️ Official Emergency Bulletin</span>;
    }
    if (isMultiSource) {
      return <span className="type-badge multi-badge">⚡ Correlated Multi-Signal</span>;
    }
    return <span className="type-badge single-badge">📡 Single-Source Telemetry</span>;
  };

  const getSeverityBadge = () => {
    const sev = insight.composite_severity.toUpperCase();
    let sevClass = 'sev-minor';
    if (isSevere) sevClass = 'sev-severe';
    else if (isHigh) sevClass = 'sev-high';
    else if (insight.composite_severity === 'moderate') sevClass = 'sev-moderate';

    return <span className={`severity-badge ${sevClass}`}>{sev}</span>;
  };

  return (
    <article
      className={`insight-card ${isSevere ? 'border-severe' : isHigh ? 'border-high' : ''}`}
      onClick={() => onSelect(insight)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(insight);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Insight: ${insight.headline}`}
    >
      <div className="card-top-row">
        <div className="badges-group">
          {getCardTypeBadge()}
          {getSeverityBadge()}
        </div>
        <span className="freshness-tag">
          ⏱️ {formatFreshness(insight.observed_at, insight.created_at)}
        </span>
      </div>

      <h3 className="insight-title">{insight.headline}</h3>

      <div className="area-location-bar">
        <span className="pin-icon">📍</span>
        <span className="area-name">{insight.area.label}</span>
      </div>

      <p className="insight-summary">{insight.summary}</p>

      {insight.potential_impact && (
        <div className="impact-box">
          <strong className="callout-label">Local Impact:</strong>
          <span className="callout-text">{insight.potential_impact}</span>
        </div>
      )}

      {insight.recommendation && (
        <div className="recommendation-box">
          <strong className="callout-label">Action Advice:</strong>
          <span className="callout-text">{insight.recommendation}</span>
        </div>
      )}

      {isSingleSource && (
        <div className="single-source-note">
          <span className="warning-icon">ℹ️</span>
          <span>Single-source observation. No corroborating secondary signals currently reported.</span>
        </div>
      )}

      <div className="card-footer">
        <div className="sources-preview">
          <span className="sources-label">Sources:</span>
          {insight.signals.map((sig, idx) => (
            <span key={idx} className="source-pill">
              {sig.source === 'weatherapi' ? 'WeatherAPI' : sig.source.includes('tomtom') ? 'TomTom' : 'NDMA SACHET'}
            </span>
          ))}
        </div>

        <span className="inspect-link">
          Inspect Evidence →
        </span>
      </div>
    </article>
  );
};
