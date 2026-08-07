"""
Module 7: Screenshot Analysis
Compares submitted screenshots against a trusted-screenshot reference set to
detect cloned UI, phishing screens, or fake login pages using perceptual
hashing (swap for a fine-tuned CNN/CLIP classifier in production).
"""
from typing import Dict, List
import io
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
import hashlib

try:
    from app.config import settings
    DATASET_ROOT = settings.DATASET_ROOT
except ImportError:
    DATASET_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "datasets"


def get_phash(image_bytes: bytes) -> str:
    try:
        # Load image with PIL, convert to OpenCV format
        img = Image.open(io.BytesIO(image_bytes)).convert("L")  # Grayscale
        # Convert to OpenCV
        img_np = np.array(img)
        # Resize to 32x32 for pHash
        img_resized = cv2.resize(img_np, (32, 32), interpolation=cv2.INTER_AREA)
        # Compute DCT
        dct = cv2.dct(np.float32(img_resized))
        # Take top-left 8x8 coefficients
        dct_low = dct[:8, :8]
        # Compute median
        median = np.median(dct_low)
        # Generate hash
        phash = []
        for i in range(8):
            for j in range(8):
                phash.append("1" if dct_low[i, j] > median else "0")
        # Convert to hex string
        phash_str = hex(int("".join(phash), 2))[2:].zfill(16)
        return phash_str
    except Exception as e:
        # Fallback to MD5 hash if anything fails
        return hashlib.md5(image_bytes).hexdigest()


def hamming_distance(hash1: str, hash2: str) -> int:
    # Convert hex to binary
    bin1 = bin(int(hash1, 16))[2:].zfill(64)
    bin2 = bin(int(hash2, 16))[2:].zfill(64)
    # Compute Hamming distance
    return sum(c1 != c2 for c1, c2 in zip(bin1, bin2))


def load_trusted_screenshot_db() -> List[str]:
    trusted_hashes = []
    screenshot_dir = DATASET_ROOT / "screenshots" / "raw"
    if screenshot_dir.exists():
        for img_path in screenshot_dir.glob("*"):
            if img_path.suffix.lower() in [".png", ".jpg", ".jpeg", ".webp"]:
                try:
                    img_bytes = img_path.read_bytes()
                    phash = get_phash(img_bytes)
                    trusted_hashes.append(phash)
                except Exception:
                    continue
    return trusted_hashes


# Initialize trusted hashes on import (or lazily)
_trusted_hashes = None


def analyze_screenshots(screenshots: List[bytes], trusted_hashes: List[str] = None) -> Dict:
    global _trusted_hashes
    if trusted_hashes is None:
        if _trusted_hashes is None:
            _trusted_hashes = load_trusted_screenshot_db()
        trusted_hashes = _trusted_hashes

    hashes = [get_phash(s) for s in screenshots]

    clone_hits = 0
    for h in hashes:
        for trusted_h in trusted_hashes:
            dist = hamming_distance(h, trusted_h)
            if dist < 10:  # Threshold for near-duplicate
                clone_hits += 1
                break

    clone_ratio = clone_hits / max(len(hashes), 1)

    risk = min(1.0, clone_ratio * 0.8)
    reasons = []
    if clone_hits:
        reasons.append(f"{clone_hits} screenshot(s) closely match a known app's UI — possible cloned interface.")
    else:
        reasons.append("Screenshots do not closely resemble known phishing/clone templates.")

    return {
        "module": "screenshot_analysis",
        "score": round(risk, 4),
        "screenshots_analyzed": len(screenshots),
        "reasons": reasons,
    }
