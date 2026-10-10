import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TopNav } from './components/TopNav';
import { Sidebar } from './components/Sidebar';
import type { ViewType } from './components/Sidebar';
import { StatusBanner } from './components/StatusBanner';
import { LocalitySelector } from './components/LocalitySelector';
import { IntelligenceBrief } from './components/IntelligenceBrief';
import { LocalConditionsGrid } from './components/LocalConditionsGrid';
import { FilterBar } from './components/FilterBar';
import { InsightCard } from './components/InsightCard';
import { InsightDetailModal } from './components/InsightDetailModal';
import { EmergencyHubModal } from './components/EmergencyHubModal';
import { SystemStatusModal } from './components/SystemStatusModal';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';

// View Components
import { LocationView } from './components/views/LocationView';
import { AssistantView } from './components/views/AssistantView';
import { InteractiveMapView } from './components/views/InteractiveMapView';
import { WeatherView } from './components/views/WeatherView';
import { TrafficView } from './components/views/TrafficView';
import { AirQualityView } from './components/views/AirQualityView';
import { AlertsView } from './components/views/AlertsView';
import { EmergencyView } from './components/views/EmergencyView';
import { EventsView } from './components/views/EventsView';
import { NewsView } from './components/views/NewsView';
import { ServicesView } from './components/views/ServicesView';
import { MarketView } from './components/views/MarketView';
import { SavedItemsView } from './components/views/SavedItemsView';
import { SettingsView } from './components/views/SettingsView';
import { GlobalSearchView } from './components/views/GlobalSearchView';

import type {
  InsightFilters,
  IntelligenceInsight,
  LocalityOption,
} from './types/intelligence';
import { fetchInsights, fetchLocalities } from './services/api';
import { getSavedLocation, saveSelectedLocation } from './services/useGeolocation';

const VALID_VIEWS: ViewType[] = [
  'dashboard',
  'location',
  'search',
  'assistant',
  'map',
  'weather',
  'traffic',
  'air-quality',
  'alerts',
  'emergency',
  'events',
  'news',
  'businesses',
  'market',
  'saved',
  'settings',
];

