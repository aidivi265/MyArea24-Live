import React, { useState } from 'react';

interface StatusBannerProps {
  isLiveSupported?: boolean;
  selectedArea?: string;
  onChooseArea?: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  isLiveSupported = true,
  selectedArea = '',
  onChooseArea,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="location-prompt-banner" aria-label="Area Selection & Pilot Scope">
      <div className="location-prompt-inner">
        <div className="location-prompt-left">
          <div className="location-prompt-icon-circle">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
          <div className="location-prompt-text-group">
            <div className="location-prompt-header-row">
              <h2 className="location-prompt-title">
                {selectedArea ? `Current Area: ${selectedArea}` : 'Select Your Area in India'}
              </h2>
              {selectedArea ? (
                <span className={`location-status-badge ${isLiveSupported ? 'badge-live' : 'badge-expansion'}`}>
                  {isLiveSupported ? 'Pilot Scope Active' : 'Expansion Corridor'}
                </span>
              ) : (
                <span className="location-status-badge badge-required">
                  Location Required · Pilot Scope
                </span>
              )}
            </div>
            <p className="location-prompt-desc">
              {selectedArea
                ? `MyArea24 delivers verified, localized situational intelligence for ${selectedArea} across weather, road transit, and disaster feeds.`
                : 'MyArea24 delivers verified, localized situational intelligence for your district or pincode.'}
            </p>
          </div>
        </div>

        <div className="location-prompt-right">
          <button
            type="button"
            className="choose-area-btn"
            onClick={onChooseArea || (() => {
              window.location.hash = '#/location';
            })}
          >
            <span>{selectedArea ? 'Change Area' : 'Choose Area'}</span>
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </div>

      {/* Subtle Pilot Scope Architecture Details toggle */}
      <div className="location-prompt-footer">
        <button
          type="button"
          className="pilot-scope-toggle-link"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Hide Architecture & Pilot Scope Details ▲' : 'Inspect Pilot Scope & Telemetry Standards ▼'}
        </button>

        {isExpanded && (
          <div className="pilot-scope-details-drawer">
            <div className="detail-item">
              <strong>Pilot Scope Coverage:</strong> Live telemetry is active in Delhi NCR and Bengaluru corridors. Expansion areas operate with honest disclosure without synthetic fabrication.
            </div>
            <div className="detail-item">
              <strong>Telemetry Sources:</strong> WeatherAPI (meteorology), TomTom Traffic v5 (arterials), NDMA SACHET (disaster bulletins), and CPCB NAQI standards.
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default StatusBanner;
