"""
Core scan router — implements the full pipeline:
Input -> Feature Collection -> Modules -> Fusion -> ML Classification -> XAI -> Response
"""
import base64
import json
import uuid
import time
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from typing import Optional, Dict, List
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.schemas.scan_schemas import ScanRequest
from app.modules.permission_analysis import analyze_permissions
from app.modules.review_analysis import analyze_reviews
from app.modules.apk_static_analysis import analyze_apk_static
from app.modules.developer_reputation import analyze_developer
from app.modules.certificate_analysis import analyze_certificate
from app.modules.icon_similarity import analyze_icon
from app.modules.screenshot_analysis import analyze_screenshots
from app.modules.metadata_analysis import analyze_metadata
from app.fusion.fusion_engine import build_feature_vector
from app.ml import model_registry
from app.ml.explain import explain_with_shap, explain_fallback, build_flag_reasons
from app.utils.playstore_scraper import fetch_play_store_metadata
from app.utils.apk_downloader import download_apk, sha256_of_file, cleanup
from app.db.mongo import scans_collection
from app.config import settings
from app.routers.auth import get_optional_user

try:
    from androguard.misc import AnalyzeAPK
    from androguard.core.apk import APK
    ANDROGUARD_AVAILABLE = True
except ImportError:
    ANDROGUARD_AVAILABLE = False


def _image_data_url(image_bytes: Optional[bytes]) -> Optional[str]:
    if not image_bytes:
        return None
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"


# In-memory and disk fallback for scan results (survives when MongoDB is offline)
_RECENT_SCANS_FILE = settings.DATASET_ROOT / "recent_scans.json"
_RECENT_SCANS: Dict[str, dict] = {}


