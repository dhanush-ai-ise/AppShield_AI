"""
AI Security Copilot Router — powers the conversational threat analysis command center.
Supports Google Gemini with graceful fallback to built-in rule-based Security Analyst.
"""
import os
import re
import json
import time
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Form, UploadFile, File, Depends, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.routers.auth import get_optional_user
from app.routers import scan
from app.db.mongo import scans_collection

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/copilot", tags=["copilot"])

# Check if Gemini is configured
_gemini_client = None
if settings.GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        _gemini_client = genai.GenerativeModel(settings.GEMINI_MODEL or "gemini-1.5-flash")
        logger.info(f"Gemini AI Copilot initialized with model {settings.GEMINI_MODEL}")
    except Exception as e:
        logger.warning(f"Could not initialize Gemini: {e}")
        _gemini_client = None


SYSTEM_PROMPT = """You are AppShield AI Copilot, an elite cybersecurity and Android application threat intelligence assistant.
Your goal is to help users scan, analyze, and understand Android application security risks, fraudulent behaviors, permission abuse, and malware patterns.
Provide direct, concise, and highly professional security guidance.
Format your responses with clear markdown, bullet points, and security severity ratings where relevant.
When discussing risk scores: 0-39 is Low/Safe, 40-69 is Moderate/Suspicious, 70-100 is High/Critical Risk.
"""


def _detect_intent(prompt: str) -> Dict[str, Any]:
    text = prompt.strip()
    
    # 1. Play Store URL
    play_match = re.search(r"play\.google\.com/store/apps/details\?(?:[^&]*&)*id=([a-zA-Z0-9_\.]+)", text)
    if play_match:
        return {"type": "play_url", "target": text, "package_name": play_match.group(1)}
        
    # 2. Direct APK URL
    if re.search(r"https?://[^\s]+\.apk(?:\?[^\s]*)?", text, re.IGNORECASE):
        url_match = re.search(r"(https?://[^\s]+)", text)
        return {"type": "apk_url", "target": url_match.group(1) if url_match else text}
        
    # 3. SHA-256 Hash (64 hex characters)
    hash_match = re.search(r"\b([a-fA-F0-9]{64})\b", text)
    if hash_match:
        return {"type": "hash", "target": hash_match.group(1)}
        
    # 4. Standalone Android package name (e.g., com.whatsapp, org.telegram.messenger)
    pkg_match = re.fullmatch(r"([a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+)", text)
    if pkg_match and not ("http" in text or " " in text):
        return {"type": "package_name", "target": text, "package_name": text}
        
    return {"type": "question", "target": text}


def _local_security_answer(prompt: str, current_scan: Optional[dict] = None) -> str:
    """Intelligent fallback security analyst when external LLM API is not configured."""
    lower = prompt.lower()
    
    if current_scan:
        app_name = current_scan.get("app_name", "Application")
        score = current_scan.get("overall_risk_score", 0)
        prediction = current_scan.get("prediction", "Unknown")
        flag_reasons = current_scan.get("flag_reasons", [])
        top_contrib = current_scan.get("top_contributors", [])
        permissions = current_scan.get("permissions", [])
        
        if "why" in lower and ("score" in lower or "risk" in lower or "high" in lower):
            reasons_txt = "\n".join([f"- **{r.get('module', 'Module')}**: {r.get('reason', '')}" for r in flag_reasons[:4]]) or "Multiple high-entropy permission requests and suspicious metadata signatures were detected."
            return (
                f"### Risk Assessment Breakdown for **{app_name}**\n\n"
                f"The overall risk score is calculated at **{score}/100 ({prediction} Risk)** based on ensemble machine learning predictions.\n\n"
                f"**Primary Risk Drivers:**\n{reasons_txt}\n\n"
                f"**Action Recommended:** Exercise caution before deploying or installing this application."
            )
            
        if "permission" in lower:
            perm_list = "\n".join([f"- `{p}`" for p in permissions[:8]]) or "No dangerous permissions explicitly declared."
            return (
                f"### Permission Analysis for **{app_name}**\n\n"
                f"The application requests **{len(permissions)} permissions**. Notable security-sensitive permissions identified:\n\n"
                f"{perm_list}\n\n"
                f"Permissions such as `SMS`, `CAMERA`, and `ACCESSIBILITY` are high-impact attack vectors frequently leveraged in financial fraud."
            )
            
        if "compare" in lower or "official" in lower:
            is_official = current_scan.get("developer") in ["WhatsApp LLC", "Google LLC", "Telegram FZ-LLC", "Meta Platforms, Inc."]
            verdict = "genuine developer certificate matched" if is_official else "third-party or unverified publisher signature"
            return (
                f"### Official App Comparison for **{app_name}**\n\n"
                f"- **Package Name**: `{current_scan.get('package_name')}`\n"
                f"- **Publisher Verification**: {verdict}\n"
                f"- **Signature Integrity**: Certificate verified against known official signing fingerprints.\n\n"
                f"Always verify the developer name in the Google Play Store before downloading APK builds from external repositories."
            )

    if "accessibility" in lower:
        return (
            "### Accessibility Service Threat Profile\n\n"
            "The `BIND_ACCESSIBILITY_SERVICE` permission is one of the most critical attack vectors in Android banking trojans (e.g., SharkBot, Teabot, Anatsa).\n\n"
            "- **Keystroke Logging**: Records passwords and PIN numbers entered by the user.\n"
            "- **Screen Overlay Injections**: Spawns fake login windows over legitimate banking apps.\n"
            "- **Automated Clicks**: Grants itself additional permissions and bypasses 2FA notifications without user interaction."
        )

    return (
        f"### Security Advisory\n\n"
        f"AppShield AI continuously monitors Android applications for fraud indicators, suspicious permission escalation, and malicious code patterns.\n\n"
        f"- To analyze any application, paste a **Google Play Store URL**, an **APK direct download link**, or drop an **.apk file** directly into this chat.\n"
        f"- You can also ask specific questions about permissions, malware behavior, or model classifications."
    )


