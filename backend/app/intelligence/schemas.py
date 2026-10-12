import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SignalProvenance(BaseModel):
    type: str  # 'weather', 'traffic', 'alert', 'air_quality', 'event', 'community'
    source: str  # 'weatherapi', 'tomtom_traffic', 'here_traffic', 'sachet_cap', 'community_signal_mesh'
    observation_id: int | str
    observed_at: datetime.datetime
    freshness_minutes: Optional[float] = None
    metric_summary: str


class AreaInfo(BaseModel):
    label: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: float = 5.0


class IntelligenceInsightOutput(BaseModel):
    id: Optional[int] = None
    insight_type: str = "weather_traffic_correlation"
    area: AreaInfo
    headline: str
    summary: str
    potential_impact: str
    recommendation: str
    evidence_quality: str = "supported"  # 'supported', 'insufficient_evidence'
    composite_severity: str = "high"  # 'minor', 'moderate', 'high', 'severe'
    confidence_level: str = "HIGH (Multi-Source Corroborated)"
    rule_identifier: str = "SCENARIO_A_WEATHER_TRAFFIC"
    rule_version: str = "1.0"
    data_quality_notes: Optional[str] = None
    observed_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    expires_at: datetime.datetime
    next_review_at: Optional[datetime.datetime] = None
    signals: List[SignalProvenance] = []


class RuleEvaluationResult(BaseModel):
    matched: bool
    reason: str
    insight: Optional[IntelligenceInsightOutput] = None
    supporting_weather_id: Optional[int] = None
    supporting_traffic_id: Optional[int] = None
    supporting_notice_id: Optional[int] = None
    supporting_aqi_id: Optional[int] = None
    supporting_event_id: Optional[int] = None
    supporting_community_signal_id: Optional[int] = None


