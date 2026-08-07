"""
Module 6: Icon Similarity (counterfeit / clone detection).

Primary path:
- MobileNetV2 embeddings via Hugging Face transformers/torch when available.

Fallback path:
- Real visual descriptors (color histograms + edge features) built with OpenCV.
"""
from functools import lru_cache
import io
from pathlib import Path
from typing import Dict, Optional
import hashlib

import cv2
import numpy as np
from PIL import Image
import joblib

from app.config import settings

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
CACHE_PATH = settings.DATASET_ROOT / "icons" / "processed" / "icon_embeddings.cache"


def _normalize_vector(vec: np.ndarray) -> np.ndarray:
    vec = vec.astype(np.float32)
    return vec / (np.linalg.norm(vec) + 1e-8)


@lru_cache(maxsize=1)
def _load_mobilenet():
    try:
        from transformers import AutoImageProcessor, AutoModel
        import torch

        processor = AutoImageProcessor.from_pretrained("google/mobilenet_v2_1.0_224")
        model = AutoModel.from_pretrained("google/mobilenet_v2_1.0_224")
        model.eval()
        return processor, model, torch
    except Exception:
        return None


def _extract_mobilenet_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    backend = _load_mobilenet()
    if backend is None:
        return None

    processor, model, torch = backend
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
        vector = outputs.pooler_output[0].cpu().numpy()
    else:
        vector = outputs.last_hidden_state.mean(dim=1)[0].cpu().numpy()
    return _normalize_vector(vector)


def _extract_visual_fallback_embedding(image_bytes: bytes) -> np.ndarray:
    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid icon image bytes.")

    image = cv2.resize(image, (224, 224))
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    color_hist = cv2.calcHist([hsv], [0, 1, 2], None, [8, 8, 8], [0, 180, 0, 256, 0, 256]).flatten()
    edge_hist = cv2.calcHist([cv2.Canny(gray, 100, 200)], [0], None, [32], [0, 256]).flatten()

    vector = np.concatenate([color_hist, edge_hist])
    return _normalize_vector(vector)


def get_embedding(image_bytes: bytes) -> np.ndarray:
    mobilenet_vector = _extract_mobilenet_embedding(image_bytes)
    if mobilenet_vector is not None:
        return mobilenet_vector
    return _extract_visual_fallback_embedding(image_bytes)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))


def _compute_dir_hash(icon_dir: Path) -> str:
    """Compute a hash of the icon directory contents to invalidate cache when files change."""
    if not icon_dir.exists():
        return ""
    files = sorted([p for p in icon_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS])
    hash_obj = hashlib.md5()
    for path in files:
        hash_obj.update(path.name.encode())
        hash_obj.update(str(path.stat().st_mtime).encode())
    return hash_obj.hexdigest()


@lru_cache(maxsize=1)
def load_trusted_icon_db() -> Dict[str, np.ndarray]:
    icon_dir = settings.DATASET_ROOT / "icons" / "raw"
    if not icon_dir.exists():
        return {}

    # Check if we can load from cache
    current_hash = _compute_dir_hash(icon_dir)
    if CACHE_PATH.exists():
        try:
            cached_data = joblib.load(CACHE_PATH)
            if cached_data.get("dir_hash") == current_hash:
                return cached_data.get("embeddings", {})
        except Exception:
            pass

    # Rebuild the DB if cache is missing or invalid
    trusted_icon_db: Dict[str, np.ndarray] = {}
    for path in icon_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        try:
            trusted_icon_db[path.stem] = get_embedding(path.read_bytes())
        except Exception:
            continue

    # Save to cache
    try:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"dir_hash": current_hash, "embeddings": trusted_icon_db}, CACHE_PATH)
    except Exception:
        pass

    return trusted_icon_db


def _claimed_matches_reference(claimed_package_name: Optional[str], reference_label: Optional[str]) -> bool:
    if not claimed_package_name or not reference_label:
        return False
    claimed = claimed_package_name.lower()
    reference = Path(reference_label).stem.lower()
    return claimed == reference or claimed in reference or reference in claimed


def analyze_icon(image_bytes: bytes, claimed_package_name: Optional[str] = None) -> Dict:
    trusted_icon_db = load_trusted_icon_db()
    query_vec = get_embedding(image_bytes)

    best_match, best_score = None, 0.0
    for label, vec in trusted_icon_db.items():
        sim = cosine_similarity(query_vec, vec)
        if sim > best_score:
            best_match, best_score = label, sim

    reasons = []
    if not trusted_icon_db:
        risk = 0.3
        reasons.append("No trusted icon references are available yet, so icon similarity is inconclusive.")
    elif best_match and not _claimed_matches_reference(claimed_package_name, best_match) and best_score >= 0.92:
        risk = best_score
        reasons.append(
            f"Icon is {round(best_score * 100)}% similar to reference icon '{best_match}', which suggests a possible clone."
        )
    elif best_match:
        risk = max(0.05, round(1 - best_score, 4)) if _claimed_matches_reference(claimed_package_name, best_match) else round(best_score * 0.35, 4)
        reasons.append(f"Closest reference icon match is '{best_match}' with {round(best_score * 100)}% similarity.")
    else:
        risk = 0.25
        reasons.append("Icon could not be matched against the reference set.")

    return {
        "module": "icon_similarity",
        "score": round(min(1.0, risk), 4),
        "best_match": best_match,
        "similarity": round(best_score, 4),
        "reasons": reasons,
    }
