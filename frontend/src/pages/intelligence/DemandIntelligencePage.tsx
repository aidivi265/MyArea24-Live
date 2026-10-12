import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  ShoppingBag,
  Coffee,
  Car,
  Umbrella,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Store,
  Truck,
  User,
  Users,
} from 'lucide-react'
import { intelligenceApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { UnavailableState } from '@/components/shared/States'

export default function DemandIntelligencePage() {
  const { selectedArea, selectedLat, selectedLon } = useLocationStore()
  const [stakeholderView, setStakeholderView] = useState<'ALL' | 'MERCHANT' | 'DELIVERY' | 'CONSUMER'>('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['demand-intelligence', selectedArea, selectedLat, selectedLon],
    queryFn: () =>
      intelligenceApi.demand({
        area: selectedArea,
        lat: selectedLat ?? undefined,
        lon: selectedLon ?? undefined,
      }),
    staleTime: 60 * 1000,
  })

  const getCategoryIcon = (cat: string) => {
    if (cat.includes('Food') || cat.includes('Beverages')) return <Coffee className="h-5 w-5 text-amber-500" />
    if (cat.includes('Groceries')) return <ShoppingBag className="h-5 w-5 text-emerald-500" />
    if (cat.includes('Mobility') || cat.includes('Cab')) return <Car className="h-5 w-5 text-blue-500" />
    return <Umbrella className="h-5 w-5 text-purple-500" />
  }

  return (
    <>
      <SEOMeta
        title={`Multi-Signal Demand Intelligence — ${selectedArea}`}
        description="Predictive demand surges across quick food, delivery, cabs, and seasonal commerce powered by live weather, traffic, and event signals."
      />
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Multi-Signal Demand Intelligence</h1>
              <p className="text-sm text-gray-500">
                Predicting localized commercial surges across merchants, delivery fleets, and residents (PPT Slide 08).
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : !data ? (
          <UnavailableState message="Demand intelligence telemetry currently unavailable for this locality." />
        ) : (
          <div className="space-y-6">
            {/* Surge Overview Header */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" /> Real-Time Local Market Surge Score
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-black">{data.composite_demand_index.toFixed(0)}</span>
                    <span className="text-lg text-purple-200 font-medium">/ 100</span>
                  </div>
                  <p className="text-sm text-purple-200 mt-1">
                    State: <strong className="text-white uppercase">{data.market_state.replace('_', ' ')}</strong> in {data.area}
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-xs space-y-1.5 max-w-sm">
                  <p className="font-semibold text-purple-200 uppercase tracking-wide text-[11px]">Fused Telemetry Signals:</p>
                  <p className="text-white/90">🌤️ {data.current_weather_summary}</p>
                  <p className="text-white/90">🚗 {data.current_traffic_summary}</p>
                  <p className="text-white/90">🎪 {data.active_local_events_count} active neighbourhood events nearby</p>
                </div>
              </div>
            </div>

            {/* 3-Stakeholder Triad Cards (PPT Slide 08) */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Stakeholder Impact Matrix
                </h2>
                {/* Stakeholder Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
                  {[
                    { id: 'ALL', label: 'All Stakeholders', icon: Users },
                    { id: 'MERCHANT', label: '🏪 Local Businesses', icon: Store },
                    { id: 'DELIVERY', label: '🚚 Delivery Fleets', icon: Truck },
                    { id: 'CONSUMER', label: '👤 Consumers', icon: User },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStakeholderView(s.id as any)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition whitespace-nowrap border ${
                        stakeholderView === s.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* Stakeholder 1: Local Businesses */}
                <div className="bg-gradient-to-br from-amber-50/70 to-orange-50/50 rounded-2xl border border-amber-200/80 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs">Local Businesses</h3>
                      <p className="text-[10px] text-amber-800 font-semibold uppercase">Prepare Inventory & Staffing</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {data.stakeholder_summary?.local_businesses ||
                      'Anticipate customer surges before events and prepare supplies, dining seating, and staff.'}
                  </p>
                </div>

                {/* Stakeholder 2: Delivery Services */}
                <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/50 rounded-2xl border border-blue-200/80 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs">Delivery Services</h3>
                      <p className="text-[10px] text-blue-800 font-semibold uppercase">Pre-position Fleet & Riders</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {data.stakeholder_summary?.delivery_services ||
                      'Pre-position fleet and riders around zones with emerging food and grocery demand.'}
                  </p>
                </div>

                {/* Stakeholder 3: Local Consumers */}
                <div className="bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-xs">Local Consumers</h3>
                      <p className="text-[10px] text-emerald-800 font-semibold uppercase">Know Wait Times & Crowds</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {data.stakeholder_summary?.local_consumers ||
                      'Understand where waiting times or footfall will peak, allowing smarter personal scheduling.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Category Demand Surge Cards */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-gray-900">Predictive Commercial Category Demand</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.categories.map((cat) => (
                  <div
                    key={cat.category}
                    className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4 hover:border-purple-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gray-50 rounded-2xl">{getCategoryIcon(cat.category)}</div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{cat.category}</h3>
                          <span
                            className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-0.5 ${
                              cat.surge_level === 'PEAK'
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : cat.surge_level === 'HIGH'
                                ? 'bg-purple-50 text-purple-600 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            }`}
                          >
                            {cat.surge_level} SURGE ({cat.demand_surge_multiplier}x)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contributing Drivers */}
                    <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 rounded-2xl p-3 border border-gray-100">
                      <p className="font-bold text-gray-700 text-[11px] uppercase tracking-wider">Multi-Signal Drivers:</p>
                      {cat.primary_drivers.map((d, i) => (
                        <p key={i} className="flex items-start gap-1.5">
                          <span className="text-purple-500 font-bold">•</span>
                          <span>{d}</span>
                        </p>
                      ))}
                    </div>

                    {/* Merchant Action Items */}
                    {(stakeholderView === 'ALL' || stakeholderView === 'MERCHANT') && (
                      <div className="space-y-1.5 text-xs bg-amber-50/60 p-3 rounded-2xl border border-amber-100">
                        <p className="font-bold text-amber-900 flex items-center gap-1.5">
                          <Store className="h-3.5 w-3.5 text-amber-600" />
                          🏪 Store Owners & Merchants (Inventory & Staffing):
                        </p>
                        <ul className="space-y-1 pl-5 list-disc text-gray-700 text-[11px]">
                          {cat.merchant_action_items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Delivery Fleet Advisory */}
                    {(stakeholderView === 'ALL' || stakeholderView === 'DELIVERY') && cat.delivery_fleet_advisory && (
                      <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100 text-xs space-y-1">
                        <p className="font-bold text-blue-900 flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-blue-600" />
                          🚚 Delivery Fleets & Logistics:
                        </p>
                        <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                          {cat.delivery_fleet_advisory}
                        </p>
                      </div>
                    )}

                    {/* Consumer Insight & Wait Time */}
                    {(stakeholderView === 'ALL' || stakeholderView === 'CONSUMER') && (
                      <div className="border-t border-gray-100 pt-3 space-y-2 text-xs">
                        <div className="text-purple-700 flex items-start gap-1.5 font-medium">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-purple-600 mt-0.5" />
                          <span>{cat.consumer_insight}</span>
                        </div>
                        {cat.peak_crowd_window && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                            <Clock className="h-3 w-3 text-emerald-600" />
                            <span>{cat.peak_crowd_window}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Merchant Action Callout Banner */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider bg-purple-200/60 px-2 py-0.5 rounded">
                    Local Merchant Radar
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm">Operate a store or service in {data.area}?</h3>
                </div>
                <p className="text-xs text-gray-600">
                  Leverage predicted surge multipliers by publishing a 1-click flash discount deal in your Merchant Hub.
                </p>
              </div>

              <a
                href="/merchant"
                className="shrink-0 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition text-center"
              >
                Launch Surge Deal →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
