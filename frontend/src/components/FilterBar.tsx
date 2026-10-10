import type { InsightFilters } from '../types/intelligence';

interface FilterBarProps {
  filters: InsightFilters;
  onFilterChange: (newFilters: InsightFilters) => void;
  totalResults: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  totalResults,
}) => {
  const hasActiveFilters = Boolean(
    filters.insight_type || filters.severity || filters.confidence
  );

  const handleReset = () => {
    onFilterChange({
      area: filters.area, // preserve area selection
    });
  };

  return (
    <div className="filter-bar" aria-label="Filter intelligence feed">
      <div className="filter-controls">
        <div className="filter-field">
          <label htmlFor="filter-type" className="filter-label">Signal Architecture</label>
          <select
            id="filter-type"
            value={filters.insight_type || ''}
            onChange={(e) => onFilterChange({ ...filters, insight_type: e.target.value || undefined })}
            className="filter-select"
          >
            <option value="">All Signal Types</option>
            <option value="weather_traffic_correlation">Weather + Traffic (Multi-Signal)</option>
            <option value="severe_public_alert">Official Emergency Alert (NDMA)</option>
            <option value="single_signal_traffic_notice">Traffic Disruption (Single-Source)</option>
            <option value="single_signal_weather_notice">Severe Weather (Single-Source)</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-severity" className="filter-label">Severity Level</label>
          <select
            id="filter-severity"
            value={filters.severity || ''}
            onChange={(e) => onFilterChange({ ...filters, severity: e.target.value || undefined })}
            className="filter-select"
          >
            <option value="">All Severities</option>
            <option value="severe">Severe (Critical Disruption)</option>
            <option value="high">High (Major Congestion/Rain)</option>
            <option value="moderate">Moderate (Elevated Impact)</option>
            <option value="minor">Minor (Low Friction)</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-confidence" className="filter-label">Evidence Strength</label>
          <select
            id="filter-confidence"
            value={filters.confidence || ''}
            onChange={(e) => onFilterChange({ ...filters, confidence: e.target.value || undefined })}
            className="filter-select"
          >
            <option value="">All Evidence Strengths</option>
            <option value="Multi-Source">Multi-Source Corroborated</option>
            <option value="Official">Official Emergency Authority</option>
            <option value="Single">Single Credible Source</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="clear-filters-btn"
            aria-label="Reset all filters"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="filter-summary">
        <span className="results-count">
          Showing <strong>{totalResults}</strong> {totalResults === 1 ? 'verified insight' : 'verified insights'}
        </span>
      </div>
    </div>
  );
};
