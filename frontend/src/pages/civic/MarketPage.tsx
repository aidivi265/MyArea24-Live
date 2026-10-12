import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp, Fuel, Search, ArrowUp, ArrowDown, Minus,
  MapPin, CheckCircle2, RotateCcw, ChevronDown, ChevronUp, Building2
} from 'lucide-react'
import { marketApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { formatCurrency } from '@/utils'

const ALL_INDIAN_STATES_UTS = [
  { labelKey: 'market.my_detected_state', label: '📍 My Detected State', val: '' },
  { label: 'Delhi NCR', val: 'Delhi' },
  { label: 'Uttar Pradesh', val: 'Uttar Pradesh' },
  { label: 'Haryana', val: 'Haryana' },
  { label: 'Maharashtra', val: 'Maharashtra' },
  { label: 'Karnataka', val: 'Karnataka' },
  { label: 'Rajasthan', val: 'Rajasthan' },
  { label: 'Gujarat', val: 'Gujarat' },
  { label: 'West Bengal', val: 'West Bengal' },
  { label: 'Tamil Nadu', val: 'Tamil Nadu' },
  { label: 'Telangana', val: 'Telangana' },
  { label: 'Andhra Pradesh', val: 'Andhra Pradesh' },
  { label: 'Madhya Pradesh', val: 'Madhya Pradesh' },
  { label: 'Bihar', val: 'Bihar' },
  { label: 'Punjab', val: 'Punjab' },
  { label: 'Kerala', val: 'Kerala' },
  { label: 'Odisha', val: 'Odisha' },
  { label: 'Assam', val: 'Assam' },
  { label: 'Uttarakhand', val: 'Uttarakhand' },
  { label: 'Jharkhand', val: 'Jharkhand' },
  { label: 'Chhattisgarh', val: 'Chhattisgarh' },
  { label: 'Goa', val: 'Goa' },
  { label: 'Himachal Pradesh', val: 'Himachal Pradesh' },
  { label: 'Jammu & Kashmir', val: 'Jammu and Kashmir' },
  { label: 'Chandigarh', val: 'Chandigarh' },
  { label: 'Puducherry', val: 'Puducherry' },
  { label: 'Tripura', val: 'Tripura' },
  { label: 'Meghalaya', val: 'Meghalaya' },
  { label: 'Manipur', val: 'Manipur' },
  { label: 'Nagaland', val: 'Nagaland' },
  { label: 'Mizoram', val: 'Mizoram' },
  { label: 'Arunachal Pradesh', val: 'Arunachal Pradesh' },
  { label: 'Sikkim', val: 'Sikkim' },
  { label: 'Ladakh', val: 'Ladakh' },
  { label: 'Andaman & Nicobar', val: 'Andaman and Nicobar Islands' },
  { label: 'Dadra & Nagar Haveli', val: 'Dadra and Nagar Haveli and Daman and Diu' },
  { label: 'Lakshadweep', val: 'Lakshadweep' },
]

export default function MarketPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedState, selectedDistrict, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [fuelStateFilter, setFuelStateFilter] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAllStatesFuel, setShowAllStatesFuel] = useState(false)

  const CATEGORIES = [
    { id: 'all', label: t('market.cat_all'), emoji: '🌾' },
    { id: 'Vegetables', label: t('market.cat_veg'), emoji: '🥬' },
    { id: 'Fruits', label: t('market.cat_fruits'), emoji: '🍎' },
    { id: 'Grains & Pulses', label: t('market.cat_grains'), emoji: '🍚' },
    { id: 'Spices & Oils', label: t('market.cat_spices'), emoji: '🫚' },
  ]

  // Scroll to hash on mount
  useEffect(() => {
    if (window.location.hash === '#fuel') {
      const el = document.getElementById('fuel')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  // Mandi Rates Query - Grounded by User Location
  const { data: rates, isLoading: rLoading, refetch } = useQuery({
    queryKey: ['mandi', search, stateFilter || selectedState, activeCategory, selectedDistrict, selectedArea, selectedLat, selectedLon],
    queryFn: () => marketApi.rates({
      search: search || undefined,
      state: stateFilter || selectedState || undefined,
      district: selectedDistrict || undefined,
      city: selectedCity || undefined,
      area: selectedArea || undefined,
      category: activeCategory !== 'all' ? activeCategory : undefined,
      lat: selectedLat || undefined,
      lon: selectedLon || undefined,
      limit: 75,
    }),
    staleTime: 15 * 60 * 1000,
  })

  // Fuel Rates Query - Grounded by User State, Locality & Coordinates
  const effectiveFuelState = fuelStateFilter || stateFilter || selectedState
  const targetCity = selectedCity || selectedDistrict || selectedArea
  const { data: fuel, isLoading: fLoading } = useQuery({
    queryKey: ['fuel', targetCity, effectiveFuelState, selectedLat, selectedLon],
    queryFn: () => marketApi.fuel({
      city: targetCity || undefined,
      state: effectiveFuelState || undefined,
      lat: selectedLat || undefined,
      lon: selectedLon || undefined,
    }),
    staleTime: 60 * 60 * 1000,
  })

  // Auto-scroll to #fuel anchor if navigated from sidebar or link
  useEffect(() => {
    if (window.location.hash === '#fuel') {
      setTimeout(() => {
        const el = document.getElementById('fuel')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [])

  const TrendIcon = ({ trend }: { trend?: string }) => {
    const trendLower = (trend || '').toLowerCase()
    if (trendLower.includes('rise') || trendLower.includes('up') || trendLower.includes('+')) {
      return <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><ArrowUp className="h-3 w-3" /> {trend}</span>
    }
    if (trendLower.includes('decreas') || trendLower.includes('down') || trendLower.includes('-')) {
      return <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><ArrowDown className="h-3 w-3" /> {trend}</span>
    }
    return <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"><Minus className="h-3 w-3" /> {t('market.stable')}</span>
  }

  return (
    <>
      <SEOMeta
        title={`${t('market.title')} — ${selectedArea}`}
        description={`Today's verified wholesale APMC mandi commodity prices, arrival volumes, and daily fuel rates for ${selectedArea}.`}
      />

      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header with Location Grounding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-brand-600" />
              <span>{t('market.title')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-700 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-brand-600" /> {selectedArea}
              </span>
              <span className="text-gray-300">·</span>
              <span>{t('market.subtitle')}</span>
            </p>
          </div>

          {/* Sourcing Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-800 self-start sm:self-auto">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{t('market.verified_badge')}</span>
          </div>
        </div>

        {/* ─── FUEL PRICES CARD ─── */}
        <div id="fuel" className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-3xl border border-amber-200/60 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Fuel className="h-4 w-4 text-orange-600" />
                <span>
                  {t('market.fuel_title')} — {fuel?.state || effectiveFuelState || 'India'}
                  {fuel?.city && fuel.city.toLowerCase() !== (fuel?.state || effectiveFuelState || '').toLowerCase() ? ` (${fuel.city})` : ''}
                </span>
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {fuel?.is_live ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {t('market.fuel_live')}
                  </span>
                ) : (
                  <span>{t('market.fuel_benchmark')}</span>
                )}
              </p>
            </div>

            {/* State filter buttons & full 36-state dropdown */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {ALL_INDIAN_STATES_UTS.slice(0, 5).map(({ labelKey, label, val }) => (
                  <button
                    key={label}
                    onClick={() => setFuelStateFilter(val)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition whitespace-nowrap ${
                      fuelStateFilter === val
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white/80 hover:bg-white text-gray-700 border border-amber-200/60'
                    }`}
                  >
                    {labelKey ? t(labelKey) : label}
                  </button>
                ))}
              </div>

              {/* Full 36 States/UTs Searchable Selector */}
              <select
                value={fuelStateFilter}
                onChange={(e) => setFuelStateFilter(e.target.value)}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white text-gray-800 border border-amber-300 shadow-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                title="Select from all 36 Indian States and Union Territories"
              >
                <option value="">{t('market.all_states')}</option>
                {ALL_INDIAN_STATES_UTS.filter(s => s.val).map(({ label, val }) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {fLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-2xl p-4 border border-amber-100 bg-white/70 animate-pulse h-20" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  label: t('market.petrol'),
                  value: fuel?.petrol ?? 94.65,
                  unit: '/litre',
                  color: 'text-red-600',
                  bg: 'bg-red-50/50',
                  available: true,
                },
                {
                  label: t('market.diesel'),
                  value: fuel?.diesel ?? 87.75,
                  unit: '/litre',
                  color: 'text-blue-600',
                  bg: 'bg-blue-50/50',
                  available: true,
                },
                {
                  label: t('market.cng'),
                  value: fuel?.cng,
                  unit: '/kg',
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50/50',
                  available: fuel?.cng !== null && fuel?.cng !== undefined,
                },
              ].map(({ label, value, unit, color, bg, available }) => (
                <div key={label} className={`rounded-2xl p-4 border border-amber-100 bg-white shadow-sm flex items-center justify-between ${bg}`}>
                  <div>
                    <p className="text-xs font-semibold text-gray-500">{label}</p>
                    {available && typeof value === 'number' ? (
                      <p className={`text-2xl font-black mt-0.5 tracking-tight ${color}`}>₹{value.toFixed(2)}</p>
                    ) : (
                      <div className="mt-1">
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">{t('market.cgd_pending')}</span>
                      </div>
                    )}
                  </div>
                  {available && (
                    <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                      {unit}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Expandable State-by-State Fuel Rates Table */}
          {fuel?.items && fuel.items.length > 1 && (
            <div className="pt-2 border-t border-amber-100/70">
              <button
                onClick={() => setShowAllStatesFuel(prev => !prev)}
                className="flex items-center justify-between w-full text-xs font-bold text-amber-900 hover:text-amber-700 py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-amber-700" />
                  {t('market.compare_fuel')} ({fuel.items.length})
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 px-2 py-0.5 rounded-lg">
                  {showAllStatesFuel ? t('market.hide_table') : t('market.show_all_states')}
                  {showAllStatesFuel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </span>
              </button>

              {showAllStatesFuel && (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-amber-200/60 bg-white/90 shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-amber-50/80 text-amber-900 border-b border-amber-200/50">
                      <tr>
                        <th className="px-3.5 py-2 font-bold">State / Metro</th>
                        <th className="px-3 py-2 font-bold">City</th>
                        <th className="px-3 py-2 font-bold text-red-600">{t('market.petrol')} (₹/L)</th>
                        <th className="px-3 py-2 font-bold text-blue-600">{t('market.diesel')} (₹/L)</th>
                        <th className="px-3 py-2 font-bold text-emerald-600">{t('market.cng')} (₹/kg)</th>
                        <th className="px-3 py-2 font-bold text-gray-500">{t('market.trend')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {fuel.items.map((item, idx) => (
                        <tr key={`${item.state}-${item.city}-${idx}`} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-3.5 py-2 font-semibold text-gray-900">{item.state}</td>
                          <td className="px-3 py-2 text-gray-600">{item.city}</td>
                          <td className="px-3 py-2 font-bold text-red-600">₹{item.petrol.toFixed(2)}</td>
                          <td className="px-3 py-2 font-bold text-blue-600">₹{item.diesel.toFixed(2)}</td>
                          <td className="px-3 py-2 font-semibold text-emerald-700">
                            {item.cng ? `₹${item.cng.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                              {item.trend || t('market.stable')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-gray-500 pt-1 gap-1">
            <span>{fuel?.vat_info || `Official benchmark retail fuel prices for ${fuel?.state || effectiveFuelState || 'India'}`}</span>
            <span className="font-medium text-gray-400">Source: {fuel?.source || 'Petroleum Ministry & State OMCs'}</span>
          </div>
        </div>

        {/* ─── MANDI RATES SECTION ─── */}
        <div className="space-y-4">
          {/* Active Mandi Grounding Information Pill */}
          {rates?.matched_mandi && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-emerald-900">{t('market.primary_wholesale_source')}</span>
                <span className="font-extrabold text-emerald-800 underline decoration-emerald-300">
                  {rates.matched_mandi}
                </span>
                <span className="text-emerald-600 font-medium">
                  ({rates.matched_state}{rates.matched_district ? ` · ${rates.matched_district}` : ''})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2.5 py-1 rounded-xl shadow-xs border border-emerald-100 whitespace-nowrap">
                {rates.total} {t('market.commodities_listed')}
              </span>
            </div>
          )}

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {CATEGORIES.map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => setActiveCategory(id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-xs ${
                  activeCategory === id
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                }`}
              >
                <span>{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Search & State Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-brand-500">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('market.search_commodity')}
                className="flex-1 text-sm outline-none bg-transparent text-gray-800"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-xs text-gray-400 hover:text-gray-600">
                  {t('common.clear')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={stateFilter}
                onChange={e => setStateFilter(e.target.value)}
                placeholder={`State (e.g. ${selectedState || 'Uttar Pradesh'})...`}
                className="text-xs sm:text-sm border border-gray-200 rounded-2xl px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 w-full sm:w-48 shadow-sm text-gray-700"
              />
              {(stateFilter || search || activeCategory !== 'all') && (
                <button
                  onClick={() => { setStateFilter(''); setSearch(''); setActiveCategory('all'); refetch() }}
                  title={t('common.reset_all')}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl transition"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table & Cards */}
          {rLoading ? (
            <CardSkeleton />
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3.5">{t('market.commodity')}</th>
                      <th className="text-left px-4 py-3.5 hidden sm:table-cell">{t('market.variety')}</th>
                      <th className="text-left px-4 py-3.5">{t('market.apmc_mandi')}</th>
                      <th className="text-right px-4 py-3.5">{t('market.modal_price')}</th>
                      <th className="text-right px-4 py-3.5 hidden md:table-cell">{t('market.price_range')}</th>
                      <th className="text-center px-4 py-3.5 hidden lg:table-cell">{t('market.arrival_volume')}</th>
                      <th className="text-center px-4 py-3.5">{t('market.trend')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(rates?.items ?? []).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-gray-900 leading-snug">{r.commodity}</div>
                          <div className="text-[11px] text-gray-400 sm:hidden mt-0.5">{r.variety}</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-500 hidden sm:table-cell font-medium">
                          {r.variety || 'Standard'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600">
                          <div className="font-medium truncate max-w-[180px]">{r.mandi_name || r.mandi}</div>
                          <div className="text-[10px] text-gray-400">{r.state}</div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-brand-700 text-base">
                          {formatCurrency(r.modal_price ?? 0)}
                          <span className="text-xs font-semibold text-gray-400 ml-1">/{r.unit}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-xs text-gray-500 font-mono hidden md:table-cell">
                          {formatCurrency(r.min_price ?? 0)} – {formatCurrency(r.max_price ?? 0)}
                        </td>
                        <td className="px-4 py-3.5 text-center text-xs text-gray-500 hidden lg:table-cell">
                          <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-[11px]">
                            {r.arrival_volume || 'Normal'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <TrendIcon trend={r.price_trend || r.trend} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(rates?.items ?? []).length === 0 && (
                  <div className="py-12">
                    <EmptyState
                      title={t('market.no_commodities')}
                      description={`${t('market.no_commodities_desc')} (${selectedArea})`}
                    />
                  </div>
                )}
              </div>

              {rates?.attribution && (
                <div className="p-3 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
                  <span>{rates.attribution}</span>
                  <span className="text-[11px]">Updated daily from state agricultural marketing boards</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

