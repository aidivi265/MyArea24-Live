import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, SlidersHorizontal, Building2, X, RotateCcw } from 'lucide-react'
import { businessApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { BusinessCard } from '@/components/marketplace/BusinessCard'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { ErrorState, EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'

export default function BusinessesPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [openNow, setOpenNow] = useState(false)
  const [sortBy, setSortBy] = useState('distance')
  const [page, setPage] = useState(1)

  const { data: cats } = useQuery({ queryKey: ['biz-cats'], queryFn: businessApi.categories, staleTime: 60 * 60 * 1000 })
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['businesses', selectedArea, selectedCity, search, category, openNow, sortBy, page],
    queryFn: () => businessApi.list({
      q: search || undefined, category: category || undefined,
      locality: selectedArea,
      city: selectedCity,
      // Pass coords only for distance sort; omitting them makes backend sort by rating
      user_lat: sortBy === 'distance' ? (selectedLat ?? undefined) : undefined,
      user_lon: sortBy === 'distance' ? (selectedLon ?? undefined) : undefined,
      open_now: openNow || undefined, page, page_size: 12,
    }),
    staleTime: 3 * 60 * 1000,
  })

  const totalPages = data ? Math.ceil(data.total / 12) : 1

  const handleResetFilters = () => {
    setSearch('')
    setCategory('')
    setOpenNow(false)
    setPage(1)
  }

  return (
    <>
      <SEOMeta title={`${t('business.title')} — ${selectedArea}`} description={`Find local businesses, shops and services in ${selectedArea}`} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-500" />
            {t('business.title')}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{data?.total ?? 0} {t('business.subtitle')} {selectedArea}</p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-brand-300">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={t('business.search_placeholder')}
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1) }}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                title={t('common.clear')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
            >
              <option value="">{t('business.all_categories')}</option>
              {(cats ?? []).map(c => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
              <input type="checkbox" checked={openNow} onChange={e => { setOpenNow(e.target.checked); setPage(1) }} className="accent-brand-500" />
              {t('business.open_now')}
            </label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none"
            >
              <option value="distance">{t('business.nearest_first')}</option>
              <option value="rating">{t('business.highest_rated')}</option>
            </select>
            <SlidersHorizontal className="h-4 w-4 text-gray-400 hidden sm:block" />
          </div>
        </div>

        {/* Horizontal Quick Category Chips */}
        {cats && cats.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => { setCategory(''); setPage(1) }}
              className={`px-3 py-1.5 rounded-full font-semibold shrink-0 transition ${
                !category
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t('common.all')}
            </button>
            {cats.slice(0, 8).map(c => (
              <button
                key={c.category}
                onClick={() => { setCategory(category === c.category ? '' : c.category); setPage(1) }}
                className={`px-3 py-1.5 rounded-full font-medium shrink-0 transition flex items-center gap-1.5 ${
                  category === c.category
                    ? 'bg-brand-600 text-white font-semibold shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{c.category}</span>
                <span className={`text-[10px] px-1 py-0.2 rounded-full ${category === c.category ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {c.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Active Filters Summary */}
        {(search || category || openNow) && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pt-0.5">
            <span className="font-medium text-gray-400">{t('common.filters')}</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 font-medium border border-brand-100">
                "{search}"
                <button onClick={() => { setSearch(''); setPage(1) }} className="hover:text-brand-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 font-medium border border-brand-100">
                {category}
                <button onClick={() => { setCategory(''); setPage(1) }} className="hover:text-brand-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {openNow && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                {t('business.open_now')}
                <button onClick={() => { setOpenNow(false); setPage(1) }} className="hover:text-emerald-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-brand-600 hover:underline font-semibold ml-auto flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> {t('common.reset_all')}
            </button>
          </div>
        )}

        {error ? <ErrorState onRetry={refetch} /> : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.items ?? []).map(biz => <BusinessCard key={biz.id} business={biz} />)}
            </div>
            {(data?.items ?? []).length === 0 && (
              <EmptyState
                title={t('business.no_businesses')}
                description={
                  search || category || openNow
                    ? t('business.no_businesses_filter_desc')
                    : `${t('business.no_businesses_area_desc')} ${selectedArea}.`
                }
                action={
                  search || category || openNow
                    ? {
                        label: t('business.clear_filters'),
                        onClick: handleResetFilters,
                      }
                    : undefined
                }
              />
            )}
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">{t('common.prev')}</button>
            <span className="text-sm text-gray-600">{t('common.page')} {page} {t('common.of')} {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">{t('common.next')}</button>
          </div>
        )}
      </div>
    </>
  )
}

