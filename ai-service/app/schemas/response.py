from pydantic import BaseModel, Field
from typing import List, Literal


class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class PersonDetection(BoundingBox):
    confidence: float


class HazardDetection(BoundingBox):
    label: str
    confidence: float


class PeopleResult(BaseModel):
    count: int
    detections: List[PersonDetection]


class FireSmokeResult(BaseModel):
    fireDetected: bool
    fireConfidence: float
    smokeDetected: bool
    smokeConfidence: float
    detections: List[HazardDetection]


class DensityResult(BaseModel):
    value: float
    percent: float
    level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]


class RiskResult(BaseModel):
    score: int = Field(ge=0, le=100)
    level: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]


class AnalysisResponse(BaseModel):
    timestamp: str
    cameraId: str
    people: PeopleResult
    fireSmoke: FireSmokeResult
    density: DensityResult
    risk: RiskResult
