import React from 'react';

interface EmptyStateProps {
  hasFilters: boolean;
  selectedArea: string;
  onClearFilters: () => void;
  lastCheckedTime?: string;
  isLiveSupported?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  hasFilters,
  selectedArea,
  onClearFilters,
  lastCheckedTime,
  isLiveSupported = true,
}) => {
  // 1. Unmonitored / Expansion Locality State
  if (selectedArea && !isLiveSupported) {
    return (
      <div className="empty-state unmonitored-state" role="status">
        <div className="empty-icon">📡</div>
        <h3 className="empty-heading">Live Signal Coverage Unavailable</h3>
        <p className="empty-message">
          MyArea24 is currently ingesting signals exclusively in <strong>Delhi-NCR</strong> and <strong>Bengaluru</strong> pilot corridors. Real-time sensor feeds, traffic telemetry, and automated cross-signal intelligence are not yet connected for <strong>{selectedArea}</strong>.
        </p>
        <div className="empty-subtext unmonitored-note">
          <span>🛡️ Strict Data Integrity: Zero synthetic readings or mock alerts are displayed for unmonitored regions.</span>
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          className="empty-action-btn"
        >
          Switch to Monitored Pilot Zones
        </button>
      </div>
    );
  }

  // 2. Active Filters Yielding No Results
  if (hasFilters) {
    return (
      <div className="empty-state" role="status">
        <div className="empty-icon">🔍</div>
        <h3 className="empty-heading">No matching insights found</h3>
        <p className="empty-message">
          No active intelligence alerts match your current filter criteria in {selectedArea || 'all pilot zones'}.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="empty-action-btn"
        >
          Reset All Filters
        </button>
      </div>
    );
  }

  // 3. Normal Operating Conditions in Monitored Pilot Zone
  return (
    <div className="empty-state" role="status">
      <div className="empty-icon">✅</div>
      <h3 className="empty-heading">Normal Conditions Reported</h3>
      <p className="empty-message">
        No active weather anomalies, traffic disruptions, or emergency bulletins are currently detected in{' '}
        <strong>{selectedArea || 'selected pilot corridors'}</strong>.
      </p>
      <div className="empty-subtext">
        <span>Signal telemetry is healthy and monitoring.</span>
        {lastCheckedTime && (
          <span className="last-sync-time">Last checked: {lastCheckedTime}</span>
        )}
      </div>
    </div>
  );
};
