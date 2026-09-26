"""
Downloads an APK from a direct URL to a temp path, hands it to the analyzer,
then deletes it — per the spec: "downloads temporarily, analyzes, deletes
file, stores only extracted features."
"""
import hashlib
import uuid
from pathlib import Path
from typing import Optional, Callable

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.config import settings


import time
import logging

logger = logging.getLogger(__name__)

MAX_APK_SIZE_BYTES = getattr(settings, "MAX_APK_SIZE_BYTES", 500 * 1024 * 1024)  # 500 MB max
MAX_DOWNLOAD_SECONDS = getattr(settings, "MAX_DOWNLOAD_SECONDS", 300)  # 5 minutes
CHUNK_SIZE = 256 * 1024  # 256 KB chunks


def _stream_to_file(
    response,
    dest: Path,
    deadline: float,
    progress_callback: Optional[Callable[[int, Optional[int]], None]] = None,
):
    max_mb = MAX_APK_SIZE_BYTES // (1024 * 1024)
    content_type = response.headers.get("content-type", "").lower()
    if "text/html" in content_type or "application/xhtml" in content_type:
        raise ValueError(
            "The provided URL returned an HTML webpage rather than an .apk file. "
            "Please provide a direct download link or upload the APK directly."
        )

    content_length = response.headers.get("content-length")
    cl = None
    if content_length:
        try:
            cl = int(content_length)
            if cl > MAX_APK_SIZE_BYTES:
                raise ValueError(
                    f"APK file size ({cl // (1024 * 1024)}MB) exceeds the maximum allowed scan limit of {max_mb}MB."
                )
        except ValueError as val_err:
            if "exceeds" in str(val_err):
                raise
            cl = None

    if progress_callback:
        try:
            progress_callback(0, cl)
        except Exception:
            pass

    total_bytes = 0
    first_chunk = True
    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=CHUNK_SIZE):
            if time.time() > deadline:
                raise TimeoutError(
                    f"APK download timed out after {MAX_DOWNLOAD_SECONDS}s. The remote server was too slow."
                )
            if chunk:
                if first_chunk:
                    # Check ZIP magic header (APKs are ZIP files starting with PK\x03\x04)
                    if not chunk.startswith(b"PK\x03\x04") and not chunk.startswith(b"PK\x05\x06"):
                        if b"<!DOCTYPE" in chunk[:100] or b"<html" in chunk[:100].lower():
                            raise ValueError(
                                "The URL points to a webpage instead of an APK binary. "
                                "Please provide a direct .apk download link."
                            )
                    first_chunk = False

                total_bytes += len(chunk)
                if total_bytes > MAX_APK_SIZE_BYTES:
                    raise ValueError(f"APK download exceeded maximum {max_mb}MB limit.")
                f.write(chunk)
                if progress_callback:
                    try:
                        progress_callback(total_bytes, cl)
                    except Exception:
                        pass


def download_apk(
    url: str,
    progress_callback: Optional[Callable[[int, Optional[int]], None]] = None,
) -> Path:
    dest = settings.TEMP_APK_DIR / f"{uuid.uuid4().hex}.apk"
    session = requests.Session()
    
    retries = Retry(
        total=2,
        backoff_factor=0.3,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    session.mount("http://", HTTPAdapter(max_retries=retries))
    session.mount("https://", HTTPAdapter(max_retries=retries))
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "*/*",
    }
    
    deadline = time.time() + MAX_DOWNLOAD_SECONDS

    try:
        try:
            with session.get(url, stream=True, timeout=(10, 30), headers=headers, verify=True, allow_redirects=True) as r:
                r.raise_for_status()
                _stream_to_file(r, dest, deadline, progress_callback)
            return dest
        except requests.exceptions.SSLError:
            logger.warning(f"SSL verification failed for {url}, retrying without verification")
            with session.get(url, stream=True, timeout=(10, 30), headers=headers, verify=False, allow_redirects=True) as r:
                r.raise_for_status()
                _stream_to_file(r, dest, deadline, progress_callback)
            return dest
    except Exception:
        cleanup(dest)
        raise


def sha256_of_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def cleanup(path: Path):
    if path.exists():
        path.unlink()