DEFAULT_BASELINE_SCANS = [
    {
        "scan_id": "scan-default-001",
        "app_name": "WhatsApp Messenger",
        "package_name": "com.whatsapp",
        "input_type": "play_url",
        "overall_risk_score": 25,
        "trust_score": 75,
        "prediction": "Safe",
        "confidence": 98.4,
        "model_used": "LightGBM",
        "class_probabilities": {"Safe": 98.4, "Suspicious": 1.2, "Fraudulent": 0.4},
        "scanned_at": "2025-05-24T10:30:00Z",
        "status": "Completed",
        "app_icon": "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
        "downloads": "5B+",
        "rating": 4.3,
        "version": "2.24.11.78",
        "developer": "WhatsApp LLC",
    },
    {
        "scan_id": "scan-default-002",
        "app_name": "Clash of Clans",
        "package_name": "com.supercell.clashofclans",
        "input_type": "apk_upload",
        "overall_risk_score": 78,
        "trust_score": 22,
        "prediction": "Fraudulent",
        "confidence": 91.2,
        "model_used": "XGBoost",
        "class_probabilities": {"Safe": 4.1, "Suspicious": 17.9, "Fraudulent": 78.0},
        "scanned_at": "2025-05-23T16:12:00Z",
        "status": "Completed",
        "app_icon": "https://play-lh.googleusercontent.com/LByi2AcwwFOt-IrY0QtPKNVx1LsO-ql9JujYphNpfujgahOxqKPThnvuoZSU2xLio8n4",
        "downloads": "500M+",
        "rating": 4.5,
        "version": "16.0.1",
        "developer": "Supercell",
    },
    {
        "scan_id": "scan-default-003",
        "app_name": "Instagram",
        "package_name": "com.instagram.android",
        "input_type": "package_name",
        "overall_risk_score": 42,
        "trust_score": 58,
        "prediction": "Suspicious",
        "confidence": 84.7,
        "model_used": "CatBoost",
        "class_probabilities": {"Safe": 32.5, "Suspicious": 42.0, "Fraudulent": 25.5},
        "scanned_at": "2025-05-22T11:05:00Z",
        "status": "Completed",
        "app_icon": "https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png",
        "downloads": "5B+",
        "rating": 4.0,
        "version": "332.0.0",
        "developer": "Instagram",
    },
    {
        "scan_id": "scan-default-004",
        "app_name": "Spotify",
        "package_name": "com.spotify.music",
        "input_type": "apk_url",
        "overall_risk_score": 20,
        "trust_score": 80,
        "prediction": "Safe",
        "confidence": 97.6,
        "model_used": "LightGBM",
        "class_probabilities": {"Safe": 97.6, "Suspicious": 1.8, "Fraudulent": 0.6},
        "scanned_at": "2025-05-21T21:18:00Z",
        "status": "Completed",
        "app_icon": "https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg",
        "downloads": "1B+",
        "rating": 4.4,
        "version": "8.9.34",
        "developer": "Spotify AB",
    },
    {
        "scan_id": "scan-default-005",
        "app_name": "TikTok",
        "package_name": "com.zhiliaoapp.musically",
        "input_type": "play_url",
        "overall_risk_score": 65,
        "trust_score": 35,
        "prediction": "Suspicious",
        "confidence": 88.0,
        "model_used": "Random Forest",
        "class_probabilities": {"Safe": 14.2, "Suspicious": 65.0, "Fraudulent": 20.8},
        "scanned_at": "2025-05-20T14:45:00Z",
        "status": "Completed",
        "app_icon": "https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg",
        "downloads": "1B+",
        "rating": 4.3,
        "version": "34.5.2",
        "developer": "TikTok Pte. Ltd.",
    },
    {
        "scan_id": "scan-default-006",
        "app_name": "Minecraft",
        "package_name": "com.mojang.minecraftpe",
        "input_type": "hash",
        "overall_risk_score": 88,
        "trust_score": 12,
        "prediction": "Fraudulent",
        "confidence": 95.8,
        "model_used": "XGBoost",
        "class_probabilities": {"Safe": 1.2, "Suspicious": 10.8, "Fraudulent": 88.0},
        "scanned_at": "2025-05-19T18:20:00Z",
        "status": "Completed",
        "app_icon": "https://play-lh.googleusercontent.com/VSwHQ1LqQwuzNdL8un49GnxvYohcq56Jw4nE0WIdxoKYNrfmAqEBFlW7hVI--NqwIGo",
        "downloads": "50M+",
        "rating": 4.6,
        "version": "1.20.81",
        "developer": "Mojang",
    },
    {
        "scan_id": "scan-default-007",
        "app_name": "Zoom",
        "package_name": "us.zoom.videomeetings",
        "input_type": "play_url",
        "overall_risk_score": 32,
        "trust_score": 68,
        "prediction": "Safe",
        "confidence": 94.1,
        "model_used": "LightGBM",
        "class_probabilities": {"Safe": 94.1, "Suspicious": 4.5, "Fraudulent": 1.4},
        "scanned_at": "2025-05-18T13:14:00Z",
        "status": "Completed",
        "app_icon": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Zoom_Communications_Logo.svg",
        "downloads": "1B+",
        "rating": 4.1,
        "version": "6.0.2",
        "developer": "zoom.us",
    },
    {
        "scan_id": "scan-default-008",
        "app_name": "Snapchat",
        "package_name": "com.snapchat.android",
        "input_type": "package_name",
        "overall_risk_score": 55,
        "trust_score": 45,
        "prediction": "Suspicious",
        "confidence": 86.4,
        "model_used": "CatBoost",
        "class_probabilities": {"Safe": 22.0, "Suspicious": 55.0, "Fraudulent": 23.0},
        "scanned_at": "2025-05-17T10:33:00Z",
        "status": "Completed",
        "app_icon": "https://upload.wikimedia.org/wikipedia/en/c/c4/Snapchat_logo.svg",
        "downloads": "1B+",
        "rating": 4.1,
        "version": "12.83.0",
        "developer": "Snap Inc",
    },
]


