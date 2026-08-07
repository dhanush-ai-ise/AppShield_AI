"""
Feature Fusion Layer
Takes the 7 module outputs (permission, review, apk_static, developer,
certificate, icon, metadata) and produces the final feature vector fed to
the ML classification layer.

Screenshot analysis feeds icon/UI-clone signal separately and is folded
into icon_similarity_risk for the fusion vector to keep the classifier's
feature set stable across module additions (extend FEATURE_ORDER when a
new independent module is added).
"""
from typing import Dict, List

FEATURE_ORDER = [
    "permission_risk",
    "review_risk",
    "apk_static_risk",
    "developer_risk",
    "certificate_risk",
    "icon_similarity_risk",
    "metadata_risk",
]


def build_feature_vector(module_outputs: Dict[str, Dict]) -> Dict[str, float]:
    """
    module_outputs: {
        "permission_analysis": {...score...},
        "review_analysis": {...},
        "apk_static_analysis": {...},
        "developer_reputation": {...},
        "certificate_analysis": {...},
        "icon_similarity": {...},
        "screenshot_analysis": {...},   # optional, blended into icon risk
        "metadata_analysis": {...},
    }
    """
    icon_risk = module_outputs.get("icon_similarity", {}).get("score", 0.0)
    screenshot_risk = module_outputs.get("screenshot_analysis", {}).get("score", None)
    if screenshot_risk is not None:
        icon_risk = round((icon_risk * 0.7) + (screenshot_risk * 0.3), 4)

    return {
        "permission_risk": module_outputs.get("permission_analysis", {}).get("score", 0.0),
        "review_risk": module_outputs.get("review_analysis", {}).get("score", 0.0),
        "apk_static_risk": module_outputs.get("apk_static_analysis", {}).get("score", 0.0),
        "developer_risk": module_outputs.get("developer_reputation", {}).get("score", 0.0),
        "certificate_risk": module_outputs.get("certificate_analysis", {}).get("score", 0.0),
        "icon_similarity_risk": icon_risk,
        "metadata_risk": module_outputs.get("metadata_analysis", {}).get("score", 0.0),
    }


def vector_to_list(feature_dict: Dict[str, float]) -> List[float]:
    return [feature_dict[k] for k in FEATURE_ORDER]
