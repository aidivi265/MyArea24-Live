import { useState, useRef, useEffect, useMemo } from 'react'
import {
  MapPin, ChevronDown, Search, LocateFixed, Loader2,
  Building2, Globe, ArrowLeft, Check, Navigation, Sparkles, X
} from 'lucide-react'
import { useLocationStore } from '@/store'
import { locationApi } from '@/services/apiService'
import type { LocationResult } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'

interface StateItem {
  code: string
  name: string
  type: string
}

export function LocalitySelector() {
  const {
    selectedArea,
    selectedLat,
    selectedLon,
    selectedCity,
    selectedState,
    selectedDistrict,
    selectedVillage,
    selectedTehsil,
    selectedPincode,
    selectedAccuracy,
    setLocation,
  } = useLocationStore()

  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'directory'>('search')

  // Search Mode State
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)

  // Directory Mode State
  const [states, setStates] = useState<StateItem[]>([])
  const [loadingStates, setLoadingStates] = useState(false)
  const [selectedStateObj, setSelectedStateObj] = useState<StateItem | null>(null)
  const [districts, setDistricts] = useState<LocationResult[]>([])
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')

  // GPS State
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const ref = useRef<HTMLDivElement>(null)

  // Fetch states when opening directory or component mount
  useEffect(() => {
    if (states.length === 0) {
      setLoadingStates(true)
      locationApi.states()
        .then(setStates)
        .catch(() => {})
        .finally(() => setLoadingStates(false))
    }
  }, [states.length])

  // Fetch districts when state is selected in Directory mode
  useEffect(() => {
    if (!selectedStateObj) {
      setDistricts([])
      return
    }
    setLoadingDistricts(true)
    locationApi.districts(selectedStateObj.name)
      .then(setDistricts)
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDistricts(false))
  }, [selectedStateObj])

  // Debounced search for any village, town, city, district, or pin code across India
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      locationApi.search(query.trim())
        .then(res => setResults(res || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 280)
    return () => clearTimeout(timer)
  }, [query])

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [])

  function selectLocation(item: {
    area: string
    lat: number
    lon: number
    city?: string
    state?: string
    district?: string
    village?: string
    tehsil?: string
    pincode?: string
    accuracy?: string
  }) {
    localStorage.setItem('ma24_location_manually_set', 'true')
    setLocation(item.area, item.lat, item.lon, {
      city: item.city || item.district || item.area.split(',')[0].trim(),
      state: item.state,
      district: item.district,
      village: item.village,
      tehsil: item.tehsil,
      pincode: item.pincode,
      accuracy: item.accuracy || 'exact',
      rawAddress: item.area,
    })
    setOpen(false)
    setQuery('')
  }

  async function redetectGPS() {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    setGpsError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await locationApi.detect(pos.coords.latitude, pos.coords.longitude)
          const city = res.town || res.district || res.display_label.split(',')[0].trim()
          localStorage.setItem('ma24_location_manually_set', 'true')
          setLocation(res.display_label, res.latitude, res.longitude, {
            city,
            state: res.state,
            district: res.district,
            village: res.village,
            tehsil: res.tehsil,
            pincode: res.pincode,
            accuracy: res.accuracy,
            rawAddress: res.display_label,
          })
          setOpen(false)
        } catch {
          localStorage.setItem('ma24_location_manually_set', 'true')
          setLocation(
            `GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
            pos.coords.latitude,
            pos.coords.longitude
          )
          setOpen(false)
        } finally {
          setGpsLoading(false)
        }
      },
      (err) => {
        setGpsLoading(false)
        setGpsError(err.code === 1 ? 'Location permission denied' : 'Could not detect GPS location')
      },
      { timeout: 9000, enableHighAccuracy: true }
    )
  }

  const filteredStates = useMemo(() => {
    if (!stateFilter.trim()) return states
    const q = stateFilter.toLowerCase()
    return states.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
  }, [states, stateFilter])

  const filteredDistricts = useMemo(() => {
    if (!districtFilter.trim()) return districts
    const q = districtFilter.toLowerCase()
    return districts.filter(d =>
      d.name.toLowerCase().includes(q) ||
      (d.district && d.district.toLowerCase().includes(q)) ||
      (d.pincode && String(d.pincode).includes(q))
    )
  }, [districts, districtFilter])

  // Display label for navbar button
  const displayTitle = selectedVillage
    ? `${selectedVillage}, ${selectedDistrict || selectedCity || ''}`
    : selectedDistrict
      ? `${selectedDistrict}, ${selectedState || ''}`
      : selectedArea || 'Select Location'

  return (
    <div className="relative" ref={ref}>
      {/* Navbar trigger buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(o => !o)}
          className="group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl bg-brand-50/70 hover:bg-brand-100/70 border border-brand-200/60 text-xs sm:text-sm font-medium text-brand-900 transition-all max-w-[130px] xs:max-w-[170px] sm:max-w-[260px]"
          title={selectedArea}
        >
          <div className="relative flex items-center justify-center">
            <MapPin className="h-4 w-4 text-brand-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <span className="truncate text-xs sm:text-sm font-semibold text-brand-900">
            {displayTitle}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-brand-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* GPS Instant Trigger */}
        <button
          onClick={redetectGPS}
          disabled={gpsLoading}
          title="Auto-detect current GPS location"
          className="p-1.5 rounded-xl bg-white border border-gray-200 hover:border-brand-300 hover:bg-brand-50 text-gray-500 hover:text-brand-600 shadow-sm transition-all disabled:opacity-50"
        >
          {gpsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Backdrop (Mobile + Desktop dismiss) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/25 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Popover Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-2.5 top-16 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:right-auto mt-2 w-[calc(100vw-1.25rem)] sm:w-[460px] md:w-[490px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200/90 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header: Exact Tracked Address Overview */}
            <div className="p-3.5 bg-gradient-to-r from-brand-900 via-brand-800 to-indigo-900 text-white border-b border-brand-700/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-brand-200 font-medium">
                    <Navigation className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Exact Tracked Location</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                      {selectedAccuracy === 'exact' ? 'High Precision GPS' : 'Active Territory'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate mt-0.5" title={selectedArea}>
                    {selectedArea || 'Location not set'}
                  </h4>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Exact Breakdown Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-white/10 text-[11px] text-brand-100">
                {selectedVillage && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-amber-200 font-medium">
                    📍 Gao: {selectedVillage}
                  </span>
                )}
                {selectedTehsil && selectedTehsil !== selectedDistrict && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 font-medium">
                    🏛️ Tehsil: {selectedTehsil}
                  </span>
                )}
                {(selectedDistrict || selectedCity) && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 font-medium">
                    🏙️ Dist: {selectedDistrict || selectedCity}
                  </span>
                )}
                {selectedState && (
                  <span className="px-2 py-0.5 rounded-md bg-white/10 font-medium">
                    🗺️ {selectedState}
                  </span>
                )}
                {selectedPincode && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-200 font-semibold">
                    📮 PIN {selectedPincode}
                  </span>
                )}
              </div>
            </div>

            {/* GPS Auto Detect CTA */}
            <div className="p-2.5 bg-brand-50/60 border-b border-gray-100 flex items-center justify-between gap-2">
              <button
                onClick={redetectGPS}
                disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.99] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
              >
                {gpsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5 text-white" />
                )}
                <span>Use My Exact GPS Location (Auto-Detect Gao/City)</span>
              </button>
            </div>
            {gpsError && (
              <p className="px-3 py-1.5 text-xs text-rose-600 bg-rose-50 border-b border-rose-100 font-medium">
                {gpsError}
              </p>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50/70 p-1 gap-1">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'search'
                    ? 'bg-white text-brand-700 shadow-sm border border-gray-200/60'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span>Pan-India Search</span>
              </button>
              <button
                onClick={() => setActiveTab('directory')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'directory'
                    ? 'bg-white text-brand-700 shadow-sm border border-gray-200/60'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>State & District Directory</span>
              </button>
            </div>

            {/* TAB 1: PAN-INDIA SEARCH */}
            {activeTab === 'search' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="p-3 border-b border-gray-100">
                  <div className="relative flex items-center">
                    <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      autoFocus
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search any village (gao), tehsil, district, pincode…"
                      className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none transition-all placeholder:text-gray-400"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery('')}
                        className="absolute right-3 p-0.5 rounded-full hover:bg-gray-200 text-gray-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Covers 100% of Indian villages, tehsils, mandis, and 6-digit PIN codes.
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[340px] divide-y divide-gray-50">
                  {searching && (
                    <div className="p-6 flex flex-col items-center justify-center text-gray-400 gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                      <span className="text-xs">Searching across all Indian territories…</span>
                    </div>
                  )}

                  {!searching && query.length >= 2 && results.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      <p className="text-sm font-medium">No direct match found for "{query}"</p>
                      <p className="text-xs mt-1 text-gray-400">Try entering your district, nearest tehsil, or 6-digit PIN code.</p>
                    </div>
                  )}

                  {!searching && query.length < 2 && (
                    <div className="p-4 text-center text-gray-400">
                      <Globe className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-gray-600">Type at least 2 characters to search</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        E.g. "Mauranipur", "Ralegan", "201009", "Varanasi", "Kudasan"
                      </p>
                    </div>
                  )}

                  {!searching && results.map((r, i) => {
                    const lat = r.latitude ?? r.lat ?? 0
                    const lon = r.longitude ?? r.lon ?? 0
                    const isCurrent = selectedLat && selectedLon &&
                      Math.abs(selectedLat - lat) < 0.005 &&
                      Math.abs(selectedLon - lon) < 0.005

                    return (
                      <button
                        key={r.id || `${r.name}-${i}`}
                        onClick={() => selectLocation({
                          area: r.display_label || `${r.name}, ${r.district || ''}, ${r.state || ''}`,
                          lat,
                          lon,
                          city: r.city || r.district,
                          state: r.state,
                          district: r.district,
                          village: r.village,
                          tehsil: r.tehsil,
                          pincode: r.pincode,
                          accuracy: r.accuracy || 'exact',
                        })}
                        className={`w-full text-left p-3 hover:bg-brand-50/80 transition-colors flex items-start gap-2.5 ${
                          isCurrent ? 'bg-brand-50/50' : ''
                        }`}
                      >
                        <div className="p-1.5 rounded-lg bg-gray-100 text-brand-600 mt-0.5 flex-shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-gray-900 truncate">
                              {r.name}
                            </span>
                            {r.coverage_status && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {r.coverage_status}
                              </span>
                            )}
                            {isCurrent && (
                              <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto flex-shrink-0" />
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1">
                            {r.village && (
                              <span className="font-medium text-amber-700">📍 Gao: {r.village} ·</span>
                            )}
                            {r.tehsil && (
                              <span>Tehsil: {r.tehsil} ·</span>
                            )}
                            {r.district && (
                              <span>{r.district}, </span>
                            )}
                            {r.state && (
                              <span className="font-medium text-gray-700">{r.state}</span>
                            )}
                            {r.pincode && (
                              <span className="text-gray-400 font-mono">[{r.pincode}]</span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: STATE & DISTRICT DIRECTORY */}
            {activeTab === 'directory' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Mode A: Select State */}
                {!selectedStateObj && (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="p-3 border-b border-gray-100">
                      <div className="relative flex items-center">
                        <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                          value={stateFilter}
                          onChange={e => setStateFilter(e.target.value)}
                          placeholder="Search Indian State or UT (36 total)…"
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-brand-500 outline-none"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">
                        Select a State or UT to view all administrative districts & cities:
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[340px] divide-y divide-gray-50">
                      {loadingStates ? (
                        <div className="p-8 flex items-center justify-center gap-2 text-gray-400">
                          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                          <span className="text-xs">Loading 36 States & UTs…</span>
                        </div>
                      ) : (
                        filteredStates.map(st => (
                          <button
                            key={st.code}
                            onClick={() => {
                              setSelectedStateObj(st)
                              setDistrictFilter('')
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-brand-50 transition-colors flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-brand-500 flex-shrink-0" />
                              <span className="text-xs font-medium text-gray-900 group-hover:text-brand-700">
                                {st.name}
                              </span>
                              <span className="text-[10px] text-gray-400">({st.type})</span>
                            </div>
                            <span className="text-xs text-brand-500 group-hover:translate-x-0.5 transition-transform">
                              View Districts →
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Mode B: Select District within State */}
                {selectedStateObj && (
                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <button
                          onClick={() => setSelectedStateObj(null)}
                          className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>All States</span>
                        </button>
                        <span className="text-xs font-bold text-gray-900 truncate">
                          {selectedStateObj.name}
                        </span>
                      </div>

                      <div className="relative flex items-center">
                        <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                          autoFocus
                          value={districtFilter}
                          onChange={e => setDistrictFilter(e.target.value)}
                          placeholder={`Filter ${selectedStateObj.name} districts / cities…`}
                          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:border-brand-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[340px] divide-y divide-gray-50">
                      {loadingDistricts ? (
                        <div className="p-8 flex items-center justify-center gap-2 text-gray-400">
                          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                          <span className="text-xs">Loading districts in {selectedStateObj.name}…</span>
                        </div>
                      ) : filteredDistricts.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400">
                          No districts found matching filter.
                        </div>
                      ) : (
                        filteredDistricts.map((d, idx) => {
                          const lat = d.lat ?? d.latitude ?? 0
                          const lon = d.lon ?? d.longitude ?? 0
                          return (
                            <button
                              key={d.id || `${d.name}-${idx}`}
                              onClick={() => selectLocation({
                                area: `${d.name}, ${selectedStateObj.name}`,
                                lat,
                                lon,
                                city: d.name.split('/')[0].trim(),
                                state: selectedStateObj.name,
                                district: d.district,
                                pincode: d.pincode,
                                accuracy: 'district',
                              })}
                              className="w-full text-left px-3.5 py-2.5 hover:bg-brand-50 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-semibold text-gray-900">
                                  {d.name}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  District: {d.district} {d.pincode ? `· PIN ${d.pincode}` : ''}
                                </p>
                              </div>
                              <span className="text-[11px] font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                                Select
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