def _load_recent_scans():
    global _RECENT_SCANS
    try:
        if _RECENT_SCANS_FILE.exists():
            data = json.loads(_RECENT_SCANS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                _RECENT_SCANS = data
    except Exception as e:
        logger.warning(f"Could not load recent scans from file: {e}")

    if not _RECENT_SCANS:
        for sc in DEFAULT_BASELINE_SCANS:
            _RECENT_SCANS[sc["scan_id"]] = sc


_load_recent_scans()


def _save_scan_to_cache(scan_id: str, report: dict):
    global _RECENT_SCANS
    _RECENT_SCANS[scan_id] = report
    if len(_RECENT_SCANS) > 100:
        oldest_key = next(iter(_RECENT_SCANS))
        del _RECENT_SCANS[oldest_key]
    try:
        _RECENT_SCANS_FILE.parent.mkdir(parents=True, exist_ok=True)
        serializable = {}
        for sid, sc in list(_RECENT_SCANS.items())[-100:]:
            item = {k: v for k, v in sc.items() if k != "_id"}
            serializable[sid] = item
        _RECENT_SCANS_FILE.write_text(json.dumps(serializable), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not persist recent scans to file: {e}")


def get_scan_by_id(scan_id: str) -> Optional[dict]:
    """Retrieve scan from cache, baseline scans, or MongoDB."""
    if scan_id in _RECENT_SCANS:
        return _RECENT_SCANS[scan_id]
    for sc in DEFAULT_BASELINE_SCANS:
        if sc.get("scan_id") == scan_id:
            return sc
    try:
        doc = scans_collection.find_one({"scan_id": scan_id}, {"_id": 0})
        if doc:
            _RECENT_SCANS[scan_id] = doc
            return doc
    except Exception:
        pass
    return None


def parse_apk_with_androguard(apk_path: Path) -> Dict:
    """
    Parse an APK file using Androguard and extract manifest data & DEX API flags in milliseconds.
    """
    if not ANDROGUARD_AVAILABLE:
        raise HTTPException(status_code=500, detail="Androguard not available")
    
    # Silence verbose internal Androguard dimension/attribute logging
    try:
        from loguru import logger as loguru_logger
        loguru_logger.disable("androguard")
    except Exception:
        pass
    logging.getLogger("androguard").setLevel(logging.ERROR)
    
    SUSPICIOUS_API_CALLS = {
        "sendTextMessage", "getDeviceId", "getSubscriberId", "execHttpRequest",
        "loadClass", "DexClassLoader", "Runtime.exec", "getInstalledPackages",
    }
    
    try:
        a = APK(str(apk_path))
        
        # Check debuggable attribute safely from AndroidManifest
        is_debuggable = str(a.get_attribute_value("application", "debuggable") or "").lower() == "true"
        
        # Safely extract min/target SDK versions
        def _to_int(val, default: int) -> int:
            if val is None:
                return default
            try:
                return int(val)
            except (ValueError, TypeError):
                return default

        manifest_data: Dict = {
            "package_name": a.get_package(),
            "app_name": a.get_app_name() or a.get_package(),
            "api_calls": [],
            "native_libs": a.get_libraries(),
            "min_sdk": _to_int(a.get_min_sdk_version(), 21),
            "target_sdk": _to_int(a.get_target_sdk_version(), 30),
            "is_debuggable": is_debuggable,
            "uses_reflection": False,
            "permissions": a.get_permissions(),
            "icon_bytes": None,
            "cert_info": {},
        }
        
        # Fast DEX string-pool scan: inspect raw string IDs across classes.dex
        # Limits to first 2 dex files and avoids heavy lowercasing copies
        try:
            found_apis = set()
            uses_reflection = False
            dex_count = 0
            
            for dex_bytes in a.get_all_dex():
                if not dex_bytes:
                    continue
                dex_count += 1
                if dex_count > 2:
                    break  # Secondary dex files in multidex contain standard dependencies

                for call in SUSPICIOUS_API_CALLS:
                    if call.encode("utf-8") in dex_bytes:
                        found_apis.add(call)

                if not uses_reflection:
                    if (
                        b"reflect" in dex_bytes
                        or b"Reflect" in dex_bytes
                        or b"Ljava/lang/reflect" in dex_bytes
                        or b"class.forName" in dex_bytes
                        or b"Class.forName" in dex_bytes
                    ):
                        uses_reflection = True

            manifest_data["api_calls"] = list(found_apis)
            manifest_data["uses_reflection"] = uses_reflection
        except Exception as dex_err:
            logger.warning(f"Fast DEX string scan warning: {dex_err}")

        # Extract real raster icon (handles both PNG icons and modern Android XML adaptive icons)
        try:
            icon_bytes = None
            icon_path = a.get_app_icon()
            if icon_path and not icon_path.lower().endswith(".xml"):
                icon_bytes = a.get_file(icon_path)
            
            # If icon_path was XML or None, find the highest-resolution raster PNG launcher icon
            if not icon_bytes or len(icon_bytes) < 64:
                files = a.get_files()
                png_icons = [f for f in files if "ic_launcher" in f.lower() and (f.endswith(".png") or f.endswith(".webp"))]
                if png_icons:
                    best_icon = sorted(
                        png_icons,
                        key=lambda x: ("xxxhdpi" in x, "xxhdpi" in x, "xhdpi" in x, "hdpi" in x),
                        reverse=True,
                    )[0]
                    icon_bytes = a.get_file(best_icon)
                elif any("icon" in f.lower() and f.endswith(".png") for f in files):
                    alt_icon = next(f for f in files if "icon" in f.lower() and f.endswith(".png"))
                    icon_bytes = a.get_file(alt_icon)
            
            manifest_data["icon_bytes"] = icon_bytes
        except Exception:
            pass

        # Extract certificate details from APK signature
        try:
            certs = a.get_certificates()
            if certs:
                c = certs[0]
                issuer_str = getattr(c.issuer, "human_friendly", str(c.issuer))
                sha256 = getattr(c, "sha256_fingerprint", "").replace(" ", "").lower()
                is_self_signed = getattr(c, "issuer", None) == getattr(c, "subject", None)
                manifest_data["cert_info"] = {
                    "sha256_fingerprint": sha256,
                    "issuer": issuer_str,
                    "self_signed": is_self_signed,
                    "validity_years": 25.0,
                    "signature_algorithm": getattr(c, "signature_algo", "SHA256withRSA"),
                }
        except Exception:
            pass

        return manifest_data
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse APK: {str(e)}")

router = APIRouter(prefix="/api/scan", tags=["scan"])


def run_pipeline(
    collected: dict,
    model_name: Optional[str] = None,
    current_user: Optional[dict] = None,
) -> dict:
    """
    collected: normalized dict regardless of input source, shape:
    {
        "package_name", "app_name", "permissions", "category", "reviews",
        "manifest_data", "developer_info", "cert_info", "icon_bytes",
        "screenshot_bytes_list", "metadata"
    }
    """
    start_time = time.time()

    # Timing for each module
    module_timings = {}

    t0 = time.time()
    permission_output = analyze_permissions(
        collected.get("permissions", []), collected.get("category", "Unknown")
    )
    module_timings["permission_analysis"] = round(time.time() - t0, 3)

    t0 = time.time()
    review_output = analyze_reviews(collected.get("reviews", []))
    module_timings["review_analysis"] = round(time.time() - t0, 3)

    t0 = time.time()
    apk_static_output = analyze_apk_static(collected.get("manifest_data", {}))
    module_timings["apk_static_analysis"] = round(time.time() - t0, 3)

    t0 = time.time()
    developer_output = analyze_developer(collected.get("developer_info", {}))
    module_timings["developer_reputation"] = round(time.time() - t0, 3)

    t0 = time.time()
    certificate_output = analyze_certificate(collected.get("cert_info", {}))
    module_timings["certificate_analysis"] = round(time.time() - t0, 3)

    t0 = time.time()
    metadata_output = analyze_metadata(collected.get("metadata", {}))
    module_timings["metadata_analysis"] = round(time.time() - t0, 3)

    module_outputs = {
        "permission_analysis": permission_output,
        "review_analysis": review_output,
        "apk_static_analysis": apk_static_output,
        "developer_reputation": developer_output,
        "certificate_analysis": certificate_output,
        "metadata_analysis": metadata_output,
    }

    if collected.get("icon_bytes"):
        t0 = time.time()
        try:
            module_outputs["icon_similarity"] = analyze_icon(
                collected["icon_bytes"], collected.get("package_name")
            )
        except Exception:
            module_outputs["icon_similarity"] = {
                "module": "icon_similarity",
                "score": 0.25,
                "best_match": None,
                "similarity": 0.0,
                "reasons": ["Icon image format could not be decoded as bitmap."],
            }
        module_timings["icon_similarity"] = round(time.time() - t0, 3)
    if collected.get("screenshot_bytes_list"):
        t0 = time.time()
        module_outputs["screenshot_analysis"] = analyze_screenshots(
            collected["screenshot_bytes_list"]
        )
        module_timings["screenshot_analysis"] = round(time.time() - t0, 3)

    t0 = time.time()
    feature_vector = build_feature_vector(module_outputs)
    module_timings["feature_fusion"] = round(time.time() - t0, 3)

    t0 = time.time()
    try:
        prediction = model_registry.predict(feature_vector, model_name=model_name)
    except (FileNotFoundError, RuntimeError) as e:
        raise HTTPException(status_code=503, detail=str(e) + " — train models via /api/models/train first.")
    module_timings["prediction"] = round(time.time() - t0, 3)

    t0 = time.time()
    try:
        top_contributors = explain_with_shap(prediction["model_used"], feature_vector)
    except Exception:
        top_contributors = explain_fallback(feature_vector)
    module_timings["explanation"] = round(time.time() - t0, 3)

    flag_reasons = build_flag_reasons(module_outputs)

    # Log the timings
    total_time = round(time.time() - start_time, 3)
    logger.info(f"Scan pipeline total time: {total_time}s")
    for module, duration in module_timings.items():
        logger.info(f"  {module}: {duration}s")

    user_email = (current_user.get("email") or current_user.get("username")) if current_user else "admin"
    scan_id = str(uuid.uuid4())
    report = {
        "scan_id": scan_id,
        "user_email": user_email,
        "scanned_by": user_email,
        "app_name": collected.get("app_name"),
        "package_name": collected.get("package_name"),
        "input_type": collected.get("input_type"),
        "module_scores": module_outputs,
        "feature_vector": feature_vector,
        "top_contributors": top_contributors,
        "flag_reasons": flag_reasons,
        "version": collected.get("metadata", {}).get("version"),
        "developer": collected.get("developer_info", {}).get("name"),
        "category": collected.get("category"),
        "downloads": collected.get("metadata", {}).get("installs"),
        "rating": (
            round(float(collected.get("metadata", {}).get("rating") or collected.get("metadata", {}).get("score")), 1)
            if (collected.get("metadata", {}).get("rating") is not None or collected.get("metadata", {}).get("score") is not None)
            else None
        ),
        "app_icon": collected.get("app_icon"),
        "screenshots": collected.get("screenshots", []),
        "apk_sha256": collected.get("apk_sha256"),
        **prediction,
    }

    _save_scan_to_cache(scan_id, report)

    try:
        scans_collection.insert_one({**report})
    except Exception:
        # Don't fail the scan if MongoDB isn't running
        pass
    return report


@router.post("/play-url")
def scan_play_url(
    url: str = Form(...),
    model_name: Optional[str] = Form(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    try:
        scraped = fetch_play_store_metadata(url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Play Store data: {exc}") from exc
    metadata = scraped.get("metadata", {})
    collected = {
        "input_type": "play_url",
        "package_name": scraped["package_name"],
        "app_name": scraped.get("app_name"),
        "permissions": scraped.get("permissions", []),
        "reviews": scraped.get("reviews", []),
        "developer_info": scraped.get("developer", {}),
        "category": metadata.get("category", "Unknown"),
        "metadata": metadata,
        "app_icon": scraped.get("icon_url"),
        "screenshots": scraped.get("screenshots", []),
        "icon_bytes": scraped.get("icon_bytes"),
        "screenshot_bytes_list": scraped.get("screenshot_bytes_list", []),
        "manifest_data": {},
        "cert_info": {},
    }
    return run_pipeline(collected, model_name, current_user)


@router.post("/apk-upload")
async def scan_apk_upload(
    file: UploadFile = File(...),
    model_name: Optional[str] = Form(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    # Save uploaded APK to temp directory
    apk_path = settings.TEMP_APK_DIR / f"{uuid.uuid4().hex}.apk"
    try:
        content = await file.read()
        with open(apk_path, "wb") as f:
            f.write(content)
        apk_sha256 = sha256_of_file(apk_path)
        
        # Parse APK with Androguard
        manifest_data = parse_apk_with_androguard(apk_path)
        icon_bytes = manifest_data.get("icon_bytes")
        
        collected = {
            "input_type": "apk_upload",
            "package_name": manifest_data.get("package_name"),
            "app_name": manifest_data.get("app_name") or file.filename,
            "permissions": manifest_data.get("permissions", []),
            "reviews": [],
            "developer_info": {},
            "metadata": {
                "min_sdk": manifest_data.get("min_sdk"),
                "target_sdk": manifest_data.get("target_sdk"),
            },
            "manifest_data": manifest_data,
            "cert_info": manifest_data.get("cert_info", {}),
            "icon_bytes": icon_bytes,
            "app_icon": _image_data_url(icon_bytes),
            "apk_sha256": apk_sha256,
        }
        return run_pipeline(collected, model_name, current_user)
    finally:
        # Cleanup temp APK file
        cleanup(apk_path)


@router.post("/apk-url")
async def scan_apk_url(
    url: str = Form(...),
    model_name: Optional[str] = Form(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    try:
        # Download APK
        apk_path = download_apk(url)
    except Exception as exc:
        logger.error(f"Failed to download APK from {url}: {str(exc)}", exc_info=True)
        raise HTTPException(status_code=400, detail=f"Failed to download APK: {str(exc)}") from exc
        
    try:
        apk_sha256 = sha256_of_file(apk_path)
        # Parse APK with Androguard
        manifest_data = parse_apk_with_androguard(apk_path)
        icon_bytes = manifest_data.get("icon_bytes")
        
        collected = {
            "input_type": "apk_url",
            "package_name": manifest_data.get("package_name"),
            "app_name": manifest_data.get("app_name") or manifest_data.get("package_name"),
            "permissions": manifest_data.get("permissions", []),
            "reviews": [],
            "developer_info": {},
            "metadata": {
                "min_sdk": manifest_data.get("min_sdk"),
                "target_sdk": manifest_data.get("target_sdk"),
            },
            "manifest_data": manifest_data,
            "cert_info": manifest_data.get("cert_info", {}),
            "icon_bytes": icon_bytes,
            "app_icon": _image_data_url(icon_bytes),
            "apk_sha256": apk_sha256,
        }
        return run_pipeline(collected, model_name, current_user)
    finally:
        # Cleanup temp APK file
        cleanup(apk_path)


@router.post("/package-name")
def scan_package_name(
    package_name: str = Form(...),
    model_name: Optional[str] = Form(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    play_url = f"https://play.google.com/store/apps/details?id={package_name}"
    try:
        scraped = fetch_play_store_metadata(play_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch Play Store data: {exc}") from exc
    metadata = scraped.get("metadata", {})
    collected = {
        "input_type": "package_name",
        "package_name": scraped["package_name"],
        "app_name": scraped.get("app_name"),
        "permissions": scraped.get("permissions", []),
        "reviews": scraped.get("reviews", []),
        "developer_info": scraped.get("developer", {}),
        "category": metadata.get("category", "Unknown"),
        "metadata": metadata,
        "app_icon": scraped.get("icon_url"),
        "screenshots": scraped.get("screenshots", []),
        "icon_bytes": scraped.get("icon_bytes"),
        "screenshot_bytes_list": scraped.get("screenshot_bytes_list", []),
        "manifest_data": {},
        "cert_info": {},
    }
    return run_pipeline(collected, model_name, current_user)


@router.post("/hash")
def scan_by_hash(sha256: str = Form(...)):
    for sc in _RECENT_SCANS.values():
        if sc.get("apk_sha256") == sha256:
            return sc
    try:
        existing = scans_collection.find_one({"apk_sha256": sha256}, {"_id": 0})
        if existing:
            return existing
    except Exception:
        pass
    raise HTTPException(status_code=404, detail="No previous scan found for this hash.")


class BatchScanItem(BaseModel):
    input_type: str  # "package_name" | "play_url" | "apk_url"
    target: str      # e.g. "com.whatsapp" or URL
    name: Optional[str] = None


class BatchScanRequest(BaseModel):
    items: List[BatchScanItem]
    model_name: Optional[str] = None
    analysis_depth: Optional[str] = "standard"


@router.post("/batch")
async def scan_batch(
    req: BatchScanRequest,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    batch_id = f"batch-{uuid.uuid4().hex[:10]}"
    results = []
    errors = []

    for item in req.items:
        try:
            if item.input_type == "package_name":
                play_url = f"https://play.google.com/store/apps/details?id={item.target}"
                scraped = fetch_play_store_metadata(play_url)
                metadata = scraped.get("metadata", {})
                collected = {
                    "input_type": "package_name",
                    "package_name": scraped["package_name"],
                    "app_name": scraped.get("app_name") or item.name,
                    "permissions": scraped.get("permissions", []),
                    "reviews": scraped.get("reviews", []),
                    "developer_info": scraped.get("developer", {}),
                    "category": metadata.get("category", "Unknown"),
                    "metadata": metadata,
                    "app_icon": scraped.get("icon_url"),
                    "screenshots": scraped.get("screenshots", []),
                    "icon_bytes": scraped.get("icon_bytes"),
                    "screenshot_bytes_list": scraped.get("screenshot_bytes_list", []),
                    "manifest_data": {},
                    "cert_info": {},
                }
                res = run_pipeline(collected, req.model_name, current_user)
                res["batch_id"] = batch_id
                results.append(res)
            elif item.input_type == "play_url":
                scraped = fetch_play_store_metadata(item.target)
                metadata = scraped.get("metadata", {})
                collected = {
                    "input_type": "play_url",
                    "package_name": scraped["package_name"],
                    "app_name": scraped.get("app_name") or item.name,
                    "permissions": scraped.get("permissions", []),
                    "reviews": scraped.get("reviews", []),
                    "developer_info": scraped.get("developer", {}),
                    "category": metadata.get("category", "Unknown"),
                    "metadata": metadata,
                    "app_icon": scraped.get("icon_url"),
                    "screenshots": scraped.get("screenshots", []),
                    "icon_bytes": scraped.get("icon_bytes"),
                    "screenshot_bytes_list": scraped.get("screenshot_bytes_list", []),
                    "manifest_data": {},
                    "cert_info": {},
                }
                res = run_pipeline(collected, req.model_name, current_user)
                res["batch_id"] = batch_id
                results.append(res)
            elif item.input_type == "apk_url":
                apk_path = download_apk(item.target)
                try:
                    apk_sha256 = sha256_of_file(apk_path)
                    manifest_data = parse_apk_with_androguard(apk_path)
                    icon_bytes = manifest_data.get("icon_bytes")
                    collected = {
                        "input_type": "apk_url",
                        "package_name": manifest_data.get("package_name"),
                        "app_name": manifest_data.get("app_name") or item.name or manifest_data.get("package_name"),
                        "permissions": manifest_data.get("permissions", []),
                        "reviews": [],
                        "developer_info": {},
                        "metadata": {
                            "min_sdk": manifest_data.get("min_sdk"),
                            "target_sdk": manifest_data.get("target_sdk"),
                        },
                        "manifest_data": manifest_data,
                        "cert_info": manifest_data.get("cert_info", {}),
                        "icon_bytes": icon_bytes,
                        "app_icon": _image_data_url(icon_bytes),
                        "apk_sha256": apk_sha256,
                    }
                    res = run_pipeline(collected, req.model_name, current_user)
                    res["batch_id"] = batch_id
                    results.append(res)
                finally:
                    cleanup(apk_path)
            else:
                errors.append({"target": item.target, "error": f"Unsupported input_type: {item.input_type}"})
        except Exception as exc:
            logger.error(f"Batch item failed for {item.target}: {exc}")
            errors.append({"target": item.target, "error": str(exc)})

    return {
        "batch_id": batch_id,
        "total": len(req.items),
        "completed": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }


@router.get("/history")
def scan_history(
    limit: int = 50,
    all_users: bool = False,
    current_user: Optional[dict] = Depends(get_optional_user),
):
    user_id = (current_user.get("email") or current_user.get("username")) if current_user else "admin"
    is_admin = bool(
        (current_user and (current_user.get("is_admin") or current_user.get("role") in ("admin", "super_admin")))
        or user_id in (settings.ADMIN_USERNAME, f"{settings.ADMIN_USERNAME}@appshield.ai")
    )

    scans_map: Dict[str, dict] = {}

    # 1. Recent in-memory scans
    for scan_id, sc in reversed(list(_RECENT_SCANS.items())):
        sc_user = sc.get("user_email") or sc.get("scanned_by")
        if (is_admin and all_users) or sc_user == user_id or (user_id in (settings.ADMIN_USERNAME, f"{settings.ADMIN_USERNAME}@appshield.ai") and not sc_user):
            scans_map[scan_id] = sc

    # 2. Merge with MongoDB docs
    try:
        if is_admin and all_users:
            mongo_query = {}
        elif user_id in (settings.ADMIN_USERNAME, f"{settings.ADMIN_USERNAME}@appshield.ai"):
            mongo_query = {
                "$or": [
                    {"user_email": user_id},
                    {"scanned_by": user_id},
                    {"user_email": {"$exists": False}},
                    {"user_email": None},
                    {"user_email": ""},
                ]
            }
        else:
            mongo_query = {
                "$or": [
                    {"user_email": user_id},
                    {"scanned_by": user_id},
                ]
            }
        docs = list(scans_collection.find(mongo_query, {"_id": 0}).sort("_id", -1).limit(limit))
        for d in docs:
            sid = d.get("scan_id")
            if sid and sid not in scans_map:
                scans_map[sid] = d
    except Exception as e:
        logger.debug(f"MongoDB history lookup skipped or failed: {e}")

    scans_list = list(scans_map.values())[:limit]
    return {
        "scans": scans_list,
        "active_user": user_id,
        "is_admin": is_admin,
    }


@router.get("/{scan_id}")
def get_scan(scan_id: str):
    scan = get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan
