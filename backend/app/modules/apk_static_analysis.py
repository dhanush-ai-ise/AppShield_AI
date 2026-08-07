"""
Module 3: APK Static Analysis
Uses Androguard to parse the manifest, activities, services, receivers,
permissions, native libs, and API calls of an APK file.

Real production version should run this against Androguard's Analysis object.
This stub defines the exact extraction contract so a real implementation can
be dropped in without touching callers (fusion engine, routers, etc).
"""
from typing import Dict, List

SUSPICIOUS_API_CALLS = {
    "sendTextMessage", "getDeviceId", "getSubscriberId", "execHttpRequest",
    "loadClass", "DexClassLoader", "Runtime.exec", "getInstalledPackages",
}


def analyze_apk_static(manifest_data: Dict) -> Dict:
    """
    manifest_data expected shape:
    {
        "activities": [...], "services": [...], "receivers": [...],
        "api_calls": [...], "native_libs": [...], "min_sdk": int,
        "target_sdk": int, "is_debuggable": bool, "uses_reflection": bool
    }
    """
    api_calls = set(manifest_data.get("api_calls", []))
    suspicious_hits = api_calls & SUSPICIOUS_API_CALLS
    suspicious_ratio = len(suspicious_hits) / max(len(api_calls), 1)

    risk = suspicious_ratio * 0.5
    reasons: List[str] = []

    if suspicious_hits:
        reasons.append(f"Uses {len(suspicious_hits)} suspicious API call(s): {', '.join(sorted(suspicious_hits))}.")
    if manifest_data.get("is_debuggable"):
        risk += 0.15
        reasons.append("APK is flagged as debuggable in a release build (unusual for production apps).")
    if manifest_data.get("uses_reflection"):
        risk += 0.15
        reasons.append("Uses Java reflection / dynamic class loading, often used to hide malicious code.")
    if manifest_data.get("min_sdk", 21) < 16:
        risk += 0.1
        reasons.append("Targets a very old minimum SDK, common in low-effort repackaged apps.")

    risk = min(1.0, risk)
    if not reasons:
        reasons.append("No suspicious static patterns detected in manifest or bytecode scan.")

    return {
        "module": "apk_static_analysis",
        "score": round(risk, 4),
        "suspicious_api_calls": sorted(suspicious_hits),
        "reasons": reasons,
    }
