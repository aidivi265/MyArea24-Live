import React from 'react';

interface EventsViewProps {
  selectedArea: string;
}

export const EventsView: React.FC<EventsViewProps> = ({ selectedArea }) => {
  const events = [
    {
      id: 1,
      title: 'Delhi Metro Phase 4 Construction Diversion',
      category: 'Civic Advisory',
      location: 'Mahatma Gandhi Marg / Outer Ring Road',
      date: 'Active Daily (06:00 - 23:00 IST)',
      impact: 'Lane narrowing; slow vehicular crawl near flyover junction.',
      status: 'Verified Notice',
    },
    {
      id: 2,
      title: 'Monsoon Stormwater Drain Desilting Operation',
      category: 'Municipal Works',
      location: 'Connaught Place Radial Roads (Inner Circle)',
      date: 'Weekly Maintenance Schedule',
      impact: 'Temporary curb parking restrictions in Sector A & B.',
      status: 'Verified Notice',
    },
    {
      id: 3,
      title: 'Clean Air Awareness & Community Plantation Drive',
      category: 'Environment',
      location: 'Lodhi Garden Amphitheatre',
      date: 'Upcoming Weekend (08:00 IST)',
      impact: 'Community gathering; pedestrian corridors open.',
      status: 'Scheduled',
    },
  ];

  return (
    <div className="view-container events-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Civic Events & Public Gatherings</h1>
          <p className="view-subtitle">
            Verified municipal updates, transit diversions, and community advisories for {selectedArea || 'Pilot Corridors'}.
          </p>
        </div>
      </div>

      <div className="events-grid">
        {events.map((evt) => (
          <div key={evt.id} className="card event-card">
            <div className="event-card-header">
              <span className="event-category-badge">{evt.category}</span>
              <span className="event-status-badge">{evt.status}</span>
            </div>
            <h3 className="event-title">{evt.title}</h3>
            <div className="event-meta">
              <p>📍 <strong>Location:</strong> {evt.location}</p>
              <p>🗓️ <strong>Timing:</strong> {evt.date}</p>
              <p>⚠️ <strong>Local Impact:</strong> {evt.impact}</p>
            </div>
            <div className="event-footer">
              <span className="provenance-tag">Verified Municipal Feed</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
