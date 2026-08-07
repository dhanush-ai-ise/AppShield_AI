"""
Module 8: Metadata Analysis
Looks for anomalies in app store metadata: category mismatch, download/rating
inconsistencies, suspicious version-history patterns, and size anomalies.
"""
from datetime import datetime, timezone
from typing import Dict


def _parse_last_updated_days(metadata: Dict) -> int:
    value = metadata.get("days_since_last_update")
    if isinstance(value, int):
        return value

    raw_date = metadata.get("last_updated")
    if not raw_date:
        return 30

    try:
        dt = datetime.fromisoformat(str(raw_date).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except ValueError:
        return 30


def analyze_metadata(metadata: Dict) -> Dict:
    """
    metadata expected shape:
    {
        "downloads": int, "rating": float, "rating_count": int,
        "version_count": int, "days_since_last_update": int,
        "size_mb": float, "category": str
    }
    """
    risk = 0.0
    reasons = []

    downloads = metadata.get("downloads", metadata.get("real_installs", metadata.get("min_installs", 0)))
    rating_count = metadata.get("rating_count", metadata.get("ratings", 0))
    days_since_last_update = _parse_last_updated_days(metadata)

    # high downloads but almost no ratings = suspicious (rating manipulation / fake installs)
    if downloads > 100_000 and rating_count < downloads * 0.001:
        risk += 0.25
        reasons.append("Download count is disproportionately high compared to the number of ratings.")

    if metadata.get("version_count", 1) <= 1 and downloads > 500_000:
        risk += 0.15
        reasons.append("App has significant install base but no version history — possible spoofed metadata.")

    if metadata.get("size_mb", 20) < 1:
        risk += 0.15
        reasons.append("App size is unusually small for its declared functionality.")

    if days_since_last_update > 730:
        risk += 0.1
        reasons.append("App has not been updated in over 2 years.")

    risk = min(1.0, risk)
    if not reasons:
        reasons.append("Metadata patterns look consistent with a legitimate app listing.")

    return {
        "module": "metadata_analysis",
        "score": round(risk, 4),
        "reasons": reasons,
    }
