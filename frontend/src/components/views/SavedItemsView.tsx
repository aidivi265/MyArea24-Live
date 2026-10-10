import React, { useState, useEffect } from 'react';
import type { IntelligenceInsight } from '../../types/intelligence';

interface SavedItemsViewProps {
  onSelectInsight: (insight: IntelligenceInsight) => void;
  onNavigateHome: () => void;
}

const STORAGE_SAVED_INSIGHTS = 'myarea24_saved_insights';

export function getSavedInsights(): IntelligenceInsight[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_INSIGHTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleSaveInsight(insight: IntelligenceInsight): boolean {
  try {
    const list = getSavedInsights();
    const exists = list.some((i) => i.id === insight.id);
    let updated: IntelligenceInsight[];
    if (exists) {
      updated = list.filter((i) => i.id !== insight.id);
    } else {
      updated = [insight, ...list];
    }
    localStorage.setItem(STORAGE_SAVED_INSIGHTS, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export const SavedItemsView: React.FC<SavedItemsViewProps> = ({
  onSelectInsight,
  onNavigateHome,
}) => {
  const [savedList, setSavedList] = useState<IntelligenceInsight[]>([]);

  useEffect(() => {
    setSavedList(getSavedInsights());
  }, []);

  const handleRemove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedList.filter((item) => item.id !== id);
    setSavedList(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_INSIGHTS, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  return (
    <div className="view-container saved-items-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Saved Items & Bookmarked Alerts</h1>
          <p className="view-subtitle">
            Insights, advisories, and emergency bulletins saved to your local offline cache.
          </p>
        </div>
        <button type="button" className="action-btn-secondary" onClick={onNavigateHome}>
          ← Back to Live Feed
        </button>
      </div>

      {savedList.length === 0 ? (
        <div className="card empty-data-card">
          <p className="empty-title">No Saved Items Yet</p>
          <p className="empty-desc">
            You haven't bookmarked any intelligence insights yet. Click the bookmark icon on any insight card in the Live Intelligence Feed to pin it here for offline reference.
          </p>
          <button type="button" className="action-btn-primary" onClick={onNavigateHome} style={{ marginTop: '1rem' }}>
            Browse Live Intelligence Feed
          </button>
        </div>
      ) : (
        <div className="saved-items-grid">
          {savedList.map((item) => (
            <div
              key={item.id}
              className="card saved-item-card"
              onClick={() => onSelectInsight(item)}
              style={{ cursor: 'pointer' }}
            >
              <div className="saved-card-header">
                <span className={`severity-tag severity-${item.composite_severity}`}>
                  {item.composite_severity.toUpperCase()}
                </span>
                <button
                  type="button"
                  className="remove-bookmark-btn"
                  onClick={(e) => handleRemove(item.id, e)}
                  title="Remove from saved items"
                >
                  ✕ Remove
                </button>
              </div>
              <h3 className="saved-item-title">{item.headline}</h3>
              <p className="saved-item-summary">{item.summary}</p>
              <div className="saved-card-footer">
                <span>📍 {item.area.label}</span>
                <span className="view-evidence-link">Inspect Evidence →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
