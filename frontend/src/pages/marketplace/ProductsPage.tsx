import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search, Package, X, RotateCcw } from 'lucide-react'
import { productApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { ProductCard } from '@/components/marketplace/ProductCard'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { ErrorState, EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'

export default function ProductsPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('relevance')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [page, setPage] = useState(1)

  const { data: cats } = useQuery({ queryKey: ['prod-cats'], queryFn: productApi.categories, staleTime: 60 * 60 * 1000 })
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['products', selectedArea, selectedCity, search, category, sort, inStockOnly, page],
    queryFn: () => productApi.list({
      q: search || undefined, category: category || undefined, sort_by: sort,
      in_stock_only: inStockOnly || undefined,
      locality: selectedArea,
      city: selectedCity,
      user_lat: selectedLat ?? undefined, user_lon: selectedLon ?? undefined,
      page, page_size: 12,
    }),
    staleTime: 3 * 60 * 1000,
  })

  const totalPages = data ? Math.ceil(data.total / 12) : 1

  const handleResetFilters = () => {
    setSearch('')
    setCategory('')
    setInStockOnly(false)
    setSort('relevance')
    setPage(1)
  }

  return (
    <>
      <SEOMeta title={`${t('product.title')} — ${selectedArea}`} description={`Compare local product prices near ${selectedArea}`} />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Package className="h-6 w-6 text-blue-500" />{t('product.title')}</h1>
          <p className="text-sm text-gray-400">{data?.total ?? 0} {t('product.subtitle')} {selectedArea}</p>
        </div>

        {/* Slide 07: Quick Offline Shopping Intent Presets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-semibold text-gray-400 shrink-0">{t('product.quick_intent')}</span>
          <button
            onClick={() => { setSearch('5G'); setCategory(''); setInStockOnly(true); setPage(1) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200/80 shrink-0 transition"
          >
            {t('product.intent_phone')}
          </button>
          <button
            onClick={() => { setSearch('Samsung'); setCategory(''); setInStockOnly(false); setPage(1) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shrink-0 transition"
          >
            {t('product.intent_samsung')}
          </button>
          <button
            onClick={() => { setSearch('Atta'); setCategory(''); setInStockOnly(true); setPage(1) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shrink-0 transition"
          >
            {t('product.intent_atta')}
          </button>
          <button
            onClick={() => { setSearch('Thermometer'); setCategory(''); setInStockOnly(false); setPage(1) }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shrink-0 transition"
          >
            {t('product.intent_pharmacy')}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-brand-300">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={t('product.search_placeholder')}
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
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none"
            >
              <option value="">{t('product.all_categories')}</option>
              {(cats ?? []).map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
            </select>
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1) }}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none"
            >
              <option value="relevance">{t('product.relevance')}</option>
              <option value="price_asc">{t('product.price_low_high')}</option>
              <option value="price_desc">{t('product.price_high_low')}</option>
              <option value="distance">{t('product.nearest')}</option>
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
              <input type="checkbox" checked={inStockOnly} onChange={e => { setInStockOnly(e.target.checked); setPage(1) }} className="accent-brand-500" />
              {t('product.in_stock')}
            </label>
          </div>
        </div>

        {/* Quick Category Chips */}
        {cats && cats.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => { setCategory(''); setPage(1) }}
              className={`px-3 py-1.5 rounded-full font-semibold shrink-0 transition ${
                !category
                  ? 'bg-blue-600 text-white shadow-xs'
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
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{c.category}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active Filters Summary */}
        {(search || category || inStockOnly || sort !== 'relevance') && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 pt-0.5">
            <span className="font-medium text-gray-400">{t('common.filters')}</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-100">
                "{search}"
                <button onClick={() => { setSearch(''); setPage(1) }} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-100">
                {category}
                <button onClick={() => { setCategory(''); setPage(1) }} className="hover:text-blue-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            {inStockOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                {t('product.in_stock')}
                <button onClick={() => { setInStockOnly(false); setPage(1) }} className="hover:text-emerald-900"><X className="h-3 w-3" /></button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-blue-600 hover:underline font-semibold ml-auto flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> {t('common.reset_all')}
            </button>
          </div>
        )}

        {error ? <ErrorState onRetry={refetch} /> : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(data?.items ?? []).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
            {(data?.items ?? []).length === 0 && (
              <EmptyState
                title={t('product.no_products')}
                description={
                  search || category || inStockOnly
                    ? t('product.no_products_filter_desc')
                    : `${t('product.no_products')} — ${selectedArea}.`
                }
                action={
                  search || category || inStockOnly
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

