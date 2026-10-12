import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  ThumbsUp,
  PlusCircle,
  AlertTriangle,
  MapPin,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Building2,
  Droplets,
  Construction,
  Car,
  ShoppingBag,
  Filter,
  Share2,
} from 'lucide-react'
import { intelligenceApi } from '@/services/apiService'
import { useLocationStore, useAuthStore } from '@/store'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { WhatsAppShareModal } from '@/components/shared/WhatsAppShareModal'
import { formatRelativeTime } from '@/utils'
import type { CommunitySignalItem } from '@/types'
import { useTranslation } from 'react-i18next'

const FILTER_TYPES = [
  { id: 'ALL', labelKey: 'common.all', fallback: 'All Signals', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'WATERLOGGING', labelKey: 'routes.waterlogging', fallback: 'Waterlogging', icon: <Droplets className="h-3.5 w-3.5 text-blue-500" /> },
  { id: 'ROAD_BLOCKAGE', labelKey: 'traffic.closure', fallback: 'Blockages', icon: <Construction className="h-3.5 w-3.5 text-amber-500" /> },
  { id: 'POTHOLE', labelKey: 'traffic.incidents', fallback: 'Potholes / Craters', icon: <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> },
  { id: 'ACCIDENT', labelKey: 'traffic.accident', fallback: 'Accidents', icon: <Car className="h-3.5 w-3.5 text-red-500" /> },
  { id: 'LOCAL_MARKET', labelKey: 'demand.surge', fallback: 'Market Surges', icon: <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" /> },
]

export default function CommunitySignalsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { selectedArea, selectedLat, selectedLon, selectedCity, selectedState } = useLocationStore()
  const { isAuthenticated, openAuthModal } = useAuthStore()

  const [activeFilter, setActiveFilter] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [signalType, setSignalType] = useState('WATERLOGGING')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('moderate')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [upvotedIds, setUpvotedIds] = useState<number[]>([])
  const [shareData, setShareData] = useState<{
    isOpen: boolean
    title: string
    category: string
    locality: string
    city: string
    messageBody: string
  } | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ma24_upvoted_signals')
      if (stored) setUpvotedIds(JSON.parse(stored))
    } catch {
      // ignore JSON parse error
    }
  }, [])

  const { data: signals, isLoading } = useQuery({
    queryKey: ['community-signals', selectedArea, selectedLat, selectedLon],
    queryFn: () =>
      intelligenceApi.communitySignals({
        area: selectedArea,
        lat: selectedLat ?? undefined,
        lon: selectedLon ?? undefined,
      }),
    staleTime: 30 * 1000,
  })

  const upvoteMutation = useMutation({
    mutationFn: (id: number) => intelligenceApi.upvoteCommunitySignal(id),
    onSuccess: (res, id) => {
      const next = [...upvotedIds, id]
      setUpvotedIds(next)
      try {
        localStorage.setItem('ma24_upvoted_signals', JSON.stringify(next))
      } catch {
        // ignore storage error
      }
      queryClient.invalidateQueries({ queryKey: ['community-signals'] })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      intelligenceApi.resolveCommunitySignal(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-signals'] })
    },
  })

  const derivedCity = selectedCity || (selectedArea.includes(',') ? selectedArea.split(',')[1].trim() : selectedArea || 'Local City')
  const derivedState = selectedState || (selectedArea.includes(',') ? selectedArea.split(',').pop()?.trim() : 'India')

  const handleCreateSignal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setIsSubmitting(true)
    try {
      await intelligenceApi.reportCommunitySignal({
        signal_type: signalType,
        title: title.trim(),
        description: description.trim() || undefined,
        locality: selectedArea || 'Local Area',
        city: derivedCity,
        state: derivedState,
        latitude: selectedLat || 28.5672,
        longitude: selectedLon || 77.2100,
        severity,
      })
      setTitle('')
      setDescription('')
      setShowModal(false)
      queryClient.invalidateQueries({ queryKey: ['community-signals'] })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredSignals = (signals || []).filter((sig) => {
    if (activeFilter === 'ALL') return true
    return sig.signal_type.toUpperCase() === activeFilter
  })

  const getSignalIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'WATERLOGGING':
        return <Droplets className="h-4 w-4 text-blue-600" />
      case 'ROAD_BLOCKAGE':
        return <Construction className="h-4 w-4 text-amber-600" />
      case 'POTHOLE':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'ACCIDENT':
        return <Car className="h-4 w-4 text-red-600" />
      case 'LOCAL_MARKET':
        return <ShoppingBag className="h-4 w-4 text-emerald-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const renderEscalationLifecycle = (sig: CommunitySignalItem) => {
    const isEscalated = sig.upvotes >= 5 || sig.status === 'ESCALATED_TO_MUNICIPALITY'
    const isVerified = sig.upvotes >= 3 || sig.status === 'COMMUNITY_VERIFIED' || isEscalated

    return (
      <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Civic Authority Action Tracker
          </span>
          {isEscalated ? (
            <span className="text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-bold">
              Escalated to Municipal Corp
            </span>
          ) : isVerified ? (
            <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">
              Citizen Verified (Consensus)
            </span>
          ) : (
            <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
              Citizen Ping ({sig.upvotes}/3 upvotes)
            </span>
          )}
        </div>

        {/* 3-Stage Progress Bar */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <div className="h-1.5 w-full bg-emerald-500 rounded-full" />
            <span className="text-[10px] text-emerald-700 font-medium">1. Reported</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            <span className={`text-[10px] font-medium ${isVerified ? 'text-emerald-700' : 'text-gray-400'}`}>
              2. Verified
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${isEscalated ? 'bg-purple-600' : 'bg-gray-200'}`} />
            <span className={`text-[10px] font-medium ${isEscalated ? 'text-purple-700' : 'text-gray-400'}`}>
              3. Municipal Desk
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <SEOMeta
        title={`Ground-Truth Community Signals — ${selectedArea}`}
        description="Real-time citizen-reported ground-truth alerts on waterlogging, potholes, blockages, and local markets verified through peer consensus."
      />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('community.title', { defaultValue: 'Community Signal Mesh' })}</h1>
                <p className="text-sm text-gray-500">
                  Citizen-reported ground truth (waterlogging, craters, blockages) with civic escalation.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              if (!isAuthenticated) {
                openAuthModal()
                return
              }
              setShowModal(true)
            }}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <PlusCircle className="h-4 w-4" /> {t('community.report', { defaultValue: 'Report Ground Signal' })}
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {FILTER_TYPES.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeFilter === f.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.icon}
              <span>{t(f.labelKey, { defaultValue: f.fallback })}</span>
            </button>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" /> Report Ground-Truth Signal
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSignal} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Hazard / Signal Type</label>
                  <select
                    value={signalType}
                    onChange={(e) => setSignalType(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="WATERLOGGING">🌧️ Waterlogging Spot / Submerged Underpass</option>
                    <option value="POTHOLE">🕳️ Hazardous Pothole / Road Cave-in</option>
                    <option value="ROAD_BLOCKAGE">🚧 Fallen Tree / Route Blockage</option>
                    <option value="ACCIDENT">🚗 Collision Obstruction</option>
                    <option value="LOCAL_MARKET">🎪 Weekly Bazaar / Crowd Footfall Surge</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Headline</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2-feet waterlogging near Metro Pillar 42..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Details & Lane Guidance (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Specific lane affected, landmark, or vehicle bypass advice..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="low">Low (Passable with caution)</option>
                    <option value="moderate">Moderate (Slow transit / Lane restricted)</option>
                    <option value="high">High (Severe bottleneck / Small vehicles stuck)</option>
                    <option value="severe">Critical (Impassable / Complete stoppage)</option>
                  </select>
                </div>

                <div className="text-[11px] text-gray-500 bg-amber-50/60 border border-amber-100 p-2.5 rounded-xl space-y-0.5">
                  <p>📍 Anchored Location: <strong>{selectedArea || 'Current Area'}</strong></p>
                  <p className="text-gray-400">Jurisdiction: {derivedCity}, {derivedState}</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="text-xs font-medium px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-xs font-bold px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Post Signal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Signals Feed */}
        {isLoading ? (
          <CardSkeleton />
        ) : filteredSignals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-gray-800 text-base">No Hazards Reported in This Category</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Your neighbourhood has zero active complaints for this filter. Report an issue if you encounter one!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSignals.map((sig) => {
              const hasUpvoted = upvotedIds.includes(sig.id)
              return (
                <div
                  key={sig.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4.5 shadow-sm hover:border-amber-200 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                          {getSignalIcon(sig.signal_type)}
                          {sig.signal_type.replace('_', ' ')}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            sig.severity === 'severe' || sig.severity === 'high'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-orange-50 text-orange-600'
                          }`}
                        >
                          {sig.severity} Severity
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 text-sm leading-snug">{sig.title}</h3>
                    </div>

                    <button
                      onClick={() => !hasUpvoted && upvoteMutation.mutate(sig.id)}
                      disabled={hasUpvoted || upvoteMutation.isPending}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        hasUpvoted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                          : 'bg-gray-50 hover:bg-amber-50 hover:text-amber-700 border-gray-200 text-gray-700'
                      }`}
                    >
                      {hasUpvoted ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                      <span>{sig.upvotes}</span>
                      <span className="hidden sm:inline text-[10px]">{hasUpvoted ? 'Verified' : 'Verify'}</span>
                    </button>
                  </div>

                  {sig.description && <p className="text-xs text-gray-600 leading-relaxed">{sig.description}</p>}

                  {/* Civic Authority Action Tracker Lifecycle */}
                  {renderEscalationLifecycle(sig)}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 border-t border-gray-100 pt-2.5">
                    <span className="flex items-center gap-1 text-gray-600">
                      <MapPin className="h-3 w-3 text-brand-500" /> {sig.locality}, {sig.city}
                    </span>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setShareData({
                            isOpen: true,
                            title: sig.title,
                            category: sig.signal_type.replace('_', ' '),
                            locality: sig.locality,
                            city: sig.city,
                            messageBody: `${sig.description || 'Ground-truth community hazard reported.'}\nSeverity: ${sig.severity.toUpperCase()}\nStatus: ${sig.status}`,
                          })
                        }
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition"
                      >
                        <Share2 className="h-3 w-3 text-emerald-500" />
                        <span>Share</span>
                      </button>

                      {sig.status !== 'RESOLVED' && (
                        <button
                          onClick={() => {
                            const notes = prompt('Enter clearance notes (optional): e.g. "Municipal pump deployed; water cleared"')
                            resolveMutation.mutate({ id: sig.id, notes: notes || undefined })
                          }}
                          disabled={resolveMutation.isPending}
                          className="text-[11px] font-bold text-gray-500 hover:text-emerald-700 flex items-center gap-1 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-gray-400 hover:text-emerald-600" />
                          Mark Cleared / Resolved
                        </button>
                      )}

                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="h-3 w-3" /> {formatRelativeTime(sig.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {shareData && (
          <WhatsAppShareModal
            isOpen={shareData.isOpen}
            onClose={() => setShareData(null)}
            title={shareData.title}
            category={shareData.category}
            locality={shareData.locality}
            city={shareData.city}
            messageBody={shareData.messageBody}
          />
        )}
      </div>
    </>
  )
}
