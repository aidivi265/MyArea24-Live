import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Newspaper, ExternalLink, Calendar, MapPin, Search,
  CheckCircle2, RotateCcw, Building2
} from 'lucide-react'
import { marketApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { EmptyState, ErrorState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { BookmarkButton } from '@/components/shared/BookmarkButton'
import { formatDate, cn } from '@/utils'
import type { CivicBulletin } from '@/types'

const CATEGORIES = [
  { id: 'all', label: 'All Notices (सभी)', emoji: '📋' },
  { id: 'Transit & Safety', label: 'Transit & Safety (यातायात)', emoji: '🚦' },
  { id: 'Civic Works', label: 'Civic Works (नागरिक कार्य)', emoji: '🚧' },
  { id: 'Environment', label: 'Environment (पर्यावरण)', emoji: '🌱' },
  { id: 'Water & Utilities', label: 'Water & Utilities (जल आपूर्ति)', emoji: '💧' },
  { id: 'Public Advisory', label: 'Public Health (स्वास्थ्य सूचना)', emoji: '📢' },
]

const PRIORITY_STYLES: Record<CivicBulletin['priority'], string> = {
  high:   'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-gray-50 text-gray-600 border-gray-200',
}

const PRIORITY_BADGE_STYLES: Record<CivicBulletin['priority'], string> = {
  high:   'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low:    'bg-gray-100 text-gray-700 border-gray-200',
}

export default function BulletinsPage() {
  const { selectedArea, selectedCity, selectedDistrict, selectedState } = useLocationStore()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  const locParam = selectedCity || selectedDistrict || selectedArea

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bulletins', search, activeCategory, locParam, selectedState],
    queryFn: () => marketApi.bulletins({
      locality: locParam || undefined,
      state: selectedState || undefined,
      category: activeCategory !== 'all' ? activeCategory : undefined,
      search: search || undefined,
      limit: 50,
    }),
    staleTime: 5 * 60 * 1000,
  })

  const bulletins = data?.items ?? []

  return (
    <>
      <SEOMeta
        title={`Civic Bulletins & Municipal Notices — ${selectedArea}`}
        description={`Verified official civic notices, municipal announcements, traffic diverts and public works bulletins for ${selectedArea}.`}
      />

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header with Location Grounding & Verification Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Newspaper className="h-6 w-6 text-brand-600" />
              <span>Civic Bulletins (नागरिक सूचनाएं)</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-700 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-brand-600" /> {selectedArea}
              </span>
              <span className="text-gray-300">·</span>
              <span>Official notices from Nagar Nigams & Municipal Authorities</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-800 self-start sm:self-auto">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Zero Unverified Rumours (Official Sources Only)</span>
          </div>
        </div>

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

        {/* Search Bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-brand-500">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bulletins (e.g. Traffic, Water supply, Metro, Road, Construction)..."
            className="flex-1 text-sm outline-none bg-transparent text-gray-800"
          />
          {(search || activeCategory !== 'all') && (
            <button
              onClick={() => { setSearch(''); setActiveCategory('all'); refetch() }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100"
            >
              <RotateCcw className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>

        {/* Bulletins Feed */}
        {error ? (
          <ErrorState onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : bulletins.length === 0 ? (
          <EmptyState
            title="No bulletins matching filters"
            description={`No active municipal notices found matching your criteria in ${selectedArea}. Try clearing filters.`}
          />
        ) : (
          <div className="space-y-3.5">
            {bulletins.map(bulletin => (
              <div
                key={bulletin.id}
                className={cn(
                  'bg-white rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all space-y-3',
                  PRIORITY_STYLES[bulletin.priority] || 'border-gray-200'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Header Chips */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={cn(
                        'text-[11px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider',
                        PRIORITY_BADGE_STYLES[bulletin.priority] || 'bg-gray-100 text-gray-700'
                      )}>
                        {bulletin.priority} Priority
                      </span>
                      {bulletin.category && (
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded-full border border-gray-200/60">
                          {bulletin.category}
                        </span>
                      )}
                      {(bulletin.locality || bulletin.city) && (
                        <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-brand-600" />
                          {[bulletin.locality, bulletin.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>

                    {/* Bulletin Title */}
                    <h2 className="font-bold text-gray-900 text-base leading-snug">
                      {bulletin.title}
                    </h2>

                    {/* Summary */}
                    {bulletin.summary && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        {bulletin.summary}
                      </p>
                    )}

                    {/* Slide 06: Structured Civic Impact Matrix */}
                    {(bulletin.affected_ward || bulletin.disruption_window || bulletin.local_impact) && (
                      <div className="mt-3 rounded-2xl bg-white/80 border border-gray-200/80 p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          {bulletin.affected_ward && (
                            <span className="font-bold text-gray-800 flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-brand-600" />
                              Affected Ward / Corridor: <span className="text-brand-700">{bulletin.affected_ward}</span>
                            </span>
                          )}
                          {bulletin.disruption_window && (
                            <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                              ⏱️ {bulletin.disruption_window}
                            </span>
                          )}
                        </div>

                        {bulletin.local_impact && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1.5 border-t border-gray-100 text-[11px]">
                            {bulletin.local_impact.water && (
                              <div className="bg-blue-50/60 border border-blue-100 rounded-xl px-2.5 py-1.5">
                                <span className="font-bold text-blue-800 block">💧 Water Supply</span>
                                <span className="text-gray-700">{bulletin.local_impact.water}</span>
                              </div>
                            )}
                            {bulletin.local_impact.electricity && (
                              <div className="bg-amber-50/60 border border-amber-100 rounded-xl px-2.5 py-1.5">
                                <span className="font-bold text-amber-800 block">⚡ Electricity Grid</span>
                                <span className="text-gray-700">{bulletin.local_impact.electricity}</span>
                              </div>
                            )}
                            {bulletin.local_impact.route && (
                              <div className="bg-orange-50/60 border border-orange-100 rounded-xl px-2.5 py-1.5">
                                <span className="font-bold text-orange-800 block">🚧 Route & Transit</span>
                                <span className="text-gray-700">{bulletin.local_impact.route}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer Metadata */}
                    <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-gray-400 pt-2 border-t border-gray-100">
                      {bulletin.source_agency && (
                        <span className="flex items-center gap-1 font-semibold text-gray-700">
                          <Building2 className="h-3.5 w-3.5 text-brand-500" />
                          {bulletin.source_agency}
                        </span>
                      )}
                      {(bulletin.published_at_display || bulletin.published_at) && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {bulletin.published_at_display || formatDate(bulletin.published_at)}
                        </span>
                      )}
                      {bulletin.helpline && (
                        <a
                          href={`tel:${bulletin.helpline}`}
                          className="ml-auto inline-flex items-center gap-1 font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-lg border border-brand-200 transition"
                        >
                          📞 Citizen Helpline: {bulletin.helpline}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions (Bookmark & Official External Link) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <BookmarkButton type="bulletin" id={bulletin.id} data={bulletin} size="sm" />
                    {bulletin.official_link && (
                      <a
                        href={bulletin.official_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-gray-50 hover:bg-brand-50 text-gray-400 hover:text-brand-600 border border-gray-200 transition-colors"
                        title="View on official municipal portal"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
