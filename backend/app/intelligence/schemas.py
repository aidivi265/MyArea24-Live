import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SignalProvenance(BaseModel):
    type: str  # 'weather', 'traffic', 'alert'
    source: str  # 'weatherapi', 'here_traffic', 'sachet_cap'
    observation_id: int | str
    observed_at: datetime.datetime
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
    evidence_quality: str  # 'supported', 'insufficient_evidence'
    composite_severity: str  # 'minor', 'moderate', 'high', 'severe'
    signals: List[SignalProvenance]
    created_at: datetime.datetime
    expires_at: datetime.datetime
    rule_version: str = "1.0"


class RuleEvaluationResult(BaseModel):
    matched: bool
    reason: str
    insight: Optional[IntelligenceInsightOutput] = None
    supporting_weather_id: Optional[int] = None
    supporting_traffic_id: Optional[int] = None
