import React, { useEffect } from 'react';

interface SystemStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  backendConnected: boolean;
  lastCheckedTime?: string;
  totalInsightsCount: number;
}

export const SystemStatusModal: React.FC<SystemStatusModalProps> = ({
  isOpen,
  onClose,
  backendConnected,
  lastCheckedTime,
  totalInsightsCount,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-status-title"
    >
      <div className="modal-container system-status-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="telemetry-status-tag">🖥️ TELEMETRY AUDIT</span>
            <h2 id="system-status-title" className="modal-headline">
              Signal Engine Health & Provenance Audit
            </h2>
            <p className="modal-subheading">
              Real-time operational status of all data pipelines, deterministic correlation rules, and pilot boundaries.
            </p>
          </div>
          <button
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Operational Overview Bar */}
          <div className="telemetry-overview-bar">
            <div className="overview-item">
              <span className="overview-label">Engine Connection</span>
              <div className="overview-status-wrap">
                <span className={`status-dot ${backendConnected ? 'connected' : 'disconnected'}`}></span>
                <strong>{backendConnected ? 'Live & Synchronized' : 'Reconnecting...'}</strong>
              </div>
            </div>

            <div className="overview-item">
              <span className="overview-label">Active Insights</span>
              <strong className="overview-val">{totalInsightsCount} Verified</strong>
            </div>

            <div className="overview-item">
              <span className="overview-label">Last Sync (IST)</span>
              <strong className="overview-val">{lastCheckedTime || 'Just now'}</strong>
            </div>

            <div className="overview-item">
              <span className="overview-label">Engine Rule Version</span>
              <strong className="overview-val">Deterministic 1.0</strong>
            </div>
          </div>

          {/* Provider Telemetry Table */}
          <div className="provider-telemetry-section">
            <h3 className="section-subheading">Active Upstream Ingestion Pipelines</h3>
            <div className="provider-grid">
              {/* WeatherAPI */}
              <div className="provider-card">
                <div className="provider-head">
                  <div>
                    <h4 className="provider-name">WeatherAPI Ingestion</h4>
                    <span className="provider-cadence">Polling: Every 15 min</span>
                  </div>
                  <span className="provider-status-badge live">Operational</span>
                </div>
                <p className="provider-desc">
                  Precipitation intensity (mm/h), wind speed, temperature, and severe storm alerts mapped to pilot bounding boxes.
                </p>
                <div className="provider-meta">
                  <span>Standardized: <code>weather_v1</code></span>
                  <span>Normalization: Metric SI</span>
                </div>
              </div>

              {/* TomTom Traffic v5 */}
              <div className="provider-card">
                <div className="provider-head">
                  <div>
                    <h4 className="provider-name">TomTom Traffic v5</h4>
                    <span className="provider-cadence">Polling: Every 5 min</span>
                  </div>
                  <span className="provider-status-badge live">Operational</span>
                </div>
                <p className="provider-desc">
                  Live traffic incident details v5: delay seconds, roadway closures, jammed corridor lengths, and criticality ratings.
                </p>
                <div className="provider-meta">
                  <span>Standardized: <code>traffic_v1</code></span>
                  <span>Geometry: Corridor Bounding Box</span>
                </div>
              </div>

              {/* NDMA SACHET */}
              <div className="provider-card">
                <div className="provider-head">
                  <div>
                    <h4 className="provider-name">NDMA SACHET (CAP / RSS)</h4>
                    <span className="provider-cadence">Polling: Every 10 min</span>
                  </div>
                  <span className="provider-status-badge live">Operational</span>
                </div>
                <p className="provider-desc">
                  Government CAP XML emergency alerts: disaster bulletins, flood alerts, and administrative safety warnings.
                </p>
                <div className="provider-meta">
                  <span>Standardized: <code>public_alert_v1</code></span>
                  <span>Security: Defused XML parsing</span>
                </div>
              </div>

              {/* CPCB Air Quality (Planned) */}
              <div className="provider-card provider-card-planned">
                <div className="provider-head">
                  <div>
                    <h4 className="provider-name">CPCB National AQI</h4>
                    <span className="provider-cadence">Phase 2 Scheduled</span>
                  </div>
                  <span className="provider-status-badge planned">Roadmap</span>
                </div>
                <p className="provider-desc">
                  Continuous ambient air quality monitoring (CPCB / SAFAR). Inactive in Phase 1 pilot to ensure zero unverified data.
                </p>
                <div className="provider-meta">
                  <span>Standardized: <code>aqi_v1</code></span>
                  <span>Integrity: Zero Synthetic Data</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pilot Corridor Bounding Rules */}
          <div className="bounding-rules-box">
            <h4 className="bounding-rules-title">📍 Pilot Corridor Boundaries & Scope</h4>
            <div className="corridor-tags">
              <span className="corridor-tag">Delhi: Ring Road (AIIMS corridor)</span>
              <span className="corridor-tag">Delhi: Connaught Place & Central arterials</span>
              <span className="corridor-tag">Bengaluru: Silk Board Junction</span>
              <span className="corridor-tag">Bengaluru: Outer Ring Road</span>
            </div>
            <p className="bounding-note">
              Telemetry outside these bounding coordinates is excluded during the pilot phase to prevent false positives and maintain 100% ground-truth verification.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Close Telemetry Audit
          </button>
        </div>
      </div>
    </div>
  );
};
