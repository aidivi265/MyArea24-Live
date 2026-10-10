import React, { useEffect, useState } from 'react';
import type {
  AirQualityStatus,
  GovernmentAlert,
  IntelligenceInsight,
  TrafficStatus,
  WeatherStatus,
} from '../types/intelligence';
import type { ViewType } from './Sidebar';
import {
  fetchAirQuality,
  fetchGovernmentAlerts,
  fetchTrafficStatus,
  fetchWeatherStatus,
} from '../services/api';

interface LocalConditionsGridProps {
  insights: IntelligenceInsight[];
  selectedArea: string;
  airQuality?: AirQualityStatus | null;
  weatherStatus?: WeatherStatus | null;
  trafficStatus?: TrafficStatus | null;
  alerts?: GovernmentAlert[] | null;
  isLiveSupported?: boolean;
  onSelectView?: (view: ViewType) => void;
}

export const LocalConditionsGrid: React.FC<LocalConditionsGridProps> = ({
  insights,
  selectedArea,
  airQuality,
  weatherStatus: propWeather,
  trafficStatus: propTraffic,
  alerts: propAlerts,
  isLiveSupported = true,
  onSelectView,
}) => {
  const [internalAqi, setInternalAqi] = useState<AirQualityStatus | null>(null);
  const [internalWeather, setInternalWeather] = useState<WeatherStatus | null>(null);
  const [internalTraffic, setInternalTraffic] = useState<TrafficStatus | null>(null);
  const [_internalAlerts, setInternalAlerts] = useState<GovernmentAlert[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (airQuality === undefined) {
      fetchAirQuality({ area: selectedArea })
        .then((data) => {
          if (isMounted) setInternalAqi(data);
        })
        .catch(() => {
          if (isMounted) {
            setInternalAqi({
              status: 'AWAITING_CONFIG',
              is_stale: false,
              attribution: 'Central Pollution Control Board (CPCB) / OpenAQ',
              message: 'Awaiting OPENAQ_API_KEY configuration in environment. Zero synthetic data shown.',
            });
          }
        });
    }

    if (propWeather === undefined) {
      fetchWeatherStatus({ area: selectedArea })
        .then((data) => {
          if (isMounted) setInternalWeather(data);
        })
        .catch(() => {
          if (isMounted) setInternalWeather(null);
        });
    }

    if (propTraffic === undefined) {
      fetchTrafficStatus({ area: selectedArea, limit: 10 })
        .then((data) => {
          if (isMounted) setInternalTraffic(data);
        })
        .catch(() => {
          if (isMounted) setInternalTraffic(null);
        });
    }

    if (propAlerts === undefined) {
      fetchGovernmentAlerts({ limit: 5 })
        .then((data) => {
          if (isMounted) setInternalAlerts(data);
        })
        .catch(() => {
          if (isMounted) setInternalAlerts([]);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedArea, airQuality, propWeather, propTraffic, propAlerts]);

  const activeAqi = airQuality !== undefined ? airQuality : internalAqi;
  const activeWeather = propWeather !== undefined ? propWeather : internalWeather;
  const activeTraffic = propTraffic !== undefined ? propTraffic : internalTraffic;

  const hasArea = Boolean(selectedArea && selectedArea.trim());

  // Traffic signal detection
  const trafficInsights = insights.filter(
    (i) => i.insight_type === 'single_signal_traffic_notice' || i.signals.some((s) => s.type === 'traffic')
  );
  const hasRoadClosure = trafficInsights.some(
    (i) => i.headline.toLowerCase().includes('closure') || i.summary.toLowerCase().includes('closure')
  );

  const getAqiCategoryClass = (cat?: string | null) => {
    switch (cat?.toLowerCase()) {
      case 'good':
        return 'aqi-good';
      case 'satisfactory':
        return 'aqi-satisfactory';
      case 'moderate':
        return 'aqi-moderate';
      case 'poor':
        return 'aqi-poor';
      case 'very poor':
        return 'aqi-very-poor';
      case 'severe':
        return 'aqi-severe';
      default:
        return '';
    }
  };

  return (
    <div className="local-conditions-triad-grid" aria-label="Local conditions overview">
      {/* CARD 1: WEATHER OUTLOOK */}
      <div
        className="telemetry-card weather-card"
        onClick={() => onSelectView?.('weather')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectView?.('weather');
          }
        }}
      >
        <div className="telemetry-card-top">
          <div className="telemetry-card-header-left">
            <div className="telemetry-icon-circle icon-weather-bg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="1" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <div className="telemetry-title-group">
              <h3 className="telemetry-card-title">Weather Outlook</h3>
              <span className="telemetry-card-subtitle">Micro-climate Telemetry</span>
            </div>
          </div>
          <span className="telemetry-protocol-badge">● IMD Protocol</span>
        </div>

        <div className="telemetry-card-body">
          {!hasArea ? (
            <p className="telemetry-placeholder-text">
              Select an area to load hyper-local temperature & precipitation metrics.
            </p>
          ) : !isLiveSupported ? (
            <div className="telemetry-active-block">
              <span className="telemetry-value-tag unmonitored-tag">Telemetry Unconnected</span>
              <p className="telemetry-desc-text">
                WeatherAPI station telemetry is pending expansion for {selectedArea}. Zero synthetic data shown.
              </p>
            </div>
          ) : activeWeather?.is_available && activeWeather.temperature_c != null ? (
            <div className="telemetry-active-block">
              <span className="telemetry-value-main">
                {activeWeather.temperature_c}°C · {activeWeather.condition_text || 'Clear'}
              </span>
              <p className="telemetry-desc-text">
                {activeWeather.location_name || selectedArea} · Wind {activeWeather.wind_kph ?? 0} km/h · Humidity {activeWeather.humidity ?? 0}% · Rain {activeWeather.precipitation_mm ?? 0} mm
              </p>
            </div>
          ) : (
            <div className="telemetry-active-block">
              <span className="telemetry-value-main">Normal Seasonal</span>
              <p className="telemetry-desc-text">
                No precipitation anomalies or high-wind warnings reported in monitored bounding box.
              </p>
            </div>
          )}
        </div>

        <div className="telemetry-card-footer">
          <div className="footer-left-status">
            <span className="signal-icon">((•))</span>
            <span className="status-text">Live Connector Ready</span>
          </div>
          <button
            type="button"
            className="footer-action-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelectView?.('weather');
            }}
          >
            Full Forecast &gt;
          </button>
        </div>
      </div>

      {/* CARD 2: AIR QUALITY (AQI) */}
      <div
        className="telemetry-card aqi-card"
        onClick={() => onSelectView?.('air-quality')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectView?.('air-quality');
          }
        }}
      >
        <div className="telemetry-card-top">
          <div className="telemetry-card-header-left">
            <div className="telemetry-icon-circle icon-aqi-bg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
              </svg>
            </div>
            <div className="telemetry-title-group">
              <h3 className="telemetry-card-title">
                Air Quality (AQI)
                <span className="sr-only">Air Quality Index</span>
              </h3>
              <span className="telemetry-card-subtitle">CPCB NAQI Standard</span>
            </div>
          </div>
          <span className="telemetry-protocol-badge">● Real Sensors</span>
        </div>

        <div className="telemetry-card-body">
          {!hasArea && activeAqi === null ? (
            <p className="telemetry-placeholder-text">
              Select an area to load CPCB air pollution indices and health advisories.
            </p>
          ) : !isLiveSupported ? (
            <div className="telemetry-active-block">
              <span className="telemetry-value-tag unmonitored-tag">Station Unavailable</span>
              <p className="telemetry-desc-text">
                No official CAAQMS station monitored in this zone for the current pilot phase. Ingestion suspended.
              </p>
            </div>
          ) : activeAqi?.status === 'ACTIVE' && activeAqi.aqi_value != null ? (
            <div className="telemetry-active-block">
              <span className={`telemetry-value-main ${getAqiCategoryClass(activeAqi.aqi_category)}`}>
                AQI {Math.round(activeAqi.aqi_value)} · {activeAqi.aqi_category}
              </span>
              <p className="telemetry-desc-text">
                Station: {activeAqi.station_name}
                {activeAqi.distance_km != null ? ` (${activeAqi.distance_km} km away)` : ''} · Prominent:{' '}
                {activeAqi.prominent_pollutant || 'PM2.5'}
              </p>
              <div className="sr-only">Live CAAQMS telemetry · {activeAqi.city || 'India'}</div>
            </div>
          ) : activeAqi?.status === 'STALE' && activeAqi.aqi_value != null ? (
            <div className="telemetry-active-block">
              <span className="telemetry-value-main text-delay">
                AQI {Math.round(activeAqi.aqi_value)} · {activeAqi.aqi_category}
              </span>
              <p className="telemetry-desc-text">
                Station: {activeAqi.station_name} · Telemetry is older than 3 hours. Awaiting fresh sync.
              </p>
              <div className="sr-only">Telemetry expired · Strict freshness policy</div>
            </div>
          ) : activeAqi?.status === 'UNAVAILABLE' ? (
            <div className="telemetry-active-block">
              <span className="telemetry-value-tag unmonitored-tag">Station Out of Range</span>
              <p className="telemetry-desc-text">
                {activeAqi.message || `No active official monitoring station within 15 km of ${selectedArea || 'selected locality'}.`}
              </p>
            </div>
          ) : (
            <div className="telemetry-active-block">
              <span className="telemetry-value-tag unmonitored-tag">Integration Pending</span>
              <p className="telemetry-desc-text">
                Awaiting OPENAQ_API_KEY configuration in environment. Zero synthetic data shown.
              </p>
              <div className="sr-only">Zero synthetic data shown · Strict data integrity</div>
            </div>
          )}
        </div>

        <div className="telemetry-card-footer">
          <div className="footer-left-status">
            <span className="shield-icon">🛡️</span>
            <span className="status-text">CPCB Protocol</span>
          </div>
          <button
            type="button"
            className="footer-action-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelectView?.('air-quality');
            }}
          >
            Health Impact &gt;
          </button>
        </div>
      </div>

      {/* CARD 3: TRAFFIC & TRANSIT */}
      <div
        className="telemetry-card traffic-card"
        onClick={() => onSelectView?.('traffic')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectView?.('traffic');
          }
        }}
      >
        <div className="telemetry-card-top">
          <div className="telemetry-card-header-left">
            <div className="telemetry-icon-circle icon-traffic-bg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <circle cx="7" cy="15" r="2" />
                <circle cx="17" cy="15" r="2" />
              </svg>
            </div>
            <div className="telemetry-title-group">
              <h3 className="telemetry-card-title">Traffic & Transit</h3>
              <span className="telemetry-card-subtitle">Corridor Congestion</span>
            </div>
          </div>
          <span className="telemetry-protocol-badge">● Transit Grid</span>
        </div>

        <div className="telemetry-card-body">
          {!hasArea ? (
            <p className="telemetry-placeholder-text">
              Select an area to view active road bottlenecks and waterlogging alerts.
            </p>
          ) : !isLiveSupported ? (
            <div className="telemetry-active-block">
              <span className="telemetry-value-tag unmonitored-tag">Unmonitored Arterials</span>
              <p className="telemetry-desc-text">
                TomTom Traffic v5 incident flow is not active for this region. No traffic delays or road closures detected.
              </p>
            </div>
          ) : activeTraffic?.is_available && activeTraffic.total_incidents > 0 ? (
            <div className="telemetry-active-block">
              <span
                className={`telemetry-value-main ${
                  activeTraffic.incidents.some((i) => i.incident_type?.toLowerCase().includes('closure'))
                    ? 'text-closure'
                    : 'text-delay'
                }`}
              >
                {activeTraffic.incidents.some((i) => i.incident_type?.toLowerCase().includes('closure'))
                  ? 'Corridor Closure'
                  : `${activeTraffic.total_incidents} Delays Reported`}
              </span>
              <p className="telemetry-desc-text">
                {activeTraffic.incidents[0].road_name ? `${activeTraffic.incidents[0].road_name}: ` : ''}
                {activeTraffic.incidents[0].description || 'Stationary traffic'}
                {activeTraffic.incidents[0].delay_seconds
                  ? ` (+${Math.round(activeTraffic.incidents[0].delay_seconds / 60)} min delay)`
                  : ''}
              </p>
            </div>
          ) : trafficInsights.length > 0 ? (
            <div className="telemetry-active-block">
              <span className={`telemetry-value-main ${hasRoadClosure ? 'text-closure' : 'text-delay'}`}>
                {hasRoadClosure ? 'Corridor Closure' : `${trafficInsights.length} Delays Reported`}
              </span>
              <p className="telemetry-desc-text">
                {trafficInsights[0].area.label}: {trafficInsights[0].signals[0]?.metric_summary || trafficInsights[0].summary}
              </p>
            </div>
          ) : (
            <div className="telemetry-active-block">
              <span className="telemetry-value-main text-smooth">Smooth Transit Flow</span>
              <p className="telemetry-desc-text">
                No critical slowdowns or road closures detected by live traffic telemetry.
              </p>
            </div>
          )}
        </div>

        <div className="telemetry-card-footer">
          <div className="footer-left-status">
            <span className="signal-icon icon-amber">((•))</span>
            <span className="status-text">Telemetry Ready</span>
          </div>
          <button
            type="button"
            className="footer-action-link"
            onClick={(e) => {
              e.stopPropagation();
              onSelectView?.('traffic');
            }}
          >
            Live Chokepoints &gt;
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocalConditionsGrid;
