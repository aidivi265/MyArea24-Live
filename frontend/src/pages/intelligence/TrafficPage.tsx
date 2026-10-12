import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Car,
  Clock,
  MapPin,
  Search,
  LocateFixed,
  RefreshCw,
  Loader2,
  X,
  AlertTriangle,
  ShieldCheck,
  Compass,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import { intelligenceApi, locationApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { UnavailableState, EmptyState } from '@/components/shared/States'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { CRITICALITY_STYLES, cn, formatRelativeTime } from '@/utils'
import type { LocationResult, TrafficIncident } from '@/types'
import { useTranslation } from 'react-i18next'

const POPULAR_CORRIDORS = [
  { name: 'Ghaziabad (AKGEC)', lat: 28.6757, lon: 77.5020 },
  { name: 'Noida Sector 62', lat: 28.6280, lon: 77.3649 },
  { name: 'Delhi Connaught Place', lat: 28.6304, lon: 77.2177 },
  { name: 'Delhi AIIMS Ring Road', lat: 28.5672, lon: 77.2100 },
  { name: 'Mumbai BKC', lat: 19.0657, lon: 72.8679 },
  { name: 'Bengaluru Silk Board', lat: 12.9128, lon: 77.6092 },
  { name: 'Lucknow Hazratganj', lat: 26.8467, lon: 80.9462 },
  { name: 'Kolkata Park Street', lat: 22.5510, lon: 88.3524 },
  { name: 'Jaipur Ajmer Road', lat: 26.9028, lon: 75.7873 },
]

type FilterType = 'ALL' | 'CONGESTION' | 'ROAD_CLOSURE' | 'ACCIDENT' | 'ROAD_WORKS'
type SortType = 'PROXIMITY' | 'DELAY' | 'SEVERITY'

export default function TrafficPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedLat, selectedLon, setLocation } = useLocationStore()

  const currentArea = selectedArea || 'Delhi Connaught Place'
  const currentLat = selectedLat ?? 28.6304
  const currentLon = selectedLon ?? 77.2177

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Filter & Sort state
  const [filterType, setFilterType] = useState<FilterType>('ALL')
  const [sortBy, setSortBy] = useState<SortType>('PROXIMITY')

  // Debounced locality search across India
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      locationApi
        .search(searchQuery.trim())
        .then((res) => {
          setSearchResults(res || [])
          setShowDropdown(true)
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Traffic query using active target coordinates & area (refetches on global location change)
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['traffic-full', currentArea, currentLat, currentLon],
    queryFn: () =>
      intelligenceApi.traffic({
        area: currentArea,
        lat: currentLat,
        lon: currentLon,
        limit: 50,
      }),
    staleTime: 2 * 60 * 1000,
  })

  function handleSelectResult(r: LocationResult) {
    const lat = r.latitude ?? r.lat ?? 28.6304
    const lon = r.longitude ?? r.lon ?? 77.2177
    const label = r.display_label || `${r.name}, ${r.district || ''}, ${r.state || ''}`
    localStorage.setItem('ma24_location_manually_set', 'true')
    setLocation(label, lat, lon, {
      city: r.district || r.name.split(',')[0].trim(),
      state: r.state,
      district: r.district,
    })
    setSearchQuery('')
    setShowDropdown(false)
  }

  function handleSelectCorridor(hub: { name: string; lat: number; lon: number }) {
    localStorage.setItem('ma24_location_manually_set', 'true')
    setLocation(hub.name, hub.lat, hub.lon, {
      city: hub.name.split(' ')[0],
    })
  }

  function handleResetToMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          localStorage.setItem('ma24_location_manually_set', 'true')
          setLocation('My Location (GPS)', pos.coords.latitude, pos.coords.longitude)
        },
        () => {
          setLocation('Delhi Connaught Place', 28.6304, 77.2177, { city: 'Delhi', state: 'Delhi NCR' })
        }
      )
    }
  }

  // Filter & sort incidents
  const allIncidents = data?.incidents ?? []
  const filteredIncidents = allIncidents.filter((inc) => {
    if (filterType === 'ALL') return true
    if (filterType === 'CONGESTION') return inc.incident_type === 'CONGESTION'
    if (filterType === 'ROAD_CLOSURE') return inc.incident_type === 'ROAD_CLOSURE'
    if (filterType === 'ACCIDENT') return inc.incident_type === 'ACCIDENT'
    if (filterType === 'ROAD_WORKS') return inc.incident_type === 'ROAD_WORKS'
    return true
  })

  filteredIncidents.sort((a, b) => {
    if (sortBy === 'PROXIMITY') {
      const distA = a.distance_km ?? 999
      const distB = b.distance_km ?? 999
      return distA - distB
    }
    if (sortBy === 'DELAY') {
      const delayA = a.delay_seconds ?? 0
      const delayB = b.delay_seconds ?? 0
      return delayB - delayA
    }
    if (sortBy === 'SEVERITY') {
      const weight: Record<string, number> = { critical: 4, major: 3, moderate: 2, minor: 1, low: 0, unknown: 0 }
      return (weight[b.criticality] ?? 0) - (weight[a.criticality] ?? 0)
    }
    return 0
  })

  // Congestion theme styling
  const congestionLevel = data?.congestion_level || (allIncidents.length > 0 ? 'Moderate' : 'Clear')
  const congestionTheme =
    congestionLevel === 'Severe'
      ? { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' }
      : congestionLevel === 'Heavy'
      ? { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' }
      : congestionLevel === 'Moderate'
      ? { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' }
      : { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' }

  return (
    <>
      <SEOMeta
        title={`Live Traffic & Incidents — ${currentArea}`}
        description={`Real-time TomTom traffic congestion, delays, accidents and arterial road conditions near ${currentArea}`}
      />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header & Location Controls */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Car className="h-6 w-6 text-orange-500" />
                {t('traffic.title', { defaultValue: 'Live Traffic & Corridor Conditions' })}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                TomTom Traffic API v5 · Real-time Incidents & Delays (Within 30 km)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                title="Refresh live traffic feed"
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleResetToMyLocation}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors flex items-center gap-1.5"
                title="Auto-detect current GPS location"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                Locate Me (GPS)
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowDropdown(true)
                }}
                placeholder="Search any locality, highway, college (e.g. AKGEC Ghaziabad), or PIN code…"
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all placeholder:text-gray-400"
              />
              {searching ? (
                <Loader2 className="absolute right-3.5 h-4 w-4 text-gray-400 animate-spin" />
              ) : searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 p-0.5 rounded-full hover:bg-gray-200 text-gray-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectResult(r)}
                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
                      <div>
                        <span className="font-semibold text-gray-900">{r.name}</span>
                        {r.district && <span className="text-gray-400">, {r.district}</span>}
                        {r.state && <span className="text-gray-400">, {r.state}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 px-1.5 py-0.5 rounded bg-gray-100 flex-shrink-0">
                      {r.district || r.state || 'Locality'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hub Pills */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Popular Nearby Corridors
            </p>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {POPULAR_CORRIDORS.map((c) => {
                const isActive = currentArea.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
                return (
                  <button
                    key={c.name}
                    onClick={() => handleSelectCorridor(c)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 border transition-all',
                      isActive
                        ? 'bg-orange-50 border-orange-300 text-orange-800 font-semibold'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Global Target Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-orange-500" />
              Showing traffic for: <strong className="text-gray-800">{currentArea}</strong>
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Unified App Location
            </span>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <CardSkeleton />
        ) : !data?.is_available ? (
          <UnavailableState message={data?.message || 'Traffic data unavailable for this corridor.'} />
        ) : (
          <div className="space-y-4">
            {/* KPI Stat Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Active Incidents
                </span>
                <p className="text-2xl font-black text-gray-900 mt-1">
                  {data.total_incidents ?? allIncidents.length}
                </p>
                <span className="text-[10px] text-gray-400 mt-1">within 30 km radius</span>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Corridor Congestion
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', congestionTheme.dot)} />
                  <p className={cn('text-lg font-bold', congestionTheme.text)}>{congestionLevel}</p>
                </div>
                <span className="text-[10px] text-gray-400 mt-1">Traffic density status</span>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Cumulative Delay
                </span>
                <p className="text-2xl font-black text-orange-600 mt-1 flex items-center gap-1">
                  <Clock className="h-5 w-5" />
                  ~{data.cumulative_delay_minutes ?? 0}m
                </p>
                <span className="text-[10px] text-gray-400 mt-1">Total vehicular wait</span>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col justify-between">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  Worst Bottleneck
                </span>
                <p className="text-xs font-bold text-gray-800 mt-1 line-clamp-2">
                  {data.worst_corridor || 'No major choke point'}
                </p>
                <span className="text-[10px] text-gray-400 mt-1">Highest impact road</span>
              </div>
            </div>

            {/* Filter and Sort Toolbar */}
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto scrollbar-none">
                {(
                  [
                    { id: 'ALL', label: 'All Incidents' },
                    { id: 'CONGESTION', label: 'Jams' },
                    { id: 'ROAD_CLOSURE', label: 'Closures' },
                    { id: 'ACCIDENT', label: 'Accidents' },
                    { id: 'ROAD_WORKS', label: 'Roadworks' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFilterType(t.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors flex-shrink-0',
                      filterType === t.id
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-gray-500">
                <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortType)}
                  className="bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2 py-1 outline-none text-xs font-medium focus:ring-1 focus:ring-orange-500"
                >
                  <option value="PROXIMITY">Nearest to Location</option>
                  <option value="DELAY">Highest Delay</option>
                  <option value="SEVERITY">Most Critical</option>
                </select>
              </div>
            </div>

            {/* Incident Cards List */}
            {filteredIncidents.length === 0 ? (
              <EmptyState
                title="Roads are clear in this vicinity"
                description={`No active incidents or vehicular bottlenecks detected near ${currentArea}.`}
              />
            ) : (
              <div className="space-y-3">
                {filteredIncidents.map((inc, i) => {
                  const style = CRITICALITY_STYLES[inc.criticality] ?? CRITICALITY_STYLES.low
                  const isVeryClose = inc.distance_km !== undefined && inc.distance_km <= 5.0

                  return (
                    <div
                      key={inc.id ?? i}
                      className={cn(
                        'bg-white rounded-xl border p-4 shadow-sm flex items-start gap-3.5 transition-all hover:shadow-md',
                        isVeryClose ? 'border-orange-200 bg-orange-50/10' : 'border-gray-100'
                      )}
                    >
                      <div className={cn('mt-1.5 h-3 w-3 rounded-full flex-shrink-0', style.dot)} />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <p className="font-bold text-sm text-gray-900 tracking-tight">
                            {inc.road_name ?? inc.incident_type}
                          </p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {inc.distance_km !== undefined && (
                              <span
                                className={cn(
                                  'text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1',
                                  isVeryClose
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-gray-100 text-gray-700'
                                )}
                              >
                                <Compass className="h-3 w-3" />
                                {inc.distance_km < 1
                                  ? '<1 km away'
                                  : `${inc.distance_km.toFixed(1)} km away`}
                              </span>
                            )}
                            <span
                              className={cn(
                                'text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full',
                                style.text,
                                inc.criticality === 'critical'
                                  ? 'bg-red-50'
                                  : inc.criticality === 'major'
                                  ? 'bg-orange-50'
                                  : inc.criticality === 'moderate'
                                  ? 'bg-amber-50'
                                  : inc.criticality === 'minor'
                                  ? 'bg-yellow-50'
                                  : 'bg-green-50'
                              )}
                            >
                              {inc.criticality}
                            </span>
                          </div>
                        </div>

                        {inc.description && (
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                            {inc.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-gray-400">
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-mono text-gray-600 uppercase">
                            {inc.incident_type}
                          </span>

                          {inc.delay_seconds ? (
                            <span className="flex items-center gap-1 font-semibold text-orange-600">
                              <Clock className="h-3.5 w-3.5" />
                              {Math.round(inc.delay_seconds / 60)} min delay
                            </span>
                          ) : null}

                          {inc.jam_factor !== undefined && inc.jam_factor !== null && (
                            <span>Jam Factor: {inc.jam_factor.toFixed(1)}/10</span>
                          )}

                          {inc.observed_at && (
                            <span className="ml-auto text-[11px]">
                              {formatRelativeTime(inc.observed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
