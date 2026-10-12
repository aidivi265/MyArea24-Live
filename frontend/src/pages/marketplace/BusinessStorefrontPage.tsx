import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Phone, MessageCircle, MapPin, Star, Clock, Globe, BadgeCheck, Package, Tag, Info, ArrowLeft, Send, Wrench } from 'lucide-react'
import { businessApi, enquiryApi } from '@/services/apiService'
import { useLocationStore } from '@/store'
import { ProductCard } from '@/components/marketplace/ProductCard'
import { OfferCard } from '@/components/marketplace/OfferCard'
import { ServiceCard } from '@/components/marketplace/ServiceCard'
import { PageSkeleton } from '@/components/shared/Skeleton'
import { ErrorState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { Breadcrumbs } from '@/components/shared/Breadcrumbs'
import { BookmarkButton } from '@/components/shared/BookmarkButton'
import { formatDistance } from '@/utils'
import { useState } from 'react'
import type { Enquiry } from '@/types'

export default function BusinessStorefrontPage() {
  const { slug } = useParams<{ slug: string }>()
  const { selectedLat, selectedLon } = useLocationStore()
  const [tab, setTab] = useState<'products' | 'services' | 'offers' | 'about'>('products')
  const [enquiryOpen, setEnquiryOpen] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', customer_email: '', message: '', enquiry_type: 'general' })

  const { data, isLoading, error } = useQuery({
    queryKey: ['business', slug],
    queryFn: () => businessApi.get(slug!, { user_lat: selectedLat ?? undefined, user_lon: selectedLon ?? undefined }),
    enabled: !!slug,
  })

  const enquiryMutation = useMutation({
    mutationFn: () => enquiryApi.submit({ ...form, business_id: data!.business.id }),
    onSuccess: () => { setEnquiryOpen(false); setForm({ customer_name: '', customer_phone: '', customer_email: '', message: '', enquiry_type: 'general' }) },
  })

  function trackClick(type: string) { if (data) enquiryApi.trackClick({ business_id: data.business.id, event_type: type }).catch(() => {}) }

  if (isLoading) return <PageSkeleton />
  if (error || !data) return <ErrorState />

  const { business, products, offers } = data
  const services = data.services ?? []

  return (
    <>
      <SEOMeta
        title={`${business.name} — ${business.category} in ${business.locality}`}
        description={business.description ?? `${business.name} in ${business.locality}, ${business.city}`}
        schema={{ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: business.name, address: business.address, telephone: business.phone }}
      />

      <div className="max-w-3xl mx-auto space-y-4">
        {/* Breadcrumbs & Smart Back */}
        <Breadcrumbs
          items={[
            { label: 'Businesses', to: '/businesses' },
            { label: business.name },
          ]}
          fallbackTo="/businesses"
        />

        {/* Header */}
        {business.image_url && (
          <div className="h-48 rounded-2xl overflow-hidden"><img src={business.image_url} alt={business.name} className="w-full h-full object-cover" /></div>
        )}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-800">{business.name}</h1>
                {business.is_verified && <BadgeCheck className="h-5 w-5 text-brand-500" />}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${business.is_open_now ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  {business.is_open_now ? 'Open Now' : 'Closed'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{business.category}{business.subcategory ? ` · ${business.subcategory}` : ''}</p>
              {business.locality && (
                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />{business.address ?? business.locality}, {business.city}
                  {business.distance_km !== undefined && <span className="text-brand-500 ml-1">({formatDistance(business.distance_km)})</span>}
                </p>
              )}
            </div>
            {business.rating && (
              <div className="text-center flex-shrink-0">
                <p className="text-2xl font-black text-gray-800">{business.rating.toFixed(1)}</p>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-3 w-3 ${i < Math.round(business.rating!) ? 'text-gold-400 fill-gold-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{business.review_count} reviews</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {business.phone && (
              <a href={`tel:${business.phone}`} onClick={() => trackClick('call_click')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors">
                <Phone className="h-4 w-4" />Call
              </a>
            )}
            {business.whatsapp && (
              <a href={`https://wa.me/${business.whatsapp}`} target="_blank" rel="noopener noreferrer" onClick={() => trackClick('whatsapp_click')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors">
                <MessageCircle className="h-4 w-4" />WhatsApp
              </a>
            )}
            {business.latitude && (
              <a href={`https://maps.google.com/?q=${business.latitude},${business.longitude}`} target="_blank" rel="noopener noreferrer" onClick={() => trackClick('direction_click')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors">
                <MapPin className="h-4 w-4" />Directions
              </a>
            )}
            {business.website && (
              <a href={business.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors">
                <Globe className="h-4 w-4" />Website
              </a>
            )}
            <button onClick={() => setEnquiryOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold-400 hover:bg-gold-500 text-white text-sm font-semibold transition-colors">
              <Send className="h-4 w-4" />Enquire
            </button>
            <BookmarkButton type="business" id={business.id} data={business} size="md" variant="pill" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {[
            { id: 'products' as const, icon: <Package className="h-4 w-4" />, label: `Products (${products.length})` },
            { id: 'services' as const, icon: <Wrench className="h-4 w-4" />, label: `Services (${services.length})` },
            { id: 'offers' as const, icon: <Tag className="h-4 w-4" />, label: `Offers (${offers.length})` },
            { id: 'about' as const, icon: <Info className="h-4 w-4" />, label: 'About' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'products' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
            {products.length === 0 && <p className="col-span-2 text-center py-8 text-gray-400 text-sm">No products listed.</p>}
          </div>
        )}
        {tab === 'services' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {services.map(s => <ServiceCard key={s.id} service={s} />)}
            {services.length === 0 && <p className="col-span-2 text-center py-8 text-gray-400 text-sm">No services listed for this provider.</p>}
          </div>
        )}
        {tab === 'offers' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {offers.map(o => <OfferCard key={o.id} offer={o} />)}
            {offers.length === 0 && <p className="col-span-2 text-center py-8 text-gray-400 text-sm">No active offers.</p>}
          </div>
        )}
        {tab === 'about' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
            {business.description && <p className="text-sm text-gray-600 leading-relaxed">{business.description}</p>}
            {business.opening_time && (
              <p className="text-sm text-gray-600 flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />{business.opening_time} – {business.closing_time} · {business.days_open}</p>
            )}
            {business.email && <p className="text-sm text-gray-600">{business.email}</p>}
          </div>
        )}

        {/* Enquiry modal */}
        {enquiryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
              <h2 className="font-bold text-gray-800 mb-4">Send Enquiry to {business.name}</h2>
              <div className="space-y-3">
                {[
                  { key: 'customer_name' as const, label: 'Your Name', placeholder: 'Full name' },
                  { key: 'customer_phone' as const, label: 'Phone', placeholder: '+91 XXXXXXXXXX' },
                  { key: 'customer_email' as const, label: 'Email (optional)', placeholder: 'your@email.com' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
                    <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Message</label>
                  <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    rows={3} placeholder="What would you like to ask?"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setEnquiryOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={() => enquiryMutation.mutate()} disabled={enquiryMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-50">
                  {enquiryMutation.isPending ? 'Sending…' : 'Send Enquiry'}
                </button>
              </div>
              {enquiryMutation.isError && <p className="text-sm text-red-500 mt-2">Failed to send. Please try again.</p>}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
