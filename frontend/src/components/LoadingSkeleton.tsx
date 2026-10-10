import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="skeleton-feed" aria-busy="true" aria-label="Loading local intelligence insights">
      {[1, 2, 3].map((n) => (
        <div key={n} className="skeleton-card">
          <div className="skeleton-row top-row">
            <div className="skeleton-badge shimmer"></div>
            <div className="skeleton-badge small shimmer"></div>
          </div>
          <div className="skeleton-title shimmer"></div>
          <div className="skeleton-meta shimmer"></div>
          <div className="skeleton-line shimmer"></div>
          <div className="skeleton-line short shimmer"></div>
          <div className="skeleton-box shimmer"></div>
        </div>
      ))}
    </div>
  );
};
