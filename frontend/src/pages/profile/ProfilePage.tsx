import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  User, Mail, Phone, Save, Store, ArrowRight, ShieldCheck,
  CheckCircle, PlusCircle, Sparkles, Building2, Package, Tag,
  MessageSquare, Heart, MapPin, Languages, ShieldAlert, LogOut,
  ChevronRight, ExternalLink, RefreshCw, X, Radio, AlertCircle
} from 'lucide-react'
import { authApi, businessApi } from '@/services/apiService'
import { useAuthStore, useUIStore, useLocationStore } from '@/store'
import { useSavedStore } from '@/store/savedStore'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { PageSkeleton } from '@/components/shared/Skeleton'
import type { BusinessCreateRequest } from '@/types'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, setUser, logout, activeMode, setActiveMode } = useAuthStore()
  const { language, setLanguage } = useUIStore()
  const { selectedArea, selectedCity } = useLocationStore()
  const savedCount = useSavedStore((state) => Object.keys(state.items).length)
  const qc = useQueryClient()

  const [form, setForm] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '' })
  const [saved, setSaved] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  // Registration modal form state
  const [bizForm, setBizForm] = useState<BusinessCreateRequest>({
    name: '',
    category: 'Grocery & Supermarket',
    address: '',
    locality: selectedArea || '',
    city: selectedCity || 'Delhi',
    phone: user?.phone || '',
    whatsapp: user?.phone || '',
    opening_time: '09:00',
    closing_time: '21:00',
  })
  const [bizError, setBizError] = useState('')
  const [bizSuccess, setBizSuccess] = useState(false)

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    if (me) {
      setUser(me)
      setForm({ full_name: me.full_name ?? '', phone: me.phone ?? '' })
    }
  }, [me, setUser])

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ full_name: form.full_name, phone: form.phone }),
    onSuccess: (u) => {
      setUser(u)
      qc.invalidateQueries({ queryKey: ['me'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const registerBizMutation = useMutation({
    mutationFn: () => businessApi.create(bizForm),
    onSuccess: async () => {
      try {
        const updated = await authApi.me()
        setUser(updated)
        setActiveMode('merchant')
      } catch {
        // Fallback
      }
      setBizSuccess(true)
      qc.invalidateQueries({ queryKey: ['me'] })
      setTimeout(() => {
        setBizSuccess(false)
        setShowRegisterModal(false)
        navigate('/merchant')
      }, 1500)
    },
    onError: (err: any) => {
      setBizError(err.response?.data?.detail || err.response?.data?.message || 'Failed to register business. Please try again.')
    },
  })

  const { data: bizCats } = useQuery({
    queryKey: ['biz-cats'],
    queryFn: businessApi.categories,
    staleTime: 60 * 60 * 1000,
  })

  if (isLoading) return <PageSkeleton />

  const isMerchant = user?.role === 'merchant' || (user?.businesses && user.businesses.length > 0)
  const primaryBusiness = user?.businesses?.[0]

  const handleToggleMode = () => {
    if (activeMode === 'merchant') {
      setActiveMode('resident')
      navigate('/')
    } else {
      setActiveMode('merchant')
      navigate('/merchant')
    }
  }

  return (
    <>
      <SEOMeta title="My Profile & Account — MyArea24" description="Manage your hyperlocal profile, saved items, and merchant storefront." />
      <div className="max-w-2xl mx-auto space-y-5 pb-10">
        
        {/* Mobile Page Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Account</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage profile, merchant store & preferences</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            isMerchant ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-brand-50 text-brand-600 border-brand-200'
          }`}>
            {isMerchant ? '🏪 Verified Merchant' : '👤 Resident Profile'}
          </span>
        </div>

        {/* ─── Profile Overview Card ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-md flex-shrink-0">
              <span className="text-white text-2xl font-black">
                {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-gray-800 text-lg truncate">{user?.full_name || 'MyArea24 User'}</h2>
                {user?.is_verified && <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              {user?.phone && <p className="text-xs text-gray-500 mt-0.5">{user.phone}</p>}
            </div>
          </div>

          {/* Edit Form */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" /> Full Name
              </label>
              <input
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Enter your full name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-gray-400" /> Email Address
              </label>
              <input
                value={user?.email ?? ''}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-100 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-gray-400" /> Mobile Number
              </label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+91 XXXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>

            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saved ? '✓ Saved Successfully!' : updateMutation.isPending ? 'Saving Profile…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ─── Merchant Account Action Hub (Primary User Requirement) ─────── */}
        {isMerchant ? (
          /* Case 1: User has registered as a merchant */
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0">
                    <Store className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                      Merchant Account
                    </span>
                    <h3 className="font-extrabold text-lg text-white mt-1 leading-snug">
                      {primaryBusiness?.name || 'My Local Storefront'}
                    </h3>
                    <p className="text-xs text-white/80">
                      {primaryBusiness?.category || 'Retail Store'} {primaryBusiness?.locality ? `• ${primaryBusiness.locality}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dual-Mode Switcher */}
              <div className="bg-black/15 backdrop-blur-md rounded-xl p-3 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-white/70 block">Current Operating Mode:</span>
                  <span className="font-bold text-white text-sm">
                    {activeMode === 'merchant' ? '🏪 Merchant Portal' : '🛍️ Resident / Shopper'}
                  </span>
                </div>
                <button
                  onClick={handleToggleMode}
                  className="px-3.5 py-1.5 rounded-lg bg-white text-orange-600 hover:bg-white/90 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {activeMode === 'merchant' ? 'Switch to Resident' : 'Switch to Merchant'}
                </button>
              </div>

              {/* Direct Store Management Shortcuts */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/merchant"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white text-gray-800 text-xs font-bold hover:bg-white/90 transition shadow-sm text-center"
                >
                  <Store className="h-4 w-4 text-orange-600" />
                  Merchant Dashboard
                </Link>
                {primaryBusiness && (
                  <Link
                    to={`/businesses/${primaryBusiness.slug || primaryBusiness.id}`}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition text-center"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Live Storefront
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Case 2: User has NOT registered as a merchant yet */
          <div className="bg-gradient-to-br from-indigo-900 via-brand-800 to-brand-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-3.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-white/20">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </span>
                <span className="text-xs font-bold tracking-wide uppercase text-amber-200">Grow Your Local Business</span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-white">Register as a Merchant</h3>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Apne local store, grocery, clinic, pharmacy ya service ko MyArea24 par list karein aur aas-paas ke hazaron customers tak seedhe pahuchein.
                </p>
              </div>

              {/* Key Features */}
              <div className="grid grid-cols-3 gap-2 py-1 text-center text-xs">
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="font-bold text-amber-300 block text-sm">₹0</span>
                  <span className="text-[11px] text-white/80">Zero Commission</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="font-bold text-emerald-300 block text-sm">Direct</span>
                  <span className="text-[11px] text-white/80">WhatsApp & Call</span>
                </div>
                <div className="bg-white/10 rounded-xl p-2">
                  <span className="font-bold text-blue-300 block text-sm">Live</span>
                  <span className="text-[11px] text-white/80">Price Match</span>
                </div>
              </div>

              <button
                onClick={() => setShowRegisterModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-900 font-extrabold text-sm transition-all shadow-md active:scale-98"
              >
                <PlusCircle className="h-4 w-4" />
                Register as a Merchant (निःशुल्क मर्चेंट पंजीकरण)
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Shortcuts & Navigation List ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100 shadow-sm overflow-hidden text-sm">
          {/* Saved Items */}
          <Link to="/saved" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-500">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Saved Items & Bookmarks</p>
                <p className="text-xs text-gray-400">Stores, deals, and products you pinned</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {savedCount}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </Link>

          {/* Current Locality */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-500">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Current Locality</p>
                <p className="text-xs text-gray-400 truncate max-w-[220px]">{selectedArea || 'Location not set'}</p>
              </div>
            </div>
            <Link to="/map" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View Map <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-500">
                <Languages className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Display Language (भाषा)</p>
                <p className="text-xs text-gray-400">English or हिंदी</p>
              </div>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-gray-50 transition"
            >
              {language === 'en' ? 'Switch to हिंदी' : 'Switch to English'}
            </button>
          </div>

          {/* Community Reporting */}
          <Link to="/intelligence/community" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Ground Truth Community Reporter</p>
                <p className="text-xs text-gray-400">Report traffic, waterlogging, or power cuts</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>

          {/* Emergency SOS Directory */}
          <Link to="/emergency" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-50 text-red-500">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Emergency SOS Services</p>
                <p className="text-xs text-gray-400">Police 112, Ambulance 108, Fire 101, Hospitals</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        </div>

        {/* ─── Sign Out Button ──────────────────────────────────────────────── */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors text-sm shadow-sm"
        >
          <LogOut className="h-4 w-4" />
          Log Out of MyArea24
        </button>
      </div>

      {/* ─── Register Business Modal ────────────────────────────────────────── */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Merchant Registration</h3>
                  <p className="text-xs text-gray-400">List your store free on MyArea24</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {bizSuccess ? (
              <div className="text-center py-8 space-y-2">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
                <h4 className="font-bold text-gray-800 text-lg">Store Registered Successfully!</h4>
                <p className="text-xs text-gray-500">Upgrading your account to Merchant & redirecting to dashboard…</p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!bizForm.name.trim() || !bizForm.address?.trim()) {
                    setBizError('Please provide store name and full address.')
                    return
                  }
                  registerBizMutation.mutate()
                }}
                className="space-y-3.5 text-sm"
              >
                {bizError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{bizError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Store / Business Name *</label>
                  <input
                    required
                    value={bizForm.name}
                    onChange={e => setBizForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Verma Grocery & Dairy"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Business Category *</label>
                  <select
                    value={bizForm.category}
                    onChange={e => setBizForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    {(bizCats ?? []).map(c => (
                      <option key={c.category} value={c.category}>{c.category}</option>
                    ))}
                    {!bizCats && (
                      <>
                        <option value="Grocery & Supermarket">Grocery & Supermarket</option>
                        <option value="Electronics">Electronics</option>
                        <option value="Bakery & Sweets">Bakery & Sweets</option>
                        <option value="Pharmacy & Wellness">Pharmacy & Wellness</option>
                        <option value="Restaurant & Cafe">Restaurant & Cafe</option>
                        <option value="Fashion & Apparel">Fashion & Apparel</option>
                        <option value="Auto Services">Auto Services</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Address & Landmark *</label>
                  <input
                    required
                    value={bizForm.address}
                    onChange={e => setBizForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Shop No., Market / Main Road, Colony"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Locality</label>
                    <input
                      value={bizForm.locality}
                      onChange={e => setBizForm(f => ({ ...f, locality: e.target.value }))}
                      placeholder="e.g. Sector 62"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      value={bizForm.city}
                      onChange={e => setBizForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="e.g. Noida"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Calling Phone *</label>
                    <input
                      required
                      value={bizForm.phone}
                      onChange={e => setBizForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 XXXXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp Orders</label>
                    <input
                      value={bizForm.whatsapp}
                      onChange={e => setBizForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="+91 XXXXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registerBizMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {registerBizMutation.isPending ? 'Registering…' : 'Submit & Open Dashboard'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
