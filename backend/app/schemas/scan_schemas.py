"""Pydantic request/response schemas for the scan API."""
from typing import List, Optional, Dict
from pydantic import BaseModel


class ScanRequest(BaseModel):
    input_type: str  # "play_url" | "apk_url" | "package_name" | "hash"
    value: str       # the URL / package name / hash string
    model_name: Optional[str] = None  # None = Production Mode auto-best-model


class ModuleScore(BaseModel):
    module: str
    score: float
    reasons: List[str]


class ScanResponse(BaseModel):
    scan_id: str
    app_name: Optional[str]
    package_name: Optional[str]
    overall_risk_score: float
    trust_score: float
    prediction: str
    confidence: float
    model_used: str
    module_scores: Dict[str, ModuleScore]
    top_contributors: List[Dict]
    flag_reasons: List[Dict]


class ModelBenchmarkEntry(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    training_time_s: Optional[float]
    inference_time_s: Optional[float]


class BenchmarkResponse(BaseModel):
    results: Dict[str, ModelBenchmarkEntry]
    best_model: str
