"""
Central configuration for AppShield AI backend.
All paths, thresholds and model registry settings live here so other
agents/devs have ONE place to look when extending the system.
"""
import os
from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "AppShield AI"
    ENV: str = os.getenv("ENV", "development")

    # --- Database (MongoDB) ---
    MONGO_URL: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    MONGO_DB: str = os.getenv("MONGO_DB", "appshield_reports")

    # --- Storage paths & limits ---
    DATASET_ROOT: Path = BASE_DIR.parent / "datasets"
    MODEL_ROOT: Path = BASE_DIR / "app" / "ml" / "trained_models"
    TEMP_APK_DIR: Path = BASE_DIR / "app" / "tmp_apks"  # deleted after analysis
    MAX_APK_SIZE_BYTES: int = int(os.getenv("MAX_APK_SIZE_BYTES", str(500 * 1024 * 1024)))  # 500 MB max
    MAX_DOWNLOAD_SECONDS: int = int(os.getenv("MAX_DOWNLOAD_SECONDS", "300"))  # 5 minutes

    # --- JWT Settings ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "admin")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5173"
    )

    # --- Google OAuth 2.0 ---
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
    )
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")

    # --- AI Copilot / LLM ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

    # --- Risk thresholds (overall 0-100 score) ---
    RISK_SAFE_MAX: int = 39
    RISK_SUSPICIOUS_MAX: int = 69
    # >= 70 -> Fraudulent / High-Critical Risk

    # --- Module weights used by the fallback rule-based fusion
    # (used only when no trained ML classifier is available yet) ---
    MODULE_WEIGHTS: dict = {
        "permission_risk": 0.20,
        "review_risk": 0.15,
        "apk_static_risk": 0.20,
        "icon_similarity_risk": 0.15,
        "certificate_risk": 0.15,
        "developer_risk": 0.10,
        "metadata_risk": 0.05,
    }

    class Config:
        env_file = ".env"


settings = Settings()

# Ensure runtime dirs exist
settings.MODEL_ROOT.mkdir(parents=True, exist_ok=True)
settings.TEMP_APK_DIR.mkdir(parents=True, exist_ok=True)
