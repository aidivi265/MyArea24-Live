import React, { useState } from 'react';
import type { LocalityOption } from '../types/intelligence';

interface LocalitySelectorProps {
  localities: LocalityOption[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
}

export const LocalitySelector: React.FC<LocalitySelectorProps> = ({
  localities,
  selectedArea,
  onSelectArea,
}) => {
  const [activeTab, setActiveTab] = useState<'pilot' | 'expansion' | 'all'>('pilot');
  const [searchFilter, setSearchFilter] = useState('');

  const liveLocalities = localities.filter((loc) => loc.is_live_supported !== false);
  const expansionLocalities = localities.filter((loc) => loc.is_live_supported === false);

  const displayedLocalities = localities.filter((loc) => {
    // Search query filter
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const match =
        loc.name.toLowerCase().includes(q) ||
        (loc.city && loc.city.toLowerCase().includes(q)) ||
        loc.state.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (activeTab === 'pilot') return loc.is_live_supported !== false;
    if (activeTab === 'expansion') return loc.is_live_supported === false;
    return true;
  });

  return (
    <section className="locality-section" aria-label="Locality selection">
      <div className="locality-header">
        <div className="locality-title-group">
          <span className="locality-icon">📍</span>
          <h2 className="locality-heading">Select Pilot Locality</h2>
        </div>
        <span className="coverage-note">
          Coverage currently active for pilot corridors in Delhi NCR & Bengaluru · Other cities in planned expansion
        </span>
      </div>

      {/* Corridor Filter Tabs & Search */}
      <div className="locality-controls-bar">
        <div className="locality-tabs" role="tablist" aria-label="Locality coverage filter">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pilot'}
            className={`locality-tab-btn ${activeTab === 'pilot' ? 'active' : ''}`}
            onClick={() => setActiveTab('pilot')}
          >
            🟢 Live Pilot Corridors ({liveLocalities.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'expansion'}
            className={`locality-tab-btn ${activeTab === 'expansion' ? 'active' : ''}`}
            onClick={() => setActiveTab('expansion')}
          >
            ⚪ India Expansion Preview ({expansionLocalities.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`locality-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Corridors ({localities.length})
          </button>
        </div>

        <div className="locality-quick-search">
          <input
            type="text"
            className="locality-search-input"
            placeholder="Search state, city or corridor..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            aria-label="Filter corridors by name, city, or state"
          />
          {searchFilter && (
            <button
              type="button"
              className="search-clear-inline"
              onClick={() => setSearchFilter('')}
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="locality-pills-container" role="radiogroup" aria-label="Available pilot areas">
        <button
          type="button"
          role="radio"
          aria-checked={selectedArea === ''}
          className={`locality-pill ${selectedArea === '' ? 'active' : ''}`}
          onClick={() => onSelectArea('')}
        >
          <span className="pill-name">All Active Pilot Zones</span>
          <span className="pill-badge">All</span>
        </button>

        {displayedLocalities.map((loc) => {
          const isSelected = selectedArea.toLowerCase() === loc.name.toLowerCase();
          const isLive = loc.is_live_supported !== false;
          return (
            <button
              key={loc.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`locality-pill ${isSelected ? 'active' : ''} ${!isLive ? 'pill-unmonitored' : ''}`}
              onClick={() => onSelectArea(loc.name)}
              title={isLive ? 'Live sensor feeds connected' : 'Live coverage unavailable (Planned expansion)'}
            >
              <span className="pill-name">{loc.name}</span>
              <span className="pill-state">{loc.state}</span>
              {!isLive && <span className="pill-status-flag">Unmonitored</span>}
            </button>
          );
        })}
      </div>

      {/* Honest Coverage Notice when selecting an unmonitored area */}
      {selectedArea && expansionLocalities.some((l) => l.name.toLowerCase() === selectedArea.toLowerCase()) && (
        <div className="unmonitored-area-banner" role="status">
          <span className="banner-icon">ℹ️</span>
          <div className="banner-text-wrap">
            <strong>Expansion Location Selected: {selectedArea}</strong>
            <p>
              Live feeds (WeatherAPI, TomTom Traffic, CAAQMS) are not yet connected for this area.
              MyArea24 displays zero synthetic data to uphold data integrity.
            </p>
          </div>
          <button
            type="button"
            className="switch-back-btn"
            onClick={() => onSelectArea('Delhi AIIMS Ring Road')}
          >
            Switch to Active Pilot (Delhi AIIMS)
          </button>
        </div>
      )}
    </section>
  );
};
