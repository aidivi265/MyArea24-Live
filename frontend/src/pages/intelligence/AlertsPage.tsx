import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  MapPin,
  Search,
  LocateFixed,
  RefreshCw,
  Loader2,
  X,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Filter,
  Radio,
  ExternalLink,
} from 'lucide-react'
import { intelligenceApi, locationApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { formatDate, formatTime, cn } from '@/utils'
import type { LocationResult, GovernmentAlert } from '@/types'

const POPULAR_HUBS = [
  { name: 'Ghaziabad (AKGEC)', lat: 28.6757, lon: 77.5020 },
  { name: 'Delhi Connaught Place', lat: 28.6304, lon: 77.2177 },
  { name: 'Noida Sector 62', lat: 28.6280, lon: 77.3649 },
  { name: 'Gurugram Cyber City', lat: 28.4952, lon: 77.0892 },
  { name: 'Bengaluru Indiranagar', lat: 12.9784, lon: 77.6408 },
  { name: 'Mumbai BKC', lat: 19.0657, lon: 72.8679 },
  { name: 'Lucknow Hazratganj', lat: 26.8467, lon: 80.9462 },
  { name: 'Patna City', lat: 25.6093, lon: 85.1235 },
]

type ScopeMode = 'LOCAL' | 'ALL_INDIA'
type SeverityFilter = 'ALL' | 'EXTREME' | 'SEVERE' | 'MODERATE' | 'MINOR'

const SEV_CARD_THEMES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  Extreme: {
    border: 'border-l-4 border-red-600 border-t border-r border-b border-red-200',
    bg: 'bg-gradient-to-r from-red-50/80 to-white',
    badge: 'bg-red-600 text-white font-black',
    text: 'text-red-900',
  },
  Severe: {
    border: 'border-l-4 border-orange-500 border-t border-r border-b border-orange-200',
    bg: 'bg-gradient-to-r from-orange-50/80 to-white',
    badge: 'bg-orange-500 text-white font-bold',
    text: 'text-orange-950',
  },
  Moderate: {
    border: 'border-l-4 border-amber-500 border-t border-r border-b border-amber-200',
    bg: 'bg-gradient-to-r from-amber-50/60 to-white',
    badge: 'bg-amber-500 text-white font-semibold',
    text: 'text-amber-950',
  },
  Minor: {
    border: 'border-l-4 border-blue-500 border-t border-r border-b border-blue-200',
    bg: 'bg-gradient-to-r from-blue-50/50 to-white',
    badge: 'bg-blue-500 text-white font-medium',
    text: 'text-blue-950',
  },
}

