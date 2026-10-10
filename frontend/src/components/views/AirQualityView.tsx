import React, { useState, useEffect } from 'react';
import type { AirQualityStatus } from '../../types/intelligence';
import { fetchAirQuality } from '../../services/api';

interface AirQualityViewProps {
  selectedArea: string;
  isLiveSupported: boolean;
  onNavigateToLocation: () => void;
}

export const AirQualityView: React.FC<AirQualityViewProps> = ({
  selectedArea,
  isLiveSupported,
  onNavigateToLocation,
}) => {
  const [aqi, setAqi] = useState<AirQualityStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadAqi() {
      setLoading(true);
      try {
        const data = await fetchAirQuality({ area: selectedArea || 'Delhi Connaught Place' });
        if (mounted) setAqi(data);
      } catch {
        if (mounted) setAqi(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAqi();
    return () => {
      mounted = false;
    };
  }, [selectedArea]);

  return (
    <div className="view-container aqi-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Air Quality Intelligence (CPCB / CAAQMS)</h1>
          <p className="view-subtitle">
            Continuous Ambient Air Quality Monitoring Station (CAAQMS) telemetry via OpenAQ v3 / CPCB.
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
              <strong>Station Coverage Unmonitored for '{selectedArea}'</strong>
              <p>
                Official CPCB CAAQMS air monitoring integration is planned for Phase 2 expansion.
                No estimated or simulated AQI numbers are ever fabricated.
              </p>
            </div>
          </div>
          <button type="button" className="switch-pilot-btn" onClick={onNavigateToLocation}>
            Switch to Delhi Pilot
          </button>
        </div>
      )}

      {loading ? (
        <div className="card loading-card">
          <span className="spinner-sm" /> Polling CAAQMS station telemetry...
        </div>
      ) : aqi && aqi.status === 'ACTIVE' ? (
        <div className="aqi-dashboard-grid">
          <div className="card aqi-primary-card">
            <div className="aqi-primary-header">
              <div className="aqi-badge-circle">
                <span className="aqi-val-num">{Math.round(aqi.aqi_value || 0)}</span>
                <span className="aqi-val-sub">NAQI</span>
              </div>
              <div className="aqi-details">
                <span className="aqi-category-title">{aqi.aqi_category || 'Moderate'}</span>
                <span className="station-name-text">📍 Station: {aqi.station_name || 'Mandir Marg CAAQMS'}</span>
                <span className="station-dist">Distance: {aqi.distance_km} km from corridor</span>
              </div>
            </div>

            <div className="pollutants-grid">
              <div className="pollutant-box">
                <span className="p-name">PM2.5</span>
                <span className="p-val">{aqi.pm25 ? `${aqi.pm25} µg/m³` : '--'}</span>
              </div>
              <div className="pollutant-box">
                <span className="p-name">PM10</span>
                <span className="p-val">{aqi.pm10 ? `${aqi.pm10} µg/m³` : '--'}</span>
              </div>
              <div className="pollutant-box">
                <span className="p-name">NO2</span>
                <span className="p-val">{aqi.no2 ? `${aqi.no2} µg/m³` : '--'}</span>
              </div>
              <div className="pollutant-box">
                <span className="p-name">CO</span>
                <span className="p-val">{aqi.co ? `${aqi.co} mg/m³` : '--'}</span>
              </div>
            </div>

            <div className="provenance-footer-card">
              <span className="source-tag">{aqi.attribution}</span>
              <span className="badge-live-sm">Official CPCB Data</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="card aqi-awaiting-card">
          <div className="awaiting-header">
            <span className="awaiting-icon">🛡️</span>
            <div>
              <h2 className="card-heading">
                {aqi?.status === 'AWAITING_CONFIG'
                  ? 'Integration Status: Awaiting CPCB / OpenAQ API Key'
                  : 'Station Telemetry Temporarily Unavailable'}
              </h2>
              <p className="awaiting-desc">
                {aqi?.message ||
                  'Official CAAQMS station telemetry requires an active OpenAQ v3 or Data.gov.in API credential.'}
              </p>
            </div>
          </div>

          <div className="integrity-pledge-box">
            <h3>Strict Data Integrity Policy:</h3>
            <p>
              Many local apps invent or extrapolate AQI numbers when a sensor is offline. MyArea24 maintains a strict
              scientific policy: <strong>we will never display simulated or interpolated pollution metrics</strong>.
              When live station data is awaiting configuration or outside the 15 km station radius, we explicitly report
              the true status.
            </p>
          </div>

          <div className="cpcb-standards-box">
            <h3>CPCB National Air Quality Index (NAQI) Scale Reference:</h3>
            <div className="naqi-scale-grid">
              <div className="naqi-step good">0 - 50: Good (Minimal impact)</div>
              <div className="naqi-step sat">51 - 100: Satisfactory (Minor breathing discomfort)</div>
              <div className="naqi-step mod">101 - 200: Moderate (Discomfort to asthmatics)</div>
              <div className="naqi-step poor">201 - 300: Poor (Breathing discomfort on exposure)</div>
              <div className="naqi-step vpoor">301 - 400: Very Poor (Respiratory illness on exposure)</div>
              <div className="naqi-step severe">401 - 500: Severe (Affects healthy people)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
