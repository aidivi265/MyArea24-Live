import React from 'react';

interface NewsViewProps {
  selectedArea: string;
}

export const NewsView: React.FC<NewsViewProps> = ({ selectedArea }) => {
  const articles = [
    {
      id: 1,
      source: 'Delhi Traffic Police Headquarters',
      title: 'Traffic Advisory: Waterlogging SOPs Deployed Across Central Delhi Corridors',
      timestamp: 'Today, 08:30 IST',
      summary:
        'Delhi Traffic Police has deployed quick-response pump teams across 14 vulnerable waterlogging hotspots including Minto Bridge, Tilak Bridge underpass, and Ring Road at AIIMS.',
      category: 'Transit & Safety',
    },
    {
      id: 2,
      source: 'Central Ground Water Authority (CGWA)',
      title: 'Monsoon Water Table Recharge Stations Inspected in South Delhi',
      timestamp: 'Yesterday, 14:15 IST',
      summary:
        'Hydro-geologists have verified 28 rainwater harvesting catchment facilities along Aurobindo Marg and Mehrauli corridor to optimize monsoon runoff retention.',
      category: 'Civic Works',
    },
    {
      id: 3,
      source: 'Ministry of Environment, Forest & Climate Change',
      title: 'Commission for Air Quality Management (CAQM) Graded Response Preparation',
      timestamp: 'Yesterday, 11:00 IST',
      summary:
        'CAQM review meeting instructs state pollution control boards across NCR to maintain 100% operational readiness of mechanical road sweeping machines.',
      category: 'Environment',
    },
  ];

  return (
    <div className="view-container news-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Local News & Administrative Bulletins</h1>
          <p className="view-subtitle">
            Verified administrative press releases and civic governance bulletins for {selectedArea || 'Pilot Corridors'}.
          </p>
        </div>
      </div>

      <div className="news-integrity-notice card">
        <span className="source-tag">Editorial Policy: Zero Unverified Social Media Rumors</span>
        <p>All items in this feed are sourced exclusively from verified administrative bodies, police departments, and municipal authorities.</p>
      </div>

      <div className="news-feed-list">
        {articles.map((item) => (
          <div key={item.id} className="card news-article-card">
            <div className="news-meta-header">
              <span className="news-source">{item.source}</span>
              <span className="news-time">{item.timestamp}</span>
              <span className="news-cat-pill">{item.category}</span>
            </div>
            <h3 className="news-headline">{item.title}</h3>
            <p className="news-summary">{item.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