export const App: React.FC = () => {
  const [localities, setLocalities] = useState<LocalityOption[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>(() => getSavedLocation() || '');
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [filters, setFilters] = useState<InsightFilters>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [insights, setInsights] = useState<IntelligenceInsight[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [selectedInsight, setSelectedInsight] = useState<IntelligenceInsight | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('');

  // Modals & Navigation state
  const [emergencyModalOpen, setEmergencyModalOpen] = useState<boolean>(false);
  const [systemStatusModalOpen, setSystemStatusModalOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Hash Routing Sync
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.replace(/^#\/?/, '').trim() as ViewType;
      if (VALID_VIEWS.includes(h)) {
        setActiveView(h);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectView = (view: ViewType) => {
    setActiveView(view);
    window.location.hash = `#/${view}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Initial Load: Fetch Localities
  useEffect(() => {
    let mounted = true;
    async function loadLocalities() {
      try {
        const locs = await fetchLocalities();
        if (mounted) {
          setLocalities(locs);
        }
      } catch (err) {
        console.warn('Using default pilot localities due to fetch error:', err);
      }
    }
    loadLocalities();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch Insights Handler
  const loadInsights = useCallback(
    async (
      activeFilters: InsightFilters,
      page: number = 1,
      isBackgroundSync: boolean = false
    ) => {
      if (!isBackgroundSync) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await fetchInsights(activeFilters, page, pageSize);
        setInsights(response.items);
        setTotalResults(response.total);
        setCurrentPage(response.page);
        setBackendConnected(true);
        setLastCheckedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown network failure occurred.';
        setError(msg);
        setBackendConnected(false);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [pageSize]
  );

  // 3. Trigger fetch on filters or page change
  useEffect(() => {
    loadInsights(filters, currentPage);
  }, [filters, currentPage, loadInsights]);

  // 4. Area selection handler
  const handleSelectArea = (area: string) => {
    setSelectedArea(area);
    saveSelectedLocation(area);
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      area: area || undefined,
    }));
  };

  // 5. Filter change handler
  const handleFilterChange = (newFilters: InsightFilters) => {
    setCurrentPage(1);
    setFilters({
      ...newFilters,
      area: selectedArea || undefined,
    });
  };

  // 6. Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInsights(filters, currentPage, true);
  };

  // 7. Clear all filters
  const handleClearFilters = () => {
    setCurrentPage(1);
    setSearchQuery('');
    setFilters({
      area: selectedArea || undefined,
    });
  };

  // 8. Sidebar Category Filter selection
  const handleSelectSidebarFilter = (type: string | undefined) => {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      insight_type: type,
    }));
    handleSelectView('dashboard');
  };

  // Client-side search filtering over retrieved insights
  const displayedInsights = useMemo(() => {
    if (!searchQuery.trim()) {
      return insights;
    }
    const q = searchQuery.toLowerCase().trim();
    return insights.filter((item) => {
      return (
        item.headline.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.area.label.toLowerCase().includes(q) ||
        (item.potential_impact && item.potential_impact.toLowerCase().includes(q)) ||
        (item.recommendation && item.recommendation.toLowerCase().includes(q)) ||
        item.signals.some((s) => s.metric_summary?.toLowerCase().includes(q))
      );
    });
  }, [insights, searchQuery]);

  const currentLocality = useMemo(() => {
    if (!selectedArea) return null;
    return localities.find(
      (l) => l.name.toLowerCase() === selectedArea.toLowerCase()
    ) || null;
  }, [localities, selectedArea]);

  const isLiveSupported = currentLocality ? (currentLocality.is_live_supported !== false) : true;
  const totalPages = Math.ceil(totalResults / pageSize) || 1;

  return (
    <div className="app-shell">
      <a href="#main-dashboard" className="skip-nav-link">
        Skip to main content
      </a>

      {/* Top Navigation Bar */}
      <TopNav
        localities={localities}
        selectedArea={selectedArea}
        onSelectArea={handleSelectArea}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        backendConnected={backendConnected}
        onOpenEmergency={() => setEmergencyModalOpen(true)}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeView={activeView}
        onSelectView={handleSelectView}
      />

      <div className="dashboard-container">
        {/* Left Sidebar Navigation */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeView={activeView}
          onSelectView={handleSelectView}
          activeFilterType={filters.insight_type}
          onSelectFilterType={handleSelectSidebarFilter}
          onOpenEmergency={() => setEmergencyModalOpen(true)}
          onOpenSystemStatus={() => setSystemStatusModalOpen(true)}
          selectedArea={selectedArea}
          onSelectArea={handleSelectArea}
        />

        {/* Main Content Router */}
        <main id="main-dashboard" className="main-content" tabIndex={-1}>
          {activeView === 'dashboard' && (
            <>
              {/* Pilot Scope & Telemetry Notice */}
              <StatusBanner
                isLiveSupported={isLiveSupported}
                selectedArea={selectedArea}
                onChooseArea={() => handleSelectView('location')}
              />

              {/* Editorial Local Intelligence Brief */}
              <IntelligenceBrief
                insights={insights}
                selectedArea={selectedArea}
                totalResults={totalResults}
                isLiveSupported={isLiveSupported}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
              />

              {/* Local Conditions Grid (Weather, Traffic, Government Alerts, Air Quality) */}
              <LocalConditionsGrid
                insights={insights}
                selectedArea={selectedArea}
                isLiveSupported={isLiveSupported}
                onSelectView={handleSelectView}
              />

              {/* Quick Locality Selector Pills */}
              <LocalitySelector
                localities={localities}
                selectedArea={selectedArea}
                onSelectArea={handleSelectArea}
              />

              {/* Feed Filter Bar */}
              <FilterBar
                filters={filters}
                onFilterChange={handleFilterChange}
                totalResults={searchQuery ? displayedInsights.length : totalResults}
              />

              {/* Search notice if search active */}
              {searchQuery && (
                <div className="search-status-bar">
                  <span>Filtering for: <strong>"{searchQuery}"</strong> ({displayedInsights.length} matching insights)</span>
                  <button
                    type="button"
                    className="clear-search-link"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search ✕
                  </button>
                </div>
              )}

              {/* Intelligence Feed List */}
              <section className="feed-section" aria-live="polite">
                {loading && insights.length === 0 ? (
                  <LoadingSkeleton />
                ) : error && insights.length === 0 ? (
                  <ErrorState
                    errorMessage={error}
                    onRetry={() => loadInsights(filters, 1)}
                  />
                ) : displayedInsights.length === 0 ? (
                  <EmptyState
                    hasFilters={Boolean(filters.insight_type || filters.severity || filters.confidence || searchQuery)}
                    selectedArea={selectedArea}
                    onClearFilters={handleClearFilters}
                    lastCheckedTime={lastCheckedTime}
                    isLiveSupported={isLiveSupported}
                  />
                ) : (
                  <>
                    <div className="insights-grid" role="feed" aria-label="Local intelligence insights">
                      {displayedInsights.map((insight) => (
                        <InsightCard
                          key={insight.id}
                          insight={insight}
                          onSelect={setSelectedInsight}
                        />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <nav className="pagination-bar" aria-label="Insights pagination">
                        <button
                          type="button"
                          disabled={currentPage <= 1 || loading}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="pagination-btn"
                        >
                          ← Previous
                        </button>
                        <span className="pagination-info">
                          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                        </span>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages || loading}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="pagination-btn"
                        >
                          Next →
                        </button>
                      </nav>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {activeView === 'location' && (
            <LocationView
              localities={localities}
              selectedArea={selectedArea}
              onSelectArea={handleSelectArea}
              onNavigateHome={() => handleSelectView('dashboard')}
            />
          )}

          {activeView === 'assistant' && (
            <AssistantView
              selectedArea={selectedArea}
              isLiveSupported={isLiveSupported}
              onNavigateToLocation={() => handleSelectView('location')}
            />
          )}

          {activeView === 'map' && (
            <InteractiveMapView
              localities={localities}
              selectedArea={selectedArea}
              onSelectArea={handleSelectArea}
              isLiveSupported={isLiveSupported}
            />
          )}

          {activeView === 'weather' && (
            <WeatherView
              selectedArea={selectedArea}
              isLiveSupported={isLiveSupported}
              onNavigateToLocation={() => handleSelectView('location')}
            />
          )}

          {activeView === 'traffic' && (
            <TrafficView
              selectedArea={selectedArea}
              isLiveSupported={isLiveSupported}
              onNavigateToLocation={() => handleSelectView('location')}
            />
          )}

          {activeView === 'air-quality' && (
            <AirQualityView
              selectedArea={selectedArea}
              isLiveSupported={isLiveSupported}
              onNavigateToLocation={() => handleSelectView('location')}
            />
          )}

          {activeView === 'alerts' && (
            <AlertsView selectedArea={selectedArea} />
          )}

          {activeView === 'emergency' && (
            <EmergencyView selectedArea={selectedArea} />
          )}

          {activeView === 'events' && (
            <EventsView selectedArea={selectedArea} />
          )}

          {activeView === 'news' && (
            <NewsView selectedArea={selectedArea} />
          )}

          {activeView === 'businesses' && (
            <ServicesView selectedArea={selectedArea} />
          )}

          {activeView === 'market' && (
            <MarketView selectedArea={selectedArea} />
          )}

          {activeView === 'saved' && (
            <SavedItemsView
              onSelectInsight={setSelectedInsight}
              onNavigateHome={() => handleSelectView('dashboard')}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              onOpenSystemStatus={() => setSystemStatusModalOpen(true)}
            />
          )}

          {activeView === 'search' && (
            <GlobalSearchView
              insights={insights}
              localities={localities}
              onSelectInsight={setSelectedInsight}
              onSelectLocality={handleSelectArea}
              onNavigateView={handleSelectView}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <InsightDetailModal
        insight={selectedInsight}
        onClose={() => setSelectedInsight(null)}
      />

      <EmergencyHubModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
      />

      <SystemStatusModal
        isOpen={systemStatusModalOpen}
        onClose={() => setSystemStatusModalOpen(false)}
        backendConnected={backendConnected}
        lastCheckedTime={lastCheckedTime}
        totalInsightsCount={totalResults}
      />

      {/* Editorial Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="footer-brand">
              <span className="footer-logo">▲</span>
              <strong>MyArea24</strong>
              <span className="footer-badge">India Pilot v0.3</span>
            </div>
            <p className="footer-desc">
              Deterministic, evidence-backed Local Intelligence Network for India. Correlating meteorological hazards, road bottlenecks, and disaster management bulletins with zero synthetic data.
            </p>
          </div>
          <div className="footer-right">
            <div className="footer-col">
              <strong>Pilot Bounding Zones</strong>
              <span>Delhi NCR (AIIMS, Connaught Place)</span>
              <span>Bengaluru (Silk Board, Outer Ring Road)</span>
            </div>
            <div className="footer-col">
              <strong>Integrated Telemetry</strong>
              <span>WeatherAPI · TomTom v5 · NDMA SACHET</span>
              <span className="cpcb-tag">CPCB AQI: Phase 2 Planned</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
