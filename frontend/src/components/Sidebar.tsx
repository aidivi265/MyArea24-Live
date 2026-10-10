import React from 'react';

export type ViewType =
  | 'dashboard'
  | 'location'
  | 'search'
  | 'assistant'
  | 'map'
  | 'weather'
  | 'traffic'
  | 'air-quality'
  | 'alerts'
  | 'emergency'
  | 'events'
  | 'news'
  | 'businesses'
  | 'market'
  | 'saved'
  | 'settings';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ViewType;
  onSelectView: (view: ViewType) => void;
  activeFilterType?: string;
  onSelectFilterType: (type: string | undefined) => void;
  onOpenEmergency: () => void;
  onOpenSystemStatus: () => void;
  selectedArea: string;
  onSelectArea: (area: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeView,
  onSelectView,
  activeFilterType: _activeFilterType,
  onSelectFilterType: _onSelectFilterType,
  onOpenEmergency,
  onOpenSystemStatus: _onOpenSystemStatus,
  selectedArea: _selectedArea,
  onSelectArea: _onSelectArea,
}) => {
  const handleNav = (view: ViewType) => {
    onSelectView(view);
    onClose();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}
        aria-label="Sidebar Navigation"
      >
        <div className="sidebar-inner">
          {/* Mobile Close Button */}
          <div className="sidebar-mobile-header">
            <div className="brand-logo-group">
              <span className="brand-title">Navigation</span>
            </div>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onClose}
              aria-label="Close navigation sidebar"
            >
              ✕
            </button>
          </div>

          {/* SECTION 1: NAVIGATION */}
          <div className="sidebar-group">
            <h3 className="sidebar-group-title">NAVIGATION</h3>
            <ul className="sidebar-menu">
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => handleNav('dashboard')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </span>
                  <span className="nav-label">Home</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'assistant' ? 'active' : ''}`}
                  onClick={() => handleNav('assistant')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                      <line x1="8" y1="16" x2="8" y2="16" />
                      <line x1="16" y1="16" x2="16" y2="16" />
                    </svg>
                  </span>
                  <span className="nav-label">Ask MyArea</span>
                  <span className="nav-ai-pill">AI</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'map' ? 'active' : ''}`}
                  onClick={() => handleNav('map')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                  </span>
                  <span className="nav-label">Live Map</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'location' ? 'active' : ''}`}
                  onClick={() => handleNav('location')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                    </svg>
                  </span>
                  <span className="nav-label">Explore</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'emergency' ? 'active' : ''}`}
                  onClick={() => {
                    onOpenEmergency();
                    handleNav('emergency');
                  }}
                >
                  <span className="nav-icon icon-health">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </span>
                  <span className="nav-label">Health & Emergency</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'saved' ? 'active' : ''}`}
                  onClick={() => handleNav('saved')}
                >
                  <span className="nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <span className="nav-label">Saved</span>
                </button>
              </li>
            </ul>
          </div>

          {/* SECTION 2: ENVIRONMENTAL */}
          <div className="sidebar-group">
            <h3 className="sidebar-group-title">ENVIRONMENTAL</h3>
            <ul className="sidebar-menu">
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'weather' ? 'active' : ''}`}
                  onClick={() => handleNav('weather')}
                >
                  <span className="nav-icon icon-weather">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                    </svg>
                  </span>
                  <span className="nav-label">Weather</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'air-quality' ? 'active' : ''}`}
                  onClick={() => handleNav('air-quality')}
                >
                  <span className="nav-icon icon-aqi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
                    </svg>
                  </span>
                  <span className="nav-label">Air Quality (AQI)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'traffic' ? 'active' : ''}`}
                  onClick={() => handleNav('traffic')}
                >
                  <span className="nav-icon icon-traffic">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <circle cx="7" cy="15" r="2" />
                      <circle cx="17" cy="15" r="2" />
                    </svg>
                  </span>
                  <span className="nav-label">Traffic & Transit</span>
                </button>
              </li>
            </ul>
          </div>

          {/* SECTION 3: CIVIC & COMMUNITY */}
          <div className="sidebar-group">
            <h3 className="sidebar-group-title">CIVIC & COMMUNITY</h3>
            <ul className="sidebar-menu">
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'events' ? 'active' : ''}`}
                  onClick={() => handleNav('events')}
                >
                  <span className="nav-icon icon-events">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <span className="nav-label">Nearby Events</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'alerts' ? 'active' : ''}`}
                  onClick={() => handleNav('alerts')}
                >
                  <span className="nav-icon icon-notices">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </span>
                  <span className="nav-label">Government Notices</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'news' ? 'active' : ''}`}
                  onClick={() => handleNav('news')}
                >
                  <span className="nav-icon icon-updates">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                      <path d="M18 14v-8" />
                      <path d="M15 18h3" />
                    </svg>
                  </span>
                  <span className="nav-label">Local Updates</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={`sidebar-nav-item ${activeView === 'businesses' ? 'active' : ''}`}
                  onClick={() => handleNav('businesses')}
                >
                  <span className="nav-icon icon-businesses">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <path d="M9 22V12h6v10" />
                    </svg>
                  </span>
                  <span className="nav-label">Local Businesses</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
