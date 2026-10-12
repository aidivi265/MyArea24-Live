import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Navigation, ShieldCheck, AlertTriangle, CloudRain, Clock, ArrowRight, Zap, CheckCircle2, MapPin } from 'lucide-react'
import { intelligenceApi, locationApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { CardSkeleton } from '@/components/shared/Skeleton'
import type { LocationResult } from '@/types'

export default function RouteRiskPage() {
  const { selectedArea, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [searchParams] = useSearchParams()

  const paramDestName = searchParams.get('dest_name')
  const paramDestLat = searchParams.get('dest_lat') ? parseFloat(searchParams.get('dest_lat')!) : null
  const paramDestLon = searchParams.get('dest_lon') ? parseFloat(searchParams.get('dest_lon')!) : null

  const baseLat = selectedLat ?? 28.5672
  const baseLon = selectedLon ?? 77.2100
  const cityLabel = selectedCity || (selectedArea ? selectedArea.split(',')[0].trim() : 'Delhi')

  const [originName, setOriginName] = useState(selectedArea || 'Delhi AIIMS Ring Road')
  const [originLat, setOriginLat] = useState<number>(baseLat)
  const [originLon, setOriginLon] = useState<number>(baseLon)

  const [destName, setDestName] = useState(
    paramDestName || `${cityLabel} Central Hub / Junction`
  )
  const [destLat, setDestLat] = useState<number>(paramDestLat ?? Number((baseLat + 0.048).toFixed(4)))
  const [destLon, setDestLon] = useState<number>(paramDestLon ?? Number((baseLon + 0.036).toFixed(4)))

  const [originSuggestions, setOriginSuggestions] = useState<LocationResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<LocationResult[]>([])
  const [activeField, setActiveField] = useState<'origin' | 'dest' | null>(null)

  useEffect(() => {
    if (selectedArea && selectedLat !== null && selectedLon !== null) {
      setOriginName(selectedArea)
      setOriginLat(selectedLat)
      setOriginLon(selectedLon)
      if (!paramDestName) {
        const cLabel = selectedCity || selectedArea.split(',')[0].trim()
        setDestName(`${cLabel} Central Hub / Junction`)
        setDestLat(Number((selectedLat + 0.048).toFixed(4)))
        setDestLon(Number((selectedLon + 0.036).toFixed(4)))
      }
    }
  }, [selectedArea, selectedCity, selectedLat, selectedLon, paramDestName])

  // Autocomplete search for Origin
  useEffect(() => {
    if (activeField !== 'origin' || originName.trim().length < 2) {
      setOriginSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await locationApi.search(originName.trim())
        setOriginSuggestions(res || [])
      } catch {
        setOriginSuggestions([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [originName, activeField])

  // Autocomplete search for Destination
  useEffect(() => {
    if (activeField !== 'dest' || destName.trim().length < 2) {
      setDestSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await locationApi.search(destName.trim())
        setDestSuggestions(res || [])
      } catch {
        setDestSuggestions([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [destName, activeField])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['route-risk', originName, originLat, originLon, destName, destLat, destLon],
    queryFn: () =>
      intelligenceApi.routesEvaluate({
        origin_name: originName,
        origin_latitude: originLat,
        origin_longitude: originLon,
        destination_name: destName,
        destination_latitude: destLat,
        destination_longitude: destLon,
      }),
    staleTime: 60 * 1000,
  })

  return (
    <>
      <SEOMeta
        title="Route Prioritization & Risk Assessment — MyArea24"
        description="Contextual route risk evaluation considering live traffic delays, rainfall, and waterlogging hazards across India."
      />
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Navigation className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dynamic Route Prioritization</h1>
              <p className="text-sm text-gray-500">
                Not just fastest ETA — AI explains <em>why</em> a corridor is safer based on waterlogging, congestion & incidents.
              </p>
            </div>
          </div>
          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-xl transition self-start"
          >
            Live Turn-by-Turn Map <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Input Bar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div className="relative">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Origin Point ({originLat.toFixed(3)}, {originLon.toFixed(3)})
              </label>
              <input
                type="text"
                value={originName}
                onFocus={() => setActiveField('origin')}
                onChange={(e) => setOriginName(e.target.value)}
                className="w-full text-sm font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Search any origin city or locality in India..."
              />
              {activeField === 'origin' && originSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-30 max-h-48 overflow-y-auto p-1">
                  {originSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setOriginName(s.display_label || s.name)
                        setOriginLat(s.latitude ?? s.lat ?? originLat)
                        setOriginLon(s.longitude ?? s.lon ?? originLon)
                        setOriginSuggestions([])
                        setActiveField(null)
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 rounded-lg flex items-center gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate font-medium text-gray-800">{s.display_label || `${s.name}, ${s.state || ''}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Destination ({destLat.toFixed(3)}, {destLon.toFixed(3)})
              </label>
              <input
                type="text"
                value={destName}
                onFocus={() => setActiveField('dest')}
                onChange={(e) => setDestName(e.target.value)}
                className="w-full text-sm font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Search any destination in India..."
              />
              {activeField === 'dest' && destSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-30 max-h-48 overflow-y-auto p-1">
                  {destSuggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDestName(s.display_label || s.name)
                        setDestLat(s.latitude ?? s.lat ?? destLat)
                        setDestLon(s.longitude ?? s.lon ?? destLon)
                        setDestSuggestions([])
                        setActiveField(null)
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 rounded-lg flex items-center gap-2"
                    >
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate font-medium text-gray-800">{s.display_label || `${s.name}, ${s.state || ''}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: `${cityLabel} Airport / Terminal`, dlat: 0.085, dlon: -0.065 },
                { label: `${cityLabel} Railway Junction`, dlat: 0.042, dlon: 0.031 },
                { label: `${cityLabel} IT / Commercial Park`, dlat: -0.055, dlon: 0.048 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDestName(preset.label)
                    setDestLat(Number((originLat + preset.dlat).toFixed(4)))
                    setDestLon(Number((originLon + preset.dlon).toFixed(4)))
                    setActiveField(null)
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition"
                >
                  ➔ {preset.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setActiveField(null)
                refetch()
              }}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2 rounded-xl transition"
            >
              <Zap className="h-4 w-4" /> Evaluate Corridor Risks
            </button>
          </div>
        </div>

        {isLoading ? (
          <CardSkeleton />
        ) : !data ? (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200 text-gray-500 text-sm">
            Unable to evaluate route corridors at this time.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Advisory Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-200">
                <ShieldCheck className="h-4 w-4" /> Why This Route? — AI Commute Intelligence Rationale
              </div>
              <p className="text-base font-medium leading-relaxed">{data.ai_commute_advisory}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {data.time_saved_vs_worst_min > 0 && (
                  <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" />
                    Saves up to {data.time_saved_vs_worst_min} minutes vs high-risk corridor
                  </div>
                )}
                {(data.active_community_reports_count ?? 0) > 0 && (
                  <Link
                    to="/community"
                    className="inline-flex items-center gap-1.5 bg-amber-400/25 hover:bg-amber-400/35 border border-amber-300/40 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-amber-100 transition"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                    {data.active_community_reports_count} Verified Citizen Ground Report{data.active_community_reports_count === 1 ? '' : 's'} Fused
                  </Link>
                )}
              </div>
            </div>

            {/* Evaluated Corridors Grid */}
            <div className="space-y-3">
              <h2 className="text-base font-bold text-gray-800">Evaluated Travel Corridors ({data.evaluated_corridors.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.evaluated_corridors.map((c) => {
                  const isRec = c.is_recommended
                  return (
                    <div
                      key={c.route_name}
                      className={`relative rounded-2xl p-5 border transition flex flex-col justify-between ${
                        isRec
                          ? 'bg-emerald-50/50 border-emerald-400 shadow-sm ring-2 ring-emerald-500/20'
                          : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                      }`}
                    >
                      {isRec && (
                        <div className="absolute -top-3 right-4 bg-emerald-600 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Recommended Route
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{c.route_name}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{c.distance_km} km total corridor</p>
                        </div>

                        {/* Travel Time & Delays */}
                        <div className="bg-gray-50 rounded-xl p-3 flex items-baseline justify-between">
                          <div>
                            <span className="text-2xl font-black text-gray-900">{c.total_duration_min}</span>
                            <span className="text-xs font-medium text-gray-500 ml-1">mins</span>
                          </div>
                          {c.estimated_delay_min > 0 ? (
                            <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> +{c.estimated_delay_min}m delay
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-emerald-600">Free Flow</span>
                          )}
                        </div>

                        {/* Risk & Hazards */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center py-1 border-b border-gray-100">
                            <span className="text-gray-500">Risk Score:</span>
                            <span
                              className={`font-bold px-2 py-0.5 rounded ${
                                c.risk_score >= 50
                                  ? 'bg-red-50 text-red-600'
                                  : c.risk_score >= 25
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-emerald-50 text-emerald-600'
                              }`}
                            >
                              {c.risk_score.toFixed(0)}/100 ({c.risk_level})
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-100">
                            <span className="text-gray-500">Waterlogging Risk:</span>
                            <span
                              className={`font-semibold flex items-center gap-1 ${
                                c.waterlogging_risk === 'CRITICAL' || c.waterlogging_risk === 'HIGH'
                                  ? 'text-red-600 font-bold'
                                  : 'text-gray-700'
                              }`}
                            >
                              <CloudRain className="h-3.5 w-3.5" /> {c.waterlogging_risk}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-gray-100">
                            <span className="text-gray-500">Traffic Incidents:</span>
                            <span className="font-semibold text-gray-800">{c.traffic_incidents_count} active</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-500">Citizen Ground Reports:</span>
                            <span
                              className={`font-semibold ${
                                (c.community_reports_count ?? 0) > 0 ? 'text-amber-700 font-bold' : 'text-gray-600'
                              }`}
                            >
                              {c.community_reports_count ?? 0} verified
                            </span>
                          </div>
                        </div>

                        {/* Verified Community Hazards */}
                        {c.community_hazards && c.community_hazards.length > 0 && (
                          <div className="bg-orange-50/80 border border-orange-200/70 rounded-xl p-2.5 text-[11px] text-orange-900 space-y-1">
                            <p className="font-bold text-orange-800 uppercase tracking-wide text-[10px]">
                              Verified Citizen Signal Mesh
                            </p>
                            {c.community_hazards.map((hz, idx) => (
                              <p key={idx} className="flex items-start gap-1.5 font-medium">
                                <AlertTriangle className="h-3 w-3 shrink-0 text-orange-600 mt-0.5" />
                                <span>{hz}</span>
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Warnings */}
                        {c.key_warnings.length > 0 && (
                          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-2.5 text-[11px] text-amber-800 space-y-1">
                            {c.key_warnings.map((w, i) => (
                              <p key={i} className="flex items-start gap-1.5">
                                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 mt-0.5" />
                                <span>{w}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 italic">
                        <span className="font-semibold not-italic text-gray-800">Why this route: </span>
                        {c.recommendation_reason}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
