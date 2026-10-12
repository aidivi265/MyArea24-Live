// ─── Pagination ─────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  phone?: string
  full_name?: string
  role: 'resident' | 'merchant' | 'admin'
  is_active: boolean
  is_verified: boolean
  businesses?: BusinessSummary[]
}

export interface SendOtpRequest { email: string; purpose: 'login' | 'signup' | 'merchant_onboarding' }
export interface SendOtpResponse { success: boolean; message: string; email: string; expires_in_minutes: number; dev_otp?: string }
export interface VerifyOtpRequest { email: string; otp_code: string; full_name?: string; role?: string; phone?: string }
export interface AuthResponse { access_token: string; token_type: string; user: User }

// ─── Business ────────────────────────────────────────────────────────────────
export interface BusinessSummary {
  id: number
  slug: string
  name: string
  category: string
  locality?: string
  city?: string
  status?: string
}

export interface Business {
  id: number
  slug: string
  name: string
  category: string
  subcategory?: string
  description?: string
  address?: string
  locality?: string
  city?: string
  state?: string
  pincode?: string
  latitude?: number
  longitude?: number
  distance_km?: number
  phone?: string
  whatsapp?: string
  email?: string
  website?: string
  opening_time?: string
  closing_time?: string
  days_open?: string
  is_open_now?: boolean
  rating?: number
  review_count?: number
  view_count?: number
  call_clicks?: number
  direction_clicks?: number
  active_products_count?: number
  active_offers_count?: number
  image_url?: string
  is_verified: boolean
  status: 'active' | 'pending_approval' | 'suspended'
}

export interface BusinessStorefront { business: Business; products: Product[]; offers: Offer[]; services?: ServiceListing[] }

export interface BusinessCreateRequest {
  name: string; category: string; subcategory?: string; description?: string
  address?: string; locality?: string; city?: string; state?: string; pincode?: string
  latitude?: number; longitude?: number
  phone?: string; whatsapp?: string; email?: string; website?: string
  opening_time?: string; closing_time?: string; days_open?: string; image_url?: string
}

// ─── Product ─────────────────────────────────────────────────────────────────
export interface Product {
  id: number
  business_id: number
  name: string
  brand?: string
  model_variant?: string
  category: string
  description?: string
  local_price?: number
  mrp?: number
  online_price?: number
  online_provider?: string
  online_url?: string
  availability_status: 'in_stock' | 'confirm_with_seller' | 'low_stock' | 'out_of_stock'
  stock_quantity?: number
  image_url?: string
  is_featured?: boolean
  savings_amount?: number
  savings_percent?: number
  better_offline?: boolean
  freshness_label?: string
  price_updated_at?: string
  distance_km?: number
  business?: Business
}

export interface ProductDetail extends Product { similar_products?: Product[] }

// ─── Service ─────────────────────────────────────────────────────────────────
export interface ServiceListing {
  id: number
  provider_name: string
  category: string
  description?: string
  service_area?: string
  locality?: string
  city?: string
  latitude?: number
  longitude?: number
  phone?: string
  whatsapp?: string
  price_starting_at?: number
  price_unit?: string
  timing?: string
  experience_years?: number
  is_verified: boolean
  rating?: number
  review_count?: number
  distance_km?: number
}

// ─── Offer ───────────────────────────────────────────────────────────────────
export interface Offer {
  id: number
  business_id: number
  title: string
  description?: string
  discount_text?: string
  coupon_code?: string
  category?: string
  valid_from?: string
  valid_until?: string
  terms_conditions?: string
  is_active: boolean
  banner_image_url?: string
  days_left?: number
  business?: Business
}

// ─── Event ───────────────────────────────────────────────────────────────────
export interface CivicEvent {
  id: number
  title: string
  category: string
  organizer?: string
  venue_name?: string
  address?: string
  locality?: string
  city?: string
  latitude?: number
  longitude?: number
  start_time?: string
  end_time?: string
  timing_text?: string
  description?: string
  expected_attendance?: number
  parking_pressure?: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'NORMAL'
  arterial_traffic_impact?: 'HIGH_BOTTLENECK' | 'MODERATE' | 'LOW'
  exit_weather_advisory?: string
  correlated_commute_route?: string
  distance_km?: number
  registration_url?: string
  is_verified?: boolean
}

// ─── Intelligence ─────────────────────────────────────────────────────────────
export type Severity = 'minor' | 'moderate' | 'high' | 'severe'
export type InsightType =
  | 'weather_traffic_correlation'
  | 'severe_public_alert'
  | 'single_signal_traffic_notice'
  | 'single_signal_weather_notice'
  | 'air_quality_alert'
  | 'event_weather_traffic_correlation'
  | 'community_ground_truth_correlation'

