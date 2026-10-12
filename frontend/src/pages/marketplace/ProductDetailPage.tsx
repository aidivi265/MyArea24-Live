import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Package, Store, TrendingDown, ShoppingCart, Phone, Send, CheckCircle2, X, MapPin } from 'lucide-react'
import { productApi, enquiryApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { PageSkeleton } from '@/components/shared/Skeleton'
import { ErrorState } from '@/components/shared/States'
import { ProductCard } from '@/components/marketplace/ProductCard'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { BookmarkButton } from '@/components/shared/BookmarkButton'
import { formatCurrency, cn } from '@/utils'
import { useTranslation } from 'react-i18next'

const STOCK_STYLES = {
  in_stock:           'bg-green-50 text-green-700 border-green-200',
  low_stock:          'bg-amber-50 text-amber-700 border-amber-200',
  confirm_with_seller:'bg-blue-50 text-blue-700 border-blue-200',
  out_of_stock:       'bg-red-50 text-red-500 border-red-200',
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { selectedLat, selectedLon } = useLocationStore()

  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [enquirySuccess, setEnquirySuccess] = useState(false)
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    message: '',
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productApi.get(Number(id)),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const { data: compareData } = useQuery({
    queryKey: ['product-compare', id, selectedLat, selectedLon],
    queryFn: () => productApi.compare(Number(id), {
      user_lat: selectedLat ?? undefined,
      user_lon: selectedLon ?? undefined,
    }),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  const enquiryMutation = useMutation({
    mutationFn: (payload: { business_id: number; product_id: number; customer_name: string; customer_phone: string; message: string; enquiry_type: string }) =>
      enquiryApi.submit(payload),
    onSuccess: () => {
      setEnquirySuccess(true)
      setTimeout(() => {
        setEnquirySuccess(false)
        setEnquiryOpen(false)
        setForm({ customer_name: '', customer_phone: '', message: '' })
      }, 1800)
    },
  })

  if (isLoading) return <PageSkeleton />
  if (error) return <ErrorState onRetry={refetch} />
  if (!data) return (
    <div className="text-center py-16">
      <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
      <p className="font-semibold text-gray-600">Product not found.</p>
      <Link to="/products" className="text-sm text-brand-500 mt-2 inline-block">← Back to Products</Link>
    </div>
  )

  const stockStyle = STOCK_STYLES[data.availability_status] ?? STOCK_STYLES.confirm_with_seller
  const hasSavings = data.better_offline && data.savings_percent && data.savings_percent > 0

  return (
    <>
      <SEOMeta
        title={data.name}
        description={`${data.name}${data.brand ? ` by ${data.brand}` : ''} — available at ${data.business?.name ?? 'local store'} for ${formatCurrency(data.local_price)}`}
      />

      <div className="space-y-4">
        {/* Breadcrumbs & Smart Back */}
        <Breadcrumbs
          items={[
            { label: 'Products', to: '/products' },
            ...(data.business ? [{ label: data.business.name, to: `/businesses/${data.business.slug}` }] : []),
            { label: data.name },
          ]}
          fallbackTo="/products"
        />

        {/* Main product card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Image */}
            <div className="h-64 md:h-auto bg-gray-50 flex items-center justify-center p-8 border-b md:border-b-0 md:border-r border-gray-100">
              {data.image_url
                ? <img src={data.image_url} alt={data.name} className="max-h-full max-w-full object-contain" />
                : <Package className="h-20 w-20 text-gray-200" />
              }
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <div>
                {data.category && (
                  <span className="text-xs font-semibold text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full">{data.category}</span>
                )}
                <h1 className="text-xl font-bold text-gray-800 mt-2 leading-snug">{data.name}</h1>
                {data.brand && <p className="text-sm text-gray-400 mt-0.5">{data.brand}{data.model_variant ? ` · ${data.model_variant}` : ''}</p>}
              </div>

              {/* Stock badge */}
              <span className={cn('inline-block text-sm font-semibold px-3 py-1 rounded-full border', stockStyle)}>
                {t(`product.${data.availability_status}`)}
                {data.stock_quantity !== undefined && data.stock_quantity !== null && data.availability_status === 'low_stock'
                  ? ` — ${data.stock_quantity} left`
                  : ''}
              </span>

              {/* Price block */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-black text-brand-600">{formatCurrency(data.local_price)}</span>
                  {data.mrp && data.mrp !== data.local_price && (
                    <span className="text-sm text-gray-400 line-through">MRP {formatCurrency(data.mrp)}</span>
                  )}
                </div>

                {data.online_price && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {data.online_provider ?? 'Online'}: <span className="font-semibold text-gray-700">{formatCurrency(data.online_price)}</span>
                    </span>
                    {hasSavings && (
                      <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <TrendingDown className="h-3.5 w-3.5" />
                        Save {data.savings_percent?.toFixed(0)}% buying local
                      </div>
                    )}
                  </div>
                )}
                {data.online_url && (
                  <a href={data.online_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" />View online listing
                  </a>
                )}
              </div>

              {/* Description */}
              {data.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{data.description}</p>
              )}

              {/* Freshness */}
              {data.freshness_label && (
                <p className="text-xs text-gray-400">Price updated: {data.freshness_label}</p>
              )}

              {/* Actions & Enquiries */}
              <div className="pt-2 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setForm(f => ({
                        ...f,
                        message: `Hi, I am interested in "${data.name}". Is this currently in stock at your store?`,
                      }))
                      setEnquiryOpen(true)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition shadow-sm"
                  >
                    <Send className="h-4 w-4" />
                    Check Stock / Enquire
                  </button>
                  {data.business?.phone && (
                    <a
                      href={`tel:${data.business.phone}`}
                      onClick={() => enquiryApi.trackClick({ business_id: data.business_id, product_id: data.id, event_type: 'call_click' }).catch(() => {})}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-brand-500 text-gray-700 hover:text-brand-600 text-sm font-semibold transition"
                    >
                      <Phone className="h-4 w-4" />
                      Call Store
                    </a>
                  )}
                  <BookmarkButton type="product" id={data.id} data={data} size="md" variant="pill" />
                </div>
              </div>

              {/* Selling business */}
              {data.business && (
                <Link
                  to={`/businesses/${data.business.slug}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-100 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center border border-gray-100 flex-shrink-0">
                    <Store className="h-4 w-4 text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{data.business.name}</p>
                    <p className="text-xs text-gray-400">{data.business.category}</p>
                  </div>
                  {data.business.phone && (
                    <a href={`tel:${data.business.phone}`} onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors">
                      <Phone className="h-3.5 w-3.5" />Call
                    </a>
                  )}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stock Enquiry Modal */}
        {enquiryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Check In-Store Stock</h3>
                    <p className="text-xs text-gray-500">Contact {data.business?.name || 'Seller'}</p>
                  </div>
                </div>
                <button onClick={() => setEnquiryOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {enquirySuccess ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <p className="font-bold text-gray-800">Enquiry Sent to Merchant!</p>
                  <p className="text-xs text-gray-500">The merchant will contact you shortly regarding stock & price.</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!form.customer_name || !form.customer_phone) return
                    enquiryMutation.mutate({
                      business_id: data.business_id,
                      product_id: data.id,
                      customer_name: form.customer_name,
                      customer_phone: form.customer_phone,
                      message: form.message,
                      enquiry_type: 'stock_check',
                    })
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={form.customer_name}
                      onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                      className="w-full text-sm border rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile number"
                      value={form.customer_phone}
                      onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                      className="w-full text-sm border rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Message</label>
                    <textarea
                      rows={3}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      className="w-full text-sm border rounded-xl px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                    />
                  </div>

                  {enquiryMutation.isError && (
                    <p className="text-xs text-red-500 font-medium">Failed to send enquiry. Please try again.</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEnquiryOpen(false)}
                      className="flex-1 py-2 text-sm text-gray-600 border rounded-xl hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={enquiryMutation.isPending}
                      className="flex-1 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl disabled:opacity-50"
                    >
                      {enquiryMutation.isPending ? 'Sending…' : 'Send Enquiry'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Slide 07: Multi-Store Local vs Online Comparison */}
        {compareData && (compareData.local_store_offers.length > 0 || compareData.online_options.length > 0) && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Store className="h-5 w-5 text-brand-500" />
                  Offline Nearby Stores vs. Online Options
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{compareData.summary.recommendation}</p>
              </div>
              {compareData.summary.price_range_display && (
                <span className="text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-xl self-start">
                  Local Range: {compareData.summary.price_range_display}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nearby Offline Stores */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  📍 Verified Nearby Offline Stores ({compareData.local_store_offers.length})
                </h3>
                {compareData.local_store_offers.map(offer => (
                  <div key={offer.product_id} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/businesses/${offer.business_slug}`}
                        className="font-bold text-sm text-gray-900 hover:text-brand-600 truncate block"
                      >
                        {offer.business_name}
                      </Link>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-brand-500" />
                        {[offer.locality, offer.city].filter(Boolean).join(', ')}
                        {offer.distance_km != null && ` · ${offer.distance_km} km`}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {offer.availability_status.replace(/_/g, ' ')} · Same-Day Pickup
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-brand-600">{formatCurrency(offer.local_price)}</p>
                      {offer.phone && (
                        <a
                          href={`tel:${offer.phone}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                        >
                          <Phone className="h-3 w-3" /> Call Store
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Online Marketplace Benchmarks */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  🌐 Online Reference Options ({compareData.online_options.length})
                </h3>
                {compareData.online_options.map((opt, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-gray-800">{opt.provider}</p>
                      <p className="text-xs text-gray-500 mt-0.5">🚚 {opt.delivery_estimate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-gray-700">{formatCurrency(opt.price)}</p>
                      {opt.url && (
                        <a
                          href={opt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          <ShoppingCart className="h-3 w-3" /> Check Online
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Similar products */}
        {data.similar_products && data.similar_products.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Similar Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.similar_products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
