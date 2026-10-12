import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Store,
  Eye,
  Phone,
  MessageSquare,
  CheckCircle,
  Clock,
  PlusCircle,
  RefreshCw,
  TrendingUp,
  Sparkles,
  Tag,
  Zap,
  Trash2,
  AlertCircle,
  Calendar,
  Package,
  Wrench,
  Pencil,
  Settings,
} from 'lucide-react'
import { enquiryApi, businessApi, authApi, intelligenceApi, offerApi, productApi, serviceApi } from '@/services/apiService'
import { useAuthStore, useLocationStore } from '@/store'
import { PageSkeleton } from '@/components/shared/Skeleton'
import { EmptyState } from '@/components/shared/States'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { formatRelativeTime, cn } from '@/utils'
import type { Enquiry, BusinessCreateRequest, Offer, Product } from '@/types'

const STATUS_STYLES: Record<Enquiry['status'], string> = {
  pending:   'bg-amber-50 text-amber-700',
  contacted: 'bg-blue-50 text-blue-700',
  resolved:  'bg-green-50 text-green-700',
  closed:    'bg-gray-100 text-gray-400',
}

// ─── Register Business Form ───────────────────────────────────────────────────
function RegisterBusinessForm() {
  const { setUser } = useAuthStore()
  const { selectedArea, selectedCity, selectedState, selectedLat, selectedLon } = useLocationStore()
  const [form, setForm] = useState<BusinessCreateRequest>({
    name: '',
    category: '',
    address: selectedArea || '',
    locality: selectedArea?.split(',')[0]?.trim() || '',
    city: selectedCity || '',
    state: selectedState || '',
    latitude: selectedLat ?? undefined,
    longitude: selectedLon ?? undefined,
    phone: '',
    whatsapp: '',
    opening_time: '09:00',
    closing_time: '21:00',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const { data: cats } = useQuery({
    queryKey: ['biz-cats'],
    queryFn: businessApi.categories,
    staleTime: 60 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: () => businessApi.create(form),
    onSuccess: async () => {
      try {
        const updated = await authApi.me()
        setUser(updated)
      } catch {
        // Ignore
      }
      setSuccess(true)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e.response?.data?.message ?? 'Failed to register business. Please try again.')
    },
  })

  function update(field: keyof BusinessCreateRequest, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError('')
  }

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-700 text-lg">Business Registered!</p>
        <p className="text-sm text-gray-400 mt-1">Your listing is pending approval. Reload to access your dashboard.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center">
            <PlusCircle className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Register Your Business</h2>
            <p className="text-xs text-gray-400">Fill in the details to list your business on MyArea24</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name <span className="text-red-400">*</span></label>
              <input
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="e.g. Sharma General Store"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category <span className="text-red-400">*</span></label>
              {cats && cats.length > 0 ? (
                <select
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                >
                  <option value="">Select category…</option>
                  {cats.map(c => <option key={c.category} value={c.category}>{c.category}</option>)}
                </select>
              ) : (
                <input
                  value={form.category}
                  onChange={e => update('category', e.target.value)}
                  placeholder="e.g. Grocery, Electronics"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Address <span className="text-red-400">*</span></label>
            <input
              value={form.address}
              onChange={e => update('address', e.target.value)}
              placeholder="e.g. Shop 12, Main Market"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">City <span className="text-red-400">*</span></label>
              <input
                value={form.city}
                onChange={e => update('city', e.target.value)}
                placeholder="e.g. Ghaziabad, Delhi, Jaipur"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone <span className="text-red-400">*</span></label>
              <input
                value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp (Optional)</label>
              <input
                value={form.whatsapp ?? ''}
                onChange={e => update('whatsapp', e.target.value)}
                placeholder="WhatsApp contact"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Opens</label>
                <input
                  type="time"
                  value={form.opening_time ?? '09:00'}
                  onChange={e => update('opening_time', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Closes</label>
                <input
                  type="time"
                  value={form.closing_time ?? '21:00'}
                  onChange={e => update('closing_time', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.name.trim() || !form.category.trim() || createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {createMutation.isPending
              ? <><RefreshCw className="h-4 w-4 animate-spin" />Registering…</>
              : <><PlusCircle className="h-4 w-4" />Register Business</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Merchant Dashboard ───────────────────────────────────────────────────────
export default function MerchantPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const businessId = user?.businesses?.[0]?.id

  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerTitle, setOfferTitle] = useState('')
  const [offerDiscount, setOfferDiscount] = useState('15% OFF')
  const [offerCoupon, setOfferCoupon] = useState('')
  const [offerDays, setOfferDays] = useState(7)
  const [offerCategory, setOfferCategory] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['merchant-dashboard', businessId],
    queryFn: () => enquiryApi.merchantDashboard(businessId!),
    enabled: !!businessId,
    staleTime: 60 * 1000,
  })

  const biz = data?.business

  // Hyperlocal Demand Radar Query for merchant's neighborhood
  const { data: demandData } = useQuery({
    queryKey: ['merchant-demand', biz?.locality, biz?.city],
    queryFn: () =>
      intelligenceApi.demand({
        area: biz?.locality || biz?.city,
        lat: biz?.latitude ?? undefined,
        lon: biz?.longitude ?? undefined,
      }),
    enabled: !!biz,
    staleTime: 60 * 1000,
  })

  // Merchant's existing offers
  const { data: offersData } = useQuery({
    queryKey: ['merchant-offers', businessId],
    queryFn: () => offerApi.list({ business_id: businessId, page_size: 25 }),
    enabled: !!biz && !!businessId,
    staleTime: 30 * 1000,
  })

  // Merchant's products catalog
  const { data: productsData } = useQuery({
    queryKey: ['merchant-products', businessId],
    queryFn: () => productApi.list({ business_id: businessId, page_size: 50 }),
    enabled: !!biz && !!businessId,
    staleTime: 30 * 1000,
  })

  const [showProductModal, setShowProductModal] = useState(false)
  const [prodName, setProdName] = useState('')
  const [prodCategory, setProdCategory] = useState('')
  const [prodPrice, setProdPrice] = useState('')
  const [prodMrp, setProdMrp] = useState('')
  const [prodStock, setProdStock] = useState<'in_stock' | 'low_stock' | 'confirm_with_seller'>('in_stock')
  const [prodDesc, setProdDesc] = useState('')

  // Edit Existing Product Modal / Inline Price Edit state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editProdName, setEditProdName] = useState('')
  const [editProdCategory, setEditProdCategory] = useState('')
  const [editProdPrice, setEditProdPrice] = useState('')
  const [editProdMrp, setEditProdMrp] = useState('')
  const [editProdStock, setEditProdStock] = useState<Product['availability_status']>('in_stock')
  const [editProdDesc, setEditProdDesc] = useState('')
  const [inlinePriceId, setInlinePriceId] = useState<number | null>(null)
  const [inlinePriceVal, setInlinePriceVal] = useState('')
  const [inlineMrpVal, setInlineMrpVal] = useState('')

  // Inline Store Timing Editor & Full Edit Business Profile Modal state
  const [isEditingHoursInline, setIsEditingHoursInline] = useState(false)
  const [showEditBizModal, setShowEditBizModal] = useState(false)
  const [editBizName, setEditBizName] = useState('')
  const [editBizPhone, setEditBizPhone] = useState('')
  const [editBizWhatsapp, setEditBizWhatsapp] = useState('')
  const [editBizAddress, setEditBizAddress] = useState('')
  const [editBizOpenTime, setEditBizOpenTime] = useState('09:00')
  const [editBizCloseTime, setEditBizCloseTime] = useState('21:00')
  const [editBizDaysOpen, setEditBizDaysOpen] = useState('Mon-Sun')
  const [editBizDesc, setEditBizDesc] = useState('')

  const updateBusinessMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => businessApi.update(businessId!, payload),
    onSuccess: () => {
      setShowEditBizModal(false)
      setIsEditingHoursInline(false)
      qc.invalidateQueries({ queryKey: ['merchant-dashboard', businessId] })
      qc.invalidateQueries({ queryKey: ['businesses'] })
      if (biz?.slug) {
        qc.invalidateQueries({ queryKey: ['business', biz.slug] })
      }
    },
  })

  const openInlineHoursEditor = () => {
    if (!biz) return
    setEditBizOpenTime(biz.opening_time || '09:00')
    setEditBizCloseTime(biz.closing_time || '21:00')
    setEditBizDaysOpen(biz.days_open || 'Mon-Sun')
    setEditBizPhone(biz.phone || '')
    setIsEditingHoursInline(true)
  }

  const openEditBizModal = () => {
    if (!biz) return
    setEditBizName(biz.name || '')
    setEditBizPhone(biz.phone || '')
    setEditBizWhatsapp(biz.whatsapp || '')
    setEditBizAddress(biz.address || '')
    setEditBizOpenTime(biz.opening_time || '09:00')
    setEditBizCloseTime(biz.closing_time || '21:00')
    setEditBizDaysOpen(biz.days_open || 'Mon-Sun')
    setEditBizDesc(biz.description || '')
    setShowEditBizModal(true)
  }

  const openEditProductModal = (p: Product) => {
    setEditingProduct(p)
    setEditProdName(p.name || '')
    setEditProdCategory(p.category || biz?.category || 'Retail')
    setEditProdPrice(p.local_price != null ? String(p.local_price) : '')
    setEditProdMrp(p.mrp != null ? String(p.mrp) : '')
    setEditProdStock(p.availability_status || 'in_stock')
    setEditProdDesc(p.description || '')
  }

  const createProductMutation = useMutation({
    mutationFn: (newProd: Record<string, unknown>) => productApi.create(newProd),
    onSuccess: () => {
      setShowProductModal(false)
      setProdName('')
      setProdPrice('')
      setProdMrp('')
      setProdDesc('')
      qc.invalidateQueries({ queryKey: ['merchant-products'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => productApi.update(id, data),
    onSuccess: () => {
      setEditingProduct(null)
      setInlinePriceId(null)
      qc.invalidateQueries({ queryKey: ['merchant-products'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => productApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merchant-products'] })
      qc.invalidateQueries({ queryKey: ['products'] })
    },
  })

  // Service listing state and mutation
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [svcName, setSvcName] = useState('')
  const [svcCategory, setSvcCategory] = useState('')
  const [svcArea, setSvcArea] = useState('')
  const [svcPrice, setSvcPrice] = useState('')
  const [svcPriceUnit, setSvcPriceUnit] = useState('job')
  const [svcPhone, setSvcPhone] = useState('')

  const createServiceMutation = useMutation({
    mutationFn: (newSvc: Record<string, unknown>) => serviceApi.create(newSvc),
    onSuccess: () => {
      setShowServiceModal(false)
      setSvcName('')
      setSvcPrice('')
      qc.invalidateQueries({ queryKey: ['services'] })
      qc.invalidateQueries({ queryKey: ['business', biz?.slug] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Enquiry['status'] }) =>
      enquiryApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-dashboard'] }),
  })

  const createOfferMutation = useMutation({
    mutationFn: (newOffer: Record<string, unknown>) => offerApi.create(newOffer),
    onSuccess: () => {
      setShowOfferModal(false)
      setOfferTitle('')
      qc.invalidateQueries({ queryKey: ['merchant-offers'] })
    },
  })

  const deleteOfferMutation = useMutation({
    mutationFn: (id: number) => offerApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant-offers'] }),
  })

  const handleLaunchOffer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessId || !offerTitle.trim()) return
    createOfferMutation.mutate({
      business_id: businessId,
      title: offerTitle.trim(),
      discount_text: offerDiscount.trim(),
      coupon_code: offerCoupon.trim() || undefined,
      category: offerCategory || biz?.category || 'Retail',
      valid_days: offerDays,
      description: `Hyperlocal promotional campaign for ${biz?.name} in ${biz?.locality ?? biz?.city}`,
    })
  }

  const prefillSurgeOffer = (categoryName: string, surgeLevel: string) => {
    setOfferCategory(categoryName)
    setOfferTitle(`${categoryName} Demand Special — ${surgeLevel} Surge Deal`)
    setOfferDiscount(surgeLevel === 'PEAK' ? '25% OFF' : '15% OFF')
    setOfferCoupon('SURGE15')
    setShowOfferModal(true)
  }

  if (!businessId) return (
    <>
      <SEOMeta title="Merchant Hub" />
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Store className="h-6 w-6 text-brand-500" />Merchant Hub
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Register your business to start receiving enquiries.</p>
        </div>
        <RegisterBusinessForm />
      </div>
    </>
  )

  if (isLoading) return <PageSkeleton />

  const enquiries = data?.enquiries ?? []
  const stats = [
    { icon: <Eye className="h-5 w-5 text-blue-500" />,         label: 'Views',     value: biz?.view_count ?? 0,                                      color: 'bg-blue-50' },
    { icon: <Phone className="h-5 w-5 text-brand-500" />,      label: 'Call Clicks', value: biz?.call_clicks ?? 0,                                   color: 'bg-brand-50' },
    { icon: <MessageSquare className="h-5 w-5 text-purple-500" />, label: 'Enquiries', value: enquiries.length,                                      color: 'bg-purple-50' },
    { icon: <CheckCircle className="h-5 w-5 text-green-500" />, label: 'Resolved', value: enquiries.filter(e => e.status === 'resolved').length,    color: 'bg-green-50' },
  ]

  const myOffers = (offersData?.items || []).filter((o: Offer) => o.business_id === businessId || o.business?.id === businessId)
  const myProducts = (productsData?.items || []).filter((p: Product) => p.business_id === businessId || p.business?.id === businessId)

  return (
    <>
      <SEOMeta title="Merchant Hub" />
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Store className="h-6 w-6 text-brand-500" />Merchant Hub
            </h1>
            {biz && <p className="text-sm text-gray-500 mt-0.5">{biz.name} · {biz.category} · 📍 {biz.locality}, {biz.city}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openEditBizModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Settings className="h-4 w-4 text-gray-500" /> Edit Store Hours & Info
            </button>

            <button
              onClick={() => {
                setProdCategory(biz?.category || 'Retail')
                setShowProductModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Package className="h-4 w-4" /> Add Product
            </button>

            <button
              onClick={() => {
                setSvcCategory(biz?.category || 'Services')
                setSvcArea(biz?.locality || biz?.city || '')
                setSvcPhone(biz?.phone || '')
                setShowServiceModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Wrench className="h-4 w-4" /> Add Service
            </button>

            <button
              onClick={() => {
                setOfferCategory(biz?.category || 'General')
                setOfferTitle(`Special Deal at ${biz?.name}`)
                setShowOfferModal(true)
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Zap className="h-4 w-4" /> Launch Flash Deal
            </button>
          </div>
        </div>

        {/* Store Operating Hours & Contact Status Bar (with Inline Timing Editor) */}
        {biz && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    biz.is_open_now ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                  )} />
                  <span className="font-bold text-gray-800">
                    {biz.is_open_now ? 'Open Now' : 'Closed'}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-brand-500" />
                  <strong>Hours:</strong> {biz.opening_time || '09:00'} – {biz.closing_time || '21:00'} ({biz.days_open || 'Mon-Sun'})
                </span>
                {biz.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    <strong>Phone:</strong> {biz.phone}
                  </span>
                )}
                {biz.address && (
                  <span className="text-gray-500 truncate max-w-xs">
                    📍 {biz.address}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <button
                  onClick={() => isEditingHoursInline ? setIsEditingHoursInline(false) : openInlineHoursEditor()}
                  className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition"
                >
                  <Clock className="h-3.5 w-3.5" /> {isEditingHoursInline ? 'Close Timing Editor' : 'Quick Edit Timing'}
                </button>
                <button
                  onClick={openEditBizModal}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" /> Full Profile
                </button>
              </div>
            </div>

            {isEditingHoursInline && (
              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3 bg-gray-50/70 p-3 rounded-xl">
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">Opening Time</label>
                  <input
                    type="time"
                    value={editBizOpenTime}
                    onChange={e => setEditBizOpenTime(e.target.value)}
                    className="text-xs font-bold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">Closing Time</label>
                  <input
                    type="time"
                    value={editBizCloseTime}
                    onChange={e => setEditBizCloseTime(e.target.value)}
                    className="text-xs font-bold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">Days Open</label>
                  <select
                    value={editBizDaysOpen}
                    onChange={e => setEditBizDaysOpen(e.target.value)}
                    className="text-xs font-bold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  >
                    <option value="Mon-Sun">Mon–Sun (All Days)</option>
                    <option value="Mon-Sat">Mon–Sat</option>
                    <option value="Mon-Fri">Mon–Fri</option>
                    <option value="Tue-Sun">Tue–Sun</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-500 block mb-1">Store Phone</label>
                  <input
                    type="text"
                    value={editBizPhone}
                    onChange={e => setEditBizPhone(e.target.value)}
                    placeholder="10-digit phone"
                    className="w-36 text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      updateBusinessMutation.mutate({
                        opening_time: editBizOpenTime || '09:00',
                        closing_time: editBizCloseTime || '21:00',
                        days_open: editBizDaysOpen || 'Mon-Sun',
                        phone: editBizPhone.trim() || undefined,
                      })
                    }
                    disabled={updateBusinessMutation.isPending}
                    className="text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white px-3.5 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    {updateBusinessMutation.isPending ? 'Saving…' : 'Save Timing'}
                  </button>
                  <button
                    onClick={() => setIsEditingHoursInline(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Performance Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ icon, label, value, color }) => (
            <div key={label} className={`rounded-2xl p-4 ${color} flex flex-col gap-1 border border-black/5`}>
              {icon}
              <p className="text-2xl font-black text-gray-800">{value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 font-semibold">{label}</p>
            </div>
          ))}
        </div>

        {/* Hyperlocal Demand Radar (Slide 07) */}
        {demandData && (
          <div className="bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  <Sparkles className="h-4 w-4" /> Neighborhood Hyperlocal Demand Radar
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black">{demandData.composite_demand_index.toFixed(0)}</span>
                  <span className="text-base text-purple-200 font-medium">/ 100 Surge Index</span>
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  Status: <strong className="text-white uppercase">{demandData.market_state.replace('_', ' ')}</strong> in {demandData.area}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-xs space-y-1">
                <p className="font-semibold text-purple-200">Active Demand Drivers:</p>
                <p className="text-white/90">🌤️ {demandData.current_weather_summary}</p>
                <p className="text-white/90">🚗 {demandData.current_traffic_summary}</p>
              </div>
            </div>

            {/* Merchant Action Playbooks */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <p className="text-xs font-bold text-purple-200">AI Inventory & Footfall Guidance:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {demandData.categories.slice(0, 2).map(cat => (
                  <div key={cat.category} className="bg-white/10 rounded-xl p-3 border border-white/10 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{cat.category}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-gray-900">
                        {cat.demand_surge_multiplier}x Surge
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-100">{cat.consumer_insight}</p>
                    <button
                      onClick={() => prefillSurgeOffer(cat.category, cat.surge_level)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 underline"
                    >
                      <Zap className="h-3 w-3" /> Create {cat.category} Promo Deal
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Flash Offer Creator Modal */}
        {showOfferModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Tag className="h-5 w-5 text-amber-500" /> Launch Smart Flash Offer
                </h2>
                <button onClick={() => setShowOfferModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleLaunchOffer} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Offer Title</label>
                  <input
                    type="text"
                    required
                    value={offerTitle}
                    onChange={e => setOfferTitle(e.target.value)}
                    placeholder="e.g. Monsoon Hot Snacks: 20% Off"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Discount Tag</label>
                    <input
                      type="text"
                      required
                      value={offerDiscount}
                      onChange={e => setOfferDiscount(e.target.value)}
                      placeholder="e.g. 20% OFF or Flat ₹100 Off"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Coupon Code (Optional)</label>
                    <input
                      type="text"
                      value={offerCoupon}
                      onChange={e => setOfferCoupon(e.target.value)}
                      placeholder="e.g. RAIN20"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Category</label>
                    <input
                      type="text"
                      value={offerCategory}
                      onChange={e => setOfferCategory(e.target.value)}
                      placeholder="e.g. Food, Groceries"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Validity (Days)</label>
                    <select
                      value={offerDays}
                      onChange={e => setOfferDays(Number(e.target.value))}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value={3}>3 Days (Flash Weekend)</option>
                      <option value={7}>7 Days (1 Week)</option>
                      <option value={14}>14 Days (2 Weeks)</option>
                      <option value={30}>30 Days (1 Month)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowOfferModal(false)}
                    className="text-xs font-medium px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createOfferMutation.isPending}
                    className="text-xs font-bold px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {createOfferMutation.isPending ? 'Publishing…' : 'Publish Offer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Product Creator Modal */}
        {showProductModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-brand-500" /> Add Product to Catalog
                </h2>
                <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!businessId || !prodName.trim()) return
                  createProductMutation.mutate({
                    business_id: businessId,
                    name: prodName.trim(),
                    category: prodCategory.trim() || 'Retail',
                    local_price: prodPrice ? parseFloat(prodPrice) : undefined,
                    mrp: prodMrp ? parseFloat(prodMrp) : undefined,
                    availability_status: prodStock,
                    description: prodDesc.trim() || undefined,
                  })
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={prodName}
                    onChange={e => setProdName(e.target.value)}
                    placeholder="e.g. Havells Rechargeable Emergency Lantern"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      value={prodCategory}
                      onChange={e => setProdCategory(e.target.value)}
                      placeholder="e.g. Electronics, Grocery"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Availability</label>
                    <select
                      value={prodStock}
                      onChange={e => setProdStock(e.target.value as 'in_stock' | 'low_stock' | 'confirm_with_seller')}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="in_stock">In Stock</option>
                      <option value="low_stock">Low Stock</option>
                      <option value="confirm_with_seller">Confirm with Seller</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Store Price (₹) *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      value={prodPrice}
                      onChange={e => setProdPrice(e.target.value)}
                      placeholder="e.g. 850"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">MRP Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={prodMrp}
                      onChange={e => setProdMrp(e.target.value)}
                      placeholder="e.g. 1100"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    value={prodDesc}
                    onChange={e => setProdDesc(e.target.value)}
                    placeholder="Key specifications or warranty details"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="text-xs font-medium px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createProductMutation.isPending}
                    className="text-xs font-bold px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {createProductMutation.isPending ? 'Adding…' : 'Add to Catalog'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Service Creator Modal */}
        {showServiceModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-purple-600" /> Create Service Listing
                </h2>
                <button onClick={() => setShowServiceModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!svcName.trim()) return
                  createServiceMutation.mutate({
                    provider_name: svcName.trim(),
                    category: svcCategory.trim() || 'Services',
                    service_area: svcArea.trim() || biz?.locality || biz?.city || 'Local Area',
                    locality: biz?.locality || 'Local Colony',
                    city: biz?.city || 'Delhi',
                    latitude: biz?.latitude || 28.6304,
                    longitude: biz?.longitude || 77.2177,
                    phone: svcPhone.trim() || biz?.phone || '+91 9999999999',
                    price_starting_at: svcPrice ? parseFloat(svcPrice) : undefined,
                    price_unit: svcPriceUnit,
                  })
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Provider or Service Name *</label>
                  <input
                    type="text"
                    required
                    value={svcName}
                    onChange={e => setSvcName(e.target.value)}
                    placeholder="e.g. 24/7 Emergency AC & Electrician Repair"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      value={svcCategory}
                      onChange={e => setSvcCategory(e.target.value)}
                      placeholder="e.g. Electrician, Plumbing"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={svcPhone}
                      onChange={e => setSvcPhone(e.target.value)}
                      placeholder="+91 XXXXXXXXXX"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Starting Rate (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={svcPrice}
                      onChange={e => setSvcPrice(e.target.value)}
                      placeholder="e.g. 299"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Rate Unit</label>
                    <select
                      value={svcPriceUnit}
                      onChange={e => setSvcPriceUnit(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="visit">per visit</option>
                      <option value="hour">per hour</option>
                      <option value="job">per job</option>
                      <option value="sqft">per sq.ft</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowServiceModal(false)}
                    className="text-xs font-medium px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createServiceMutation.isPending}
                    className="text-xs font-bold px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50"
                  >
                    {createServiceMutation.isPending ? 'Publishing…' : 'Publish Service'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Business Operating Hours & Contact Modal */}
        {showEditBizModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-500" /> Edit Store Hours & Info
                </h2>
                <button onClick={() => setShowEditBizModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!businessId) return
                  updateBusinessMutation.mutate({
                    name: editBizName.trim() || undefined,
                    phone: editBizPhone.trim() || undefined,
                    whatsapp: editBizWhatsapp.trim() || undefined,
                    address: editBizAddress.trim() || undefined,
                    opening_time: editBizOpenTime || '09:00',
                    closing_time: editBizCloseTime || '21:00',
                    days_open: editBizDaysOpen.trim() || 'Mon-Sun',
                    description: editBizDesc.trim() || undefined,
                  })
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Store Name *</label>
                  <input
                    type="text"
                    required
                    value={editBizName}
                    onChange={e => setEditBizName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Opening Time</label>
                    <input
                      type="time"
                      value={editBizOpenTime}
                      onChange={e => setEditBizOpenTime(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Closing Time</label>
                    <input
                      type="time"
                      value={editBizCloseTime}
                      onChange={e => setEditBizCloseTime(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Days Open</label>
                    <select
                      value={editBizDaysOpen}
                      onChange={e => setEditBizDaysOpen(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="Mon-Sun">Mon–Sun (All Days)</option>
                      <option value="Mon-Sat">Mon–Sat</option>
                      <option value="Mon-Fri">Mon–Fri</option>
                      <option value="Tue-Sun">Tue–Sun</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Contact Phone *</label>
                    <input
                      type="text"
                      required
                      value={editBizPhone}
                      onChange={e => setEditBizPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">WhatsApp Number</label>
                    <input
                      type="text"
                      value={editBizWhatsapp}
                      onChange={e => setEditBizWhatsapp(e.target.value)}
                      placeholder="WhatsApp contact"
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Store Address</label>
                  <input
                    type="text"
                    value={editBizAddress}
                    onChange={e => setEditBizAddress(e.target.value)}
                    placeholder="Shop number, street, landmark"
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Store Description</label>
                  <textarea
                    rows={2}
                    value={editBizDesc}
                    onChange={e => setEditBizDesc(e.target.value)}
                    placeholder="What makes your shop special, home delivery availability, etc."
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditBizModal(false)}
                    className="text-xs font-medium px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateBusinessMutation.isPending}
                    className="text-xs font-bold px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {updateBusinessMutation.isPending ? 'Saving…' : 'Save Store Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Existing Product Modal */}
        {editingProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-brand-500" /> Edit Product & Price
                </h2>
                <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!editingProduct) return
                  updateProductMutation.mutate({
                    id: editingProduct.id,
                    data: {
                      name: editProdName.trim() || editingProduct.name,
                      category: editProdCategory.trim() || editingProduct.category,
                      local_price: editProdPrice !== '' ? parseFloat(editProdPrice) : undefined,
                      mrp: editProdMrp !== '' ? parseFloat(editProdMrp) : undefined,
                      availability_status: editProdStock,
                      description: editProdDesc.trim() || undefined,
                    },
                  })
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={editProdName}
                    onChange={e => setEditProdName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Category *</label>
                    <input
                      type="text"
                      required
                      value={editProdCategory}
                      onChange={e => setEditProdCategory(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Availability</label>
                    <select
                      value={editProdStock}
                      onChange={e => setEditProdStock(e.target.value as Product['availability_status'])}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="in_stock">In Stock</option>
                      <option value="low_stock">Low Stock</option>
                      <option value="confirm_with_seller">Confirm with Seller</option>
                      <option value="out_of_stock">Out of Stock</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Local Store Price (₹) *</label>
                    <input
                      type="number"
                      required
                      step="any"
                      value={editProdPrice}
                      onChange={e => setEditProdPrice(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">MRP Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={editProdMrp}
                      onChange={e => setEditProdMrp(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editProdDesc}
                    onChange={e => setEditProdDesc(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="text-xs font-medium px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateProductMutation.isPending}
                    className="text-xs font-bold px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl disabled:opacity-50"
                  >
                    {updateProductMutation.isPending ? 'Updating…' : 'Update Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* My Products Section */}
        {myProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                <Package className="h-4 w-4 text-brand-600" /> Catalog Products ({myProducts.length})
              </h2>
              <button
                onClick={() => setShowProductModal(true)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                + Add Another Product
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myProducts.map((p: Product) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {p.category}
                      </span>
                      <select
                        value={p.availability_status}
                        onChange={e => updateProductMutation.mutate({
                          id: p.id,
                          data: { availability_status: e.target.value }
                        })}
                        className="text-[11px] font-semibold text-gray-700 border border-gray-200 rounded-lg px-2 py-0.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      >
                        <option value="in_stock">🟢 In Stock</option>
                        <option value="low_stock">🟡 Low Stock</option>
                        <option value="confirm_with_seller">🔵 Confirm with Seller</option>
                        <option value="out_of_stock">🔴 Out of Stock</option>
                      </select>
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm">{p.name}</h3>
                    {inlinePriceId === p.id ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1 bg-white border border-brand-300 rounded-lg px-2 py-0.5 shadow-xs">
                            <span className="text-[11px] font-bold text-gray-500">Store ₹</span>
                            <input
                              type="number"
                              step="any"
                              value={inlinePriceVal}
                              onChange={e => setInlinePriceVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const parsed = parseFloat(inlinePriceVal)
                                  const parsedMrp = inlineMrpVal.trim() ? parseFloat(inlineMrpVal) : undefined
                                  if (!isNaN(parsed) && parsed >= 0) {
                                    updateProductMutation.mutate({
                                      id: p.id,
                                      data: {
                                        local_price: parsed,
                                        ...(parsedMrp !== undefined && !isNaN(parsedMrp) ? { mrp: parsedMrp } : {}),
                                      },
                                    })
                                  }
                                } else if (e.key === 'Escape') {
                                  setInlinePriceId(null)
                                }
                              }}
                              placeholder="Price"
                              className="w-20 text-xs font-bold text-gray-900 focus:outline-none"
                              autoFocus
                            />
                          </div>

                          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-0.5">
                            <span className="text-[11px] font-medium text-gray-400">MRP ₹</span>
                            <input
                              type="number"
                              step="any"
                              value={inlineMrpVal}
                              onChange={e => setInlineMrpVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const parsed = parseFloat(inlinePriceVal)
                                  const parsedMrp = inlineMrpVal.trim() ? parseFloat(inlineMrpVal) : undefined
                                  if (!isNaN(parsed) && parsed >= 0) {
                                    updateProductMutation.mutate({
                                      id: p.id,
                                      data: {
                                        local_price: parsed,
                                        ...(parsedMrp !== undefined && !isNaN(parsedMrp) ? { mrp: parsedMrp } : {}),
                                      },
                                    })
                                  }
                                } else if (e.key === 'Escape') {
                                  setInlinePriceId(null)
                                }
                              }}
                              placeholder="Optional MRP"
                              className="w-20 text-xs text-gray-600 focus:outline-none"
                            />
                          </div>

                          <button
                            onClick={() => {
                              const parsed = parseFloat(inlinePriceVal)
                              const parsedMrp = inlineMrpVal.trim() ? parseFloat(inlineMrpVal) : undefined
                              if (!isNaN(parsed) && parsed >= 0) {
                                updateProductMutation.mutate({
                                  id: p.id,
                                  data: {
                                    local_price: parsed,
                                    ...(parsedMrp !== undefined && !isNaN(parsedMrp) ? { mrp: parsedMrp } : {}),
                                  },
                                })
                              } else {
                                setInlinePriceId(null)
                              }
                            }}
                            disabled={updateProductMutation.isPending}
                            className="text-[11px] font-bold bg-brand-500 hover:bg-brand-600 text-white px-2.5 py-1 rounded-lg transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setInlinePriceId(null)}
                            className="text-[11px] text-gray-400 hover:text-gray-600 px-1"
                          >
                            Cancel
                          </button>
                        </div>
                        {(() => {
                          const parsedPr = parseFloat(inlinePriceVal)
                          const parsedM = parseFloat(inlineMrpVal)
                          if (!isNaN(parsedPr) && !isNaN(parsedM) && parsedM > parsedPr) {
                            const diff = parsedM - parsedPr
                            const pct = Math.round((diff / parsedM) * 100)
                            return (
                              <p className="text-[11px] font-semibold text-green-700">
                                🏷️ Customer saves ₹{Math.round(diff)} ({pct}% OFF)
                              </p>
                            )
                          }
                          return null
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-gray-900">₹{p.local_price ?? 0}</span>
                        {p.mrp && <span className="text-xs text-gray-400 line-through">₹{p.mrp}</span>}
                        {p.mrp && p.local_price != null && p.mrp > p.local_price && (
                          <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-md">
                            Save ₹{Math.round(p.mrp - p.local_price)} ({Math.round(((p.mrp - p.local_price) / p.mrp) * 100)}% OFF)
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setInlinePriceId(p.id)
                            setInlinePriceVal(p.local_price != null ? String(p.local_price) : '0')
                            setInlineMrpVal(p.mrp != null ? String(p.mrp) : '')
                          }}
                          className="text-[11px] font-semibold text-brand-600 hover:underline inline-flex items-center gap-0.5 ml-1"
                          title="Quick edit local price and MRP"
                        >
                          <Pencil className="h-3 w-3" /> Edit Price
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditProductModal(p)}
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                      title="Edit Product Details & Price"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteProductMutation.mutate(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Remove Product"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Offers Section */}
        {myOffers.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              <Tag className="h-4 w-4 text-amber-500" /> Active Promotional Offers ({myOffers.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myOffers.map((off: Offer) => (
                <div key={off.id} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      {off.discount_text}
                    </span>
                    <h3 className="font-bold text-gray-800 text-sm">{off.title}</h3>
                    {off.coupon_code && <p className="text-xs font-mono text-gray-500">Code: {off.coupon_code}</p>}
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {off.days_left ?? 7} days remaining
                    </p>
                  </div>
                  <button
                    onClick={() => deleteOfferMutation.mutate(off.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Deactivate Offer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Enquiries */}
        <div>
          <h2 className="font-bold text-gray-700 mb-3">Customer Enquiries</h2>
          {enquiries.length === 0 ? (
            <EmptyState title="No enquiries yet" description="Share your business profile to get customer enquiries." />
          ) : (
            <div className="space-y-3">
              {enquiries.map(enq => (
                <div key={enq.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{enq.customer_name ?? 'Anonymous'}</p>
                      {enq.customer_phone && <p className="text-xs text-gray-400">{enq.customer_phone}</p>}
                      {enq.message && <p className="text-sm text-gray-600 mt-1">{enq.message}</p>}
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />{formatRelativeTime(enq.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_STYLES[enq.status])}>
                        {enq.status}
                      </span>
                      <select
                        value={enq.status}
                        onChange={e => updateStatus.mutate({ id: enq.id, status: e.target.value as Enquiry['status'] })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="contacted">Contacted</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
