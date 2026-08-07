"""
Module 1: Permission Analysis
Input: list of Android permission strings requested by the app + app category
Output: risk score (0-1) + human-readable reasons

Real dataset to plug in: Kaggle "Android Permission Dataset for Malware
Detection" or CICMalDroid2020 permission matrix (see /datasets/permissions/README.md)
"""
from typing import List, Dict

DANGEROUS_PERMISSIONS = {
    "android.permission.SEND_SMS", "android.permission.READ_SMS",
    "android.permission.RECEIVE_SMS", "android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS", "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.RECORD_AUDIO", "android.permission.CAMERA",
    "android.permission.READ_CALL_LOG", "android.permission.CALL_PHONE",
    "android.permission.READ_PHONE_STATE", "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.REQUEST_INSTALL_PACKAGES", "android.permission.BIND_ACCESSIBILITY_SERVICE",
}

CATEGORY_PERMISSION_MISMATCH = {
    "Tools": {"android.permission.SEND_SMS", "android.permission.READ_CONTACTS"},
    "Photography": {"android.permission.SEND_SMS", "android.permission.READ_SMS"},
    "Entertainment": {"android.permission.SEND_SMS", "android.permission.READ_CALL_LOG"},
}


def analyze_permissions(permissions: List[str], category: str = "Unknown") -> Dict:
    total = len(permissions) or 1
    dangerous = [p for p in permissions if p in DANGEROUS_PERMISSIONS]
    dangerous_ratio = len(dangerous) / total

    mismatches = CATEGORY_PERMISSION_MISMATCH.get(category, set()) & set(permissions)
    context_penalty = 0.15 * len(mismatches)

    score = min(1.0, dangerous_ratio * 0.8 + context_penalty)

    reasons = []
    if dangerous:
        reasons.append(f"Requests {len(dangerous)} dangerous permissions out of {total} total.")
    if mismatches:
        reasons.append(
            f"Requests permissions unusual for a '{category}' app: "
            f"{', '.join(m.split('.')[-1] for m in mismatches)}."
        )
    if not reasons:
        reasons.append("Permission set looks consistent with declared app category.")

    return {
        "module": "permission_analysis",
        "score": round(score, 4),
        "dangerous_permission_count": len(dangerous),
        "total_permission_count": total,
        "dangerous_permissions": dangerous,
        "reasons": reasons,
    }
