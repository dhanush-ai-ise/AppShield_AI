"""
AppShield AI — FastAPI entrypoint.
Run with: uvicorn app.main:app --reload --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.postgres import Base, engine
from app.routers import auth, datasets_router, models_router, reports_router, scan, copilot_router

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-based fraudulent Android application detection platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in settings.CORS_ORIGINS.split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(copilot_router.router)
app.include_router(scan.router)
app.include_router(auth.router)
app.include_router(models_router.router)
app.include_router(datasets_router.router)
app.include_router(reports_router.router)


import threading


@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Don't fail startup if Postgres isn't available
        pass

    def _warmup():
        try:
            from app.ml.model_registry import warmup_best_model
            warmup_best_model()
        except Exception:
            pass

    threading.Thread(target=_warmup, daemon=True, name="model_warmup").start()


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.ENV}
