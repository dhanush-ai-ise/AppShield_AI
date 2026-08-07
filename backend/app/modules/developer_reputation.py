"""
Module 4: Developer Reputation
Scores trustworthiness of the publishing developer account.
"""
from typing import Dict
from datetime import datetime


def analyze_developer(developer_info: Dict) -> Dict:
    """
    developer_info expected shape:
    {
        "name": str, "account_created_year": int, "total_apps": int,
        "average_rating": float, "is_verified": bool, "prior_takedowns": int
    }
    """
    current_year = datetime.utcnow().year
    account_created_year = developer_info.get("account_created_year")
    account_age = None
    if isinstance(account_created_year, int):
        account_age = max(0, current_year - account_created_year)

    risk = 0.0
    reasons = []

    if account_age is not None:
        if account_age < 1:
            risk += 0.35
            reasons.append("Developer account is less than a year old.")
        elif account_age < 2:
            risk += 0.15
            reasons.append("Developer account is relatively new (under 2 years).")

    if "total_apps" in developer_info:
        total_apps = developer_info.get("total_apps", 0)
        if total_apps <= 1:
            risk += 0.15
            reasons.append("Developer has published only one app.")

    if "is_verified" in developer_info and not developer_info.get("is_verified", False):
        risk += 0.15
        reasons.append("Developer identity is not verified by the store.")

    if "average_rating" in developer_info and developer_info.get("average_rating", 4.0) < 3.0:
        risk += 0.15
        reasons.append("Developer's other apps have low average ratings.")

    if "prior_takedowns" in developer_info:
        prior_takedowns = developer_info.get("prior_takedowns", 0)
        if prior_takedowns > 0:
            risk += min(0.3, prior_takedowns * 0.1)
            reasons.append(f"Developer has {prior_takedowns} prior app takedown(s) on record.")

    risk = min(1.0, risk)
    if not reasons:
        if developer_info:
            reasons.append("Developer information is limited, but no negative reputation signals were found.")
        else:
            reasons.append("No developer reputation data available — defaulting to neutral risk.")

    return {
        "module": "developer_reputation",
        "score": round(risk, 4),
        "account_age_years": account_age,
        "reasons": reasons,
    }
