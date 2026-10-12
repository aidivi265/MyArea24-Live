import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, Wrench, X, RotateCcw } from 'lucide-react'
import { serviceApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { ServiceCard } from '@/components/marketplace/ServiceCard'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { ErrorState, EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'

export default function ServicesPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('distance')
  const [page, setPage] = useState(1)

  const { data: cats } = useQuery({ queryKey: ['svc-cats'], queryFn: serviceApi.categories, staleTime: 60 * 60 * 1000 })
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['services', selectedArea, selectedCity, selectedLat, selectedLon, search, category, sort, page],
    queryFn: () => serviceApi.list({
      q: search || undefined,
      category: category || undefined,
      locality: selectedArea,
      city: selectedCity,
      sort_by: sort,
      user_lat: selectedLat ?? undefined,
      user_lon: selectedLon ?? undefined,
      page,
      page_size: 12,
    }),
    staleTime: 5 * 60 * 1000,
  })

  const totalPages = data ? Math.ceil(data.total / 12) : 1

  const handleResetFilters = () => {
    setSearch('')
    setCategory('')
    setSort('distance')
    setPage(1)
  }

  return (
    <>
      <SEOMeta title={`${t('service_page.title')} — ${selectedArea}`} description={`Find electricians, plumbers, tutors and more in ${selectedArea}`} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Wrench className="h-6 w-6 text-purple-500" />{t('service_page.title')}</h1>
          <p className="text-sm text-gray-400">{data?.total ?? 0} {t('service_page.subtitle')} {selectedArea}</p>
        </div>

        {/* Quick Home Service Intent Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-semibold text-gray-400 shrink-0">{t('service_page.quick_need')}</span>
          {[
            { label: t('service_page.need_electrician'), cat: 'Electrician' },
            { label: t('service_page.need_ac'), cat: 'AC Repair' },
            { label: t('service_page.need_plumber'), cat: 'Plumber' },
            { label: t('service_page.need_ro'), cat: 'Appliance Repair' },
            { label: t('service_page.need_carpenter'), cat: 'Carpenter' },
          ].map(item => (
            <button
              key={item.cat}
              onClick={() => { setCategory(category === item.cat ? '' : item.cat); setSearch(''); setPage(1) }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border shrink-0 transition ${
                category === item.cat
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-white hover:bg-purple-50 text-gray-700 border-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-brand-300">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={t('service_page.search_placeholder')}
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
          <div className="flex gap-2 flex-wrap">
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none"
            >
              <option value="">{t('service_page.all_services')}</option>
              {(cats ?? []).map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none"
            >
              <option value="distance">{t('product.nearest')}</option>
              <option value="rating">{t('service_page.top_rated')}</option>
              <option value="price_asc">{t('service_page.rate_low_high')}</option>
              <option value="price_desc">{t('service_page.rate_high_low')}</option>
            </select>
          </div>
        </div>

        {/* Category Chips */}
        {cats && cats.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => { setCategory(''); setPage(1) }}
              className={`px-3 py-1.5 rounded-full font-semibold shrink-0 transition ${
                !category
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {t('common.all')}
            </button>
            {cats.slice(0, 8).map(c => (
              <button
                key={c.category}
                onClick={() => { setCategory(category === c.category ? '' : c.category); setPage(1) }}
                className={`px-3 py-1.5 rounded-full font-medium shrink-0 transition flex items-center gap-1 ${
                  category === c.category
                    ? 'bg-purple-600 text-white font-semibold shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{c.category}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active Filters Summary */}
        {(search || category) && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pt-0.5">
            <span className="font-medium text-gray-400">{t('common.filters')}</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-100">
                "{search}"
                <button onClick={() => { setSearch(''); setPage(1) }} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-100">
                {category}
                <button onClick={() => { setCategory(''); setPage(1) }} className="hover:text-purple-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-purple-600 hover:underline font-semibold ml-auto flex items-center gap-1"
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
              {(data?.items ?? []).map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
            {(data?.items ?? []).length === 0 && (
              <EmptyState
                title={t('service_page.no_services')}
                description={
                  search || category
                    ? t('service_page.no_services_filter_desc')
                    : `${t('service_page.no_services')} — ${selectedArea}.`
                }
                action={
                  search || category
                    ? {
                        label: t('business.clear_filters'),
                        onClick: handleResetFilters,
                      }
                    : undefined
                }
                icon={<Wrench className="h-10 w-10 text-gray-200" />}
              />
            )}
          </>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50">{t('common.prev')}</button>
            <span className="text-sm text-gray-600">{t('common.page')} {page} {t('common.of')} {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50">{t('common.next')}</button>
          </div>
        )}
      </div>
    </>
  )
}

