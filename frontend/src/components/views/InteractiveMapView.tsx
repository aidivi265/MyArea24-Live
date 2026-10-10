import React, { useState, useEffect } from 'react';
import type { LocalityOption, TrafficIncident } from '../../types/intelligence';
import { fetchTrafficStatus, fetchWeatherStatus } from '../../services/api';

interface InteractiveMapViewProps {
  localities: LocalityOption[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  isLiveSupported: boolean;
}

export const InteractiveMapView: React.FC<InteractiveMapViewProps> = ({
  localities,
  selectedArea,
  onSelectArea,
  isLiveSupported,
}) => {
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [weatherInfo, setWeatherInfo] = useState<{ temp?: number; cond?: string; loc?: string } | null>(null);
  const [selectedPin, setSelectedPin] = useState<{
    type: 'locality' | 'traffic' | 'weather';
    title: string;
    subtitle: string;
    details: string;
    coords: [number, number];
  } | null>(null);

  const [showTraffic, setShowTraffic] = useState(true);
  const [showWeather, setShowWeather] = useState(true);
  const [showBBox, setShowBBox] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadMapData() {
      try {
        const [trafficResp, weatherResp] = await Promise.all([
          fetchTrafficStatus({ area: selectedArea || 'Delhi Connaught Place', limit: 20 }),
          fetchWeatherStatus({ area: selectedArea || 'Delhi Connaught Place' }),
        ]);

        if (mounted) {
          if (trafficResp.is_available) {
            setIncidents(trafficResp.incidents);
          } else {
            setIncidents([]);
          }
          if (weatherResp.is_available) {
            setWeatherInfo({
              temp: weatherResp.temperature_c ?? undefined,
              cond: weatherResp.condition_text ?? undefined,
              loc: weatherResp.location_name ?? undefined,
            });
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadMapData();
    return () => {
      mounted = false;
    };
  }, [selectedArea]);

  // Convert lat/lon to percentage position inside Delhi bounding area
  // Bounding box: minLon: 77.05, maxLon: 77.35, minLat: 28.45, maxLat: 28.75
  const toXY = (lat: number, lon: number): { x: number; y: number } => {
    const minLat = 28.45;
    const maxLat = 28.75;
    const minLon = 77.05;
    const maxLon = 77.35;

    const x = Math.min(Math.max(((lon - minLon) / (maxLon - minLon)) * 100, 5), 95);
    const y = Math.min(Math.max((1 - (lat - minLat) / (maxLat - minLat)) * 100, 5), 95);
    return { x, y };
  };

  return (
    <div className="view-container map-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Interactive Corridor Map</h1>
          <p className="view-subtitle">
            Geospatial visualization of pilot corridors, TomTom traffic incidents, and WeatherAPI observation nodes.
          </p>
        </div>
        <div className="map-view-controls">
          <label className="toggle-label">
            <input type="checkbox" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} />
            🚗 Traffic Incidents ({incidents.length})
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showWeather} onChange={(e) => setShowWeather(e.target.checked)} />
            ⛅ Weather Stations
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={showBBox} onChange={(e) => setShowBBox(e.target.checked)} />
            🔲 Pilot Bounding Box
          </label>
        </div>
      </div>

      {!isLiveSupported && (
        <div className="status-banner banner-unsupported">
          <div className="status-banner-content">
            <span className="status-banner-icon">⚠️</span>
            <div>
              <strong>Map Overlay Unavailable for '{selectedArea}'</strong>
              <p>
                Live spatial incident coordinates are restricted to Delhi NCR pilot corridors. Expansion localities display macro coordinates only.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="switch-pilot-btn"
            onClick={() => onSelectArea('Delhi Connaught Place')}
          >
            Switch to Delhi Pilot Map
          </button>
        </div>
      )}

      <div className="map-layout-grid">
        {/* Interactive Map Visual Stage */}
        <div className="map-stage-container">
          <div className="map-stage">
            {/* SVG Grid and Boundaries */}
            <svg className="map-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="gridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(203, 213, 225, 0.4)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#gridPattern)" />

              {/* Pilot BBox: [77.1500, 28.5200, 77.2600, 28.6200] */}
              {showBBox && (
                <rect
                  x="33"
                  y="43"
                  width="37"
                  height="33"
                  fill="rgba(59, 130, 246, 0.08)"
                  stroke="#2563eb"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
              )}

              {/* Primary Connecting Arterials */}
              <line x1="25" y1="50" x2="80" y2="50" stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="1,1" />
              <line x1="50" y1="20" x2="50" y2="85" stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="1,1" />
              <circle cx="50" cy="50" r="18" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
            </svg>

            {/* BBox Label */}
            {showBBox && (
              <div className="bbox-label" style={{ left: '34%', top: '44%' }}>
                PILOT TRAFFIC BBOX [77.15 - 77.26°E]
              </div>
            )}

            {/* Locality Markers */}
            {localities
              .filter((l) => l.is_live_supported !== false && l.state === 'Delhi')
              .map((loc) => {
                const pos = toXY(loc.latitude, loc.longitude);
                const isSelected = selectedArea.toLowerCase() === loc.name.toLowerCase();

                return (
                  <div
                    key={loc.id}
                    className={`map-pin locality-pin ${isSelected ? 'active' : ''}`}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onClick={() => {
                      onSelectArea(loc.name);
                      setSelectedPin({
                        type: 'locality',
                        title: loc.name,
                        subtitle: `${loc.city || 'Delhi'}, ${loc.state}`,
                        details: `Coordinates: ${loc.latitude.toFixed(4)}°N, ${loc.longitude.toFixed(4)}°E • Monitored Corridor`,
                        coords: [loc.latitude, loc.longitude],
                      });
                    }}
                    title={loc.name}
                  >
                    <span className="pin-pulse" />
                    <span className="pin-badge">📍 {loc.name.replace('Delhi ', '')}</span>
                  </div>
                );
              })}

            {/* Traffic Incident Pins */}
            {showTraffic &&
              incidents.map((inc) => {
                const pos = toXY(inc.latitude, inc.longitude);
                const delayMin = Math.round((inc.delay_seconds || 0) / 60);

                return (
                  <div
                    key={`inc-${inc.id}`}
                    className="map-pin incident-pin"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onClick={() => {
                      setSelectedPin({
                        type: 'traffic',
                        title: inc.road_name || 'Corridor Congestion',
                        subtitle: `TomTom v5 Incident #${inc.id}`,
                        details: `Estimated delay: ${delayMin} mins (${inc.delay_seconds}s) • Type: ${inc.incident_type} • Observed at: ${new Date(inc.observed_at).toLocaleTimeString()}`,
                        coords: [inc.latitude, inc.longitude],
                      });
                    }}
                    title={`${inc.road_name || 'Traffic'}: +${delayMin}m delay`}
                  >
                    <span className="pin-icon">🚗</span>
                    {delayMin > 0 && <span className="delay-badge">+{delayMin}m</span>}
                  </div>
                );
              })}

            {/* Weather Observation Pin */}
            {showWeather && weatherInfo && (
              <div
                className="map-pin weather-pin"
                style={{ left: '56%', top: '38%' }}
                onClick={() => {
                  setSelectedPin({
                    type: 'weather',
                    title: `Weather Station: ${weatherInfo.loc || 'Delhi Connaught Place'}`,
                    subtitle: 'WeatherAPI Live Telemetry',
                    details: `Condition: ${weatherInfo.cond || 'Nominal'} • Temperature: ${weatherInfo.temp}°C`,
                    coords: [28.6304, 77.2177],
                  });
                }}
              >
                <span className="pin-icon">⛅</span>
                <span className="weather-badge">{weatherInfo.temp}°C</span>
              </div>
            )}
          </div>

          <div className="map-legend">
            <div className="legend-item">
              <span className="legend-dot dot-locality" /> Monitored Pilot Corridor
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-traffic" /> TomTom Congestion Point
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-weather" /> WeatherAPI Observation Node
            </div>
            <div className="legend-item">
              <span className="legend-dot dot-bbox" /> Active Traffic Polling Boundary
            </div>
          </div>
        </div>

        {/* Selected Pin Telemetry Inspector */}
        <div className="map-telemetry-panel card">
          <h2 className="card-heading">Node Telemetry Inspector</h2>
          {selectedPin ? (
            <div className="telemetry-details">
              <div className="telemetry-type-badge">
                {selectedPin.type === 'locality' ? '📍 Pilot Corridor' : selectedPin.type === 'traffic' ? '🚗 TomTom Incident' : '⛅ Weather Station'}
              </div>
              <h3 className="telemetry-title">{selectedPin.title}</h3>
              <p className="telemetry-subtitle">{selectedPin.subtitle}</p>
              <div className="telemetry-meta">
                <p>{selectedPin.details}</p>
                <div className="coords-box">
                  <strong>GPS:</strong> {selectedPin.coords[0].toFixed(4)}°N, {selectedPin.coords[1].toFixed(4)}°E
                </div>
              </div>
              {selectedPin.type === 'locality' && (
                <button
                  type="button"
                  className="action-btn-primary select-corridor-btn"
                  onClick={() => onSelectArea(selectedPin.title)}
                >
                  Focus Feed on {selectedPin.title}
                </button>
              )}
            </div>
          ) : (
            <div className="telemetry-placeholder">
              <p>Click on any corridor pin, traffic bottleneck, or weather station on the map to inspect live raw coordinates and telemetry.</p>
              <div className="quick-stats">
                <div className="stat-pill">
                  <strong>{incidents.length}</strong>
                  <span>TomTom Incidents</span>
                </div>
                <div className="stat-pill">
                  <strong>5</strong>
                  <span>Pilot Corridors</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
