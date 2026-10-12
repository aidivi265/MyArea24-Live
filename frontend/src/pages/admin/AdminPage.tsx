import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  Building2,
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Radio,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Package,
  Trash2,
} from 'lucide-react'
import { adminApi, productApi } from '@/services/apiService'
import { useAuthStore } from '@/store'
import { PageSkeleton, CardSkeleton } from '@/components/shared/Skeleton'
import { SEOMeta } from '@/components/shared/SEOMeta'
import { cn, formatRelativeTime, formatCurrency } from '@/utils'
import type { Business, CommunitySignalItem, Product } from '@/types'

export default function AdminPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [activeTab, setActiveTab] = useState<'businesses' | 'signals' | 'users' | 'products'>('businesses')
  const [searchQuery, setSearchQuery] = useState('')
  const [bizStatusFilter, setBizStatusFilter] = useState('')
  const [signalStatusFilter, setSignalStatusFilter] = useState('')

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-16">
        <ShieldCheck className="h-12 w-12 text-gray-200 mx-auto mb-4" />
        <p className="font-semibold text-gray-600">Admin access required.</p>
        <p className="text-xs text-gray-400 mt-1">Please log in with an administrator account to view the moderation console.</p>
      </div>
    )
  }

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: adminApi.overview,
    staleTime: 60 * 1000,
  })

  // Businesses list query
  const { data: bizList, isLoading: bizLoading } = useQuery({
    queryKey: ['admin-biz', bizStatusFilter, searchQuery],
    queryFn: () =>
      adminApi.businesses({
        status: bizStatusFilter || undefined,
        q: searchQuery || undefined,
        page_size: 20,
      }),
    enabled: activeTab === 'businesses',
    staleTime: 30 * 1000,
  })

  // Community signals list query
  const { data: signalList, isLoading: signalLoading } = useQuery({
    queryKey: ['admin-signals', signalStatusFilter, searchQuery],
    queryFn: () =>
      adminApi.communitySignals({
        status: signalStatusFilter || undefined,
        q: searchQuery || undefined,
        page_size: 25,
      }),
    enabled: activeTab === 'signals',
    staleTime: 30 * 1000,
  })

  // Users list query
  const { data: userList, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', searchQuery],
    queryFn: () =>
      adminApi.users({
        q: searchQuery || undefined,
        page_size: 25,
      }),
    enabled: activeTab === 'users',
    staleTime: 30 * 1000,
  })

  // Catalog products query
  const { data: productList, isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products', searchQuery],
    queryFn: () =>
      productApi.list({
        q: searchQuery || undefined,
        page_size: 30,
      }),
    enabled: activeTab === 'products',
    staleTime: 30 * 1000,
  })

  const deleteProductMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-overview'] })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: number) => adminApi.verifyBusiness(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-biz'] })
      qc.invalidateQueries({ queryKey: ['admin-overview'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => adminApi.setBusinessStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-biz'] })
      qc.invalidateQueries({ queryKey: ['admin-overview'] })
    },
  })

  const signalStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => adminApi.setSignalStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-signals'] })
      qc.invalidateQueries({ queryKey: ['admin-overview'] })
    },
  })

  const userRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => adminApi.setUserRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-overview'] })
    },
  })

  if (overviewLoading) return <PageSkeleton />

  const m = overview?.metrics

  return (
    <>
      <SEOMeta title="Administrative Governance & Moderation" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand-500" />
            Administrative Moderation Console
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pan-India business verification, municipal hazard ticket escalation, and user management.
          </p>
        </div>

        {/* Metrics Row */}
        {m && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { icon: <Building2 className="h-4 w-4 text-brand-600" />, label: 'Businesses', value: m.total_businesses, color: 'bg-brand-50' },
              { icon: <Users className="h-4 w-4 text-blue-600" />, label: 'Users', value: m.total_users, color: 'bg-blue-50' },
              { icon: <AlertTriangle className="h-4 w-4 text-amber-600" />, label: 'Pending Approval', value: m.pending_businesses, color: 'bg-amber-50' },
              { icon: <Radio className="h-4 w-4 text-purple-600" />, label: 'Active Hazards', value: m.pending_signals ?? 0, color: 'bg-purple-50' },
              { icon: <CheckCircle className="h-4 w-4 text-emerald-600" />, label: 'Active Deals', value: m.active_offers, color: 'bg-emerald-50' },
              { icon: <RefreshCw className="h-4 w-4 text-indigo-600" />, label: 'Total Enquiries', value: m.total_enquiries, color: 'bg-indigo-50' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className={`rounded-2xl p-4 ${color} border border-black/5`}>
                <div className="flex items-center gap-1.5">{icon}</div>
                <p className="text-2xl font-black text-gray-900 mt-2">{value?.toLocaleString() ?? 0}</p>
                <p className="text-xs font-semibold text-gray-600">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Console Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6">
          <button
            onClick={() => { setActiveTab('businesses'); setSearchQuery('') }}
            className={cn(
              'pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
              activeTab === 'businesses'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Building2 className="h-4 w-4" />
            Merchant Businesses ({(bizList?.total ?? m?.total_businesses) || 0})
          </button>

          <button
            onClick={() => { setActiveTab('signals'); setSearchQuery('') }}
            className={cn(
              'pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
              activeTab === 'signals'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Radio className="h-4 w-4" />
            Hazard Triage Mesh ({m?.pending_signals ?? 0} Pending)
          </button>

          <button
            onClick={() => { setActiveTab('users'); setSearchQuery('') }}
            className={cn(
              'pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
              activeTab === 'users'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Users className="h-4 w-4" />
            User Roles & Access
          </button>

          <button
            onClick={() => { setActiveTab('products'); setSearchQuery('') }}
            className={cn(
              'pb-3 text-sm font-bold border-b-2 transition flex items-center gap-2',
              activeTab === 'products'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Package className="h-4 w-4" />
            Catalog Products ({productList?.total ?? m?.total_products ?? 0})
          </button>
        </div>

        {/* Global Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={`Search ${activeTab}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {activeTab === 'businesses' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={bizStatusFilter}
                onChange={(e) => setBizStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}

          {activeTab === 'signals' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={signalStatusFilter}
                onChange={(e) => setSignalStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
              >
                <option value="">All Signal Statuses</option>
                <option value="REPORTED">Reported (Pending)</option>
                <option value="COMMUNITY_VERIFIED">Citizen Verified</option>
                <option value="ESCALATED_TO_MUNICIPALITY">Escalated to Municipality</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: BUSINESSES */}
        {activeTab === 'businesses' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {bizLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Business / Owner</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Category</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">City / Area</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bizList?.items ?? []).map((biz: Business) => (
                      <tr key={biz.id} className="border-b border-gray-100 hover:bg-gray-50/70 transition">
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">{biz.name}</p>
                          {biz.is_verified ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                              ✓ Verified Store
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Unverified</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{biz.category}</td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{biz.locality}, {biz.city}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                              biz.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : biz.status === 'pending_approval'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-600'
                            )}
                          >
                            {biz.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => verifyMutation.mutate(biz.id)}
                              title={biz.is_verified ? 'Revoke verification badge' : 'Grant verification badge'}
                              className={cn(
                                'text-xs px-2.5 py-1 rounded-lg transition font-medium',
                                biz.is_verified
                                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              )}
                            >
                              {biz.is_verified ? 'Unverify' : 'Verify'}
                            </button>

                            {biz.status === 'pending_approval' ? (
                              <button
                                onClick={() => statusMutation.mutate({ id: biz.id, status: 'active' })}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                              >
                                Approve
                              </button>
                            ) : biz.status !== 'suspended' ? (
                              <button
                                onClick={() => statusMutation.mutate({ id: biz.id, status: 'suspended' })}
                                className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => statusMutation.mutate({ id: biz.id, status: 'active' })}
                                className="text-xs px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 font-bold"
                              >
                                Re-activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(bizList?.items ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                          No businesses found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HAZARD TRIAGE DESK */}
        {activeTab === 'signals' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {signalLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Hazard / Signal</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">Location</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Municipal Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(signalList?.items ?? []).map((sig: CommunitySignalItem) => (
                      <tr key={sig.id} className="border-b border-gray-100 hover:bg-gray-50/70 transition">
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-900">{sig.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                              👍 {sig.upvotes} Upvotes
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatRelativeTime(sig.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                          <span className="text-xs font-mono font-semibold">{sig.signal_type}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{sig.locality}, {sig.city}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                              sig.status === 'RESOLVED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : sig.status === 'ESCALATED_TO_MUNICIPALITY'
                                ? 'bg-purple-50 text-purple-700'
                                : sig.status === 'COMMUNITY_VERIFIED'
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-amber-50 text-amber-700'
                            )}
                          >
                            {sig.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {sig.status !== 'ESCALATED_TO_MUNICIPALITY' && sig.status !== 'RESOLVED' && (
                              <button
                                onClick={() => signalStatusMutation.mutate({ id: sig.id, status: 'ESCALATED_TO_MUNICIPALITY' })}
                                className="text-xs px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold"
                              >
                                Escalate to Ward
                              </button>
                            )}

                            {sig.status !== 'RESOLVED' ? (
                              <button
                                onClick={() => signalStatusMutation.mutate({ id: sig.id, status: 'RESOLVED' })}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                              >
                                Mark Resolved
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Closed
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(signalList?.items ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                          No hazard signals found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: USERS & ROLES */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {usersLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">User Email</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Full Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Current Role</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Assign Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(userList?.items as Array<{ id: number; email: string; full_name?: string; role: string }>)?.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50/70 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">{u.email}</td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{u.full_name || '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded-full uppercase',
                              u.role === 'admin'
                                ? 'bg-purple-50 text-purple-700'
                                : u.role === 'merchant'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <select
                            value={u.role}
                            onChange={(e) => userRoleMutation.mutate({ id: u.id, role: e.target.value })}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                          >
                            <option value="resident">Resident</option>
                            <option value="merchant">Merchant</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PRODUCTS MODERATION */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {productsLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <CardSkeleton key={i} />)}</div>
            ) : !productList?.items || productList.items.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Package className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-700">No products found</p>
                <p className="text-xs text-gray-400">Try adjusting your search keywords</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Product</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Category</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Price</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Moderation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productList.items.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/70 transition">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{p.name}</div>
                          {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {p.category || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-800">
                          {formatCurrency(p.local_price ?? 0)}
                          {p.mrp && p.local_price !== undefined && p.mrp > p.local_price && (
                            <span className="ml-1 text-xs text-gray-400 line-through">
                              {formatCurrency(p.mrp)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs font-semibold px-2 py-0.5 rounded-full',
                              p.availability_status === 'in_stock'
                                ? 'bg-emerald-50 text-emerald-700'
                                : p.availability_status === 'low_stock'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-600'
                            )}
                          >
                            {p.availability_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete and unlist "${p.name}"?`)) {
                                deleteProductMutation.mutate(p.id)
                              }
                            }}
                            disabled={deleteProductMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
