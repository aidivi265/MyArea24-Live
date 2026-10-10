import React, { useState, useEffect } from 'react';
import type { WeatherStatus } from '../../types/intelligence';
import { fetchWeatherStatus } from '../../services/api';

interface WeatherViewProps {
  selectedArea: string;
  isLiveSupported: boolean;
  onNavigateToLocation: () => void;
}

export const WeatherView: React.FC<WeatherViewProps> = ({
  selectedArea,
  isLiveSupported,
  onNavigateToLocation,
}) => {
  const [weather, setWeather] = useState<WeatherStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadWeather() {
      setLoading(true);
      try {
        const data = await fetchWeatherStatus({ area: selectedArea || 'Delhi Connaught Place' });
        if (mounted) setWeather(data);
      } catch {
        if (mounted) setWeather(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadWeather();
    return () => {
      mounted = false;
    };
  }, [selectedArea]);

  return (
    <div className="view-container weather-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Weather Telemetry & Outlook</h1>
          <p className="view-subtitle">
            Hyperlocal meteorological telemetry ingested directly from WeatherAPI.com.
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
              <strong>Weather Ingestion Unmonitored for '{selectedArea}'</strong>
              <p>
                Live automated weather observation stations are currently active in Delhi NCR pilot corridors.
                We refuse to generate synthetic temperature or rain figures for unmonitored zones.
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
          <span className="spinner-sm" /> Loading meteorological observations...
        </div>
      ) : weather && weather.is_available ? (
        <div className="weather-dashboard-grid">
          {/* Main Weather Card */}
          <div className="card weather-primary-card">
            <div className="weather-primary-header">
              <span className="weather-icon-huge">
                {weather.condition_text?.toLowerCase().includes('rain')
                  ? '🌧️'
                  : weather.condition_text?.toLowerCase().includes('cloud')
                  ? '⛅'
                  : '☀️'}
              </span>
              <div className="weather-primary-temps">
                <span className="temp-huge">{weather.temperature_c}°C</span>
                <span className="condition-label">{weather.condition_text}</span>
                <span className="station-location-label">📍 {weather.location_name}</span>
              </div>
            </div>

            <div className="weather-metrics-row">
              <div className="metric-box">
                <span className="metric-title">Rainfall (1hr)</span>
                <span className="metric-val">{weather.precipitation_mm} mm</span>
                <span className="metric-sub">
                  {weather.precipitation_mm && weather.precipitation_mm > 5
                    ? '⚠️ Waterlogging Risk'
                    : 'Nominal'}
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-title">Humidity</span>
                <span className="metric-val">{weather.humidity ?? '--'}%</span>
                <span className="metric-sub">Relative moisture</span>
              </div>
              <div className="metric-box">
                <span className="metric-title">Wind Speed</span>
                <span className="metric-val">{weather.wind_kph ?? '--'} km/h</span>
                <span className="metric-sub">Surface anemometer</span>
              </div>
            </div>

            <div className="provenance-footer-card">
              <div className="provenance-left">
                <span className="source-tag">Source: {weather.source}</span>
                <span className="provenance-text">
                  Observed at:{' '}
                  <strong>
                    {weather.observed_at ? new Date(weather.observed_at).toLocaleString() : 'Recent'}
                  </strong>
                </span>
              </div>
              <span className="badge-live-sm">Raw Telemetry Verified</span>
            </div>
          </div>

          {/* Environmental Correlation Insight */}
          <div className="card weather-correlation-card">
            <h2 className="card-heading">Monsoon & Drainage Advisory</h2>
            <div className="advisory-content">
              {weather.precipitation_mm && weather.precipitation_mm > 0 ? (
                <div className="advisory-box alert-moderate">
                  <strong>⚠️ Active Precipitation Detected:</strong>
                  <p>
                    Accumulated rain of {weather.precipitation_mm} mm recorded in this corridor.
                    Deterministic correlation rules flag increased braking distances and potential underpass ponding.
                  </p>
                </div>
              ) : (
                <div className="advisory-box alert-good">
                  <strong>✅ Dry Road Conditions:</strong>
                  <p>
                    Zero active precipitation measured at the observation node. No monsoon-related traction hazards currently detected.
                  </p>
                </div>
              )}

              <div className="correlation-info-box">
                <h4>Deterministic Correlation Rules:</h4>
                <ul>
                  <li>Threshold: Rain ≥ 8.0 mm/hr triggers automatic traffic bottleneck correlation.</li>
                  <li>Spatial Radius: 5.0 km around observation node coordinates.</li>
                  <li>Time Window: 17:30 to 20:30 IST evening peak evaluation.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card empty-data-card">
          <p>{weather?.message || 'Weather observations currently unavailable for this area.'}</p>
        </div>
      )}
    </div>
  );
};
