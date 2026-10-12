import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Zap,
  Cloud,
  Wind,
  Car,
  AlertTriangle,
  Bot,
  Navigation,
  TrendingUp,
  Radio,
  Filter,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Thermometer,
  Droplets,
  Activity,
  Compass,
  CheckCircle2,
  RefreshCw,
  Clock,
  Send,
  Sparkles,
  MapPin,
  ExternalLink,
  Info
} from 'lucide-react'
import { intelligenceApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { InsightCard } from '@/components/intelligence/InsightCard'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { cn } from '@/utils'
import type { Severity, InsightType } from '@/types'

const SEVERITY_OPTIONS: Severity[] = ['minor', 'moderate', 'high', 'severe']
const TYPE_OPTIONS: InsightType[] = [
  'weather_traffic_correlation',
  'event_weather_traffic_correlation',
  'community_ground_truth_correlation',
  'severe_public_alert',
  'air_quality_alert',
  'single_signal_traffic_notice',
]
const TYPE_LABELS: Record<string, string> = {
  weather_traffic_correlation: 'Weather + Traffic',
  event_weather_traffic_correlation: 'Event + Rain + Traffic',
  community_ground_truth_correlation: 'Citizen Signal Mesh',
  severe_public_alert: 'Public Alert',
  air_quality_alert: 'Air Quality',
  single_signal_traffic_notice: 'Traffic Notice',
  single_signal_weather_notice: 'Weather Notice',
}

const QUICK_PILLS = [
  { to: '/intelligence/weather', labelKey: 'intelligence_hub.pill_weather', icon: Cloud, bg: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200/60' },
  { to: '/intelligence/air-quality', labelKey: 'intelligence_hub.pill_aqi', icon: Wind, bg: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200/60' },
  { to: '/intelligence/traffic', labelKey: 'intelligence_hub.pill_traffic', icon: Car, bg: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200/60' },
  { to: '/intelligence/alerts', labelKey: 'intelligence_hub.pill_alerts', icon: AlertTriangle, bg: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200/60' },
  { to: '/intelligence/routes', labelKey: 'intelligence_hub.pill_routes', icon: Navigation, bg: 'bg-teal-50 text-teal-700 hover:bg-teal-100 border-teal-200/60' },
  { to: '/intelligence/demand', labelKey: 'intelligence_hub.pill_demand', icon: TrendingUp, bg: 'bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200/60' },
  { to: '/intelligence/community', labelKey: 'intelligence_hub.pill_community', icon: Radio, bg: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200/60' },
  { to: '/intelligence/assistant', labelKey: 'intelligence_hub.pill_saathi', icon: Bot, bg: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200/60' },
]

export default function IntelligencePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedArea, selectedLat, selectedLon, selectedCity, selectedState } = useLocationStore()

  const [severity, setSeverity] = useState<Severity | ''>('')
  const [type, setType] = useState<InsightType | ''>('')
  const [page, setPage] = useState(1)
  const [saathiInput, setSaathiInput] = useState('')

  const lat = selectedLat ?? 28.6692
  const lon = selectedLon ?? 77.4538

  // ─── Parallel Telemetry Queries ──────────────────────────────────────────────
  const { data: weatherData, isLoading: weatherLoading, refetch: refetchWeather } = useQuery({
    queryKey: ['intel-weather', selectedArea, lat, lon],
    queryFn: () => intelligenceApi.weather({ area: selectedArea || undefined, lat, lon }),
    staleTime: 60 * 1000,
  })

  const { data: aqiData, isLoading: aqiLoading, refetch: refetchAqi } = useQuery({
    queryKey: ['intel-aqi', selectedArea, lat, lon],
    queryFn: () => intelligenceApi.airQuality({ area: selectedArea || undefined, lat, lon }),
    staleTime: 60 * 1000,
  })

  const { data: trafficData, isLoading: trafficLoading, refetch: refetchTraffic } = useQuery({
    queryKey: ['intel-traffic', selectedArea, lat, lon],
    queryFn: () => intelligenceApi.traffic({ area: selectedArea || undefined, lat, lon }),
    staleTime: 60 * 1000,
  })

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['intel-alerts', lat, lon],
    queryFn: () => intelligenceApi.alerts({ lat, lon, scope: 'local' }),
    staleTime: 60 * 1000,
  })

  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['insights', selectedArea, lat, lon, severity, type, page],
    queryFn: () =>
      intelligenceApi.list({
        area: selectedArea,
        lat,
        lon,
        ...(severity ? { severity } : {}),
        ...(type ? { insight_type: type } : {}),
        is_active: true,
        page,
        page_size: 6,
      }),
    staleTime: 60 * 1000,
  })

  const handleRefreshAll = () => {
    refetchWeather()
    refetchAqi()
    refetchTraffic()
    refetchAlerts()
    refetchInsights()
  }

  // ─── Composite Safety & Livability Meter ──────────────────────────────────────
  const compositeStatus = useMemo(() => {
    const aqi = aqiData?.aqi_value ?? 0
    const alertsCount = alertsData?.length ?? 0
    const delayMinutes = trafficData?.cumulative_delay_minutes ?? 0
    const rainMm = weatherData?.precipitation_mm ?? 0

    let score: 'safe' | 'caution' | 'alert' = 'safe'
    let message = t('intelligence_hub.status_safe_msg')

    if (alertsCount > 0 || aqi > 300 || delayMinutes > 25 || rainMm > 15) {
      score = 'alert'
      message = t('intelligence_hub.status_alert_msg')
    } else if (aqi > 150 || delayMinutes > 10 || rainMm > 2) {
      score = 'caution'
      message = t('intelligence_hub.status_caution_msg')
    }

    return { score, message, aqi: aqiData?.aqi_value ?? 'N/A', alertsCount, delayMinutes }
  }, [aqiData, alertsData, trafficData, weatherData, t])

  const handleAskSaathi = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!saathiInput.trim()) return
    navigate(`/intelligence/assistant?q=${encodeURIComponent(saathiInput.trim())}`)
  }

  const handleQuickPrompt = (prompt: string) => {
    navigate(`/intelligence/assistant?q=${encodeURIComponent(prompt)}`)
  }

  const totalPages = insightsData ? Math.ceil(insightsData.total / 6) : 1

  return (
    <>
      <SEOMeta
        title={`${t('intelligence_hub.title')} — ${selectedArea}`}
        description={`Real-time civic intelligence, environmental sensors, traffic flow, and hazard prediction for ${selectedArea}, ${selectedCity || 'India'}.`}
      />

      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* ─── 1. Command Center Hero Header ───────────────────────────────── */}
        <div className="bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold tracking-wide uppercase">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {t('intelligence_hub.live_telemetry')}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
                <Zap className="h-7 w-7 text-gold-400" />
                {t('intelligence_hub.title')}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 max-w-xl flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand-400 flex-shrink-0" />
                <span>
                  {t('intelligence_hub.subtitle_prefix')}{' '}
                  <strong className="text-white font-bold">{selectedArea}</strong>
                  {selectedCity && `, ${selectedCity}`}
                  {selectedState && ` (${selectedState})`}.
                </span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefreshAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm border border-white/10 transition shadow-xs"
                title={t('intelligence_hub.refresh_btn')}
              >
                <RefreshCw className="h-4 w-4 text-slate-300" />
                {t('intelligence_hub.refresh_btn')}
              </button>
            </div>
          </div>

          {/* Composite Livability & Risk Meter */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0',
                  compositeStatus.score === 'safe' && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                  compositeStatus.score === 'caution' && 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                  compositeStatus.score === 'alert' && 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                )}
              >
                {compositeStatus.score === 'safe' && <ShieldCheck className="h-6 w-6" />}
                {compositeStatus.score === 'caution' && <Activity className="h-6 w-6" />}
                {compositeStatus.score === 'alert' && <ShieldAlert className="h-6 w-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    {t('intelligence_hub.city_status_label')}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wide',
                      compositeStatus.score === 'safe' && 'bg-emerald-500 text-slate-950 font-black',
                      compositeStatus.score === 'caution' && 'bg-amber-500 text-slate-950 font-black',
                      compositeStatus.score === 'alert' && 'bg-rose-500 text-white font-black'
                    )}
                  >
                    {compositeStatus.score === 'safe' && t('intelligence_hub.status_safe')}
                    {compositeStatus.score === 'caution' && t('intelligence_hub.status_caution')}
                    {compositeStatus.score === 'alert' && t('intelligence_hub.status_alert')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">{compositeStatus.message}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Wind className="h-3.5 w-3.5 text-emerald-400" />
                AQI: <strong className="text-white">{compositeStatus.aqi}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-orange-400" />
                {t('traffic.delay')}: <strong className="text-white">+{compositeStatus.delayMinutes}m</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                {t('nav.alerts')}: <strong className="text-white">{compositeStatus.alertsCount}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* ─── 2. Quick Sub-System Navigation Pills ────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {QUICK_PILLS.map((p) => {
            const Icon = p.icon
            return (
              <Link
                key={p.to}
                to={p.to}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0 shadow-2xs',
                  p.bg
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t(p.labelKey)}</span>
              </Link>
            )
          })}
        </div>

        {/* ─── 3. Core Sensor Telemetry Grid (4 Cards) ─────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-600" />
              {t('intelligence_hub.sensor_streams_title')}
            </h2>
            <span className="text-xs text-gray-400">{t('intelligence_hub.sensor_streams_subtitle')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sensor 1: Weather */}
            <div className="bg-white rounded-3xl border border-blue-100 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-2xl bg-blue-50 text-blue-600">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {t('weather.title')}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900">
                      {weatherData?.temperature_c !== undefined
                        ? `${Math.round(weatherData.temperature_c)}°C`
                        : weatherLoading ? '…' : '--°C'}
                    </span>
                    <span className="text-xs text-gray-500 font-medium truncate">
                      {weatherData?.condition_text || (weatherLoading ? t('common.loading') : t('weather.condition'))}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mt-1">
                    {t('weather.wind')} {weatherData?.wind_kph ?? '--'} km/h · {t('weather.humidity')} {weatherData?.humidity ?? '--'}%
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                  <Droplets className="h-3.5 w-3.5" />
                  {weatherData?.precipitation_mm ? `${weatherData.precipitation_mm}mm ${t('weather.precipitation')}` : t('weather.dry_clear')}
                </span>
                <Link
                  to="/intelligence/weather"
                  className="text-xs font-bold text-gray-700 hover:text-blue-600 inline-flex items-center gap-0.5"
                >
                  {t('weather.radar')} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Sensor 2: Air Quality (AQI) */}
            <div className="bg-white rounded-3xl border border-emerald-100 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600">
                    <Wind className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                      !aqiData?.aqi_value && 'bg-gray-100 text-gray-600',
                      aqiData?.aqi_value !== undefined && aqiData.aqi_value <= 50 && 'bg-green-100 text-green-700',
                      aqiData?.aqi_value !== undefined && aqiData.aqi_value > 50 && aqiData.aqi_value <= 100 && 'bg-lime-100 text-lime-700',
                      aqiData?.aqi_value !== undefined && aqiData.aqi_value > 100 && aqiData.aqi_value <= 200 && 'bg-yellow-100 text-yellow-800',
                      aqiData?.aqi_value !== undefined && aqiData.aqi_value > 200 && aqiData.aqi_value <= 300 && 'bg-orange-100 text-orange-800',
                      aqiData?.aqi_value !== undefined && aqiData.aqi_value > 300 && 'bg-red-100 text-red-700'
                    )}
                  >
                    {aqiData?.aqi_category || (aqiLoading ? t('common.loading') : t('aqi.no_station'))}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900">
                      {aqiData?.aqi_value ?? (aqiLoading ? '…' : 'N/A')}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">CPCB AQI</span>
                  </div>

                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {aqiData?.pm25 !== undefined || aqiData?.pm10 !== undefined
                      ? `PM2.5: ${aqiData?.pm25 ?? '--'} µg/m³ · PM10: ${aqiData?.pm10 ?? '--'}`
                      : (aqiData?.station_name || 'Nearest CPCB station telemetry')}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-gray-500 truncate max-w-[120px]">
                  {aqiData?.prominent_pollutant ? `Main: ${aqiData.prominent_pollutant}` : 'CPCB Air Network'}
                </span>
                <Link
                  to="/intelligence/air-quality"
                  className="text-xs font-bold text-gray-700 hover:text-emerald-600 inline-flex items-center gap-0.5"
                >
                  {t('aqi.pollutants')} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Sensor 3: Traffic Congestion */}
            <div className="bg-white rounded-3xl border border-orange-100 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-2xl bg-orange-50 text-orange-600">
                    <Car className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                    {trafficData?.congestion_level || (trafficLoading ? t('common.loading') : 'Clear')}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900">
                      {trafficData?.cumulative_delay_minutes !== undefined
                        ? `+${trafficData.cumulative_delay_minutes}m`
                        : trafficLoading ? '…' : '+0m'}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{t('traffic.delay')}</span>
                  </div>

                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {trafficData?.worst_corridor ? `Bottleneck: ${trafficData.worst_corridor}` : 'Arterial flow normal'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-orange-600 font-semibold truncate max-w-[120px]">
                  {trafficData?.total_incidents ? `${trafficData.total_incidents} ${t('traffic.incidents')}` : t('traffic.free_flow')}
                </span>
                <Link
                  to="/intelligence/traffic"
                  className="text-xs font-bold text-gray-700 hover:text-orange-600 inline-flex items-center gap-0.5"
                >
                  {t('traffic.corridors')} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Sensor 4: Civic & Emergency Alerts */}
            <div className="bg-white rounded-3xl border border-rose-100 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-2xl bg-rose-50 text-rose-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                    {t('intelligence_hub.govt_advisories')}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900">
                      {alertsData?.length ?? (alertsLoading ? '…' : 0)}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">{t('intelligence_hub.active_alerts')}</span>
                  </div>

                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {alertsData?.[0]?.headline || t('intelligence_hub.no_severe_alerts')}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-rose-600 font-semibold truncate max-w-[120px]">
                  {alertsData?.[0]?.sender || alertsData?.[0]?.event_type || 'IMD / NDMA'}
                </span>
                <Link
                  to="/intelligence/alerts"
                  className="text-xs font-bold text-gray-700 hover:text-rose-600 inline-flex items-center gap-0.5"
                >
                  {t('intelligence_hub.all_alerts')} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4. Advanced AI Sub-Systems Grid ─────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              {t('intelligence_hub.ai_engines_title')}
            </h2>
            <span className="text-xs text-gray-400">{t('intelligence_hub.ai_engines_subtitle')}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sub-system 1: Route Risk AI */}
            <div className="bg-gradient-to-br from-white to-teal-50/40 rounded-3xl border border-teal-100 p-5 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Navigation className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mt-3">{t('intelligence_hub.route_engine_title')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('intelligence_hub.route_engine_desc')}
                </p>
              </div>
              <Link
                to="/intelligence/routes"
                className="inline-flex items-center justify-between w-full pt-3 border-t border-teal-100/60 text-xs font-bold text-teal-700 hover:text-teal-900"
              >
                <span>{t('intelligence_hub.route_engine_cta')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Sub-system 2: Demand Intelligence */}
            <div className="bg-gradient-to-br from-white to-purple-50/40 rounded-3xl border border-purple-100 p-5 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mt-3">{t('intelligence_hub.demand_engine_title')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('intelligence_hub.demand_engine_desc')}
                </p>
              </div>
              <Link
                to="/intelligence/demand"
                className="inline-flex items-center justify-between w-full pt-3 border-t border-purple-100/60 text-xs font-bold text-purple-700 hover:text-purple-900"
              >
                <span>{t('intelligence_hub.demand_engine_cta')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Sub-system 3: Community Ground Truth */}
            <div className="bg-gradient-to-br from-white to-amber-50/40 rounded-3xl border border-amber-100 p-5 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Radio className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mt-3">{t('intelligence_hub.community_engine_title')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('intelligence_hub.community_engine_desc')}
                </p>
              </div>
              <Link
                to="/intelligence/community"
                className="inline-flex items-center justify-between w-full pt-3 border-t border-amber-100/60 text-xs font-bold text-amber-700 hover:text-amber-900"
              >
                <span>{t('intelligence_hub.community_engine_cta')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Sub-system 4: AI Saathi */}
            <div className="bg-gradient-to-br from-white to-indigo-50/40 rounded-3xl border border-indigo-100 p-5 shadow-xs hover:shadow-md transition space-y-3 flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mt-3">{t('intelligence_hub.saathi_engine_title')}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t('intelligence_hub.saathi_engine_desc')}
                </p>
              </div>
              <Link
                to="/intelligence/assistant"
                className="inline-flex items-center justify-between w-full pt-3 border-t border-indigo-100/60 text-xs font-bold text-indigo-700 hover:text-indigo-900"
              >
                <span>{t('intelligence_hub.saathi_engine_cta')}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ─── 5. Ask AI Saathi Quick Interactive Bar ──────────────────────── */}
        <div className="bg-gradient-to-r from-indigo-900 via-brand-900 to-indigo-950 text-white rounded-3xl p-6 shadow-sm border border-indigo-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-indigo-300" />
              <h3 className="font-extrabold text-sm sm:text-base tracking-wide">
                {t('intelligence_hub.ask_saathi_title')} {selectedArea}
              </h3>
            </div>
            <span className="text-xs text-indigo-200">{t('intelligence_hub.grounded_badge')}</span>
          </div>

          <form onSubmit={handleAskSaathi} className="relative flex items-center">
            <input
              type="text"
              value={saathiInput}
              onChange={(e) => setSaathiInput(e.target.value)}
              placeholder={t('intelligence_hub.saathi_placeholder')}
              className="w-full pl-4 pr-24 py-3 rounded-2xl bg-white/10 text-white placeholder-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400 border border-white/20 backdrop-blur-sm transition"
            />
            <button
              type="submit"
              className="absolute right-2 px-4 py-1.5 rounded-xl bg-gold-400 hover:bg-gold-500 text-slate-950 font-bold text-xs transition flex items-center gap-1 shadow-xs"
            >
              <span>{t('intelligence_hub.ask_btn')}</span>
              <Send className="h-3 w-3" />
            </button>
          </form>

          {/* Prompt Chips */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] text-slate-300 font-semibold">{t('intelligence_hub.try_asking')}</span>
            {[
              '🚗 Office commute traffic status?',
              '🌧️ Aaj barish ka forecast kya hai?',
              '💨 Morning walk ke liye AQI safe hai?',
              '🏥 Aas-paas 24/7 trauma center hospital?',
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleQuickPrompt(prompt)}
                className="text-[11px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-medium transition border border-white/10"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* ─── 6. Multi-Signal Correlated Insights Feed ────────────────────── */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-600" />
                {t('intelligence_hub.feed_title')}
              </h2>
              <p className="text-xs text-gray-500">
                {t('intelligence_hub.feed_subtitle')}
              </p>
            </div>

            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value as Severity | '')
                  setPage(1)
                }}
                className="text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">{t('intelligence_hub.all_severities')}</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as InsightType | '')
                  setPage(1)
                }}
                className="text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">{t('intelligence_hub.all_types')}</option>
                {TYPE_OPTIONS.map((tp) => (
                  <option key={tp} value={tp}>
                    {TYPE_LABELS[tp]}
                  </option>
                ))}
              </select>

              {(severity || type) && (
                <button
                  onClick={() => {
                    setSeverity('')
                    setType('')
                    setPage(1)
                  }}
                  className="text-xs text-rose-500 hover:text-rose-700 font-semibold px-2 py-1"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>
          </div>

          {/* Insights Grid */}
          {insightsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : insightsData?.items && insightsData.items.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insightsData.items.map((insight, i) => (
                  <InsightCard key={insight.id} insight={insight} index={i} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold disabled:opacity-40 hover:bg-gray-50"
                  >
                    {t('common.prev')}
                  </button>
                  <span className="text-xs text-gray-600">
                    {t('common.page')} {page} {t('common.of')} {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold disabled:opacity-40 hover:bg-gray-50"
                  >
                    {t('common.next')}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Fallback Live Correlated Telemetry Card when no static insight in DB */
            <div className="bg-white rounded-3xl border border-brand-100 p-6 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold uppercase tracking-wider">
                    <Sparkles className="h-3 w-3 text-brand-500" />
                    {t('intelligence_hub.synthesized_badge')}
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">
                    {t('intelligence_hub.synthesized_title')} {selectedArea}
                  </h3>
                </div>

                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {t('intelligence_hub.live_synced')}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                Current atmospheric readings indicate <strong>{weatherData?.temperature_c ?? '--'}°C</strong> with{' '}
                <strong>{weatherData?.condition_text ?? 'clear regional conditions'}</strong>. CPCB Air Quality is{' '}
                <strong>{aqiData?.aqi_value ?? 'N/A'} ({aqiData?.aqi_category ?? 'Station Syncing'})</strong>. Regional arterial corridors are observing{' '}
                <strong>{trafficData?.cumulative_delay_minutes ?? 0} minutes delay</strong> with no major systemic gridlock reported.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <span className="text-[11px] text-gray-400 block font-medium">{t('weather.temperature')}</span>
                  <span className="text-sm font-extrabold text-gray-800">
                    {weatherData?.temperature_c ?? '--'}°C
                  </span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <span className="text-[11px] text-gray-400 block font-medium">{t('aqi.title')}</span>
                  <span className="text-sm font-extrabold text-emerald-600">
                    {aqiData?.aqi_value ?? 'N/A'} ({aqiData?.aqi_category ?? 'N/A'})
                  </span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <span className="text-[11px] text-gray-400 block font-medium">{t('traffic.delay')}</span>
                  <span className="text-sm font-extrabold text-orange-600">
                    +{trafficData?.cumulative_delay_minutes ?? 0}m
                  </span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
                  <span className="text-[11px] text-gray-400 block font-medium">{t('intelligence_hub.govt_advisories')}</span>
                  <span className="text-sm font-extrabold text-rose-600">
                    {alertsData?.length ?? 0} {t('intelligence_hub.active_alerts')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
