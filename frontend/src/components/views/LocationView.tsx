import React, { useState } from 'react';
import type { LocalityOption } from '../../types/intelligence';
import { useGeolocation, saveSelectedLocation } from '../../services/useGeolocation';

interface LocationViewProps {
  localities: LocalityOption[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  onNavigateHome: () => void;
}

export const LocationView: React.FC<LocationViewProps> = ({
  localities,
  selectedArea,
  onSelectArea,
  onNavigateHome,
}) => {
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'live' | 'expansion'>('all');
  const { status, errorMsg, detectedLocality, distanceKm, detectLocation } = useGeolocation();

  const handleAutoDetect = async () => {
    const matched = await detectLocation(localities);
    if (matched) {
      onSelectArea(matched.name);
      saveSelectedLocation(matched.name);
    }
  };

  const filtered = localities.filter((loc) => {
    const matchSearch =
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      (loc.city && loc.city.toLowerCase().includes(search.toLowerCase())) ||
      loc.state.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;
    if (filterTab === 'live') return loc.is_live_supported !== false;
    if (filterTab === 'expansion') return loc.is_live_supported === false;
    return true;
  });

  return (
    <div className="view-container location-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Location Selection & Detection</h1>
          <p className="view-subtitle">
            Configure your active neighborhood. MyArea24 delivers strict evidence-based telemetry with zero synthetic data.
          </p>
        </div>
        <button type="button" className="action-btn-secondary" onClick={onNavigateHome}>
          ← Back to Dashboard
        </button>
      </div>

      {/* GPS Detection Box */}
      <div className="card location-detection-card">
        <div className="detection-header">
          <div className="detection-icon">📍</div>
          <div className="detection-info">
            <h2 className="card-heading">Browser Geolocation Detection</h2>
            <p className="detection-desc">
              Detect your device's GPS coordinates to snap to the nearest monitored Indian corridor. We never store raw coordinates on external servers.
            </p>
          </div>
          <button
            type="button"
            className="action-btn-primary"
            onClick={handleAutoDetect}
            disabled={status === 'locating'}
          >
            {status === 'locating' ? 'Locating Device…' : '🎯 Auto-Detect My Location'}
          </button>
        </div>

        {status === 'locating' && (
          <div className="status-notice notice-info">
            <span className="spinner-sm" /> Requesting GPS coordinates from browser...
          </div>
        )}

        {status === 'success' && detectedLocality && (
          <div className="status-notice notice-success">
            <strong>✅ Detected Location:</strong> Closest monitored corridor is{' '}
            <strong>{detectedLocality.name}</strong> ({distanceKm} km away).
            {detectedLocality.is_live_supported ? (
              <span className="badge-live-sm">Live Pilot Active</span>
            ) : (
              <span className="badge-unsupported-sm">Coverage Expansion</span>
            )}
          </div>
        )}

        {status === 'denied' && (
          <div className="status-notice notice-warning">
            <strong>⚠️ Permission Denied:</strong> Browser location access was denied. Please select your locality manually from the catalog below.
          </div>
        )}

        {(status === 'error' || status === 'timeout') && errorMsg && (
          <div className="status-notice notice-error">
            <strong>⚠️ Geolocation Note:</strong> {errorMsg}
          </div>
        )}
      </div>

      {/* Search & Tabs */}
      <div className="locality-catalog-header">
        <div className="catalog-tabs">
          <button
            type="button"
            className={`tab-btn ${filterTab === 'all' ? 'active' : ''}`}
            onClick={() => setFilterTab('all')}
          >
            All Localities ({localities.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${filterTab === 'live' ? 'active' : ''}`}
            onClick={() => setFilterTab('live')}
          >
            🟢 Live Pilot Corridors ({localities.filter((l) => l.is_live_supported !== false).length})
          </button>
          <button
            type="button"
            className={`tab-btn ${filterTab === 'expansion' ? 'active' : ''}`}
            onClick={() => setFilterTab('expansion')}
          >
            🟡 Expansion Areas ({localities.filter((l) => l.is_live_supported === false).length})
          </button>
        </div>

        <div className="catalog-search">
          <input
            type="text"
            className="search-input"
            placeholder="Search state, city, or locality..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Localities Grid */}
      <div className="localities-grid">
        {filtered.map((loc) => {
          const isSelected = selectedArea.toLowerCase() === loc.name.toLowerCase();
          const isLive = loc.is_live_supported !== false;

          return (
            <div
              key={loc.id}
              className={`locality-card ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                onSelectArea(loc.name);
                saveSelectedLocation(loc.name);
                onNavigateHome();
              }}
            >
              <div className="locality-card-top">
                <span className="locality-name">{loc.name}</span>
                {isLive ? (
                  <span className="badge-live-sm">Live Pilot</span>
                ) : (
                  <span className="badge-unsupported-sm">Unmonitored</span>
                )}
              </div>
              <div className="locality-card-meta">
                <span>{loc.city ? `${loc.city}, ` : ''}{loc.state}</span>
                <span className="coords-text">
                  {loc.latitude.toFixed(4)}°N, {loc.longitude.toFixed(4)}°E
                </span>
              </div>
              <div className="locality-card-footer">
                {isLive ? (
                  <span className="source-pills">Sources: WeatherAPI, TomTom v5, NDMA</span>
                ) : (
                  <span className="unmonitored-text">Awaiting sensor deployment • Zero fake data</span>
                )}
                {isSelected && <span className="selected-indicator">✓ Active</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