export interface IntelligenceSignal {
  type: string
  source: string
  observation_id?: number
  observed_at?: string
  freshness_minutes?: number
  metric_summary?: string
}

export interface IntelligenceInsight {
  id: number
  insight_type: InsightType
  area: { label: string; latitude: number; longitude: number; radius_km: number }
  headline: string
  summary?: string
  potential_impact?: string
  recommendation?: string
  evidence_quality: 'supported' | 'insufficient_evidence'
  composite_severity: Severity
  confidence_level?: number | string
  rule_identifier?: string
  observed_at?: string
  created_at?: string
  expires_at?: string
  signals?: IntelligenceSignal[]
}

export interface WeatherStatus {
  is_available: boolean
  location_name?: string
  latitude?: number
  longitude?: number
  temperature_c?: number
  precipitation_mm?: number
  condition_text?: string
  wind_kph?: number
  humidity?: number
  observed_at?: string
  source?: string
  message?: string
  waterlogging_risk_index?: number
  transit_delay_estimate_min?: number
  outdoor_activity_advice?: string
  travel_impact?: {
    headline: string
    risk_level: string
    waterlogging_risk_index: number
    transit_delay_estimate_min: number
    advisory: string
  }
  event_impact?: {
    headline: string
    risk_level: string
    advisory: string
    crowd_behavior: string
  }
  activity_consideration?: {
    headline: string
    recommended_window: string
    advisory: string
    sun_protection?: string
  }
}

export interface RouteCorridorAssessment {
  route_name: string
  distance_km: number
  typical_duration_min: number
  estimated_delay_min: number
  total_duration_min: number
  risk_score: number
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE'
  traffic_incidents_count: number
  community_reports_count?: number
  community_hazards?: string[]
  rainfall_mm: number
  waterlogging_risk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  is_recommended: boolean
  recommendation_reason: string
  key_warnings: string[]
}

export interface RouteEvaluationResponse {
  origin: string
  destination: string
  recommended_route: string
  time_saved_vs_worst_min: number
  active_community_reports_count?: number
  evaluated_corridors: RouteCorridorAssessment[]
  ai_commute_advisory: string
}

export interface CategoryDemandSurge {
  category: string
  demand_surge_multiplier: number
  surge_level: 'NORMAL' | 'HIGH' | 'PEAK'
  confidence: string
  primary_drivers: string[]
  merchant_action_items: string[]
  delivery_fleet_advisory?: string
  consumer_insight: string
  peak_crowd_window?: string
}

export interface LocalDemandIntelligence {
  area: string
  latitude: number
  longitude: number
  composite_demand_index: number
  market_state: 'ELEVATED_DEMAND' | 'PEAK_COMMERCE' | 'NORMAL' | 'SLOW'
  current_weather_summary: string
  current_traffic_summary: string
  active_local_events_count: number
  stakeholder_summary?: {
    local_businesses: string
    delivery_services: string
    local_consumers: string
  }
  categories: CategoryDemandSurge[]
  generated_at: string
}

export interface CommunitySignalItem {
  id: number
  signal_type: 'WATERLOGGING' | 'POTHOLE' | 'ROAD_BLOCKAGE' | 'ACCIDENT' | 'LOCAL_MARKET'
  title: string
  description?: string
  locality: string
  city: string
  state: string
  latitude: number
  longitude: number
  upvotes: number
  status: string
  severity: string
  created_at: string
}

export interface AirQualityStatus {
  is_available: boolean
  status?: string
  station_id?: string
  station_name?: string
  city?: string
  latitude?: number
  longitude?: number
  distance_km?: number
  aqi_value?: number
  aqi_category?: string
  prominent_pollutant?: string
  pm25?: number
  pm10?: number
  no2?: number
  so2?: number
  co?: number
  o3?: number
  observed_at?: string
  is_stale?: boolean
  source?: string
  attribution?: string
  message?: string
}

export interface TrafficIncident {
  id?: number
  incident_type: string
  criticality: 'critical' | 'major' | 'moderate' | 'minor' | 'low' | 'unknown'
  road_name?: string
  description?: string
  latitude?: number
  longitude?: number
  delay_seconds?: number
  jam_factor?: number
  observed_at?: string
  distance_km?: number
}

export interface TrafficStatus {
  is_available: boolean
  total_incidents?: number
  area?: string
  incidents?: TrafficIncident[]
  source?: string
  message?: string
  cumulative_delay_minutes?: number
  worst_corridor?: string
  congestion_level?: 'Clear' | 'Moderate' | 'Heavy' | 'Severe' | string
}

export interface GovernmentAlert {
  id: number
  alert_identifier?: string
  sender?: string
  event_type?: string
  severity?: string
  urgency?: string
  headline?: string
  description?: string
  instruction?: string
  area_description?: string
  effective_at?: string
  expires_at?: string
  is_active: boolean
}

