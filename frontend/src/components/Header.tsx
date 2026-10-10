import React from 'react';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  backendConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isRefreshing,
  backendConnected,
}) => {
  return (
    <header className="header">
      <div className="header-container">
        <div className="brand-group">
          <div className="logo-badge">
            <span className="logo-icon">▲</span>
            <span className="logo-text">MyArea24</span>
          </div>
          <span className="version-pill">India Pilot v0.3</span>
        </div>

        <div className="header-meta">
          <div className="connection-status" title={backendConnected ? "Connected to Local Backend" : "Connecting to Backend..."}>
            <span className={`status-dot ${backendConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-label">
              {backendConnected ? 'Live Signal Engine' : 'Reconnecting...'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="refresh-btn"
            aria-label="Refresh intelligence feed"
          >
            <span className={`refresh-icon ${isRefreshing ? 'spinning' : ''}`}>↻</span>
            <span className="refresh-text">{isRefreshing ? 'Syncing...' : 'Sync Feed'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
