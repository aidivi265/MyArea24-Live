import React, { useState, useEffect } from 'react';
import type { GovernmentAlert } from '../../services/api';
import { fetchGovernmentAlerts } from '../../services/api';

interface AlertsViewProps {
  selectedArea: string;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ selectedArea }) => {
  const [alerts, setAlerts] = useState<GovernmentAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    async function loadAlerts() {
      setLoading(true);
      try {
        const data = await fetchGovernmentAlerts({ is_active: true, limit: 30 });
        if (mounted) setAlerts(data);
      } catch {
        if (mounted) setAlerts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAlerts();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = alerts.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.headline.toLowerCase().includes(q) ||
      a.area_description.toLowerCase().includes(q) ||
      a.sender.toLowerCase().includes(q) ||
      a.event_type.toLowerCase().includes(q)
    );
  });

  return (
    <div className="view-container alerts-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Government Alerts & Disaster Bulletins</h1>
          <p className="view-subtitle">
            Official Common Alerting Protocol (CAP) feeds ingested from National Disaster Management Authority (NDMA SACHET) for {selectedArea || 'All Corridors'}.
          </p>
        </div>
        <div className="catalog-search">
          <input
            type="text"
            className="search-input"
            placeholder="Search alerts by state, district, or disaster type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="alerts-meta-banner card">
        <div className="banner-left">
          <span className="source-tag">Feed Provider: NDMA SACHET (CAP / RSS)</span>
          <span className="meta-text">
            Official emergency notices issued by State Disaster Management Authorities (SDMAs) & IMD.
          </span>
        </div>
        <span className="badge-live-sm">Real Government Data</span>
      </div>

      {loading ? (
        <div className="card loading-card">
          <span className="spinner-sm" /> Polling NDMA SACHET CAP repository...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-data-card">
          <p>No active government disaster notices matching your search criteria.</p>
        </div>
      ) : (
        <div className="alerts-feed-grid">
          {filtered.map((item) => (
            <div key={item.id} className="card gov-alert-card">
              <div className="gov-alert-header">
                <div className="alert-badge-group">
                  <span className={`severity-tag severity-${item.severity.toLowerCase()}`}>
                    {item.severity}
                  </span>
                  <span className="urgency-tag">{item.urgency} Urgency</span>
                </div>
                <span className="alert-sender">{item.sender}</span>
              </div>

              <h2 className="gov-alert-headline">{item.headline}</h2>

              {item.description && (
                <p className="gov-alert-desc">{item.description}</p>
              )}

              {item.instruction && (
                <div className="gov-instruction-box">
                  <strong>Citizen Directive:</strong> {item.instruction}
                </div>
              )}

              <div className="gov-alert-footer">
                <div className="area-box">
                  📍 <strong>Impact Area:</strong> {item.area_description}
                </div>
                <div className="time-box">
                  Expires: <strong>{new Date(item.expires_at).toLocaleString()}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
