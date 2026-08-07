"""
MongoDB connection for scan history & full JSON reports (flexible schema,
grows with new modules without migrations).
"""
from pymongo import MongoClient
from app.config import settings

_client = MongoClient(settings.MONGO_URL)
mongo_db = _client[settings.MONGO_DB]

scans_collection = mongo_db["scans"]
reports_collection = mongo_db["reports"]
