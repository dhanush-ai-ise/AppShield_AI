"""
Extracts metadata from a Google Play Store listing URL:
package name, reviews, screenshots, developer, ratings, permissions.

NOTE: Scraping the Play Store directly is fragile and against Google's ToS
for production use at scale. For a real deployment, swap this for:
  - the unofficial `google-play-scraper` PyPI package, or
  - the official Google Play Developer API (requires publisher access), or
  - a licensed third-party app-intelligence API (Sensor Tower, data.ai)
This module defines the stable extraction contract other modules depend on.
"""
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

import requests
from google_play_scraper import app, reviews


def extract_package_name(play_url: str) -> str:
    parsed = urlparse(play_url)
    qs = parse_qs(parsed.query)
    if "id" in qs:
        return qs["id"][0]
    match = re.search(r"/details/([\w.]+)", play_url)
    if match:
        return match.group(1)
    raise ValueError(
        "Enter a Play Store app details URL with an id parameter, such as "
        "https://play.google.com/store/apps/details?id=com.instagram.android, "
        "or use the Package Name tab with com.instagram.android."
    )


def _normalize_datetime(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        timestamp = value / 1000.0 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _days_since(value: str) -> int:
    if not value:
        return 0
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return max(0, (datetime.now(timezone.utc) - dt).days)
    except ValueError:
        return 0


def _download_image(url: Optional[str]) -> Optional[bytes]:
    if not url:
        return None
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        return None

    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        return None
    return response.content


def fetch_play_store_metadata(play_url: str) -> Dict:
    """
    Fetch real Play Store metadata using google-play-scraper!
    """
    package_name = extract_package_name(play_url)
    
    # Fetch app info
    info = app(package_name)
    
    # Fetch reviews (max 200)
    review_list, _ = reviews(package_name, count=200, lang="en", country="us")
    
    # Normalize reviews to our expected format
    normalized_reviews: List[Dict] = []
    for r in review_list:
        date_str = _normalize_datetime(r.get("at"))
        normalized_reviews.append({
            "text": r.get("content", ""),
            "rating": r.get("score", 3),
            "date": date_str,
            "author": r.get("userName", "")
        })
    
    last_updated = _normalize_datetime(info.get("updated"))
    downloads = info.get("realInstalls") or info.get("minInstalls") or 0
    screenshots = info.get("screenshots", [])
    icon_bytes = _download_image(info.get("icon"))
    screenshot_bytes_list = [
        image_bytes
        for image_bytes in (_download_image(url) for url in screenshots[:5])
        if image_bytes
    ]

    return {
        "package_name": package_name,
        "app_name": info.get("title"),
        "developer": {
            "name": info.get("developer"),
            "id": info.get("developerId"),
            "email": info.get("developerEmail"),
            "website": info.get("developerWebsite"),
            "average_rating": info.get("score"),
            "is_verified": bool(info.get("developerEmail") or info.get("developerWebsite")),
        },
        "permissions": info.get("permissions", []),
        "reviews": normalized_reviews,
        "icon_url": info.get("icon"),
        "screenshots": screenshots,
        "icon_bytes": icon_bytes,
        "screenshot_bytes_list": screenshot_bytes_list,
        "metadata": {
            "category": info.get("genre"),
            "downloads": downloads,
            "installs": info.get("installs"),
            "rating": info.get("score"),
            "score": info.get("score"),
            "rating_count": info.get("ratings"),
            "ratings": info.get("ratings"),
            "released": info.get("released"),
            "last_updated": last_updated,
            "days_since_last_update": _days_since(last_updated),
            "version_count": 1,
            "version": info.get("version"),
            "price": info.get("price")
        }
    }
