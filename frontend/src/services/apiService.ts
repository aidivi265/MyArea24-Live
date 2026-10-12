import api from './api'
import type {
  SendOtpRequest, SendOtpResponse, VerifyOtpRequest, AuthResponse, User,
  PaginatedResponse, Business, BusinessStorefront, BusinessCreateRequest,
  Product, ProductDetail, ServiceListing, Offer, CivicEvent,
  IntelligenceInsight, WeatherStatus, AirQualityStatus, TrafficStatus,
  GovernmentAlert, AssistantResponse, MandiRate, FuelRate, CivicBulletin,
  EmergencyResponse, SavedItems, SaveItemType, Enquiry, MerchantDashboard,
  LocationResult, ReverseGeocode, LocalityOption, AdminOverview,
  RouteEvaluationResponse, LocalDemandIntelligence, CommunitySignalItem,
  LocalitySnapshot,
} from '@/types'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  sendOtp: (data: SendOtpRequest) => api.post<SendOtpResponse>('/auth/send-otp', data).then(r => r.data),
  verifyOtp: (data: VerifyOtpRequest) => api.post<AuthResponse>('/auth/verify-otp', data).then(r => r.data),
  me: () => api.get<User>('/auth/me').then(r => r.data),
  updateProfile: (data: Partial<User>) => api.put<User>('/auth/profile', data).then(r => r.data),
}

// ─── Businesses ───────────────────────────────────────────────────────────────
export const businessApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Business>>('/businesses', { params }).then(r => r.data),
  categories: () => api.get<{ category: string; count: number }[]>('/businesses/categories').then(r => r.data),
  get: (idOrSlug: string, params?: Record<string, unknown>) => api.get<BusinessStorefront>(`/businesses/${idOrSlug}`, { params }).then(r => r.data),
  create: (data: BusinessCreateRequest) => api.post('/businesses', data).then(r => r.data),
  update: (id: number, data: Partial<BusinessCreateRequest>) => api.put(`/businesses/${id}`, data).then(r => r.data),
}

// ─── Products ─────────────────────────────────────────────────────────────────
export const productApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Product>>('/products', { params }).then(r => r.data),
  categories: () => api.get<{ category: string; count: number }[]>('/products/categories').then(r => r.data),
  get: (id: number, params?: Record<string, unknown>) => api.get<ProductDetail>(`/products/${id}`, { params }).then(r => r.data),
  compare: (id: number, params?: Record<string, unknown>) => api.get<{
    product_name: string
    brand?: string
    category: string
    summary: {
      total_local_stores: number
      lowest_local_price?: number
      highest_local_price?: number
      lowest_online_price?: number
      price_range_display?: string
      better_offline: boolean
      recommendation: string
    }
    local_store_offers: {
      product_id: number
      business_id: number
      business_name: string
      business_slug: string
      locality?: string
      city?: string
      phone?: string
      whatsapp?: string
      local_price: number
      mrp?: number
      availability_status: string
      distance_km?: number
      is_verified: boolean
    }[]
    online_options: {
      provider: string
      price: number
      url?: string
      delivery_estimate: string
    }[]
  }>(`/products/${id}/compare`, { params }).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/products', data).then(r => r.data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/products/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/products/${id}`).then(r => r.data),
}

// ─── Services ─────────────────────────────────────────────────────────────────
export const serviceApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<ServiceListing>>('/services', { params }).then(r => r.data),
  categories: () => api.get<{ category: string; count: number }[]>('/services/categories').then(r => r.data),
  get: (id: number, params?: Record<string, unknown>) => api.get<ServiceListing>(`/services/${id}`, { params }).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/services', data).then(r => r.data),
}

// ─── Offers ───────────────────────────────────────────────────────────────────
export const offerApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Offer>>('/offers', { params }).then(r => r.data),
  get: (id: number) => api.get<Offer>(`/offers/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/offers', data).then(r => r.data),
  delete: (id: number) => api.delete(`/offers/${id}`).then(r => r.data),
}

// ─── Events ───────────────────────────────────────────────────────────────────
export const eventApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<CivicEvent>>('/events', { params }).then(r => r.data),
  get: (id: number) => api.get<CivicEvent>(`/events/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/events', data).then(r => r.data),
  sync: (city?: string, extra?: { locality?: string; lat?: number; lon?: number }) =>
    api.post<{ success: boolean; message: string; total_for_city: number }>('/events/sync', null, {
      params: { ...(city ? { city } : {}), ...extra },
    }).then(r => r.data),
  contextual: (id: number) => api.get<{
    event_id: number
    title: string
    venue_name: string
    expected_attendance: number
    parking_pressure: string
    arterial_traffic_impact: string
    total_approach_delay_minutes: number
    nearby_traffic_bottlenecks: { road_name: string; incident_type: string; delay_minutes: number; distance_km: number }[]
    exit_weather_summary: string
    exit_weather_advisory: string
    parking_guidance: string
    correlated_commute_corridor: string
    nearby_food_options?: {
      id: number
      name: string
      slug: string
      category: string
      address: string
      locality?: string
      phone?: string
      rating: number
      distance_km: number
    }[]
  }>(`/events/${id}/contextual-intelligence`).then(r => r.data),
}

// ─── Intelligence ─────────────────────────────────────────────────────────────
export const intelligenceApi = {
  list: (params?: Record<string, unknown>) => api.get<PaginatedResponse<IntelligenceInsight>>('/intelligence', { params }).then(r => r.data),
  get: (id: number) => api.get<IntelligenceInsight>(`/intelligence/${id}`).then(r => r.data),
  localities: (params?: { state?: string; search?: string }) => api.get<LocalityOption[]>('/intelligence/localities', { params }).then(r => r.data),
  alerts: (params?: { area?: string; state?: string; lat?: number; lon?: number; scope?: 'local' | 'all'; is_active?: boolean; limit?: number }) => api.get<GovernmentAlert[]>('/intelligence/alerts', { params }).then(r => r.data),
  weather: (params?: Record<string, unknown>) => api.get<WeatherStatus>('/intelligence/weather', { params }).then(r => r.data),
  airQuality: (params?: Record<string, unknown>) => api.get<AirQualityStatus>('/intelligence/air-quality', { params }).then(r => r.data),
  traffic: (params?: Record<string, unknown>) => api.get<TrafficStatus>('/intelligence/traffic', { params }).then(r => r.data),
  assistant: (query: string, area?: string, lat?: number | null, lon?: number | null) =>
    api.get<AssistantResponse>('/intelligence/assistant', { params: { query, area, lat: lat ?? undefined, lon: lon ?? undefined } }).then(r => r.data),
  routesEvaluate: (data: {
    origin_name: string; origin_latitude: number; origin_longitude: number;
    destination_name: string; destination_latitude: number; destination_longitude: number;
  }) => api.post<RouteEvaluationResponse>('/intelligence/routes/evaluate', data).then(r => r.data),
  demand: (params?: { area?: string; lat?: number; lon?: number }) => api.get<LocalDemandIntelligence>('/intelligence/demand', { params }).then(r => r.data),
  communitySignals: (params?: { area?: string; lat?: number; lon?: number; limit?: number }) => api.get<CommunitySignalItem[]>('/intelligence/community/signals', { params }).then(r => r.data),
  reportCommunitySignal: (data: {
    signal_type: string; title: string; description?: string;
    locality: string; city: string; state?: string;
    latitude: number; longitude: number; severity?: string;
  }) => api.post<CommunitySignalItem>('/intelligence/community/signals', data).then(r => r.data),
  upvoteCommunitySignal: (id: number) => api.post<{ success: boolean; signal_id: number; upvotes: number; status: string }>(`/intelligence/community/signals/${id}/upvote`).then(r => r.data),
  resolveCommunitySignal: (id: number, notes?: string) => api.post<{ success: boolean; signal_id: number; status: string }>(`/intelligence/community/signals/${id}/resolve`, null, { params: notes ? { notes } : undefined }).then(r => r.data),
  snapshot: (params?: { area?: string; city?: string; state?: string; lat?: number; lon?: number }) =>
    api.get<LocalitySnapshot>('/intelligence/snapshot', { params }).then(r => r.data),
}

