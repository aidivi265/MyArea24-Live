import React, { useState, useEffect } from 'react';
import type { TrafficStatus } from '../../types/intelligence';
import { fetchTrafficStatus } from '../../services/api';

interface TrafficViewProps {
  selectedArea: string;
  isLiveSupported: boolean;
  onNavigateToLocation: () => void;
}

export const TrafficView: React.FC<TrafficViewProps> = ({
  selectedArea,
  isLiveSupported,
  onNavigateToLocation,
}) => {
  const [traffic, setTraffic] = useState<TrafficStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    let mounted = true;
    async function loadTraffic() {
      setLoading(true);
      try {
        const data = await fetchTrafficStatus({
          area: selectedArea || 'Delhi Connaught Place',
          limit: 50,
        });
        if (mounted) setTraffic(data);
      } catch {
        if (mounted) setTraffic(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadTraffic();
    return () => {
      mounted = false;
    };
  }, [selectedArea]);

  const incidents = traffic?.incidents || [];
  const filteredIncidents = incidents.filter((inc) => {
    if (filterType === 'all') return true;
    if (filterType === 'major') return (inc.delay_seconds || 0) >= 300;
    if (filterType === 'closure') return inc.incident_type.toLowerCase().includes('close');
    return true;
  });

  const totalDelayMinutes = Math.round(
    incidents.reduce((acc, curr) => acc + (curr.delay_seconds || 0), 0) / 60
  );

  return (
    <div className="view-container traffic-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Traffic Bottlenecks & Congestion Feeds</h1>
          <p className="view-subtitle">
            Real-time arterial incident telemetry ingested via TomTom Traffic API v5.
          </p>
        </div>
        <div className="active-locality-pill-group">
          <span className="locality-label-text">Corridor:</span>
          <strong>{selectedArea || 'All Pilot Areas'}</strong>
        </div>
      </div>

      {!isLiveSupported && (
        <div className="status-banner banner-unsupported">
          <div className="status-banner-content">
            <span className="status-banner-icon">⚠️</span>
            <div>
              <strong>Traffic Ingestion Unmonitored for '{selectedArea}'</strong>
              <p>
                Live TomTom incident polling is currently configured for Delhi NCR pilot corridors.
                We refuse to fabricate simulated vehicular congestion or jam factors for unmonitored zones.
              </p>
            </div>
          </div>
          <button type="button" className="switch-pilot-btn" onClick={onNavigateToLocation}>
            Switch to Delhi Pilot
          </button>
        </div>
      )}

      {/* Traffic Summary Metrics */}
      <div className="metrics-row traffic-metrics-grid">
        <div className="metric-card card">
          <span className="metric-label">Active Incidents</span>
          <span className="metric-number">{incidents.length}</span>
          <span className="metric-subtext">Within 25 km radius</span>
        </div>
        <div className="metric-card card">
          <span className="metric-label">Cumulative Delay</span>
          <span className="metric-number">+{totalDelayMinutes} min</span>
          <span className="metric-subtext">Across monitored corridors</span>
        </div>
        <div className="metric-card card">
          <span className="metric-label">Provider Engine</span>
          <span className="metric-number-sm">TomTom v5</span>
          <span className="metric-subtext">India Traffic Services</span>
        </div>
        <div className="metric-card card">
          <span className="metric-label">Bounding Box</span>
          <span className="metric-number-sm">77.15 - 77.26°E</span>
          <span className="metric-subtext">Delhi Central Ring</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="traffic-filter-bar">
        <div className="traffic-tabs">
          <button
            type="button"
            className={`tab-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Incidents ({incidents.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${filterType === 'major' ? 'active' : ''}`}
            onClick={() => setFilterType('major')}
          >
            ⚠️ High Delay &gt;5 min ({incidents.filter((i) => (i.delay_seconds || 0) >= 300).length})
          </button>
        </div>
      </div>

      {/* Incidents Table / List */}
      {loading ? (
        <div className="card loading-card">
          <span className="spinner-sm" /> Ingesting TomTom traffic incidents...
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="card empty-data-card">
          <p>{traffic?.message || 'No active traffic incidents found for this area.'}</p>
        </div>
      ) : (
        <div className="incidents-list">
          {filteredIncidents.map((inc) => {
            const delayMin = Math.round((inc.delay_seconds || 0) / 60);

            return (
              <div key={inc.id} className="card incident-card">
                <div className="incident-card-header">
                  <div className="incident-title-row">
                    <span className="incident-type-tag">{inc.incident_type}</span>
                    <h3 className="incident-road">{inc.road_name || 'Connecting Arterial'}</h3>
                  </div>
                  <div className="incident-delay-badge">
                    +{delayMin} min delay
                  </div>
                </div>

                {inc.description && (
                  <p className="incident-desc">{inc.description}</p>
                )}

                <div className="incident-card-footer">
                  <div className="incident-coords">
                    📍 {inc.latitude.toFixed(4)}°N, {inc.longitude.toFixed(4)}°E
                  </div>
                  <div className="incident-time">
                    Observed: {new Date(inc.observed_at).toLocaleTimeString()}
                  </div>
                  <span className="source-tag">TomTom v5</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
