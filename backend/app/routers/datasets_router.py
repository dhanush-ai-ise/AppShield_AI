"""
Dataset management router.
"""
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import settings
from app.routers.auth import get_current_active_admin

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

VALID_MODULES = {
    "permissions",
    "reviews",
    "icons",
    "apk_static",
    "certificates",
    "metadata",
    "combined",
}


def _module_dir(module: str, sub: str = "raw") -> Path:
    if module not in VALID_MODULES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown module '{module}'. Valid: {sorted(VALID_MODULES)}",
        )
    directory = settings.DATASET_ROOT / module / sub
    directory.mkdir(parents=True, exist_ok=True)
    return directory


@router.post("/upload")
async def upload_dataset(
    module: str = Form(...),
    source_name: str = Form("manual_upload"),
    file: UploadFile = File(...),
    _: dict = Depends(get_current_active_admin),
):
    """
    Save file as:
    /datasets/<module>/raw/<module>_<source_name>_<YYYYMMDD>_<shortid>.<ext>
    """
    dest_dir = _module_dir(module, "raw")
    ext = Path(file.filename or "").suffix or ".csv"
    date_str = datetime.utcnow().strftime("%Y%m%d")
    short_id = uuid.uuid4().hex[:6]
    safe_source = "".join(
        c for c in source_name if c.isalnum() or c in ("-", "_")
    ).lower() or "upload"
    filename = f"{module}_{safe_source}_{date_str}_{short_id}{ext}"
    dest_path = dest_dir / filename

    with open(dest_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    return {
        "message": "Dataset uploaded successfully.",
        "module": module,
        "saved_as": filename,
        "path": str(dest_path.relative_to(settings.DATASET_ROOT.parent)),
        "next_step": (
            "combined/processed/training_data.csv must contain the fused 7-feature "
            "+ label rows before running /api/models/train — see /datasets/README.md"
        ),
    }


@router.get("/list")
def list_datasets(
    module: Optional[str] = None,
    _: dict = Depends(get_current_active_admin),
):
    modules = [module] if module else sorted(VALID_MODULES)
    result = {}
    for item in modules:
        if item not in VALID_MODULES:
            continue
        raw_dir = settings.DATASET_ROOT / item / "raw"
        processed_dir = settings.DATASET_ROOT / item / "processed"
        result[item] = {
            "raw_files": [f.name for f in raw_dir.glob("*") if f.is_file()] if raw_dir.exists() else [],
            "processed_files": [f.name for f in processed_dir.glob("*") if f.is_file()]
            if processed_dir.exists()
            else [],
        }
    return result


@router.delete("/{module}/{filename}")
def delete_dataset(
    module: str,
    filename: str,
    _: dict = Depends(get_current_active_admin),
):
    path = _module_dir(module, "raw") / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    path.unlink()
    return {"message": f"Deleted {filename} from {module}."}
