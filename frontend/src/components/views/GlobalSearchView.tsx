import React, { useState } from 'react';
import type { IntelligenceInsight, LocalityOption } from '../../types/intelligence';
import type { ViewType } from '../Sidebar';

interface GlobalSearchViewProps {
  insights: IntelligenceInsight[];
  localities: LocalityOption[];
  onSelectInsight: (insight: IntelligenceInsight) => void;
  onSelectLocality: (locality: string) => void;
  onNavigateView: (view: ViewType) => void;
}

export const GlobalSearchView: React.FC<GlobalSearchViewProps> = ({
  insights,
  localities,
  onSelectInsight,
  onSelectLocality,
  onNavigateView,
}) => {
  const [query, setQuery] = useState('');

  const q = query.toLowerCase().trim();

  const matchedInsights = q
    ? insights.filter(
        (i) =>
          i.headline.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q) ||
          i.area.label.toLowerCase().includes(q) ||
          (i.potential_impact && i.potential_impact.toLowerCase().includes(q))
      )
    : [];

  const matchedLocalities = q
    ? localities.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.city && l.city.toLowerCase().includes(q)) ||
          l.state.toLowerCase().includes(q)
      )
    : [];

  return (
    <div className="view-container search-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Global Intelligence Search</h1>
          <p className="view-subtitle">
            Search across local insights, monitored corridors, emergency alerts, and cross-signal rules.
          </p>
        </div>
      </div>

      <div className="global-search-input-box card">
        <input
          type="text"
          className="search-input-huge"
          placeholder="Search corridors, rain, traffic jams, NDMA alerts, AIIMS, Connaught Place..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <button type="button" className="clear-search-btn" onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>

      {!query ? (
        <div className="search-suggestions-box card">
          <h3>Popular Quick Searches:</h3>
          <div className="chips-list">
            {['Traffic delay', 'Rainfall', 'Connaught Place', 'AIIMS Ring Road', 'Disaster alert', 'Silk Board', 'Waterlogging'].map(
              (term, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="query-chip"
                  onClick={() => setQuery(term)}
                >
                  🔍 {term}
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="search-results-section">
          {/* Matched Corridors */}
          {matchedLocalities.length > 0 && (
            <div className="search-group">
              <h2 className="search-group-title">Matched Corridors ({matchedLocalities.length})</h2>
              <div className="localities-search-list">
                {matchedLocalities.map((loc) => (
                  <div
                    key={loc.id}
                    className="card locality-search-item"
                    onClick={() => {
                      onSelectLocality(loc.name);
                      onNavigateView('dashboard');
                    }}
                  >
                    <div>
                      <strong>📍 {loc.name}</strong>
                      <span className="sub-text"> • {loc.city ? `${loc.city}, ` : ''}{loc.state}</span>
                    </div>
                    {loc.is_live_supported !== false ? (
                      <span className="badge-live-sm">Live Pilot</span>
                    ) : (
                      <span className="badge-unsupported-sm">Unmonitored</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched Intelligence Insights */}
          <div className="search-group">
            <h2 className="search-group-title">Matched Intelligence Insights ({matchedInsights.length})</h2>
            {matchedInsights.length === 0 ? (
              <p className="no-matches-text">No active cross-signal insights matching "{query}".</p>
            ) : (
              <div className="insights-search-grid">
                {matchedInsights.map((ins) => (
                  <div
                    key={ins.id}
                    className="card insight-search-item"
                    onClick={() => onSelectInsight(ins)}
                  >
                    <div className="search-item-header">
                      <span className={`severity-tag severity-${ins.composite_severity}`}>
                        {ins.composite_severity.toUpperCase()}
                      </span>
                      <span className="area-label">📍 {ins.area.label}</span>
                    </div>
                    <h3 className="search-item-headline">{ins.headline}</h3>
                    <p className="search-item-summary">{ins.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
