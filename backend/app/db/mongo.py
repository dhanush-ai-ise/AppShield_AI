"""
MongoDB connection for all persistent application data:
scans, reports, user accounts, and metadata.
"""
import logging
from pymongo import MongoClient
from app.config import settings

logger = logging.getLogger(__name__)

_client = MongoClient(settings.MONGO_URL, serverSelectionTimeoutMS=2000)
mongo_db = _client[settings.MONGO_DB]

scans_collection = mongo_db["scans"]
reports_collection = mongo_db["reports"]
users_collection = mongo_db["users"]


def ping_mongo() -> bool:
    """Test connection to MongoDB server."""
    try:
        _client.admin.command("ping")
        return True
    except Exception as exc:
        logger.debug(f"MongoDB ping failed: {exc}")
        return False


def init_db() -> bool:
    """Ensure database collections and indexes exist in MongoDB."""
    if not ping_mongo():
        return False
    try:
        existing = mongo_db.list_collection_names()
        for col_name in ["scans", "users", "reports"]:
            if col_name not in existing:
                mongo_db.create_collection(col_name)
                logger.info(f"Created MongoDB collection: {col_name}")

        # Ensure performance & constraint indexes
        scans_collection.create_index("scan_id", unique=True)
        scans_collection.create_index("package_name")
        scans_collection.create_index("apk_sha256", sparse=True)
        scans_collection.create_index([("scanned_at", -1)])
        scans_collection.create_index("user_email")

        users_collection.create_index("username", unique=True, sparse=True)
        users_collection.create_index("email", unique=True, sparse=True)
        users_collection.create_index("user_id", unique=True, sparse=True)

        reports_collection.create_index("scan_id")
        seed_default_users()
        logger.info("MongoDB collections, users, and indexes initialized successfully.")
        return True
    except Exception as exc:
        logger.warning(f"MongoDB collection/index initialization: {exc}")
        return False


def seed_default_users() -> bool:
    """Ensure default administrator and analyst user accounts are populated in MongoDB."""
    try:
        from passlib.context import CryptContext
        from datetime import datetime, timezone

        pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
        admin_email = f"{settings.ADMIN_USERNAME}@appshield.ai"

        # 1. Super Admin User
        users_collection.update_one(
            {"$or": [{"username": settings.ADMIN_USERNAME}, {"email": admin_email}]},
            {
                "$set": {
                    "user_id": "usr_admin_001",
                    "username": settings.ADMIN_USERNAME,
                    "email": admin_email,
                    "full_name": "Security Administrator",
                    "role": "super_admin",
                    "is_admin": True,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "hashed_password": pwd_context.hash(settings.ADMIN_PASSWORD),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            upsert=True,
        )

        # 2. Threat Analyst User
        analyst_email = "analyst@appshield.ai"
        users_collection.update_one(
            {"$or": [{"username": "analyst"}, {"email": analyst_email}]},
            {
                "$set": {
                    "user_id": "usr_analyst_002",
                    "username": "analyst",
                    "email": analyst_email,
                    "full_name": "Threat Intelligence Analyst",
                    "role": "analyst",
                    "is_admin": False,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                "$setOnInsert": {
                    "hashed_password": pwd_context.hash("analyst123!"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            upsert=True,
        )
        logger.info(f"Default user accounts ({admin_email}, {analyst_email}) seeded into MongoDB.")
        return True
    except Exception as exc:
        logger.warning(f"Could not seed default users into MongoDB: {exc}")
        return False


