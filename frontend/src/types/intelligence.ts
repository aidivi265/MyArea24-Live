export type SignalType = 'weather' | 'traffic' | 'alert' | 'air_quality';

export interface AirQualityStatus {
  status: 'ACTIVE' | 'STALE' | 'UNAVAILABLE' | 'AWAITING_CONFIG';
  station_id?: string | null;
  station_name?: string | null;
  city?: string | null;
  distance_km?: number | null;
  aqi_value?: number | null;
  aqi_category?: string | null;
  prominent_pollutant?: string | null;
  pm25?: number | null;
  pm10?: number | null;
  no2?: number | null;
  so2?: number | null;
  co?: number | null;
  o3?: number | null;
  observed_at?: string | null;
  is_stale: boolean;
  attribution: string;
  message: string;
}

export interface SignalProvenance {
  type: SignalType;
  source: string;
  observation_id: number | string;
  observed_at: string;
  freshness_minutes?: number | null;
  metric_summary: string;
}

export interface AreaInfo {
  label: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_km: number;
}

export type SeverityLevel = 'minor' | 'moderate' | 'high' | 'severe';

export interface IntelligenceInsight {
  id: number;
  insight_type: 'weather_traffic_correlation' | 'severe_public_alert' | 'single_signal_traffic_notice' | 'single_signal_weather_notice' | string;
  area: AreaInfo;
  headline: string;
  summary: string;
  potential_impact: string;
  recommendation: string;
  evidence_quality: string;
  composite_severity: SeverityLevel;
  confidence_level: string;
  rule_identifier: string;
  rule_version: string;
  data_quality_notes?: string | null;
  observed_at?: string | null;
  created_at: string;
  expires_at: string;
  next_review_at?: string | null;
  signals: SignalProvenance[];
}

export interface PaginatedInsightsResponse {
  items: IntelligenceInsight[];
  total: number;
  page: number;
  page_size: number;
}

export interface LocalityOption {
  id: string;
  name: string;
  city?: string;
  state: string;
  latitude: number;
  longitude: number;
  coverage_status: string;
  is_live_supported?: boolean;
  live_sources?: string[];
}

export interface InsightFilters {
  area?: string;
  insight_type?: string;
  severity?: string;
  confidence?: string;
  is_active?: boolean;
}

export interface WeatherStatus {
  is_available: boolean;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  temperature_c?: number | null;
  precipitation_mm?: number | null;
  condition_text?: string | null;
  wind_kph?: number | null;
  humidity?: number | null;
  observed_at?: string | null;
  source: string;
  message: string;
}

export interface TrafficIncident {
  id: number;
  incident_type: string;
  criticality?: string | null;
  road_name?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  delay_seconds?: number | null;
  jam_factor?: number | null;
  observed_at: string;
  expected_end_at?: string | null;
}

export interface TrafficStatus {
  is_available: boolean;
  total_incidents: number;
  area?: string | null;
  incidents: TrafficIncident[];
  source: string;
  message: string;
}

export interface AssistantResponse {
  query: string;
  area: string;
  is_live_supported: boolean;
  response_text: string;
  key_findings: string[];
  recommendations: string[];
  grounded_sources: string[];
  confidence: string;
  timestamp: string;
}

export interface GovernmentAlert {
  id: number;
  alert_identifier: string;
  sender: string;
  event_type: string;
  severity: string;
  urgency: string;
  headline: string;
  description?: string | null;
  instruction?: string | null;
  area_description: string;
  effective_at: string;
  expires_at: string;
  is_active: boolean;
}

