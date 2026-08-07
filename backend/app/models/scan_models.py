"""
SQLAlchemy models — lightweight relational metadata only.
Full nested scan reports (module breakdowns, screenshots, explanations)
are stored in MongoDB (see db/mongo.py) and referenced here by report_id.
"""
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean
from sqlalchemy.sql import func

from app.db.postgres import Base


class ScanRecord(Base):
    __tablename__ = "scans"

    id = Column(String, primary_key=True)  # uuid
    package_name = Column(String, index=True, nullable=True)
    app_name = Column(String, nullable=True)
    input_type = Column(String)  # play_url | apk_url | apk_upload | package_name | hash
    apk_sha256 = Column(String, index=True, nullable=True)
    overall_risk_score = Column(Float, nullable=True)
    prediction = Column(String, nullable=True)  # Safe | Suspicious | Fraudulent
    confidence = Column(Float, nullable=True)
    model_used = Column(String, nullable=True)
    mongo_report_id = Column(String, nullable=True)
    scanned_by_user_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String, nullable=True)
    role = Column(String, default="user")  # user | admin | super_admin
    scan_limit = Column(Integer, default=10)
    is_pro = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True)
    name = Column(String)
    module = Column(String)  # permissions | reviews | icons | apk_static | certificates | metadata | combined
    file_path = Column(String)
    row_count = Column(Integer, nullable=True)
    uploaded_by_user_id = Column(String, nullable=True)
    source = Column(String, nullable=True)  # e.g. "CICMalDroid2020", "manual upload"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
