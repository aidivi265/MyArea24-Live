import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  CalendarDays,
  MapPin,
  Clock,
  Share2,
  Navigation,
  CloudRain,
  Radio,
  Car,
  Search,
  RefreshCw,
  ExternalLink,
  Sparkles,
  X,
  PlusCircle,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { eventApi } from '@/services/apiService'
import { useLocationStore, useAuthStore } from '@/store'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { ErrorState, EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { BookmarkButton } from '@/components/shared/BookmarkButton'
import { WhatsAppShareModal } from '@/components/shared/WhatsAppShareModal'
import { formatDate, formatTime, cn } from '@/utils'

const CATEGORIES = [
  '',
  'Concerts & Music',
  'Sports & Screenings',
  'Comedy',
  'Workshops',
  'Exhibitions & Culture',
  'Meetups & Networking',
  'Community',
  'Market',
  'Civic Advisory',
]

export default function EventsPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedEventForContext, setSelectedEventForContext] = useState<number | null>(null)
  const [shareData, setShareData] = useState<{
    isOpen: boolean
    title: string
    category: string
    locality: string
    messageBody: string
  } | null>(null)

  const { isAuthenticated, openAuthModal } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createError, setCreateError] = useState('')
  const [eventForm, setEventForm] = useState({
    title: '',
    category: 'Workshops',
    organizer: '',
    venue_name: '',
    address: '',
    locality: selectedArea || '',
    city: selectedCity || 'Delhi',
    start_time: '',
    expected_attendance: 300,
    registration_url: '',
    description: '',
  })

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => eventApi.create(payload),
    onSuccess: () => {
      setCreateSuccess(true)
      refetch()
      setTimeout(() => {
        setCreateSuccess(false)
        setShowCreateModal(false)
        setEventForm({
          title: '',
          category: 'Workshops',
          organizer: '',
          venue_name: '',
          address: '',
          locality: selectedArea || '',
          city: selectedCity || 'Delhi',
          start_time: '',
          expected_attendance: 300,
          registration_url: '',
          description: '',
        })
      }, 1500)
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.detail || err.message || 'Failed to list event. Please try again.')
    },
  })

  const handleSubmitEvent = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!eventForm.title || !eventForm.venue_name || !eventForm.start_time) {
      setCreateError('Please fill in Title, Venue Name, and Start Time.')
      return
    }
    const payload = {
      ...eventForm,
      latitude: selectedLat ?? 28.6139,
      longitude: selectedLon ?? 77.2090,
      start_time: new Date(eventForm.start_time).toISOString(),
      locality: eventForm.locality || selectedArea || 'Delhi',
      city: eventForm.city || selectedCity || 'Delhi',
      organizer: eventForm.organizer || 'Community Organizer',
      address: eventForm.address || eventForm.venue_name,
    }
    createMutation.mutate(payload)
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['events', selectedArea, selectedCity, selectedLat, selectedLon, category, search, page],
    queryFn: () =>
      eventApi.list({
        category: category || undefined,
        locality: selectedArea || undefined,
        city: selectedCity || undefined,
        lat: selectedLat ?? undefined,
        lon: selectedLon ?? undefined,
        q: search.trim() || undefined,
        page,
        page_size: 12,
      }),
    staleTime: 5 * 60 * 1000,
  })

  const { data: contextualData, isLoading: contextualLoading } = useQuery({
    queryKey: ['event-contextual', selectedEventForContext],
    queryFn: () => eventApi.contextual(selectedEventForContext!),
    enabled: selectedEventForContext !== null,
    staleTime: 60 * 1000,
  })

  const handleSyncLive = async () => {
    setIsSyncing(true)
    try {
      await eventApi.sync(selectedCity || selectedArea || 'delhi', {
        locality: selectedArea || undefined,
        lat: selectedLat ?? undefined,
        lon: selectedLon ?? undefined,
      })
      await refetch()
    } catch (e) {
      console.error('Failed to sync events:', e)
    } finally {
      setIsSyncing(false)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 12)) : 1

  const CAT_COLORS: Record<string, string> = {
    'Civic Advisory': 'bg-blue-50 text-blue-700 border-blue-200',
    Community: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Workshop: 'bg-purple-50 text-purple-700 border-purple-200',
    Market: 'bg-amber-50 text-amber-700 border-amber-200',
    'Concerts & Music': 'bg-rose-50 text-rose-700 border-rose-200',
    'Sports & Screenings': 'bg-sky-50 text-sky-700 border-sky-200',
    Comedy: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    'Exhibitions & Culture': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Meetups & Networking': 'bg-teal-50 text-teal-700 border-teal-200',
  }

  return (
    <>
      <SEOMeta
        title={`${t('events_page.title')} — ${selectedArea}`}
        description={`Real-time civic events, fests, workshops, and community activities happening in and around ${selectedArea}`}
      />

      <div className="space-y-6">
        {/* Header with Title and Live Sync Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-2xl text-purple-600">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  {t('events_page.title')}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">
                  {data?.total ?? 0} {t('events_page.upcoming_around')}{' '}
                  <span className="text-purple-600 font-bold">{selectedArea}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  openAuthModal()
                  return
                }
                setShowCreateModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition active:scale-95"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{t('events_page.host_btn')}</span>
            </button>
            <button
              onClick={handleSyncLive}
              disabled={isSyncing || isFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shadow-2xs transition disabled:opacity-50"
              title="Pull latest live events from official aggregator feeds"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', (isSyncing || isFetching) && 'animate-spin')} />
              <span>{isSyncing ? t('events_page.syncing_btn') : t('events_page.pull_live_btn')}</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Category Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('events_page.search_placeholder')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat || 'all'}
                onClick={() => {
                  setCategory(cat)
                  setPage(1)
                }}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border',
                  category === cat
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                )}
              >
                {cat || t('events_page.all_events')}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        {error ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center space-y-4 shadow-2xs">
            <EmptyState
              title={t('events_page.empty_title')}
              description={`We couldn't find events matching "${search || category || selectedArea}". Click below to pull live feeds!`}
              icon={<CalendarDays className="h-10 w-10 text-gray-300" />}
            />
            <button
              onClick={handleSyncLive}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('events_page.fetch_live_btn')} {selectedArea}</span>
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(data?.items ?? []).map((ev) => (
                <div
                  key={ev.id}
                  className="bg-white rounded-3xl border border-gray-100 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Category + Badges + Bookmark Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={cn(
                            'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border',
                            CAT_COLORS[ev.category] || 'bg-gray-50 text-gray-600 border-gray-200'
                          )}
                        >
                          {ev.category}
                        </span>

                        {ev.distance_km !== undefined && ev.distance_km !== null && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            📍 {ev.distance_km} km
                          </span>
                        )}

                        {ev.parking_pressure && (
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full',
                              ev.parking_pressure === 'CRITICAL'
                                ? 'bg-red-50 text-red-700'
                                : ev.parking_pressure === 'ELEVATED'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            )}
                          >
                            {t('events_page.parking_label')} {ev.parking_pressure}
                          </span>
                        )}
                      </div>

                      <BookmarkButton type="event" id={ev.id} data={ev} />
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug group-hover:text-purple-600 transition">
                      {ev.title}
                    </h3>

                    {/* Description */}
                    {ev.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}

                    {/* Venue & Location */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                        <span className="line-clamp-1 font-medium text-gray-700">
                          {ev.venue_name || ev.locality} ·{' '}
                          <span className="text-gray-400">{ev.city}</span>
                        </span>
                      </div>

                      {ev.start_time && (
                        <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold bg-purple-50/70 px-2.5 py-1 rounded-xl">
                          <Clock className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                          <span>
                            {formatDate(ev.start_time)}
                            {ev.timing_text ? ` · ${ev.timing_text}` : ` · ${formatTime(ev.start_time)}`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Contextual Intelligence Summary */}
                    {ev.expected_attendance && (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                        <span>{t('events_page.crowd_label')} ~{ev.expected_attendance.toLocaleString()} {t('events_page.attendees')}</span>
                        {ev.arterial_traffic_impact && (
                          <span
                            className={cn(
                              'font-bold',
                              ev.arterial_traffic_impact === 'HIGH_BOTTLENECK'
                                ? 'text-red-600'
                                : 'text-amber-600'
                            )}
                          >
                            {ev.arterial_traffic_impact.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    )}

                    {ev.exit_weather_advisory && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl">
                        <CloudRain className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="line-clamp-1">{ev.exit_weather_advisory}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => setSelectedEventForContext(ev.id)}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold transition shadow-2xs"
                      >
                        <Radio className="h-3 w-3" />
                        <span>{t('events_page.live_telemetry_btn')}</span>
                      </button>

                      <Link
                        to="/intelligence/routes"
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-gray-50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 font-semibold transition"
                      >
                        <Navigation className="h-3 w-3" />
                        <span>{t('events_page.route_risk_btn')}</span>
                      </Link>

                      {ev.registration_url && (
                        <a
                          href={ev.registration_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition shadow-2xs"
                        >
                          <span>{t('events_page.tickets_btn')}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() =>
                        setShareData({
                          isOpen: true,
                          title: ev.title,
                          category: ev.category,
                          locality: ev.venue_name || ev.locality || 'Local Venue',
                          messageBody: `📅 Upcoming Local Event: ${ev.title}\n📍 Venue: ${ev.venue_name || ev.locality}, ${ev.city}\n⏰ Time: ${formatDate(ev.start_time)} (${ev.timing_text || formatTime(ev.start_time)})\n${ev.parking_pressure ? `🚗 Parking Pressure: ${ev.parking_pressure}\n` : ''}${ev.registration_url ? `🎟️ Tickets / Details: ${ev.registration_url}\n` : ''}`,
                        })
                      }
                      className="text-gray-400 hover:text-emerald-600 p-1.5 rounded-xl hover:bg-emerald-50 transition"
                      title="Share Event on WhatsApp"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  {t('common.prev')}
                </button>
                <span className="text-xs font-bold text-gray-600 px-3">
                  {t('common.page')} {page} {t('common.of')} {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  {t('common.next')}
                </button>
              </div>
            )}
          </>
        )}

        {/* Live Contextual Event Intelligence Modal */}
        {selectedEventForContext !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600">
                    <Radio className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-snug">
                      {contextualData?.title ?? t('events_page.live_telemetry_btn')}
                    </h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {contextualData?.venue_name ?? 'Venue Telemetry Corridor'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEventForContext(null)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {contextualLoading ? (
                <div className="p-8 text-center text-sm text-gray-500 space-y-2">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mb-2" />
                  <p>{t('common.loading')}</p>
                </div>
              ) : contextualData ? (
                <div className="space-y-4">
                  {/* Attendance & Parking Stress */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-[11px] font-bold text-gray-400 block">{t('events_page.expected_crowd')}</span>
                      <span className="text-lg font-black text-gray-900">
                        ~{contextualData.expected_attendance.toLocaleString()} {t('events_page.attendees')}
                      </span>
                    </div>
                    <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-[11px] font-bold text-gray-400 block">{t('events_page.parking_pressure')}</span>
                      <span
                        className={cn(
                          'text-xs font-black px-2.5 py-1 rounded-full inline-block mt-1',
                          contextualData.parking_pressure === 'CRITICAL'
                            ? 'bg-red-50 text-red-700'
                            : contextualData.parking_pressure === 'ELEVATED'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {contextualData.parking_pressure}
                      </span>
                    </div>
                  </div>

                  {/* Parking Guidance Advice */}
                  <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5">
                    <Car className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-blue-900">{t('events_page.parking_advisory')}</p>
                      <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                        {contextualData.parking_guidance}
                      </p>
                    </div>
                  </div>

                  {/* Arterial Traffic Bottlenecks */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                      <span>{t('events_page.arterial_delays')}</span>
                      <span className="text-amber-600 font-extrabold">
                        {contextualData.total_approach_delay_minutes > 0
                          ? `+${contextualData.total_approach_delay_minutes} mins delay`
                          : t('events_page.flowing_smoothly')}
                      </span>
                    </div>
                    {contextualData.nearby_traffic_bottlenecks &&
                    contextualData.nearby_traffic_bottlenecks.length > 0 ? (
                      <div className="space-y-1.5">
                        {contextualData.nearby_traffic_bottlenecks.map((b, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-gray-800">{b.road_name}</span>
                              <span className="text-gray-400 text-[11px] ml-2">({b.distance_km} km away)</span>
                            </div>
                            <span className="font-black text-red-600">+{b.delay_minutes}m</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-600 font-medium p-2.5 bg-emerald-50 rounded-xl">
                        {t('events_page.no_bottlenecks')}
                      </p>
                    )}
                  </div>

                  {/* Weather & Exit Dispersal Advisory */}
                  <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2.5">
                    <CloudRain className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">{t('events_page.dispersal_advisory')}</p>
                      <p className="text-xs text-amber-800 mt-0.5">{contextualData.exit_weather_summary}</p>
                      <p className="text-xs text-amber-700 mt-1">{contextualData.exit_weather_advisory}</p>
                    </div>
                  </div>

                  {/* Curated Nearby Food & Dining Options (PPT Slide 05) */}
                  {contextualData.nearby_food_options && contextualData.nearby_food_options.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <span>🍔</span> {t('events_page.nearby_food')}
                        </span>
                        <span className="text-gray-400 font-normal text-[11px]">{t('events_page.venue_radius')}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {contextualData.nearby_food_options.map((f) => (
                          <div
                            key={f.id}
                            className="p-2.5 rounded-xl border border-gray-100 bg-white shadow-2xs hover:border-purple-200 transition flex flex-col justify-between space-y-2"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-gray-900 text-xs truncate max-w-[150px]">
                                  {f.name}
                                </span>
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  ★ {f.rating.toFixed(1)}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{f.category} · {f.distance_km} km away</p>
                              {f.address && (
                                <p className="text-[10px] text-gray-500 truncate mt-0.5">{f.address}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-50">
                              <Link
                                to={`/businesses/${f.slug}`}
                                className="flex-1 py-1 px-2 text-center text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                              >
                                {t('events_page.view_shop')}
                              </Link>
                              {f.phone && (
                                <a
                                  href={`tel:${f.phone}`}
                                  className="py-1 px-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition flex items-center gap-1"
                                >
                                  {t('business.call')}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Host / List an Event Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900">{t('events_page.modal_title')}</h2>
                    <p className="text-[11px] text-gray-500">{t('events_page.modal_subtitle')} ({selectedArea})</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {createSuccess ? (
                <div className="p-6 text-center space-y-2">
                  <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">Event Listed Successfully!</h3>
                  <p className="text-xs text-gray-500">Your event is now live and discoverable for the neighbourhood.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmitEvent} className="space-y-3">
                  {createError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Event Title *</label>
                    <input
                      required
                      placeholder="e.g. Diwali Haat Mela 2026, Robotics Workshop..."
                      value={eventForm.title}
                      onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                      <select
                        value={eventForm.category}
                        onChange={e => setEventForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                      >
                        {CATEGORIES.filter(Boolean).map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Expected Attendance</label>
                      <input
                        type="number"
                        min="10"
                        value={eventForm.expected_attendance}
                        onChange={e => setEventForm(f => ({ ...f, expected_attendance: Number(e.target.value) }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Venue Name *</label>
                      <input
                        required
                        placeholder="e.g. JL Nehru Stadium, Gate 2"
                        value={eventForm.venue_name}
                        onChange={e => setEventForm(f => ({ ...f, venue_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Organizer Name</label>
                      <input
                        placeholder="e.g. RWA, Local Club, College"
                        value={eventForm.organizer}
                        onChange={e => setEventForm(f => ({ ...f, organizer: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Date & Start Time *</label>
                      <input
                        required
                        type="datetime-local"
                        value={eventForm.start_time}
                        onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ticket / Registration URL</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={eventForm.registration_url}
                        onChange={e => setEventForm(f => ({ ...f, registration_url: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Event Description</label>
                    <textarea
                      rows={2}
                      placeholder="Brief details about the event, rules, entry details..."
                      value={eventForm.description}
                      onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="flex-1 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition disabled:opacity-50 shadow-sm"
                    >
                      {createMutation.isPending ? '…' : t('events_page.publish_btn')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {shareData && (
          <WhatsAppShareModal
            isOpen={shareData.isOpen}
            onClose={() => setShareData(null)}
            title={shareData.title}
            category={shareData.category}
            locality={shareData.locality}
            messageBody={shareData.messageBody}
            url={window.location.origin + '/events'}
          />
        )}
      </div>
    </>
  )
}
