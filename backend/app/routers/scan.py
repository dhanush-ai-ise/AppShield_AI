"""
Core scan router — implements the full pipeline:
Input -> Feature Collection -> Modules -> Fusion -> ML Classification -> XAI -> Response
"""
import base64
import uuid
import time
import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, Dict, List

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


def parse_apk_with_androguard(apk_path: Path) -> Dict:
    """
    Parse an APK file using Androguard and extract only necessary manifest data.
    """
    if not ANDROGUARD_AVAILABLE:
        raise HTTPException(status_code=500, detail="Androguard not available")
    
    SUSPICIOUS_API_CALLS = {
        "sendTextMessage", "getDeviceId", "getSubscriberId", "execHttpRequest",
        "loadClass", "DexClassLoader", "Runtime.exec", "getInstalledPackages",
    }
    
    try:
        # Skip full DEX analysis if possible by just parsing the APK
        # First, try to get manifest-only data, and only do DEX analysis if needed
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
            "api_calls": [],
            "native_libs": a.get_libraries(),
            "min_sdk": _to_int(a.get_min_sdk_version(), 21),
            "target_sdk": _to_int(a.get_target_sdk_version(), 30),
            "is_debuggable": is_debuggable,
            "uses_reflection": False,
            "permissions": a.get_permissions(),
        }
        
        # Now, do minimal DEX analysis only to check for suspicious API calls
        try:
            a_dex, d, dx = AnalyzeAPK(str(apk_path))
            
            # Extract only suspicious API calls to save time
            api_calls: set = set()
            found_suspicious = set()
            for method in dx.get_methods():
                try:
                    method_name = method.name
                    if not method_name:
                        continue
                    # Check for reflection
                    if not manifest_data["uses_reflection"] and ("reflect" in method_name.lower() or "class.forname" in str(method.class_name).lower()):
                        manifest_data["uses_reflection"] = True
                    # Check for suspicious calls
                    if method_name in SUSPICIOUS_API_CALLS:
                        found_suspicious.add(method_name)
                        api_calls.add(method_name)
                        # If we found all suspicious ones, break early!
                        if found_suspicious == SUSPICIOUS_API_CALLS:
                            break
                except Exception:
                    pass
            
            manifest_data["api_calls"] = list(api_calls)
        except Exception:
            # If full DEX analysis fails, just skip API calls
            pass

        return manifest_data
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse APK: {str(e)}")

router = APIRouter(prefix="/api/scan", tags=["scan"])


def run_pipeline(collected: dict, model_name: Optional[str] = None) -> dict:
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
        module_outputs["icon_similarity"] = analyze_icon(
            collected["icon_bytes"], collected.get("package_name")
        )
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

    scan_id = str(uuid.uuid4())
    report = {
        "scan_id": scan_id,
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
        "rating": collected.get("metadata", {}).get("score"),
        "app_icon": collected.get("app_icon"),
        "screenshots": collected.get("screenshots", []),
        "apk_sha256": collected.get("apk_sha256"),
        **prediction,
    }

    try:
        scans_collection.insert_one({**report})
    except Exception:
        # Don't fail the scan if MongoDB isn't running
        pass
    return report


@router.post("/play-url")
def scan_play_url(url: str = Form(...), model_name: Optional[str] = Form(None)):
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
    return run_pipeline(collected, model_name)


@router.post("/apk-upload")
async def scan_apk_upload(
    file: UploadFile = File(...),
    model_name: Optional[str] = Form(None),
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
        
        # Extract icon if available
        icon_bytes = None
        try:
            a = APK(str(apk_path))
            icon_path = a.get_app_icon()
            if icon_path:
                icon_bytes = a.get_file(icon_path)
        except Exception:
            pass
        
        collected = {
            "input_type": "apk_upload",
            "package_name": manifest_data.get("package_name"),
            "app_name": file.filename,
            "permissions": manifest_data.get("permissions", []),
            "reviews": [],
            "developer_info": {},
            "metadata": {
                "min_sdk": manifest_data.get("min_sdk"),
                "target_sdk": manifest_data.get("target_sdk"),
            },
            "manifest_data": manifest_data,
            "cert_info": {},
            "icon_bytes": icon_bytes,
            "app_icon": _image_data_url(icon_bytes),
            "apk_sha256": apk_sha256,
        }
        return run_pipeline(collected, model_name)
    finally:
        # Cleanup temp APK file
        cleanup(apk_path)


@router.post("/apk-url")
async def scan_apk_url(
    url: str = Form(...),
    model_name: Optional[str] = Form(None),
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
        
        # Extract icon if available
        icon_bytes = None
        try:
            a = APK(str(apk_path))
            icon_path = a.get_app_icon()
            if icon_path:
                icon_bytes = a.get_file(icon_path)
        except Exception:
            pass
        
        collected = {
            "input_type": "apk_url",
            "package_name": manifest_data.get("package_name"),
            "app_name": None,
            "permissions": manifest_data.get("permissions", []),
            "reviews": [],
            "developer_info": {},
            "metadata": {
                "min_sdk": manifest_data.get("min_sdk"),
                "target_sdk": manifest_data.get("target_sdk"),
            },
            "manifest_data": manifest_data,
            "cert_info": {},
            "icon_bytes": icon_bytes,
            "app_icon": _image_data_url(icon_bytes),
            "apk_sha256": apk_sha256,
        }
        return run_pipeline(collected, model_name)
    finally:
        # Cleanup temp APK file
        cleanup(apk_path)


@router.post("/package-name")
def scan_package_name(package_name: str = Form(...), model_name: Optional[str] = Form(None)):
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
    return run_pipeline(collected, model_name)


@router.post("/hash")
def scan_by_hash(sha256: str = Form(...)):
    existing = scans_collection.find_one({"apk_sha256": sha256}, {"_id": 0})
    if existing:
        return existing
    raise HTTPException(status_code=404, detail="No previous scan found for this hash.")


@router.get("/history")
def scan_history(limit: int = 20):
    docs = list(scans_collection.find({}, {"_id": 0}).sort("_id", -1).limit(limit))
    return {"scans": docs}
