import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Heart,
  Building2,
  Package,
  Wrench,
  Tag,
  Newspaper,
  Calendar,
  Search,
  Trash2,
  Share2,
  ExternalLink,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Star,
  Copy,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingDown,
  RotateCcw,
  CheckCircle2,
  X,
  AlertTriangle
} from 'lucide-react'
import { savedApi } from '@/services/apiService'
import { useAuthStore } from '@/store'
import { useSavedStore } from '@/store/savedStore'
import { PageSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { WhatsAppShareModal } from '@/components/shared/WhatsAppShareModal'
import { formatCurrency, formatDate, cn } from '@/utils'
import type { SaveItemType } from '@/types'

const CATEGORY_TABS = [
  { id: 'all', label: 'All Items', icon: Layers },
  { id: 'business', label: 'Businesses', icon: Building2 },
  { id: 'product', label: 'Products', icon: Package },
  { id: 'service', label: 'Services', icon: Wrench },
  { id: 'offer', label: 'Offers & Deals', icon: Tag },
  { id: 'bulletin', label: 'Civic Bulletins', icon: Newspaper },
  { id: 'event', label: 'Events', icon: Calendar },
]

export default function SavedPage() {
  const { isAuthenticated, openAuthModal } = useAuthStore()
  const localItems = useSavedStore((state) => state.items)
  const removeItem = useSavedStore((state) => state.removeItem)
  const clearAllSaved = useSavedStore((state) => state.clearAll)
  const hydrateFromApi = useSavedStore((state) => state.hydrateFromApi)

  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest')
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)

  // Fetch backend bookmarks if authenticated
  const { data: apiData, isLoading } = useQuery({
    queryKey: ['saved-items-api', isAuthenticated],
    queryFn: () => savedApi.list(),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  })

  // Hydrate local store from backend when API data arrives
  useEffect(() => {
    if (apiData) {
      hydrateFromApi(apiData)
    }
  }, [apiData, hydrateFromApi])

  // Flatten and normalize all saved records
  const allSavedList = useMemo(() => {
    return Object.values(localItems).map((record) => {
      const d = record.data || {}
      return {
        key: `${record.type}_${record.id}`,
        type: record.type,
        id: record.id,
        savedAt: record.savedAt,
        data: d,
        title: d.name || d.title || d.provider_name || 'Saved Item',
        locality: d.locality || d.city || d.service_area || '',
        category: d.category || '',
      }
    })
  }, [localItems])

  // Count items per category accurately
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: allSavedList.length,
      business: 0,
      product: 0,
      service: 0,
      offer: 0,
      bulletin: 0,
      event: 0,
    }
    for (const item of allSavedList) {
      if (c[item.type] !== undefined) {
        c[item.type]++
      }
    }
    return c
  }, [allSavedList])

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = allSavedList

    // Filter by tab
    if (activeTab !== 'all') {
      result = result.filter((i) => i.type === activeTab)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.locality.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.data.description && i.data.description.toLowerCase().includes(q))
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime()
      }
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title)
      }
      return 0
    })

    return result
  }, [allSavedList, activeTab, searchQuery, sortBy])

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCoupon(code)
      setTimeout(() => setCopiedCoupon(null), 2000)
    })
  }

  const handleRemove = (type: SaveItemType, id: number) => {
    removeItem(type, id)
  }

  const handleClearAll = () => {
    clearAllSaved()
    setShowClearConfirm(false)
  }

  if (isLoading && allSavedList.length === 0) {
    return <PageSkeleton />
  }

  return (
    <>
      <SEOMeta
        title="Saved Items & Bookmarks — MyArea24"
        description="Your bookmarked local stores, products, service providers, deals, and civic notices in one organized hub."
      />

      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header Card */}
        <div className="bg-gradient-to-br from-white via-rose-50/30 to-brand-50/20 rounded-3xl border border-rose-100/60 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold tracking-wide uppercase">
                <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500 animate-pulse" />
                Personal Bookmark Hub
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Saved Items & Bookmarks
              </h1>
              <p className="text-sm text-gray-600 max-w-xl">
                Aapke pasandeeda local businesses, products, verified services, discount offers aur zaroori notices ek jagah safe hain.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {allSavedList.length > 0 && (
                <>
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 text-sm font-semibold transition-all shadow-xs"
                    title="Share saved list via WhatsApp"
                  >
                    <Share2 className="h-4 w-4 text-emerald-600" />
                    Share List
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-gray-200 hover:border-rose-300 hover:bg-rose-50 text-gray-600 hover:text-rose-600 text-sm font-semibold transition-all shadow-xs"
                    title="Clear all saved bookmarks"
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-rose-100/60">
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-gray-100 shadow-2xs">
              <p className="text-xs text-gray-400 font-medium">Total Saved</p>
              <p className="text-xl font-extrabold text-gray-800 mt-0.5">{allSavedList.length}</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-gray-100 shadow-2xs">
              <p className="text-xs text-gray-400 font-medium">Local Stores</p>
              <p className="text-xl font-extrabold text-brand-600 mt-0.5">{counts.business}</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-gray-100 shadow-2xs">
              <p className="text-xs text-gray-400 font-medium">Products & Services</p>
              <p className="text-xl font-extrabold text-amber-600 mt-0.5">{counts.product + counts.service}</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 border border-gray-100 shadow-2xs">
              <p className="text-xs text-gray-400 font-medium">Deals & Bulletins</p>
              <p className="text-xl font-extrabold text-emerald-600 mt-0.5">{counts.offer + counts.bulletin}</p>
            </div>
          </div>
        </div>

        {/* Guest Device Sync Notice */}
        {!isAuthenticated && allSavedList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-amber-900 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                Aapke bookmarks is device par safe hain. Inhe apne doosre phones aur laptops par sync karne ke liye login karein.
              </span>
            </div>
            <button
              onClick={openAuthModal}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition whitespace-nowrap shadow-xs"
            >
              Login / Sign Up
            </button>
          </div>
        )}

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in saved items by name, category, or locality..."
              className="w-full pl-10 pr-10 py-2.5 bg-white rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
            >
              <option value="newest">Recently Saved</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1.5 p-1.5 bg-gray-100/90 rounded-2xl overflow-x-auto scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon
            const count = counts[tab.id] ?? 0
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0',
                  isActive
                    ? 'bg-white text-rose-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? 'text-rose-500' : 'text-gray-400')} />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    isActive ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Items Grid / Empty State */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
              <Heart className="h-8 w-8 text-rose-400" />
            </div>

            {searchQuery ? (
              <>
                <h3 className="text-lg font-bold text-gray-800">No matching saved items</h3>
                <p className="text-sm text-gray-500">
                  "{searchQuery}" ke liye koi saved bookmark nahi mila. Kripya alag keyword search karein.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear search
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-800">
                  {activeTab === 'all'
                    ? 'No saved items yet'
                    : `No saved ${CATEGORY_TABS.find((t) => t.id === activeTab)?.label.toLowerCase()} yet`}
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Aap marketplace, offers, ya notices browse karte waqt kisi bhi card par bane Heart icon par click karke use yahan save kar sakte hain.
                </p>

                <div className="pt-2 flex justify-center gap-2 flex-wrap">
                  {activeTab === 'business' && (
                    <Link
                      to="/businesses"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      Browse Businesses <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {activeTab === 'product' && (
                    <Link
                      to="/products"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      Browse Products <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {activeTab === 'service' && (
                    <Link
                      to="/services"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      Browse Services <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {activeTab === 'offer' && (
                    <Link
                      to="/offers"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      Discover Deals <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {activeTab === 'bulletin' && (
                    <Link
                      to="/civic/bulletins"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      View Bulletins <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {activeTab === 'all' && (
                    <Link
                      to="/businesses"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      Explore Marketplace <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const d = item.data

              // ─── 1. BUSINESS CARD ──────────────────────────────────────────
              if (item.type === 'business') {
                return (
                  <div
                    key={item.key}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <button
                      onClick={() => handleRemove('business', item.id)}
                      className="absolute top-2.5 right-2.5 z-10 p-2 rounded-full bg-white/90 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shadow-xs border border-gray-100"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div>
                      {d.image_url ? (
                        <div className="h-36 overflow-hidden bg-gray-50">
                          <img
                            src={d.image_url}
                            alt={d.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="h-24 bg-gradient-to-r from-brand-50 to-rose-50 flex items-center px-4">
                          <Building2 className="h-8 w-8 text-brand-400" />
                        </div>
                      )}

                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                            Business
                          </span>
                          {d.category && (
                            <span className="text-xs text-gray-500 truncate">{d.category}</span>
                          )}
                        </div>

                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{d.name}</h3>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          {d.locality && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-brand-500" />
                              {d.locality}
                            </span>
                          )}
                          {d.rating && (
                            <span className="flex items-center gap-1 ml-auto font-semibold text-gray-700">
                              <Star className="h-3 w-3 text-gold-400 fill-gold-400" />
                              {Number(d.rating).toFixed(1)}
                            </span>
                          )}
                        </div>

                        {d.saved_at && (
                          <p className="text-[11px] text-gray-400">
                            Saved {formatDate(d.saved_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0 border-t border-gray-50 flex gap-2">
                      {d.phone && (
                        <a
                          href={`tel:${d.phone}`}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 text-xs font-semibold transition"
                        >
                          <Phone className="h-3.5 w-3.5" /> Call
                        </a>
                      )}
                      <Link
                        to={`/businesses/${d.slug || d.id}`}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs font-semibold transition"
                      >
                        Storefront <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              }

              // ─── 2. PRODUCT CARD ───────────────────────────────────────────
              if (item.type === 'product') {
                return (
                  <div
                    key={item.key}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                  >
                    <button
                      onClick={() => handleRemove('product', item.id)}
                      className="absolute top-2.5 right-2.5 z-10 p-2 rounded-full bg-white/90 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shadow-xs border border-gray-100"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div>
                      <div className="h-36 bg-gray-50 flex items-center justify-center overflow-hidden">
                        {d.image_url ? (
                          <img
                            src={d.image_url}
                            alt={d.name}
                            loading="lazy"
                            className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <Package className="h-10 w-10 text-gray-200" />
                        )}
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            Product
                          </span>
                          {d.brand && <span className="text-xs text-gray-500">{d.brand}</span>}
                        </div>

                        <h3 className="font-bold text-gray-900 text-sm line-clamp-2 leading-snug">
                          {d.name}
                        </h3>

                        <div className="flex items-baseline justify-between pt-1">
                          <div>
                            <span className="text-base font-extrabold text-brand-600">
                              {formatCurrency(d.local_price || 0)}
                            </span>
                            {d.online_price && d.online_price > d.local_price && (
                              <span className="text-xs text-gray-400 line-through ml-2">
                                {formatCurrency(d.online_price)}
                              </span>
                            )}
                          </div>
                          {d.availability_status && (
                            <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              In Stock
                            </span>
                          )}
                        </div>

                        {d.store_name && (
                          <p className="text-xs text-gray-400 truncate">
                            Sold by: <span className="font-medium text-gray-700">{d.store_name}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-0 border-t border-gray-50">
                      <Link
                        to={`/products/${item.id}`}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-semibold transition"
                      >
                        View Product Details <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                )
              }

              // ─── 3. SERVICE CARD ───────────────────────────────────────────
              if (item.type === 'service') {
                return (
                  <div
                    key={item.key}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between"
                  >
                    <button
                      onClick={() => handleRemove('service', item.id)}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shadow-xs border border-gray-100"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3 pr-8">
                        <div className="h-10 w-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-500 flex-shrink-0">
                          <Wrench className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                              Service
                            </span>
                            <span className="text-xs text-gray-400">{d.category}</span>
                          </div>
                          <h3 className="font-bold text-gray-900 text-sm truncate mt-0.5">
                            {d.provider_name}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {d.service_area && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-brand-500" />
                            {d.service_area}
                          </span>
                        )}
                        {d.rating && (
                          <span className="flex items-center gap-1 ml-auto font-semibold text-gray-700">
                            <Star className="h-3 w-3 text-gold-400 fill-gold-400" />
                            {Number(d.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex gap-2">
                      {d.phone && (
                        <a
                          href={`tel:${d.phone}`}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 text-xs font-semibold transition"
                        >
                          <Phone className="h-3.5 w-3.5" /> Call Provider
                        </a>
                      )}
                      <Link
                        to="/services"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 text-xs font-semibold transition"
                      >
                        All Services
                      </Link>
                    </div>
                  </div>
                )
              }

              // ─── 4. OFFER CARD ─────────────────────────────────────────────
              if (item.type === 'offer') {
                return (
                  <div
                    key={item.key}
                    className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between"
                  >
                    <button
                      onClick={() => handleRemove('offer', item.id)}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shadow-xs border border-gray-100"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="space-y-3">
                      <div className="flex items-start justify-between pr-8">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Deal & Offer
                          </span>
                          <h3 className="font-bold text-gray-900 text-sm mt-1.5 line-clamp-2">
                            {d.title}
                          </h3>
                        </div>
                      </div>

                      {d.discount_text && (
                        <div className="inline-block text-xs font-extrabold text-gold-700 bg-gold-50 px-2.5 py-1 rounded-xl border border-gold-200">
                          {d.discount_text}
                        </div>
                      )}

                      {d.coupon_code && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <code className="flex-1 text-xs font-mono font-bold text-brand-600 tracking-wider">
                            {d.coupon_code}
                          </code>
                          <button
                            onClick={() => copyCoupon(d.coupon_code)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-brand-600"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedCoupon === d.coupon_code ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )}

                      {d.valid_until && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Valid until: {formatDate(d.valid_until)}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center text-xs">
                      <span className="text-gray-400 truncate max-w-[150px]">
                        {d.store_name || 'Local Store'}
                      </span>
                      <Link
                        to="/offers"
                        className="font-semibold text-brand-600 hover:underline flex items-center gap-0.5"
                      >
                        View Deals <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )
              }

              // ─── 5. BULLETIN CARD ──────────────────────────────────────────
              if (item.type === 'bulletin') {
                return (
                  <div
                    key={item.key}
                    className="relative bg-white rounded-2xl border border-amber-100/70 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between"
                  >
                    <button
                      onClick={() => handleRemove('bulletin', item.id)}
                      className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shadow-xs border border-gray-100"
                      title="Remove from saved"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <div className="space-y-2.5 pr-8">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                          Civic Notice
                        </span>
                        {d.priority && (
                          <span className="text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            {d.priority}
                          </span>
                        )}
                        {d.category && (
                          <span className="text-xs text-gray-400">{d.category}</span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">
                        {d.title}
                      </h3>

                      {d.summary && (
                        <p className="text-xs text-gray-600 line-clamp-2">{d.summary}</p>
                      )}

                      {d.source_agency && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1 pt-1">
                          <Building2 className="h-3 w-3 text-gray-400" /> {d.source_agency}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        {d.city || d.locality || 'Civic Advisory'}
                      </span>
                      <Link
                        to="/civic/bulletins"
                        className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
                      >
                        Civic Portal <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )
              }

              // ─── 6. EVENT CARD ─────────────────────────────────────────────
              return (
                <div
                  key={item.key}
                  className="relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 flex flex-col justify-between"
                >
                  <button
                    onClick={() => handleRemove(item.type, item.id)}
                    className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition shadow-xs border border-gray-100"
                    title="Remove from saved"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="space-y-2 pr-8">
                    <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      Event
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-2">{item.title}</h3>
                    {d.venue_name && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-brand-500" /> {d.venue_name}
                      </p>
                    )}
                    {d.timing_text && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {d.timing_text}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
                    <Link
                      to="/events"
                      className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
                    >
                      View Events <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100 animate-scale-up">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-gray-900">Clear All Saved Items?</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Kya aap apne saare saved bookmarks hatana chahte hain? Yeh action revert nahi kiya ja sakta.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition shadow-xs"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Saved List Modal */}
      <WhatsAppShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="My Saved Local Favorites on MyArea24"
        category="Personal Bookmarks"
        messageBody={`✨ Mere saved local businesses aur offers on MyArea24 (${allSavedList.length} items bookmarked):\n\n${allSavedList
          .slice(0, 5)
          .map((i, idx) => `${idx + 1}. ${i.title} (${i.type.toUpperCase()})`)
          .join('\n')}\n\nCheck out MyArea24:`}
        url={window.location.origin + '/saved'}
      />
    </>
  )
}
