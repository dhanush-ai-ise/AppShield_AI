"""
Model training, benchmarking, and comparison endpoints.
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.config import settings
from app.ml import model_registry
from app.ml.train_models import train_all
from app.routers.auth import get_current_active_admin

router = APIRouter(prefix="/api/models", tags=["models"])

_training_status = {"status": "idle"}  # idle | running | done | failed


def _run_training(data_path: str) -> None:
    global _training_status
    _training_status = {"status": "running"}
    try:
        train_all(data_path)
        _training_status = {"status": "done"}
    except Exception as exc:
        _training_status = {"status": "failed", "error": str(exc)}


@router.post("/train")
def train_models(
    background_tasks: BackgroundTasks,
    data_path: Optional[str] = None,
    _: dict = Depends(get_current_active_admin),
):
    path = data_path or str(settings.DATASET_ROOT / "combined" / "processed" / "training_data.csv")
    background_tasks.add_task(_run_training, path)
    return {"message": "Training started in background.", "data_path": path}


@router.get("/train/status")
def training_status(_: dict = Depends(get_current_active_admin)):
    return _training_status


@router.get("/benchmark")
def get_benchmark():
    results = model_registry.get_benchmark_results()
    if not results:
        raise HTTPException(status_code=404, detail="No benchmark results yet. Run /api/models/train first.")
    return results


@router.get("/available")
def list_available_models():
    return {
        "models": model_registry.available_models(),
        "best_model": model_registry.get_best_model_name(),
    }
