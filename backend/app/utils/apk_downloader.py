"""
Downloads an APK from a direct URL to a temp path, hands it to the analyzer,
then deletes it — per the spec: "downloads temporarily, analyzes, deletes
file, stores only extracted features."
"""
import hashlib
import uuid
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.config import settings


def download_apk(url: str) -> Path:
    dest = settings.TEMP_APK_DIR / f"{uuid.uuid4().hex}.apk"
    
    # Configure session with retries, custom headers, and optional SSL verification
    session = requests.Session()
    
    # Retry strategy
    retries = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    session.mount("http://", HTTPAdapter(max_retries=retries))
    session.mount("https://", HTTPAdapter(max_retries=retries))
    
    # Custom User-Agent to avoid being blocked
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    }
    
    try:
        # First try with SSL verification enabled
        with session.get(url, stream=True, timeout=60, headers=headers, verify=True, allow_redirects=True) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:  # Filter out keep-alive new chunks
                        f.write(chunk)
        return dest
    except requests.exceptions.SSLError:
        # If SSL verification fails, try again without verification (warn in logs)
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"SSL certificate verification failed for {url}, trying again without verification")
        
        with session.get(url, stream=True, timeout=60, headers=headers, verify=False, allow_redirects=True) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
        return dest


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def cleanup(path: Path):
    if path.exists():
        path.unlink()
