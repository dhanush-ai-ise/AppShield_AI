"""
Loads trained models from disk and serves predictions.
Used by both Production Mode (auto best model) and Research Mode (user-selected).
"""
import json
from typing import Dict, List, Optional

import joblib
import numpy as np

from app.config import settings
from app.fusion.fusion_engine import FEATURE_ORDER

MODEL_ROOT = settings.MODEL_ROOT
LABEL_NAMES = {0: "Safe", 1: "Suspicious", 2: "Fraudulent"}

_MODEL_CACHE: Dict[str, object] = {}
_SHAP_EXPLAINER_CACHE: Dict[str, object] = {}


def available_models() -> List[str]:
    return [p.stem for p in MODEL_ROOT.glob("*.joblib")]


def load_model(name: str):
    if name not in _MODEL_CACHE:
        path = MODEL_ROOT / f"{name}.joblib"
        if not path.exists():
            raise FileNotFoundError(
                f"Model '{name}' not found. Run `python -m app.ml.train_models` first."
            )
        _MODEL_CACHE[name] = joblib.load(path)
    return _MODEL_CACHE[name]


def get_shap_explainer(name: str):
    if name not in _SHAP_EXPLAINER_CACHE:
        import shap
        model = load_model(name)
        _SHAP_EXPLAINER_CACHE[name] = shap.TreeExplainer(model)
    return _SHAP_EXPLAINER_CACHE[name]


def get_best_model_name() -> Optional[str]:
    best_path = MODEL_ROOT / "best_model.txt"
    if best_path.exists():
        return best_path.read_text().strip()
    return None


def get_benchmark_results() -> Optional[dict]:
    path = MODEL_ROOT / "benchmark_results.json"
    if path.exists():
        return json.loads(path.read_text())
    return None


def predict(feature_dict: Dict[str, float], model_name: Optional[str] = None) -> Dict:
    """
    model_name=None -> Production Mode: auto-load best benchmarked model.
    """
    if model_name is None:
        model_name = get_best_model_name()
        if model_name is None:
            raise RuntimeError("No trained models available. Run training first.")

    model = load_model(model_name)
    vector = np.array([[feature_dict[k] for k in FEATURE_ORDER]])

    proba = model.predict_proba(vector)[0]
    pred_class = int(np.argmax(proba))

    overall_risk_score = round(float(proba[1] * 50 + proba[2] * 100), 1)  # 0-100 scale
    # Suspicious contributes half-weight toward risk, Fraudulent full weight

    return {
        "model_used": model_name,
        "prediction": LABEL_NAMES[pred_class],
        "confidence": round(float(proba[pred_class]) * 100, 1),
        "class_probabilities": {
            LABEL_NAMES[i]: round(float(p) * 100, 1) for i, p in enumerate(proba)
        },
        "overall_risk_score": overall_risk_score,
        "trust_score": round(100 - overall_risk_score, 1),
    }
