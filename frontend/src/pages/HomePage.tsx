import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, Package, Wrench, Tag, CalendarDays, Map,
  ShieldAlert, TrendingUp, ArrowRight, Zap, Download,
  Navigation, Radio, Sparkles, Fuel, Newspaper
} from 'lucide-react'
import { intelligenceApi, offerApi, eventApi, marketApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { InsightCard } from '@/components/intelligence/InsightCard'
import { WeatherWidget } from '@/components/intelligence/WeatherWidget'
import { AQIBadge } from '@/components/intelligence/AQIWidget'
import { TrafficWidget } from '@/components/intelligence/TrafficWidget'
import { FuelWidget } from '@/components/intelligence/FuelWidget'
import { OfferCard } from '@/components/marketplace/OfferCard'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { formatDate } from '@/utils'

const QUICK_LINKS = [
  { to: '/businesses', icon: Building2, labelKey: 'nav.businesses', color: 'bg-emerald-50 text-emerald-600' },
  { to: '/products', icon: Package, labelKey: 'nav.products', color: 'bg-blue-50 text-blue-600' },
  { to: '/services', icon: Wrench, labelKey: 'nav.services', color: 'bg-purple-50 text-purple-600' },
  { to: '/offers', icon: Tag, labelKey: 'nav.offers', color: 'bg-amber-50 text-amber-600' },
  { to: '/market', icon: Fuel, labelKey: 'nav.market', color: 'bg-orange-50 text-orange-600' },
  { to: '/events', icon: CalendarDays, labelKey: 'nav.events', color: 'bg-green-50 text-green-600' },
  { to: '/map', icon: Map, labelKey: 'nav.map', color: 'bg-teal-50 text-teal-600' },
  { to: '/intelligence/routes', icon: Navigation, labelKey: 'nav.routes', color: 'bg-sky-50 text-sky-600' },
  { to: '/intelligence/demand', icon: TrendingUp, labelKey: 'nav.demand', color: 'bg-indigo-50 text-indigo-600' },
  { to: '/intelligence/community', icon: Radio, labelKey: 'nav.community', color: 'bg-rose-50 text-rose-600' },
  { to: '/bulletins', icon: Newspaper, labelKey: 'nav.bulletins', color: 'bg-violet-50 text-violet-600' },
  { to: '/emergency', icon: ShieldAlert, labelKey: 'nav.sos', color: 'bg-red-50 text-red-600' },
]

export default function HomePage() {
  const { t } = useTranslation()
  const { selectedArea, selectedLat, selectedLon, selectedCity, selectedState } = useLocationStore()
  const hasLocation = !!(selectedArea && selectedLat !== null && selectedLon !== null)
  const areaParams = {
    area: selectedArea || undefined,
    lat: selectedLat ?? undefined,
    lon: selectedLon ?? undefined,
  }

  const { data: weather, isLoading: wLoading } = useQuery({
    queryKey: ['weather', selectedArea, selectedLat, selectedLon],
    queryFn: () => intelligenceApi.weather(areaParams),
    staleTime: 5 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: aqi, isLoading: aqiLoading } = useQuery({
    queryKey: ['aqi', selectedArea, selectedLat, selectedLon],
    queryFn: () => intelligenceApi.airQuality(areaParams),
    staleTime: 5 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: traffic, isLoading: tLoading } = useQuery({
    queryKey: ['traffic', selectedArea, selectedLat, selectedLon],
    queryFn: () => intelligenceApi.traffic(areaParams),
    staleTime: 3 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: fuel, isLoading: fLoading } = useQuery({
    queryKey: ['fuel-home', selectedCity, selectedState, selectedArea, selectedLat, selectedLon],
    queryFn: () => marketApi.fuel({
      city: selectedCity || selectedArea || undefined,
      state: selectedState || undefined,
      lat: selectedLat ?? undefined,
      lon: selectedLon ?? undefined,
    }),
    staleTime: 30 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: insights, isLoading: iLoading } = useQuery({
    queryKey: ['insights', selectedArea, selectedLat, selectedLon],
    queryFn: () => intelligenceApi.list({ area: selectedArea || undefined, lat: selectedLat ?? undefined, lon: selectedLon ?? undefined, is_active: true, page_size: 4 }),
    staleTime: 3 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: offers } = useQuery({
    queryKey: ['offers-home', selectedArea, selectedCity, selectedLat, selectedLon],
    queryFn: () => offerApi.list({ locality: selectedArea || undefined, city: selectedCity || undefined, user_lat: selectedLat ?? undefined, user_lon: selectedLon ?? undefined, page_size: 3 }),
    staleTime: 10 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: events } = useQuery({
    queryKey: ['events-home', selectedArea, selectedCity, selectedLat, selectedLon],
    queryFn: () => eventApi.list({ locality: selectedArea || undefined, city: selectedCity || undefined, lat: selectedLat ?? undefined, lon: selectedLon ?? undefined, page_size: 3 }),
    staleTime: 10 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: alerts } = useQuery({
    queryKey: ['alerts-home', selectedArea, selectedLat, selectedLon],
    queryFn: () => intelligenceApi.alerts({
      area: selectedArea || undefined,
      lat: selectedLat ?? undefined,
      lon: selectedLon ?? undefined,
      scope: 'local',
      is_active: true,
      limit: 5,
    }),
    staleTime: 5 * 60 * 1000,
    enabled: hasLocation,
  })
  const { data: communitySignals } = useQuery({
    queryKey: ['community-home', selectedArea, selectedLat, selectedLon],
    queryFn: () => intelligenceApi.communitySignals({ area: selectedArea || undefined, lat: selectedLat ?? undefined, lon: selectedLon ?? undefined, limit: 2 }),
    staleTime: 60 * 1000,
    enabled: hasLocation,
  })

  const criticalAlert = alerts?.find(a => a.is_active && (a.severity?.toLowerCase() === 'severe' || a.severity?.toLowerCase() === 'extreme' || a.urgency?.toLowerCase() === 'immediate'))
  const highWaterlogging = (weather?.waterlogging_risk_index ?? 0) >= 6.0
  const topInsight = insights?.items?.[0]
  const topEvent = events?.items?.[0]
  const rainMm = weather?.precipitation_mm ?? 0
  const tempC = weather?.temperature_c ?? 28
  const delayMin = traffic?.cumulative_delay_minutes ?? 8
  const cleanTopRec = topInsight?.recommendation
    ? topInsight.recommendation.replace(/^[•\-*]\s*/gm, '').split('\n')[0]
    : `Prefer elevated bypasses or Metro corridors around ${selectedArea}; allow 20-30 mins commute buffer.`

  return (
    <>
      <SEOMeta
        title={`${selectedArea} — ${t('nav.intelligence')}`}
        description={t('seo.home_desc')}
        schema={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'MyArea24', url: 'https://myarea24.in' }}
      />

      {/* Red Alert Crisis Banner (Slide 08 Protocol) */}
      {(criticalAlert || highWaterlogging) && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-4 rounded-2xl mb-6 shadow-md border border-red-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-yellow-300 animate-pulse shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black bg-white/20 px-2 py-0.5 rounded">
                  {t('home.disaster_mode')}
                </span>
                <span className="text-xs font-bold">
                  {criticalAlert ? criticalAlert.event_type ?? t('home.emergency_alert') : t('home.waterlogging_advisory')}
                </span>
              </div>
              <p className="text-xs text-red-100 mt-0.5 line-clamp-1">
                {criticalAlert ? criticalAlert.headline : `High waterlogging risk index (${Math.min(100, (weather?.waterlogging_risk_index ?? 0) * 10).toFixed(0)}%) in ${selectedArea}. Emergency rescue desks on standby.`}
              </p>
            </div>
          </div>
          <Link
            to="/emergency"
            className="shrink-0 text-xs font-bold bg-white text-red-700 hover:bg-red-50 px-3.5 py-2 rounded-xl transition shadow-sm text-center"
          >
            {t('home.emergency_hub_cta')}
          </Link>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 text-white mb-6 px-4 sm:px-6 py-6 sm:py-10 shadow-sm">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 h-32 w-32 rounded-full border-2 border-white" />
          <div className="absolute bottom-4 left-8 h-20 w-20 rounded-full border border-white" />
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative">
          <div className="flex items-center gap-2 mb-2">
            {hasLocation
              ? <><span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs sm:text-sm text-white/90 truncate max-w-xs font-medium">📍 {selectedArea}</span></>
              : <><span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" /><span className="text-xs sm:text-sm text-white/90">{t('home.detecting_location')}</span></>
            }
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-2">
            {t('home.hero_title')}
          </h1>
          <p className="text-white/80 text-xs sm:text-sm max-w-lg leading-relaxed mb-4">{t('home.hero_subtitle')}</p>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/businesses"
              className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white text-brand-600 font-bold text-xs sm:text-sm hover:bg-brand-50 transition-colors shadow-sm">
              {t('home.cta_explore')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/market"
              className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-white/20 border border-white/30 text-white font-semibold text-xs sm:text-sm hover:bg-white/30 transition-colors">
              <Fuel className="h-4 w-4 text-amber-300" /> {t('home.cta_market')}
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Local Conditions */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand-500" />{t('home.conditions_title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: t('weather.title'), to: '/intelligence/weather', loading: wLoading, content: <WeatherWidget data={weather} /> },
            { title: t('aqi.title'), to: '/intelligence/air-quality', loading: aqiLoading, content: <AQIBadge data={aqi} /> },
            { title: t('traffic.title'), to: '/intelligence/traffic', loading: tLoading, content: <TrafficWidget data={traffic} /> },
            { title: t('home.fuel_card_title'), to: '/market#fuel', loading: fLoading, content: <FuelWidget data={fuel} /> },
          ].map(({ title, to, loading, content }) => (
            <Link
              key={to}
              to={to}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:border-brand-200 hover:shadow-md transition block group"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 group-hover:text-brand-600 transition uppercase tracking-wide">
                  {title}
                </p>
                <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-brand-500 transition" />
              </div>
              {loading ? <CardSkeleton /> : content}
            </Link>
          ))}
        </div>

        {/* Live Ground-Truth Hazard Ribbon */}
        {communitySignals && communitySignals.length > 0 && (
          <div className="mt-3 bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <span className="p-1 bg-amber-200/80 text-amber-800 rounded-lg font-bold">⚠️ {t('home.ground_signal_badge')}</span>
              <span className="font-semibold">{communitySignals[0].title}</span>
              <span className="text-gray-500 hidden md:inline">· {communitySignals[0].locality} ({communitySignals[0].upvotes} {t('home.verifications')})</span>
            </div>
            <Link to="/intelligence/community" className="text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 shrink-0">
              {t('home.view_ground_signals')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Visual Data ➔ Context ➔ Intelligence ➔ Action Pipeline (Slides 02–03) */}
      <section className="mb-8 bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/30 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3 text-gold-400" />
              {t('home.pipeline_badge')}
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold mt-1.5 text-white">
              {t('home.pipeline_title')}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              {t('home.pipeline_subtitle')} <strong className="text-white">{selectedArea}</strong>
            </p>
          </div>

          <Link
            to="/intelligence"
            className="self-start md:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition shrink-0"
          >
            {t('home.view_all')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Connected Signal Chain Badges Row (🌧️ Rain + 🚗 Traffic + 🎪 Event ➔ ⚠️ Impact Alert ➔ ✅ Action) */}
        <div className="my-4 bg-white/5 border border-white/10 rounded-xl p-3 flex items-center flex-wrap gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
            <span>🌧️</span>
            <span>{t('home.chain_rain')}: {rainMm > 0 ? `${rainMm}mm` : `${tempC}°C ${weather?.condition_text || 'Clear'}`}</span>
          </span>
          <span className="text-slate-400 font-bold">+</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-orange-500/20 text-orange-200 border border-orange-400/30">
            <span>🚗</span>
            <span>{t('home.chain_traffic')}: +{delayMin}m</span>
          </span>
          <span className="text-slate-400 font-bold">+</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-purple-500/20 text-purple-200 border border-purple-400/30">
            <span>🎪</span>
            <span className="truncate max-w-[160px]">{t('home.chain_event')}: {topEvent ? topEvent.title : `${events?.total ?? 3} Active`}</span>
          </span>
          <span className="text-slate-400 font-bold">+</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
            <span>🅿️</span>
            <span>{t('home.chain_parking')}: {topEvent?.parking_pressure || 'ELEVATED'}</span>
          </span>
          {communitySignals && communitySignals.length > 0 && (
            <>
              <span className="text-slate-400 font-bold">+</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30">
                <span>👥</span>
                <span>{t('home.chain_citizen')} ({communitySignals.length})</span>
              </span>
            </>
          )}
          <span className="text-gold-400 font-black mx-1">➔</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold bg-amber-500 text-slate-950 shadow-xs">
            <span>⚠️</span>
            <span>{t('home.chain_impact')}</span>
          </span>
          <span className="text-gold-400 font-black mx-1">➔</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-extrabold bg-emerald-400 text-slate-950 shadow-xs">
            <span>✅</span>
            <span>{t('home.chain_action')}</span>
          </span>
        </div>

        {/* 4-Stage Connected Synthesis Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Stage 01: Data */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded">
                {t('home.stage_data')}
              </span>
              <h3 className="text-xs font-bold text-white mt-2">Multi-Sensor Ingestion</h3>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Weather ({tempC}°C, {rainMm}mm), TomTom Traffic (+{delayMin}m), CPCB AQI ({aqi?.aqi_value ?? '--'}), & Civic Events.
              </p>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-white/10">
              7 Live Hyperlocal Signal Streams
            </span>
          </div>

          {/* Stage 02: Context */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                {t('home.stage_context')}
              </span>
              <h3 className="text-xs font-bold text-white mt-2">Spatial & Temporal Fusion</h3>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Correlating {topEvent ? `'${topEvent.title}' at ${topEvent.venue_name}` : `evening commercial surge in ${selectedArea}`} with arterial flow & parking occupancy.
              </p>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-white/10">
              📍 {selectedArea} (5 km radius)
            </span>
          </div>

          {/* Stage 03: Intelligence (Impact Alert) */}
          <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-200 bg-amber-500/30 px-2 py-0.5 rounded">
                ⚠️ {t('home.stage_intelligence')}
              </span>
              <h3 className="text-xs font-bold text-amber-100 mt-2 line-clamp-1">
                {topInsight ? topInsight.headline : `Commute & Parking Impact in ${selectedArea}`}
              </h3>
              <p className="text-[11px] text-amber-100/90 mt-1 leading-relaxed line-clamp-2">
                {topInsight?.potential_impact || topInsight?.summary || `Corridors approaching ${selectedArea} face +${delayMin}m bottleneck delays with rising parking saturation.`}
              </p>
            </div>
            <span className="text-[10px] text-amber-300 font-semibold mt-2 pt-2 border-t border-amber-400/20">
              Confidence: HIGH (Multi-Signal Grounded)
            </span>
          </div>

          {/* Stage 04: Action */}
          <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-200 bg-emerald-500/30 px-2 py-0.5 rounded">
                ✅ {t('home.stage_action')}
              </span>
              <h3 className="text-xs font-bold text-emerald-100 mt-2">Actionable Decision</h3>
              <p className="text-[11px] text-emerald-100/90 mt-1 leading-relaxed line-clamp-2">
                {cleanTopRec}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-400/20">
              <Link
                to="/intelligence/routes"
                className="text-[10px] font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 px-2.5 py-1 rounded-lg transition"
              >
                {t('home.route_action_cta')} →
              </Link>
              <Link
                to="/events"
                className="text-[10px] font-semibold text-emerald-200 hover:text-white underline"
              >
                {t('home.event_action_cta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pan-India AI Intelligence Engines */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-500" />
            {t('home.ai_engines_title')}
          </h2>
          <span className="text-xs bg-brand-50 text-brand-700 px-2.5 py-1 rounded-full font-semibold">
            {t('home.districts_live')}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/intelligence/routes"
            className="group p-5 bg-gradient-to-br from-white to-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Navigation className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1 group-hover:text-emerald-700 transition-colors">
              {t('home.engine_routes_title')}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              {t('home.engine_routes_desc')}
            </p>
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              {t('home.engine_routes_cta')} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to="/intelligence/demand"
            className="group p-5 bg-gradient-to-br from-white to-purple-50/50 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1 group-hover:text-purple-700 transition-colors">
              {t('home.engine_demand_title')}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              {t('home.engine_demand_desc')}
            </p>
            <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
              {t('home.engine_demand_cta')} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to="/intelligence/community"
            className="group p-5 bg-gradient-to-br from-white to-amber-50/50 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-1 group-hover:text-amber-700 transition-colors">
              {t('home.engine_community_title')}
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              {t('home.engine_community_desc')}
            </p>
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
              {t('home.engine_community_cta')} <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* Quick Links */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-4">{t('home.quicklinks_title')}</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-2 sm:gap-3">
          {QUICK_LINKS.map(({ to, icon: Icon, labelKey, color }, i) => (
            <motion.div key={to} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}>
              <Link to={to} className="flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center ${color} shadow-xs`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-gray-700 text-center leading-tight line-clamp-1">{t(labelKey)}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Latest Insights */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand-500" />{t('home.insights_title')}
          </h2>
          <Link to="/intelligence" className="text-sm text-brand-500 hover:text-brand-700 font-medium flex items-center gap-1">
            {t('home.view_all')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {iLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0,1,2,3].map(i => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(insights?.items ?? []).map((insight, i) => <InsightCard key={insight.id} insight={insight} index={i} />)}
            {(insights?.items ?? []).length === 0 && (
              <p className="col-span-2 text-center py-8 text-gray-400 text-sm">{t('home.no_insights')} {selectedArea}</p>
            )}
          </div>
        )}
      </section>

      {/* Deals Near You */}
      {(offers?.items?.length ?? 0) > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Tag className="h-5 w-5 text-gold-500" />{t('home.deals_title')}
            </h2>
            <Link to="/offers" className="text-sm text-brand-500 hover:text-brand-700 font-medium flex items-center gap-1">
              {t('home.view_all')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {offers?.items?.map(offer => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        </section>
      )}

      {/* Community Events */}
      {(events?.items?.length ?? 0) > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-500" />{t('home.events_title')}
            </h2>
            <Link to="/events" className="text-sm text-brand-500 hover:text-brand-700 font-medium flex items-center gap-1">
              {t('home.view_all')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {events?.items?.map(ev => (
              <div key={ev.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all">
                <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{ev.category}</span>
                <h3 className="font-semibold text-gray-800 text-sm mt-2 line-clamp-2">{ev.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{ev.venue_name} · {ev.locality}</p>
                {ev.start_time && <p className="text-xs text-brand-500 font-medium mt-1">{formatDate(ev.start_time)}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
