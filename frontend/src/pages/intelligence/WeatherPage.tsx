import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Cloud,
  Droplets,
  Wind,
  Thermometer,
  MapPin,
  Clock,
  Search,
  RotateCcw,
  Check,
  Navigation,
  Sun,
  CloudRain,
  X,
  Compass,
  Activity,
  Car,
  Calendar,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { intelligenceApi, locationApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { UnavailableState } from '@/components/shared/States'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { formatRelativeTime, cn } from '@/utils'
import type { LocationResult } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

const POPULAR_LOCATIONS = [
  { name: 'Delhi Connaught Place', lat: 28.6304, lon: 77.2177, label: 'Delhi' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, label: 'Mumbai' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, label: 'Bengaluru' },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873, label: 'Jaipur' },
  { name: 'Lucknow', lat: 26.8467, lon: 80.9462, label: 'Lucknow' },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, label: 'Hyderabad' },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639, label: 'Kolkata' },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707, label: 'Chennai' },
  { name: 'Noida Sector 18', lat: 28.5708, lon: 77.3261, label: 'Noida' },
  { name: 'Pune', lat: 18.5204, lon: 73.8567, label: 'Pune' },
]

export default function WeatherPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedLat, selectedLon, setLocation } = useLocationStore()

  const currentArea = selectedArea || 'Delhi Connaught Place'
  const currentLat = selectedLat ?? 28.6304
  const currentLon = selectedLon ?? 77.2177

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<LocationResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Debounced locality search across all 780+ Indian districts and corridors
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = setTimeout(() => {
      locationApi
        .search(searchQuery.trim())
        .then((res) => {
          setSearchResults(res || [])
          setShowDropdown(true)
        })
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false))
    }, 280)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Click outside listener for suggestions dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Weather query using current target (refetches on global location change)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['weather-full', currentArea, currentLat, currentLon],
    queryFn: () =>
      intelligenceApi.weather({
        area: currentArea || undefined,
        lat: currentLat,
        lon: currentLon,
      }),
    staleTime: 3 * 60 * 1000,
  })

  // Pick a location from suggestions or chips — updates global store for all tabs
  function handleSelectLocation(loc: { name: string; lat?: number; lon?: number; district?: string }) {
    const displayName = loc.district ? `${loc.name}, ${loc.district}` : loc.name
    const lat = loc.lat ?? 28.6304
    const lon = loc.lon ?? 77.2177
    localStorage.setItem('ma24_location_manually_set', 'true')
    setLocation(displayName, lat, lon, {
      city: loc.district || loc.name.split(',')[0].trim(),
      district: loc.district,
    })
    setSearchQuery('')
    setShowDropdown(false)
  }

  // Handle free-form submit
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return

    if (searchResults.length > 0) {
      const first = searchResults[0]
      handleSelectLocation({
        name: first.name,
        district: first.district,
        lat: first.latitude,
        lon: first.longitude,
      })
    } else {
      localStorage.setItem('ma24_location_manually_set', 'true')
      setLocation(searchQuery.trim(), currentLat, currentLon, {
        city: searchQuery.trim(),
      })
      setShowDropdown(false)
    }
  }

  // Reset to GPS location
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
    setSearchQuery('')
  }

  const isRain = data?.condition_text?.toLowerCase().includes('rain') || (data?.precipitation_mm ?? 0) > 0
  const isSunny = data?.condition_text?.toLowerCase().includes('sun') || data?.condition_text?.toLowerCase().includes('clear')

  return (
    <>
      <SEOMeta
        title={`Live Weather — ${currentArea}`}
        description={`Real-time temperature, precipitation, humidity, and commute weather advisories for ${currentArea}, India.`}
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Cloud className="h-6 w-6 text-blue-500" />
              {t('weather.title', { defaultValue: 'Live Weather Telemetry' })}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-3.5 w-3.5 text-brand-500 shrink-0" />
              <span className="font-semibold text-gray-800">{currentArea}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                Unified App Location
              </span>
            </p>
          </div>

          {/* Quick Context Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToMyLocation}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition"
              title="Auto-detect current GPS location"
            >
              <RotateCcw className="h-3.5 w-3.5 text-gray-400" />
              Locate Me (GPS)
            </button>
          </div>
        </div>

        {/* Location Search Bar with Live Suggestions */}
        <div className="relative" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search another city, district, village, or pincode (e.g. Mumbai, Jaipur, Lucknow, 110001)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
              className="w-full pl-10 pr-20 py-2.5 text-sm bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false) }}
                className="absolute right-14 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1.5 px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl transition"
            >
              Check
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          <AnimatePresence>
            {showDropdown && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-gray-50"
              >
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      handleSelectLocation({
                        name: item.name,
                        district: item.district,
                        lat: item.latitude,
                        lon: item.longitude,
                      })
                    }
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-50/70 transition flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-brand-700">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.district ? `${item.district}, ` : ''}{item.state} {item.pincode ? `• PIN ${item.pincode}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                      View Weather →
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Popular Location Pills */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Quick Select Major Hubs:</p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {POPULAR_LOCATIONS.map((loc) => {
              const isCurrent = currentArea.toLowerCase().includes(loc.label.toLowerCase())
              return (
                <button
                  key={loc.label}
                  onClick={() =>
                    handleSelectLocation({
                      name: loc.name,
                      lat: loc.lat,
                      lon: loc.lon,
                    })
                  }
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition border',
                    isCurrent
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  )}
                >
                  {loc.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Weather Data Card */}
        {isLoading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
            </div>
          </div>
        ) : !data?.is_available ? (
          <UnavailableState
            message={
              data?.message ||
              `Weather data currently unavailable for ${currentArea}. Try picking a nearby district or select from quick hubs above.`
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Main Weather Hero Card */}
            <div
              className={cn(
                'rounded-3xl p-6 text-white shadow-md relative overflow-hidden transition-all',
                isRain
                  ? 'bg-gradient-to-br from-slate-800 via-blue-900 to-indigo-950'
                  : isSunny
                  ? 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700'
                  : 'bg-gradient-to-br from-blue-600 via-slate-600 to-indigo-800'
              )}
            >
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full">
                      {data.location_name || currentArea}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-6xl font-black tracking-tight">
                      {data.temperature_c?.toFixed(1)}
                    </p>
                    <span className="text-3xl font-bold text-blue-200">°C</span>
                  </div>

                  <p className="text-lg font-medium mt-1 text-blue-100 flex items-center gap-1.5">
                    {data.condition_text}
                  </p>
                </div>

                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                  {isRain ? (
                    <CloudRain className="h-14 w-14 text-blue-200" />
                  ) : isSunny ? (
                    <Sun className="h-14 w-14 text-yellow-300 animate-spin-slow" />
                  ) : (
                    <Cloud className="h-14 w-14 text-white/70" />
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-blue-200 relative z-10">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Updated {formatRelativeTime(data.observed_at)}
                </span>
                <span className="font-medium bg-white/10 px-2 py-0.5 rounded">
                  {data.source || 'WeatherAPI'}
                </span>
              </div>
            </div>

            {/* Weather Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <Droplets className="h-5 w-5 text-blue-500" />, label: t('weather.humidity', { defaultValue: 'Humidity' }), value: `${data.humidity}%` },
                { icon: <Wind className="h-5 w-5 text-teal-500" />, label: t('weather.wind', { defaultValue: 'Wind Speed' }), value: `${data.wind_kph} km/h` },
                { icon: <Thermometer className="h-5 w-5 text-indigo-500" />, label: t('weather.precipitation', { defaultValue: 'Precipitation' }), value: `${data.precipitation_mm ?? 0} mm` },
                { icon: <Navigation className="h-5 w-5 text-purple-500" />, label: 'Commute Index', value: (data.waterlogging_risk_index ?? 0) > 4 ? 'Disrupted' : 'Optimal' },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center shadow-sm">
                  <div className="flex justify-center mb-1.5">{icon}</div>
                  <p className="text-xs font-medium text-gray-400">{label}</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Hyperlocal Weather Impact Synthesis (PPT Slide 04: "What does today's weather mean for my area?") */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  What Today's Weather Means For Your Area
                </h2>
                <span className="text-xs text-gray-400 font-medium">Domain Impact Synthesis</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Travel Impact (Weather + Traffic) */}
                <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 rounded-2xl border border-blue-100 p-4 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                        <Car className="h-4 w-4 text-blue-600" /> Travel & Traffic Impact
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-black px-2 py-0.5 rounded-full uppercase',
                          (data.waterlogging_risk_index ?? 0) >= 7
                            ? 'bg-red-100 text-red-700'
                            : (data.waterlogging_risk_index ?? 0) >= 4
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        {data.travel_impact?.risk_level || ((data.waterlogging_risk_index ?? 0) >= 4 ? 'ELEVATED' : 'OPTIMAL')}
                      </span>
                    </div>

                    <h4 className="text-xs font-extrabold text-gray-900">
                      {data.travel_impact?.headline || 'Commute & Road Conditions'}
                    </h4>

                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      {data.travel_impact?.advisory || data.outdoor_activity_advice || 'Dry road surfaces with standard traffic flow.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-blue-100/60 flex items-center justify-between text-[11px] text-blue-800 font-semibold">
                    <span>Waterlogging: {(data.waterlogging_risk_index ?? 0).toFixed(1)}/10</span>
                    {data.transit_delay_estimate_min ? (
                      <span className="text-amber-700 font-bold">+{data.transit_delay_estimate_min}m delay</span>
                    ) : (
                      <span className="text-emerald-700">No weather delay</span>
                    )}
                  </div>
                </div>

                {/* 2. Event Impact (Weather + Outdoor Event) */}
                <div className="bg-gradient-to-br from-purple-50/70 to-pink-50/50 rounded-2xl border border-purple-100 p-4 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-purple-600" /> Event & Gathering Impact
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-black px-2 py-0.5 rounded-full uppercase',
                          data.event_impact?.risk_level === 'HIGH'
                            ? 'bg-red-100 text-red-700'
                            : data.event_impact?.risk_level === 'MODERATE'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        {data.event_impact?.risk_level || 'LOW RISK'}
                      </span>
                    </div>

                    <h4 className="text-xs font-extrabold text-gray-900">
                      {data.event_impact?.headline || 'Open-Air & Market Impact'}
                    </h4>

                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      {data.event_impact?.advisory || 'Clear skies expected; outdoor gatherings and markets will run smoothly.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-purple-100/60 text-[11px] text-purple-800 font-medium leading-snug">
                    {data.event_impact?.crowd_behavior || 'Normal visitor footfall and regular exit dispersal.'}
                  </div>
                </div>

                {/* 3. Activity Consideration (Weather + Outdoor Activity) */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-100 p-4 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <Activity className="h-4 w-4 text-emerald-600" /> Activity Consideration
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                        Fitness & Daily
                      </span>
                    </div>

                    <h4 className="text-xs font-extrabold text-gray-900">
                      {data.activity_consideration?.headline || 'Daily Routine Advisory'}
                    </h4>

                    <p className="text-xs text-gray-600 leading-relaxed font-medium">
                      {data.activity_consideration?.advisory || data.outdoor_activity_advice || 'Favorable conditions for morning fitness and outdoor strolls.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-emerald-100/60 text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                    <Clock className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Window: {data.activity_consideration?.recommended_window || 'Morning & Evening'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {data.message && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                {data.message}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
