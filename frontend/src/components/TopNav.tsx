import React, { useState, useRef, useEffect } from 'react';
import type { LocalityOption } from '../types/intelligence';
import type { ViewType } from './Sidebar';

interface TopNavProps {
  localities: LocalityOption[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  backendConnected: boolean;
  onOpenEmergency: () => void;
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeView?: ViewType;
  onSelectView?: (view: ViewType) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  localities,
  selectedArea,
  onSelectArea,
  onRefresh: _onRefresh,
  isRefreshing: _isRefreshing,
  backendConnected,
  onOpenEmergency,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  activeView: _activeView = 'dashboard',
  onSelectView,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [dropdownTab, setDropdownTab] = useState<'all' | 'live' | 'expansion'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLocalityDisplay = selectedArea || 'Select Location (India)';

  const filteredDropdownLocalities = localities.filter((loc) => {
    if (dropdownSearch.trim()) {
      const q = dropdownSearch.toLowerCase();
      const match =
        loc.name.toLowerCase().includes(q) ||
        (loc.city && loc.city.toLowerCase().includes(q)) ||
        loc.state.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (dropdownTab === 'live') return loc.is_live_supported !== false;
    if (dropdownTab === 'expansion') return loc.is_live_supported === false;
    return true;
  });

  return (
    <header className="top-nav" role="banner">
      <div className="top-nav-inner">
        {/* Left Section: Brand Logo + Location Selector */}
        <div className="nav-left">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation sidebar"
          >
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
          </button>

          <div
            className="brand-logo-group"
            onClick={() => onSelectView?.('dashboard')}
            style={{ cursor: 'pointer' }}
            title="MyArea24 — Pan-India Intelligence"
          >
            <div className="brand-symbol">
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
            <div className="brand-text-wrap">
              <span className="brand-title">MyArea24</span>
              <span className="brand-subtitle">PAN-INDIA INTELLIGENCE</span>
            </div>
          </div>

          {/* Location Dropdown Pill directly in TopNav */}
          <div className="locality-dropdown-container" ref={dropdownRef}>
            <button
              type="button"
              className="locality-nav-pill-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
              aria-label={`Selected locality: ${currentLocalityDisplay}. Click to change locality`}
            >
              <svg
                className="loc-pill-pin"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="loc-pill-text">{currentLocalityDisplay}</span>
              <span className="loc-pill-chevron">⌄</span>
            </button>

            {dropdownOpen && (
              <div
                className="locality-dropdown-menu"
                role="listbox"
                aria-label="Supported localities across India"
              >
                <div className="dropdown-menu-header">
                  <span>Pan-India Locality Selector</span>
                  <span className="coverage-badge">Pilot Corridors Active</span>
                </div>

                {/* Quick search inside dropdown */}
                <div className="dropdown-search-wrapper">
                  <span className="dropdown-search-icon">🔍</span>
                  <input
                    type="text"
                    className="dropdown-search-input"
                    placeholder="Search city, district, or pin..."
                    value={dropdownSearch}
                    onChange={(e) => setDropdownSearch(e.target.value)}
                    autoFocus
                  />
                  {dropdownSearch && (
                    <button
                      type="button"
                      className="dropdown-search-clear"
                      onClick={() => setDropdownSearch('')}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="dropdown-filter-tabs">
                  <button
                    type="button"
                    className={`dropdown-tab ${dropdownTab === 'all' ? 'active' : ''}`}
                    onClick={() => setDropdownTab('all')}
                  >
                    All ({localities.length})
                  </button>
                  <button
                    type="button"
                    className={`dropdown-tab ${dropdownTab === 'live' ? 'active' : ''}`}
                    onClick={() => setDropdownTab('live')}
                  >
                    🟢 Live ({localities.filter((l) => l.is_live_supported !== false).length})
                  </button>
                  <button
                    type="button"
                    className={`dropdown-tab ${dropdownTab === 'expansion' ? 'active' : ''}`}
                    onClick={() => setDropdownTab('expansion')}
                  >
                    ⚪ Expansion ({localities.filter((l) => l.is_live_supported === false).length})
                  </button>
                </div>

                <button
                  type="button"
                  role="option"
                  aria-selected={selectedArea === ''}
                  className={`dropdown-item ${selectedArea === '' ? 'active' : ''}`}
                  onClick={() => {
                    onSelectArea('');
                    setDropdownOpen(false);
                    setDropdownSearch('');
                  }}
                >
                  <div className="item-text">
                    <strong>All Active Pilot Zones (India)</strong>
                    <span className="item-sub">Delhi NCR & Bengaluru corridors (All Signals)</span>
                  </div>
                  {selectedArea === '' && <span className="item-check">✓</span>}
                </button>

                <div className="dropdown-divider"></div>

                <div className="dropdown-items-scroll">
                  {filteredDropdownLocalities.length === 0 ? (
                    <div className="dropdown-empty-search">
                      <span>No locations match "{dropdownSearch}".</span>
                      <small>Live signals active in Delhi NCR & Bengaluru.</small>
                    </div>
                  ) : (
                    filteredDropdownLocalities.map((loc) => {
                      const isSelected = selectedArea.toLowerCase() === loc.name.toLowerCase();
                      const isLive = loc.is_live_supported !== false;
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`dropdown-item ${isSelected ? 'active' : ''} ${!isLive ? 'dropdown-item-unmonitored' : ''}`}
                          onClick={() => {
                            onSelectArea(loc.name);
                            setDropdownOpen(false);
                            setDropdownSearch('');
                          }}
                        >
                          <div className="item-text">
                            <strong>{loc.name}</strong>
                            <span className="item-sub">
                              {loc.city ? `${loc.city}, ` : ''}{loc.state} · {loc.coverage_status}
                            </span>
                          </div>
                          <div className="item-badge-wrap">
                            {isLive ? (
                              <span className="badge-live-tag">Live</span>
                            ) : (
                              <span className="badge-unmonitored-tag">Planned</span>
                            )}
                            {isSelected && <span className="item-check">✓</span>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Pan-India Search Input */}
        <div className="nav-center">
          <div className="search-box">
            <span className="search-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Search local hospitals, events, civic notices, blood banks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  onSelectView?.('search');
                }
              }}
              aria-label="Search local hospitals, events, civic notices, blood banks"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Emergency Pill + Moon + Bell + Avatar */}
        <div className="nav-right">
          {/* Red Emergency Button */}
          <button
            type="button"
            onClick={onOpenEmergency}
            className="nav-emergency-pill-btn"
            aria-label="Emergency response and helplines"
          >
            <span className="emergency-icon-circle">!</span>
            <span className="emergency-pill-text">Emergency</span>
          </button>

          {/* Dark Mode Icon Button */}
          <button
            type="button"
            className="nav-icon-action-btn"
            aria-label="Toggle dark mode"
            title="Theme toggle"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#475569"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>

          {/* Notification Bell Button */}
          <button
            type="button"
            className="nav-icon-action-btn"
            aria-label="Notifications"
            title="Alert notifications"
            onClick={() => onSelectView?.('alerts')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#475569"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="notification-dot" />
          </button>

          {/* User Profile Avatar */}
          <button
            type="button"
            className="nav-profile-avatar-btn"
            aria-label="User account profile"
            title={backendConnected ? "User Profile · Online" : "User Profile"}
            onClick={() => onSelectView?.('settings')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#475569"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Engine Status Tag for E2E & Accessibility */}
          <span className="status-label sr-only">{backendConnected ? 'Live Signals' : 'Syncing'}</span>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
