"""
Explainable AI Layer
Produces the "Why is this app flagged?" breakdown + top risk contributors,
using SHAP values when a tree-based model is available, falling back to
normalized feature-weight contribution so the endpoint never hard-fails.
"""
from typing import Dict, List
import numpy as np

from app.fusion.fusion_engine import FEATURE_ORDER

FEATURE_LABELS = {
    "permission_risk": "Dangerous Permissions",
    "review_risk": "Fake / Spam Reviews",
    "apk_static_risk": "APK Static Analysis",
    "developer_risk": "Developer Reputation",
    "certificate_risk": "Certificate Trust",
    "icon_similarity_risk": "Icon Similarity",
    "metadata_risk": "Metadata Anomalies",
}


def explain_with_shap(model_name: str, feature_dict: Dict[str, float]) -> List[Dict]:
    try:
        from app.ml.model_registry import get_shap_explainer
        vector = np.array([[feature_dict[k] for k in FEATURE_ORDER]])
        explainer = get_shap_explainer(model_name)
        shap_values = explainer.shap_values(vector)
        # multiclass returns a list per class; use the "Fraudulent" class (idx 2) if present
        vals = shap_values[2][0] if isinstance(shap_values, list) and len(shap_values) > 2 else shap_values[0]
        return _to_contributions(vals)
    except Exception:
        return explain_fallback(feature_dict)


def explain_fallback(feature_dict: Dict[str, float]) -> List[Dict]:
    """Normalized raw-score contribution — used when SHAP/model introspection fails."""
    vals = [feature_dict[k] for k in FEATURE_ORDER]
    return _to_contributions(vals)


def _to_contributions(vals) -> List[Dict]:
    vals = np.abs(np.array(vals, dtype=float))
    total = vals.sum() or 1.0
    contributions = [
        {
            "feature": FEATURE_ORDER[i],
            "label": FEATURE_LABELS[FEATURE_ORDER[i]],
            "impact_percent": round(float(v) / total * 100, 1),
        }
        for i, v in enumerate(vals)
    ]
    return sorted(contributions, key=lambda c: c["impact_percent"], reverse=True)


def build_flag_reasons(module_outputs: Dict[str, Dict], top_n: int = 5) -> List[Dict]:
    """Turns each module's own `reasons` list into the 'Why is this app flagged?' feed."""
    flagged = []
    for mod_name, output in module_outputs.items():
        score = output.get("score", 0)
        if score >= 0.4:
            level = "High Risk" if score >= 0.7 else "Moderate Risk"
            for reason in output.get("reasons", []):
                flagged.append({"module": mod_name, "reason": reason, "level": level, "score": score})
    flagged.sort(key=lambda f: f["score"], reverse=True)
    return flagged[:top_n]
