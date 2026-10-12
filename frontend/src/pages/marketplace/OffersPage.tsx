import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Tag } from 'lucide-react'
import { offerApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { OfferCard } from '@/components/marketplace/OfferCard'
import { CardSkeleton } from '@/components/shared/Skeleton'
import { ErrorState, EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'

export default function OffersPage() {
  const { t } = useTranslation()
  const { selectedArea, selectedCity, selectedLat, selectedLon } = useLocationStore()
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['offers', selectedArea, selectedCity, selectedLat, selectedLon, category, page],
    queryFn: () => offerApi.list({
      category: category || undefined,
      locality: selectedArea,
      city: selectedCity,
      user_lat: selectedLat ?? undefined,
      user_lon: selectedLon ?? undefined,
      page,
      page_size: 12,
    }),
    staleTime: 5 * 60 * 1000,
  })

  const totalPages = data ? Math.ceil(data.total / 12) : 1

  return (
    <>
      <SEOMeta title={`${t('offer_page.title')} — ${selectedArea}`} description={`Latest local deals, discounts and offers in ${selectedArea}`} />
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><Tag className="h-6 w-6 text-gold-500" />{t('offer_page.title')}</h1>
          <p className="text-sm text-gray-400">{data?.total ?? 0} {t('offer_page.subtitle')}</p>
        </div>

        <div className="flex gap-3 flex-wrap">
          {['', 'Electronics', 'Food', 'Fashion', 'Health', 'Home', 'Services'].map(cat => (
            <button key={cat} onClick={() => { setCategory(cat); setPage(1) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${category === cat ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
              {cat || t('common.all')}
            </button>
          ))}
        </div>

        {error ? <ErrorState onRetry={refetch} /> : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.items ?? []).map(o => <OfferCard key={o.id} offer={o} />)}
            </div>
            {(data?.items ?? []).length === 0 && (
              <EmptyState
                title={t('offer_page.no_offers')}
                description={category ? `${t('offer_page.no_offers')} (${category})` : t('offer_page.no_offers_desc')}
                action={category ? { label: t('offer_page.view_all_deals'), onClick: () => { setCategory(''); setPage(1) } } : undefined}
                icon={<Tag className="h-10 w-10 text-gray-200" />}
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