export interface AssistantResponse {
  query: string
  area?: string
  is_live_supported: boolean
  response_text?: string
  key_findings?: string[]
  recommendations?: string[]
  grounded_sources?: string[]
  confidence?: string
  timestamp?: string
}

// ─── Market ──────────────────────────────────────────────────────────────────
export interface MandiRate {
  id?: number
  commodity: string
  variety?: string
  category?: string
  mandi?: string
  mandi_name?: string
  district?: string
  city?: string
  state?: string
  modal_price?: number
  min_price?: number
  max_price?: number
  modal_price_display?: string
  price_range_display?: string
  unit?: string
  arrival_volume?: string | number
  price_trend?: string
  trend?: string
  observed_date?: string
}

export interface FuelRateItem {
  city: string
  state: string
  petrol: number
  diesel: number
  cng?: number | null
  trend: string
  observed_date: string
}

export interface FuelRate {
  petrol?: number
  diesel?: number
  cng?: number | null
  city?: string
  state?: string
  vat_info?: string
  trend?: string
  source?: string
  is_live?: boolean
  updated_at?: string
  items?: FuelRateItem[]
}

export interface LocalitySnapshot {
  area: string
  city?: string
  state?: string
  weather?: WeatherStatus | null
  air_quality?: AirQualityStatus | null
  traffic?: TrafficStatus | null
  fuel?: FuelRate | null
  top_alert?: GovernmentAlert | null
  active_community_signals?: number
  cached?: boolean
  timestamp: string
}

export interface CivicBulletin {
  id: number
  title: string
  summary?: string
  source_agency?: string
  category?: string
  locality?: string
  city?: string
  state?: string
  priority: 'high' | 'medium' | 'low'
  published_at?: string
  published_at_display?: string
  official_link?: string
  affected_ward?: string
  disruption_window?: string
  local_impact?: {
    water?: string
    electricity?: string
    route?: string
  }
  helpline?: string
}

// ─── Emergency ────────────────────────────────────────────────────────────────
export interface EmergencyFacility {
  id: number
  name: string
  facility_type?: string
  phone?: string
  secondary_phone?: string
  address?: string
  locality?: string
  city?: string
  state?: string
  latitude?: number
  longitude?: number
  is_24_7?: boolean
  trauma_level?: string
  blood_bank_available?: boolean
  distance_km?: number
}

export interface ExpresswayEmergencyDesk {
  name: string
  route: string
  phone: string
}

export interface EmergencyResponse {
  total: number
  national_emergency_number?: string
  ambulance_number?: string
  fire_number?: string
  disaster_number?: string
  nhai_highway_helpline?: string
  railway_security_helpline?: string
  women_safety_helpline?: string
  ndma_disaster_helpline?: string
  sdma_state_control?: string
  flood_maritime_rescue?: string
  expressway_emergency_desks?: ExpresswayEmergencyDesk[]
  facilities: EmergencyFacility[]
}

// ─── Saved ───────────────────────────────────────────────────────────────────
export interface SavedItems {
  total: number
  businesses: Business[]
  products: Product[]
  services: ServiceListing[]
  offers: Offer[]
  bulletins?: CivicBulletin[]
  events?: CivicEvent[]
}

export type SaveItemType = 'business' | 'product' | 'service' | 'offer' | 'bulletin' | 'event'

// ─── Enquiry ─────────────────────────────────────────────────────────────────
export interface Enquiry {
  id: number
  business_id: number
  product_id?: number
  service_id?: number
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  enquiry_type?: string
  message?: string
  status: 'pending' | 'contacted' | 'resolved' | 'closed'
  created_at?: string
}

export interface MerchantDashboard {
  business: Business
  enquiries: Enquiry[]
}

// ─── Location ─────────────────────────────────────────────────────────────────
export interface LocationResult {
  id?: number | string
  name: string
  district?: string
  city?: string
  village?: string
  tehsil?: string
  state?: string
  pincode?: string
  lat?: number
  lon?: number
  latitude?: number
  longitude?: number
  coverage_status?: string
  accuracy?: string
  display_label?: string
}

export interface ReverseGeocode {
  village?: string
  town?: string
  tehsil?: string
  district?: string
  state?: string
}

export interface LocalityOption {
  id?: string
  label: string
  name?: string
  latitude: number
  longitude: number
  coverage_status?: string
  is_live_supported?: boolean
  live_sources?: string[]
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export interface AdminOverview {
  metrics: {
    total_businesses: number
    verified_businesses?: number
    total_users: number
    total_enquiries: number
    pending_businesses: number
    total_products?: number
    total_offers?: number
    active_offers: number
    total_signals?: number
    pending_signals?: number
  }
  recent_businesses: Business[]
}

