import React, { useState } from 'react';

interface SettingsViewProps {
  onOpenSystemStatus: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenSystemStatus }) => {
  const [clearedNotice, setClearedNotice] = useState(false);

  const handleClearCache = () => {
    try {
      localStorage.removeItem('myarea24_selected_location');
      localStorage.removeItem('myarea24_saved_insights');
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="view-container settings-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">App Settings & Data Integrity Audit</h1>
          <p className="view-subtitle">
            Engine configurations, telemetry source parameters, and zero-synthetic-data compliance status.
          </p>
        </div>
      </div>

      <div className="settings-cards-grid">
        {/* Core Architectural Parameters */}
        <div className="card settings-card">
          <h2 className="card-heading">Ingestion & Telemetry Pipeline</h2>
          <div className="settings-kv-list">
            <div className="kv-row">
              <span className="kv-label">Ingestion Master Switch</span>
              <span className="badge-unsupported-sm">INGESTION_ENABLED=false (Freeze Mode)</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Traffic Provider</span>
              <span className="badge-live-sm">TomTom Traffic API v5 (India Covered)</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Disaster Warning Feed</span>
              <span className="badge-live-sm">NDMA SACHET CAP / RSS (Official)</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Weather Provider</span>
              <span className="badge-live-sm">WeatherAPI.com (Hyperlocal)</span>
            </div>
            <div className="kv-row">
              <span className="kv-label">Air Quality Integration</span>
              <span className="badge-unsupported-sm">Awaiting OpenAQ / CPCB API Key</span>
            </div>
          </div>
          <button
            type="button"
            className="action-btn-primary audit-modal-btn"
            onClick={onOpenSystemStatus}
            style={{ marginTop: '1.25rem' }}
          >
            Open Live Telemetry Diagnostics Modal 🖥️
          </button>
        </div>

        {/* Zero-Synthetic Data Compliance */}
        <div className="card settings-card">
          <h2 className="card-heading">Zero-Synthetic Compliance Checklist</h2>
          <ul className="compliance-checklist">
            <li>
              <span className="check-icon">✅</span>
              <span><strong>No Fabricated Weather:</strong> Unmonitored cities return explicit UNAVAILABLE states.</span>
            </li>
            <li>
              <span className="check-icon">✅</span>
              <span><strong>No Simulated Congestion:</strong> TomTom v5 incidents are strictly rendered from database records.</span>
            </li>
            <li>
              <span className="check-icon">✅</span>
              <span><strong>No Invented AQI Numbers:</strong> CAAQMS readings refuse to extrapolate without active sensor key.</span>
            </li>
            <li>
              <span className="check-icon">✅</span>
              <span><strong>Official Government Alerts:</strong> Only official NDMA SACHET CAP items are served.</span>
            </li>
            <li>
              <span className="check-icon">✅</span>
              <span><strong>Secret Exposure Zero-Tolerance:</strong> No API keys bundled in client code or Git repository.</span>
            </li>
          </ul>
        </div>

        {/* Local Storage & Device Preferences */}
        <div className="card settings-card">
          <h2 className="card-heading">Local Cache & Device Storage</h2>
          <p className="settings-subtext">
            MyArea24 stores your selected corridor preference and bookmarked insights in browser localStorage only.
          </p>

          {clearedNotice && (
            <div className="status-notice notice-success">
              ✅ Local cache cleared successfully.
            </div>
          )}

          <button
            type="button"
            className="action-btn-secondary"
            onClick={handleClearCache}
            style={{ marginTop: '1rem' }}
          >
            Clear Local Corridors & Bookmarks Cache 🗑️
          </button>
        </div>
      </div>
    </div>
  );
};