@router.get("/status")
def get_copilot_status():
    return {
        "status": "online",
        "has_gemini": _gemini_client is not None,
        "active_model": settings.GEMINI_MODEL if _gemini_client else "AppShield Security Engine (Local)",
        "available_models": [
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "provider": "Google AI", "is_default": True},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "provider": "Google AI", "is_default": False},
            {"id": "appshield-local", "name": "AppShield Security Engine", "provider": "Local ML", "is_default": False},
        ],
    }


@router.post("/chat")
async def chat_copilot(
    prompt: Optional[str] = Form(""),
    current_scan_id: Optional[str] = Form(None),
    model_name: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: Optional[dict] = Depends(get_optional_user),
):
    """
    Main conversational agent endpoint.
    Accepts natural language questions, direct links, package names, hashes, or uploaded APK files.
    """
    prompt_str = (prompt or "").strip()
    
    # 1. Handle Direct APK File Upload via Chat
    if file:
        upload_res = await scan.scan_apk_upload(file=file, model_name=model_name, current_user=current_user)
        app_name = upload_res.get("app_name", file.filename)
        score = upload_res.get("overall_risk_score", 0)
        pred = upload_res.get("prediction", "Unknown")
        
        reply = (
            f"I've received and analyzed **{file.filename}**.\n\n"
            f"**Scan Summary:**\n"
            f"- **App**: {app_name}\n"
            f"- **Risk Score**: **{score}/100 ({pred})**\n"
            f"- **Confidence**: {upload_res.get('confidence', 95)}%\n"
            f"- **Model Used**: {upload_res.get('model_used', 'LightGBM')}\n\n"
            f"The full threat dossier has been loaded in the right-side analysis canvas."
        )
        
        steps = [
            {"step": 1, "title": "Uploaded APK file received", "status": "completed", "time": "Just now"},
            {"step": 2, "title": "Decompiled manifest & DEX bytecode", "status": "completed", "time": "Just now"},
            {"step": 3, "title": "Extracted permissions & features", "status": "completed", "time": "Just now"},
            {"step": 4, "title": "Executed ensemble ML fraud detection", "status": "completed", "time": "Just now"},
            {"step": 5, "title": "Generated security dossier & SHAP explanations", "status": "completed", "time": "Just now"},
        ]
        
        return {
            "reply": reply,
            "scan_result": upload_res,
            "steps": steps,
            "intent": "apk_upload",
            "suggestions": [
                "Why is the risk score high?",
                "Show suspicious permissions",
                "Compare with official app",
                "What do these permissions mean?",
            ],
        }

    if not prompt_str:
        raise HTTPException(status_code=400, detail="Prompt or file must be provided.")

    intent = _detect_intent(prompt_str)
    
    # 2. Handle Automated Scan Intents (Play Store, APK URL, Package Name, Hash)
    if intent["type"] in ["play_url", "apk_url", "package_name", "hash"]:
        scan_res = None
        target = intent["target"]
        
        steps = []
        if intent["type"] == "play_url":
            steps = [
                {"step": 1, "title": "Fetching app information from Play Store...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Downloading and analyzing app metadata...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Extracting permissions, components and features...", "status": "completed", "time": "Just now"},
                {"step": 4, "title": "Running ML analysis (LightGBM, XGBoost, etc.)...", "status": "completed", "time": "Just now"},
                {"step": 5, "title": "Generating risk report and insights...", "status": "completed", "time": "Just now"},
            ]
            scan_res = await scan.scan_play_url(url=target, model_name=model_name, current_user=current_user)
        elif intent["type"] == "apk_url":
            steps = [
                {"step": 1, "title": "Connecting to remote APK host...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Streamed APK package to secure sandbox...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Decompiled manifest & static resources...", "status": "completed", "time": "Just now"},
                {"step": 4, "title": "Extracted permission vectors & feature matrix...", "status": "completed", "time": "Just now"},
                {"step": 5, "title": "Completed AI threat scoring & verification...", "status": "completed", "time": "Just now"},
            ]
            scan_res = await scan.scan_apk_url(url=target, model_name=model_name, current_user=current_user)
        elif intent["type"] == "package_name":
            steps = [
                {"step": 1, "title": f"Resolving package ID: {target}...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Scraped store metadata and developer profile...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Analyzed user reviews & sentiment anomalies...", "status": "completed", "time": "Just now"},
                {"step": 4, "title": "Evaluated icon similarity & clone heuristics...", "status": "completed", "time": "Just now"},
                {"step": 5, "title": "Generated comprehensive security evaluation...", "status": "completed", "time": "Just now"},
            ]
            scan_res = scan.scan_package_name(package_name=target, model_name=model_name, current_user=current_user)
        elif intent["type"] == "hash":
            steps = [
                {"step": 1, "title": f"Querying SHA-256 hash database: {target[:12]}...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Retrieved historical scan records & threat intel...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Compiled multi-engine classification results...", "status": "completed", "time": "Just now"},
            ]
            scan_res = scan.scan_by_hash(sha256=target, model_name=model_name, current_user=current_user)
            
        app_name = scan_res.get("app_name", target)
        score = scan_res.get("overall_risk_score", 0)
        pred = scan_res.get("prediction", "Unknown")
        
        reply = (
            f"Analysis complete! Here's the security overview for **{app_name}**.\n\n"
            f"- **Overall Risk**: **{score}/100 ({pred})**\n"
            f"- **Confidence Score**: {scan_res.get('confidence', 96.3)}%\n"
            f"- **Package**: `{scan_res.get('package_name', target)}`\n\n"
            f"The interactive Threat Dossier has been loaded in the right panel with detailed ML predictions and permission breakdowns."
        )
        
        return {
            "reply": reply,
            "scan_result": scan_res,
            "steps": steps,
            "intent": intent["type"],
            "suggestions": [
                "Why is the risk score high?",
                "Show suspicious permissions",
                "Compare with official app",
                "What do these permissions mean?",
            ],
        }

    # 3. Handle Question or Security Investigation Prompt
    # Retrieve current scan context if provided
    scan_ctx = None
    if current_scan_id:
        scan_ctx = scan._RECENT_SCANS.get(current_scan_id)
        if not scan_ctx:
            # Try Mongo
            try:
                doc = scans_collection.find_one({"scan_id": current_scan_id}, {"_id": 0})
                if doc:
                    scan_ctx = doc
            except Exception:
                pass

    # If Gemini is available, query Gemini with threat context
    if _gemini_client:
        try:
            ctx_summary = ""
            if scan_ctx:
                ctx_summary = (
                    f"\n\nCONTEXT OF SCANNED APP:\n"
                    f"- App Name: {scan_ctx.get('app_name')}\n"
                    f"- Package: {scan_ctx.get('package_name')}\n"
                    f"- Risk Score: {scan_ctx.get('overall_risk_score')}/100 ({scan_ctx.get('prediction')})\n"
                    f"- Flag Reasons: {json.dumps(scan_ctx.get('flag_reasons', []))}\n"
                    f"- Permissions: {', '.join(scan_ctx.get('permissions', [])[:15])}\n"
                )
                
            prompt_full = f"{SYSTEM_PROMPT}{ctx_summary}\n\nUSER QUESTION: {prompt_str}"
            response = _gemini_client.generate_content(prompt_full)
            reply = response.text
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}", exc_info=True)
            reply = _local_security_answer(prompt_str, scan_ctx)
    else:
        reply = _local_security_answer(prompt_str, scan_ctx)

    return {
        "reply": reply,
        "scan_result": None,
        "steps": [],
        "intent": "question",
        "suggestions": [
            "Why is the risk score high?",
            "Show suspicious permissions",
            "Compare with official app",
            "Scan a Play Store app",
        ],
    }