// ─── Market ───────────────────────────────────────────────────────────────────
export const marketApi = {
  rates: (params?: Record<string, unknown>) => api.get<{
    total: number
    items: MandiRate[]
    matched_mandi?: string
    matched_state?: string
    matched_district?: string
    attribution: string
  }>('/market-rates', { params }).then(r => r.data),
  bulletins: (params?: Record<string, unknown>) => api.get<{ total: number; items: CivicBulletin[] }>('/bulletins', { params }).then(r => r.data),
  fuel: (params?: { city?: string; state?: string; lat?: number; lon?: number } | string) => {
    const qParams = typeof params === 'string' ? { city: params } : params
    return api.get<FuelRate>('/fuel-rates', { params: qParams }).then(r => r.data)
  },
}

// ─── Emergency ────────────────────────────────────────────────────────────────
export const emergencyApi = {
  facilities: (params?: Record<string, unknown>) => api.get<EmergencyResponse>('/emergency/facilities', { params }).then(r => r.data),
}

// ─── Saved ────────────────────────────────────────────────────────────────────
export const savedApi = {
  list: () => api.get<SavedItems>('/saved').then(r => r.data),
  toggle: (item_type: SaveItemType, item_id: number) => api.post<{ saved: boolean; message: string }>('/saved', { item_type, item_id }).then(r => r.data),
  remove: (type: SaveItemType, id: number) => api.delete(`/saved/${type}/${id}`).then(r => r.data),
  clearAll: () => api.delete('/saved/all').then(r => r.data),
  sync: (items: { item_type: SaveItemType; item_id: number }[]) => api.post('/saved/sync', { items }).then(r => r.data),
}

// ─── Enquiries ────────────────────────────────────────────────────────────────
export const enquiryApi = {
  submit: (data: Record<string, unknown>) => api.post('/enquiries', data).then(r => r.data),
  trackClick: (data: { business_id: number; product_id?: number; event_type: string }) => api.post('/enquiries/track-click', data).then(r => r.data),
  updateStatus: (id: number, status: Enquiry['status']) => api.put(`/enquiries/${id}/status`, { status }).then(r => r.data),
  merchantDashboard: (businessId: number) => api.get<MerchantDashboard>(`/enquiries/merchant/${businessId}`).then(r => r.data),
}

// ─── Location ─────────────────────────────────────────────────────────────────
export const locationApi = {
  search: (q: string) => api.get<LocationResult[]>('/location/search', { params: { q } }).then(r => r.data),
  reverseGeocode: (lat: number, lon: number) => api.get<ReverseGeocode>('/location/reverse-geocode', { params: { lat, lon } }).then(r => r.data),
  states: () => api.get<{ code: string; name: string; type: string }[]>('/location/states').then(r => r.data),
  districts: (state: string) => api.get<LocationResult[]>('/location/districts', { params: { state } }).then(r => r.data),
  detect: (lat: number, lon: number) => api.get<{
    latitude: number; longitude: number
    display_label: string; short_label: string
    village?: string; town?: string; tehsil?: string; district?: string; state?: string; pincode?: string
    accuracy: string
  }>('/location/detect', { params: { lat, lon } }).then(r => r.data),
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  overview: () => api.get<AdminOverview>('/admin/overview').then(r => r.data),
  businesses: (params?: Record<string, unknown>) => api.get<PaginatedResponse<Business>>('/admin/businesses', { params }).then(r => r.data),
  users: (params?: Record<string, unknown>) => api.get<PaginatedResponse<unknown>>('/admin/users', { params }).then(r => r.data),
  verifyBusiness: (id: number) => api.post(`/admin/businesses/${id}/verify`).then(r => r.data),
  setBusinessStatus: (id: number, status: string) => api.put(`/admin/businesses/${id}/status`, { status }).then(r => r.data),
  setUserRole: (id: number, role: string) => api.put(`/admin/users/${id}/role`, { role }).then(r => r.data),
  deleteProduct: (id: number) => api.delete(`/admin/products/${id}`).then(r => r.data),
  communitySignals: (params?: Record<string, unknown>) => api.get<PaginatedResponse<CommunitySignalItem>>('/admin/community-signals', { params }).then(r => r.data),
  setSignalStatus: (id: number, status: string) => api.put(`/admin/community-signals/${id}/status`, { status }).then(r => r.data),
}

// ─── System & Telemetry Mesh ──────────────────────────────────────────────────
export const systemApi = {
  meshStatus: () => api.get<{
    status: string
    mesh_network_state: string
    active_districts_indexed: number
    spatial_indexing_engine: string
    providers: Record<string, string>
    server_time_utc: string
  }>('/system/mesh-status').then(r => r.data),
}
