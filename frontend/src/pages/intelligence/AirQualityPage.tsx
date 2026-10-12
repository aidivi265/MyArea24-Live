import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Wind, Search, MapPin, LocateFixed, Loader2,
  ShieldCheck, AlertTriangle, ShieldAlert, Sparkles, RefreshCw, X
} from 'lucide-react'
import { intelligenceApi, locationApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { UnavailableState } from '@/components/shared/States'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { AQIGauge } from '@/components/intelligence/AQIWidget'
import { formatRelativeTime, getAQIInfo } from '@/utils'
import type { LocationResult } from '@/types'
import { useTranslation } from 'react-i18next'

const POLLUTANTS = [
  { key: 'pm25' as const, label: 'PM2.5', unit: 'µg/m³', limit: 60, desc: 'Fine Particulate Matter' },
  { key: 'pm10' as const, label: 'PM10', unit: 'µg/m³', limit: 100, desc: 'Coarse Dust & Pollen' },
  { key: 'no2' as const, label: 'NO₂', unit: 'µg/m³', limit: 80, desc: 'Nitrogen Dioxide (Vehicular)' },
  { key: 'so2' as const, label: 'SO₂', unit: 'µg/m³', limit: 80, desc: 'Sulphur Dioxide (Industrial)' },
  { key: 'co' as const, label: 'CO', unit: 'mg/m³', limit: 4, desc: 'Carbon Monoxide' },
  { key: 'o3' as const, label: 'O₃', unit: 'µg/m³', limit: 100, desc: 'Ground-level Ozone' },
]

const POPULAR_HUBS = [
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Kanpur', lat: 26.4499, lon: 80.3319 },
  { name: 'Patna', lat: 25.5941, lon: 85.1376 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
]

function getHealthAdvisory(aqi?: number) {
  if (aqi === undefined || aqi === null) {
    return {
      title: 'Air Quality Advisory',
      desc: 'Ambient monitoring telemetry active. Observe standard precautions.',
      icon: Sparkles,
      color: 'bg-gray-50 border-gray-200 text-gray-700',
    }
  }
  if (aqi <= 50) {
    return {
      title: 'Good Air Quality',
      desc: 'Air quality is satisfactory and poses little or no health risk. Ideal for outdoor recreation.',
      icon: ShieldCheck,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    }
  }
  if (aqi <= 100) {
    return {
      title: 'Satisfactory Air Quality',
      desc: 'Acceptable air quality. Exceptionally sensitive people may experience minor breathing discomfort.',
      icon: ShieldCheck,
      color: 'bg-green-50 border-green-200 text-green-800',
    }
  }
  if (aqi <= 200) {
    return {
      title: 'Moderate Health Advisory',
      desc: 'May cause breathing discomfort to people with asthma, lung, or heart conditions on prolonged exposure.',
      icon: AlertTriangle,
      color: 'bg-amber-50 border-amber-200 text-amber-800',
    }
  }
  if (aqi <= 300) {
    return {
      title: 'Poor Air Quality Advisory',
      desc: 'May cause breathing discomfort to most people on prolonged exposure. Sensitive groups should wear masks.',
      icon: AlertTriangle,
      color: 'bg-orange-50 border-orange-200 text-orange-800',
    }
  }
  if (aqi <= 400) {
    return {
      title: 'Very Poor — High Precaution',
      desc: 'Respiratory illness likely on prolonged exposure. Wear N95 masks outdoors, keep windows shut, and run air purifiers.',
      icon: ShieldAlert,
      color: 'bg-rose-50 border-rose-200 text-rose-800',
    }
  }
  return {
    title: 'Severe — Emergency Health Warning',
    desc: 'Seriously impacts healthy people and severely affects individuals with existing diseases. Strictly avoid outdoor exertion.',
    icon: ShieldAlert,
    color: 'bg-red-100 border-red-300 text-red-900',
  }
}

export default function AirQualityPage() {
  const { selectedArea, selectedLat, selectedLon, setLocation } = useLocationStore()

  const currentArea = selectedArea || 'Delhi Connaught Place'
  const currentLat = selectedLat ?? 28.6304
  const currentLon = selectedLon ?? 77.2177

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      locationApi.search(searchQuery.trim())
        .then(res => {
          setSearchResults(res || [])
          setShowDropdown(true)
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // AQI Query (refetches on global location change)
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['aqi-full', currentArea, currentLat, currentLon],
    queryFn: () => intelligenceApi.airQuality({
      area: currentArea,
      lat: currentLat,
      lon: currentLon,
    }),
    staleTime: 3 * 60 * 1000,
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

  function handleSelectHub(hub: { name: string; lat: number; lon: number }) {
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

  const isAvailable = Boolean(data?.is_available || (data?.aqi_value !== undefined && data?.aqi_value !== null))
  const advisory = getHealthAdvisory(data?.aqi_value)
  const AdvisoryIcon = advisory.icon

  return (
    <>
      <SEOMeta
        title={`Air Quality (AQI) — ${currentArea}`}
        description={`Real-time Central Pollution Control Board (CPCB) NAQI and pollutant breakdown for ${currentArea}`}
      />

      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header & Location Search */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Wind className="h-6 w-6 text-emerald-600" />
                Air Quality Index (AQI)
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Central Pollution Control Board (CPCB) · 2014 NAQI Standard
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                title="Refresh AQI telemetry"
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
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
                placeholder="Search any village, tehsil, city, district, or PIN code for AQI…"
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

            {/* Autocomplete Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button
                    key={r.id || `${r.name}-${i}`}
                    onClick={() => handleSelectResult(r)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
                      <span className="text-xs font-semibold text-gray-900 truncate">{r.name}</span>
                      <span className="text-xs text-gray-400 truncate">
                        {r.district ? `· ${r.district}` : ''} {r.state ? `, ${r.state}` : ''}
                      </span>
                    </div>
                    {r.pincode && (
                      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {r.pincode}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Hub Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-gray-400 font-medium whitespace-nowrap text-[11px] mr-1">Major Hubs:</span>
            {POPULAR_HUBS.map(hub => {
              const active = currentArea.toLowerCase().includes(hub.name.toLowerCase())
              return (
                <button
                  key={hub.name}
                  onClick={() => handleSelectHub(hub)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {hub.name}
                </button>
              )
            })}
          </div>

          {/* Active Location Banner */}
          <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-600 truncate min-w-0">
              <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold text-gray-800">Showing AQI for:</span>
              <span className="truncate text-gray-600 font-medium">{currentArea}</span>
            </div>

            <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Unified App Location
            </span>
          </div>
        </div>

        {/* Content Section */}
        {isLoading ? (
          <CardSkeleton />
        ) : !isAvailable ? (
          <UnavailableState message={data?.message || "Air quality data currently unavailable for this location."} />
        ) : (
          <div className="space-y-4">
            {/* Main Gauge Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
              <AQIGauge aqi={data?.aqi_value} />

              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2
                    className="text-2xl font-black tracking-tight"
                    style={{ color: getAQIInfo(data?.aqi_value).color }}
                  >
                    {data?.aqi_value} AQI — {getAQIInfo(data?.aqi_value).label}
                  </h2>
                </div>

                <p className="text-sm text-gray-600 mt-1 font-medium">
                  {data?.station_name || data?.city || currentArea}
                </p>

                {data?.prominent_pollutant && (
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-semibold text-gray-700">Prominent Pollutant:</span>{' '}
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-gray-800 font-bold">
                      {data.prominent_pollutant}
                    </span>
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3 text-xs text-gray-400">
                  {data?.observed_at && (
                    <span>Updated {formatRelativeTime(data.observed_at)}</span>
                  )}
                  {data?.distance_km !== undefined && data.distance_km !== null && (
                    <span>· Station {data.distance_km.toFixed(1)} km away</span>
                  )}
                  {data?.is_stale && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-medium">
                      Telemetry Stale
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Health Advisory Card */}
            <div className={`rounded-2xl border p-4.5 flex items-start gap-3.5 shadow-xs ${advisory.color}`}>
              <div className="p-2 rounded-xl bg-white/70 shadow-xs flex-shrink-0 mt-0.5">
                <AdvisoryIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm tracking-tight">{advisory.title}</h3>
                <p className="text-xs leading-relaxed mt-1 opacity-90">{advisory.desc}</p>
              </div>
            </div>

            {/* Pollutant Breakdown Table */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-bold text-gray-900 text-sm">Pollutant Breakdown</h3>
                <span className="text-[11px] text-gray-400">CPCB Permissible 24-hr Limits</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {POLLUTANTS.map(({ key, label, unit, limit, desc }) => {
                  const val = data?.[key]
                  if (val === undefined || val === null) return null
                  const pct = Math.min((val / limit) * 100, 100)
                  const color = pct > 100 ? '#ef4444' : pct > 60 ? '#f97316' : '#10b981'

                  return (
                    <div key={key} className="p-3 rounded-xl bg-gray-50/70 border border-gray-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gray-900">{label}</span>
                          <span className="text-[10px] text-gray-400 ml-1.5">({desc})</span>
                        </div>
                        <span className="font-mono font-semibold text-gray-800">
                          {val.toFixed(1)} <span className="text-[10px] font-normal text-gray-500">{unit}</span>
                        </span>
                      </div>

                      <div className="h-2 bg-gray-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>Safe: 0</span>
                        <span>Standard Limit: {limit} {unit}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Telemetry Attribution Footer */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/60 text-xs text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>{data?.message || `Air quality telemetry via ${data?.attribution || 'CPCB / OpenAQ'}`}</span>
              <span className="text-[11px] text-gray-400 font-medium">Source: {data?.attribution || 'CPCB / OpenAQ'}</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