export default function AlertsPage() {
  const { selectedArea, selectedLat, selectedLon, setLocation } = useLocationStore()

  // Active target location for alerts
  const [activeLocation, setActiveLocation] = useState<{
    area: string
    lat: number | null
    lon: number | null
  }>({
    area: selectedArea || 'Ghaziabad (AKGEC)',
    lat: selectedLat ?? 28.6757,
    lon: selectedLon ?? 77.5020,
  })

  // Sync when global store changes
  useEffect(() => {
    if (selectedArea) {
      setActiveLocation({
        area: selectedArea,
        lat: selectedLat ?? null,
        lon: selectedLon ?? null,
      })
    }
  }, [selectedArea, selectedLat, selectedLon])

  // Scope mode: Local vs All-India
  const [scopeMode, setScopeMode] = useState<ScopeMode>('LOCAL')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [locatingUser, setLocatingUser] = useState(false)

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await locationApi.search(searchQuery.trim())
        setSearchResults(res || [])
        setShowDropdown(true)
      } catch (e) {
        console.error('Location search failed:', e)
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Select location from search or pills
  const handleSelectLocation = (loc: { name: string; lat: number; lon: number }) => {
    setActiveLocation({ area: loc.name, lat: loc.lat, lon: loc.lon })
    setLocation(loc.name, loc.lat, loc.lon)
    setSearchQuery('')
    setShowDropdown(false)
  }

  // Detect GPS Location
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setLocatingUser(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          const geo = await locationApi.detect(lat, lon)
          const name = geo.short_label || geo.display_label || 'Current Location'
          setActiveLocation({ area: name, lat, lon })
          setLocation(name, lat, lon)
        } catch {
          const name = `GPS (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`
          setActiveLocation({ area: name, lat: pos.coords.latitude, lon: pos.coords.longitude })
          setLocation(name, pos.coords.latitude, pos.coords.longitude)
        } finally {
          setLocatingUser(false)
        }
      },
      (err) => {
        console.warn('Geolocation error:', err)
        alert('Could not access GPS location. Please check browser permissions.')
        setLocatingUser(false)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Query alerts based on active parameters
  const { data: alerts, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['alerts', scopeMode, activeLocation.area, activeLocation.lat, activeLocation.lon],
    queryFn: () =>
      intelligenceApi.alerts({
        area: scopeMode === 'LOCAL' ? activeLocation.area : undefined,
        lat: scopeMode === 'LOCAL' ? activeLocation.lat ?? undefined : undefined,
        lon: scopeMode === 'LOCAL' ? activeLocation.lon ?? undefined : undefined,
        scope: scopeMode === 'LOCAL' ? 'local' : 'all',
        is_active: true,
        limit: 50,
      }),
    staleTime: 3 * 60 * 1000,
  })

  // Filter alerts by severity
  const filteredAlerts = (alerts ?? []).filter((a) => {
    if (severityFilter === 'ALL') return true
    return (a.severity || '').toUpperCase() === severityFilter
  })

  const extremeCount = (alerts ?? []).filter((a) => (a.severity || '').toLowerCase() === 'extreme').length
  const severeCount = (alerts ?? []).filter((a) => (a.severity || '').toLowerCase() === 'severe').length
  const moderateCount = (alerts ?? []).filter((a) => (a.severity || '').toLowerCase() === 'moderate').length

  return (
    <>
      <SEOMeta
        title="Disaster & Emergency Government Alerts"
        description="Verified NDMA SACHET government disaster alerts, flood bulletins, and extreme weather notices."
      />

      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Top Header & Provenance */}
        <div className="bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-red-800/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider bg-red-500/20 text-red-200 border border-red-500/30 px-2.5 py-0.5 rounded-full">
                  <Radio className="h-3 w-3 animate-pulse text-red-400" />
                  Live Government Feed
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />
                  100% Official NDMA SACHET
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 tracking-tight">
                <ShieldAlert className="h-8 w-8 text-red-400 shrink-0" />
                Disaster & Emergency Alerts
              </h1>
              <p className="text-sm text-gray-300 mt-1 max-w-xl">
                National Disaster Management Authority (NDMA) Common Alerting Protocol (CAP v1.2) telemetry with verified state and district emergency notices.
              </p>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="self-start md:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition text-white"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Refresh Feed
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs">
            <div className="bg-white/5 rounded-lg p-2.5">
              <span className="text-gray-400 block text-[11px]">Active Bulletins</span>
              <span className="text-base font-bold text-white">{(alerts ?? []).length}</span>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <span className="text-red-300 block text-[11px]">Extreme Warnings</span>
              <span className="text-base font-bold text-red-400">{extremeCount}</span>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <span className="text-orange-300 block text-[11px]">Severe Advisories</span>
              <span className="text-base font-bold text-orange-400">{severeCount}</span>
            </div>
            <div className="bg-white/5 rounded-lg p-2.5">
              <span className="text-amber-300 block text-[11px]">Moderate Notices</span>
              <span className="text-base font-bold text-amber-400">{moderateCount}</span>
            </div>
          </div>
        </div>

        {/* Location Selection Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input with dropdown */}
            <div className="relative flex-1">
              <div className="flex items-center border border-gray-300 rounded-xl px-3 py-2 bg-gray-50 focus-within:bg-white focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 transition">
                <Search className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search city, district, or pin (e.g. Ghaziabad, Delhi, Patna, Bangalore)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                />
                {searching && <Loader2 className="h-4 w-4 text-red-500 animate-spin mr-1" />}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setShowDropdown(false)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 max-h-64 overflow-y-auto divide-y divide-gray-100">
                  {searchResults.map((res, idx) => (
                    <button
                      key={`${res.name}-${idx}`}
                      onClick={() =>
                        handleSelectLocation({
                          name: res.name,
                          lat: res.latitude ?? res.lat ?? 28.6304,
                          lon: res.longitude ?? res.lon ?? 77.2177,
                        })
                      }
                      className="w-full text-left px-3.5 py-2.5 hover:bg-red-50/60 transition flex items-start gap-2.5 text-xs"
                    >
                      <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800 block">{res.name}</span>
                        <span className="text-gray-500 text-[11px]">{res.display_label || [res.district, res.state].filter(Boolean).join(', ')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* GPS Locate Button */}
            <button
              onClick={handleDetectGPS}
              disabled={locatingUser}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition border border-gray-200"
            >
              {locatingUser ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <LocateFixed className="h-4 w-4 text-red-600" />
              )}
              Use My Location
            </button>
          </div>

          {/* Quick Hub Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[11px] font-semibold text-gray-400 uppercase shrink-0 mr-1">Quick:</span>
            {POPULAR_HUBS.map((hub) => {
              const isSelected = activeLocation.area.toLowerCase().includes(hub.name.split(' ')[0].toLowerCase())
              return (
                <button
                  key={hub.name}
                  onClick={() => handleSelectLocation(hub)}
                  className={cn(
                    'shrink-0 px-2.5 py-1 rounded-lg font-medium transition text-xs border',
                    isSelected
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                  )}
                >
                  {hub.name}
                </button>
              )
            })}
          </div>

          {/* Active Target Banner */}
          <div className="flex items-center justify-between bg-red-50/50 rounded-xl px-3 py-2 text-xs text-red-900 border border-red-100">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-red-600 shrink-0" />
              <span>
                Active Target:{' '}
                <strong className="font-semibold text-gray-900">{activeLocation.area}</strong>
                {activeLocation.lat && activeLocation.lon && (
                  <span className="text-gray-500 text-[11px] ml-1.5">
                    ({activeLocation.lat.toFixed(4)}, {activeLocation.lon.toFixed(4)})
                  </span>
                )}
              </span>
            </div>
            <span className="text-[11px] text-gray-500 font-medium">
              {scopeMode === 'LOCAL' ? 'Targeted Local & State Filter' : 'All-India National View'}
            </span>
          </div>
        </div>

        {/* Feed Scope Tabs & Severity Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setScopeMode('LOCAL')}
              className={cn(
                'px-4 py-2 rounded-lg transition flex items-center gap-1.5',
                scopeMode === 'LOCAL'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <MapPin className="h-3.5 w-3.5 text-red-500" />
              Local & State Notices
              {scopeMode === 'LOCAL' && !isLoading && (
                <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded-full font-bold">
                  {(alerts ?? []).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setScopeMode('ALL_INDIA')}
              className={cn(
                'px-4 py-2 rounded-lg transition flex items-center gap-1.5',
                scopeMode === 'ALL_INDIA'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60 font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Radio className="h-3.5 w-3.5 text-rose-500" />
              All-India NDMA Feed
              {scopeMode === 'ALL_INDIA' && !isLoading && (
                <span className="ml-1 text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded-full font-bold">
                  {(alerts ?? []).length}
                </span>
              )}
            </button>
          </div>

          {/* Severity Filters */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs no-scrollbar">
            <Filter className="h-3.5 w-3.5 text-gray-400 mr-1 shrink-0" />
            {(['ALL', 'EXTREME', 'SEVERE', 'MODERATE', 'MINOR'] as SeverityFilter[]).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={cn(
                  'px-2.5 py-1 rounded-lg font-medium text-[11px] transition uppercase border',
                  severityFilter === sev
                    ? 'bg-gray-800 text-white border-gray-800 shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
                )}
              >
                {sev === 'ALL' ? 'All' : sev}
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <CardSkeleton />
        ) : (
          <div className="space-y-4">
            {/* If Local Mode and 0 alerts: Show reassuring verified normal conditions card */}
            {scopeMode === 'LOCAL' && filteredAlerts.length === 0 && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-2xl p-6 border border-emerald-200 shadow-sm text-center sm:text-left flex flex-col sm:flex-row items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Conditions Normal
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">
                    No Active Disaster Warnings in {activeLocation.area}
                  </h2>
                  <p className="text-xs text-gray-600 leading-relaxed max-w-2xl">
                    Official NDMA SACHET common alerting telemetry reports no active civil protection notices, severe inundation alerts, or extreme weather advisories for this geographic jurisdiction.
                  </p>
                </div>
                <button
                  onClick={() => setScopeMode('ALL_INDIA')}
                  className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-xl border border-emerald-300 shadow-xs transition shrink-0"
                >
                  View All-India Feed ({alerts?.length ?? 0})
                </button>
              </div>
            )}

            {/* List of Alerts */}
            {filteredAlerts.map((alert: GovernmentAlert) => {
              const theme = SEV_CARD_THEMES[alert.severity ?? ''] ?? {
                border: 'border-l-4 border-gray-400 bg-white',
                bg: 'bg-white',
                badge: 'bg-gray-500 text-white',
                text: 'text-gray-900',
              }

              return (
                <div
                  key={alert.id || alert.alert_identifier}
                  className={cn(
                    'rounded-2xl p-5 shadow-sm transition hover:shadow-md space-y-3',
                    theme.border,
                    theme.bg
                  )}
                >
                  {/* Alert Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {alert.severity && (
                          <span className={cn('text-[10px] uppercase px-2 py-0.5 rounded-md', theme.badge)}>
                            {alert.severity} Alert
                          </span>
                        )}
                        {alert.urgency && (
                          <span className="text-[11px] font-medium text-gray-600 bg-white/80 border border-gray-200 px-2 py-0.5 rounded-md">
                            Urgency: {alert.urgency}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500 font-mono">
                          ID: {alert.alert_identifier}
                        </span>
                      </div>
                      <h3 className={cn('text-base sm:text-lg font-bold leading-snug', theme.text)}>
                        {alert.headline || alert.event_type}
                      </h3>
                    </div>

                    {/* Sender Authority Badge */}
                    <div className="shrink-0 flex items-center gap-1.5 bg-white/90 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 shadow-2xs">
                      <Building2 className="h-3.5 w-3.5 text-gray-500" />
                      <span>{alert.sender || 'NDMA SACHET'}</span>
                    </div>
                  </div>

                  {/* Area Description */}
                  {alert.area_description && (
                    <div className="flex items-start gap-2 text-xs text-gray-700 bg-white/80 p-2.5 rounded-xl border border-gray-100">
                      <MapPin className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-gray-800">Affected Area: </span>
                        <span>{alert.area_description}</span>
                      </div>
                    </div>
                  )}

                  {/* Official Instructions / Advisory */}
                  {alert.instruction && (
                    <div className="bg-amber-500/10 border-l-3 border-amber-500 p-3 rounded-r-xl text-xs text-amber-950 font-medium">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        Civic Action Advisory:
                      </span>
                      {alert.instruction}
                    </div>
                  )}

                  {/* Description Details */}
                  {alert.description && (
                    <p className="text-xs text-gray-600 leading-relaxed bg-white/40 p-2.5 rounded-xl">
                      {alert.description}
                    </p>
                  )}

                  {/* Footer Meta & Timestamps */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-gray-200/60 text-[11px] text-gray-500">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        Issued: {alert.effective_at ? `${formatDate(alert.effective_at)} ${formatTime(alert.effective_at)}` : 'Recently'}
                      </span>
                      {alert.expires_at && (
                        <span>
                          Expires: {formatDate(alert.expires_at)} {formatTime(alert.expires_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[10px]">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Verified Government CAP Notice
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Empty State for All-India or Filtered out */}
            {scopeMode === 'ALL_INDIA' && filteredAlerts.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <h3 className="text-base font-bold text-gray-800">No Disaster Bulletins Matching Filter</h3>
                <p className="text-xs text-gray-500">
                  There are currently no active government notices matching the severity &apos;{severityFilter}&apos;.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer Provenance Note */}
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              Direct integration with <strong>NDMA SACHET</strong> (CAP v1.2 Standard) and Indian State Disaster Management Authorities. Zero synthetic content.
            </span>
          </div>
          <a
            href="https://sachet.ndma.gov.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600 hover:text-red-700 font-semibold inline-flex items-center gap-1 shrink-0"
          >
            sachet.ndma.gov.in <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </>
  )
}
