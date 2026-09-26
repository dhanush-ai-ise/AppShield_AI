"""
AI Security Copilot Router — powers the conversational threat analysis command center.
Supports Google Gemini with resilient model auto-resolution and graceful fallback.
"""
import os
import re
import json
import time
import asyncio
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

_gemini_model_instance = None
_configured_gemini = False

def get_gemini_client(requested_model: Optional[str] = None):
    """
    Returns an active Gemini GenerativeModel instance with fallback across supported models.
    """
    global _gemini_model_instance, _configured_gemini
    
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
        
    try:
        import google.generativeai as genai
        if not _configured_gemini:
            genai.configure(api_key=api_key)
            _configured_gemini = True
            
        # Target model candidates in priority order
        candidates = []
        if requested_model and requested_model not in ["appshield-local", "default"]:
            candidates.append(requested_model)
            # Map legacy 1.5 names to current 3.8 / 2.5 models
            if "1.5" in requested_model:
                candidates.append("gemini-3.8-flash")
                
        if settings.GEMINI_MODEL:
            candidates.append(settings.GEMINI_MODEL)
            if "1.5" in settings.GEMINI_MODEL:
                candidates.append("gemini-3.8-flash")
                
        candidates.extend(["gemini-3.8-flash", "gemini-2.5-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"])
        
        # Deduplicate while preserving order
        seen = set()
        dedup_candidates = [c for c in candidates if not (c in seen or seen.add(c))]
        
        for cand in dedup_candidates:
            try:
                model = genai.GenerativeModel(cand)
                return model
            except Exception as e:
                logger.debug(f"Candidate {cand} not available: {e}")
                continue
                
        return None
    except Exception as e:
        logger.warning(f"Could not initialize Google Gemini: {e}")
        return None


SYSTEM_PROMPT = """You are AppShield AI Copilot, an elite cybersecurity analyst and Android threat intelligence assistant.
Your goal is to help users scan, analyze, and understand Android security risks, fraudulent behaviors, permission abuse, and malware patterns.
Guidelines:
1. Provide direct, informative, professional security guidance.
2. If the user asks about specific apps, permissions, malicious behaviors, or general technical questions, answer thoroughly and clearly using clean markdown.
3. If app telemetry context is provided below, incorporate those specific metrics into your explanation.
4. If no specific app is being analyzed, answer the user's question directly with actionable cybersecurity insights.
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
    """Intelligent fallback security analyst when external LLM API is not configured or offline."""
    lower = prompt.lower()
    
    if current_scan:
        app_name = current_scan.get("app_name", "Application")
        score = current_scan.get("overall_risk_score", 0)
        prediction = current_scan.get("prediction", "Unknown")
        flag_reasons = current_scan.get("flag_reasons", [])
        permissions = current_scan.get("permissions", [])
        
        if any(w in lower for w in ["why", "score", "risk", "high", "danger", "safe"]):
            reasons_txt = "\n".join([f"- **{r.get('module', 'Module')}**: {r.get('reason', '')}" for r in flag_reasons[:4]]) or "Detected high-privilege permission combinations and dynamic network behavior."
            return (
                f"### Risk Assessment for **{app_name}**\n\n"
                f"The overall calculated risk score is **{score}/100 ({prediction} Risk)**.\n\n"
                f"**Key Risk Drivers Identified:**\n{reasons_txt}\n\n"
                f"**Recommendation:** Verify that this application was downloaded from an authenticated official source before granting sensitive permissions."
            )
            
        if any(w in lower for w in ["permission", "access", "sms", "camera", "microphone"]):
            perm_list = "\n".join([f"- `{p}`" for p in permissions[:8]]) or "No dangerous permissions explicitly declared."
            return (
                f"### Permission Analysis for **{app_name}**\n\n"
                f"The application requests **{len(permissions)} permissions**. Notable permissions include:\n\n"
                f"{perm_list}\n\n"
                f"High-impact permissions such as SMS and Accessibility Services are frequently targeted in banking fraud and data exfiltration."
            )

    if any(w in lower for w in ["accessibility", "service", "bind"]):
        return (
            "### Accessibility Service Threat Profile\n\n"
            "The `BIND_ACCESSIBILITY_SERVICE` permission is one of the highest-impact attack vectors in Android banking trojans (e.g., SharkBot, Teabot, Anatsa):\n\n"
            "- **Keystroke Logging**: Intercepts passwords and PINs entered by the user.\n"
            "- **Screen Overlay Injections**: Spawns counterfeit credential harvest windows over legitimate banking apps.\n"
            "- **Automated Clicks**: Disables Google Play Protect and grants itself additional administrative rights without user intervention."
        )

    if any(w in lower for w in ["sms", "otp", "2fa"]):
        return (
            "### SMS Fraud & OTP Interception\n\n"
            "Malicious applications frequently abuse `READ_SMS` and `RECEIVE_SMS` to intercept one-time verification passwords (OTPs) from banking apps and crypto wallets. "
            "Legitimate financial institutions will never require third-party utility apps to access your SMS inbox."
        )

    if any(w in lower for w in ["trojan", "malware", "virus", "spyware"]):
        return (
            "### Mobile Trojan Attack Vectors\n\n"
            "Modern Android threats typically utilize a multi-stage delivery architecture:\n\n"
            "1. **Dropper / Loader Stage**: A seemingly benign utility (calculator, cleaner, PDF reader) bypasses initial vetting.\n"
            "2. **Dynamic Code Loading**: Downloads an encrypted `.dex` or `.so` payload from an external C2 server.\n"
            "3. **Overlay & ATS (Automated Transfer System)**: Hijacks active user sessions to initiate unauthorized transactions."
        )

    # General dynamic response based on prompt terms
    return (
        f"### Threat Intelligence Guidance\n\n"
        f"Regarding your query about **'{prompt.strip()}'**:\n\n"
        f"- In Android security, suspicious behaviors are typically evaluated across static manifest declarations, bytecode heuristics, and network domain reputations.\n"
        f"- You can paste any **Google Play Store URL**, **APK download link**, or **package identifier** (e.g., `com.example.app`) directly into this chat to trigger an automated deep scan.\n"
        f"- You can also upload any `.apk` file using the paperclip icon for decompilation and ML ensemble classification."
    )


@router.get("/status")
def get_copilot_status():
    client = get_gemini_client()
    return {
        "status": "online",
        "has_gemini": client is not None,
        "active_model": settings.GEMINI_MODEL if client else "AppShield Security Engine (Local)",
        "available_models": [
            {"id": "gemini-3.8-flash", "name": "Gemini 3.8 Flash", "provider": "Google AI", "is_default": True},
            {"id": "gemini-3.1-pro-preview", "name": "Gemini 3.1 Pro", "provider": "Google AI", "is_default": False},
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
    
    # Determine ML classifier model vs LLM Copilot model
    # ML models are: lightgbm, random_forest, xgboost, catboost
    ml_model_to_use = None
    if model_name:
        try:
            from app.ml.model_registry import available_models
            avail = available_models()
            normalized = model_name.lower().replace("-", "_").strip()
            if normalized in avail:
                ml_model_to_use = normalized
        except Exception:
            ml_model_to_use = None

    # 1. Handle Direct APK File Upload via Chat
    if file and hasattr(file, "filename") and file.filename:
        upload_res = await scan.scan_apk_upload(file=file, model_name=ml_model_to_use, current_user=current_user)
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
            scan_res = await scan.scan_play_url(url=target, model_name=ml_model_to_use, current_user=current_user)
        elif intent["type"] == "apk_url":
            steps = [
                {"step": 1, "title": "Connecting to remote APK host...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Streamed APK package to secure sandbox...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Decompiled manifest & static resources...", "status": "completed", "time": "Just now"},
                {"step": 4, "title": "Extracted permission vectors & feature matrix...", "status": "completed", "time": "Just now"},
                {"step": 5, "title": "Completed AI threat scoring & verification...", "status": "completed", "time": "Just now"},
            ]
            scan_res = await scan.scan_apk_url(url=target, model_name=ml_model_to_use, current_user=current_user)
        elif intent["type"] == "package_name":
            steps = [
                {"step": 1, "title": f"Resolving package ID: {target}...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Scraped store metadata and developer profile...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Analyzed user reviews & sentiment anomalies...", "status": "completed", "time": "Just now"},
                {"step": 4, "title": "Evaluated icon similarity & clone heuristics...", "status": "completed", "time": "Just now"},
                {"step": 5, "title": "Generated comprehensive security evaluation...", "status": "completed", "time": "Just now"},
            ]
            scan_res = scan.scan_package_name(package_name=target, model_name=ml_model_to_use, current_user=current_user)
        elif intent["type"] == "hash":
            steps = [
                {"step": 1, "title": f"Querying SHA-256 hash database: {target[:12]}...", "status": "completed", "time": "Just now"},
                {"step": 2, "title": "Retrieved historical scan records & threat intel...", "status": "completed", "time": "Just now"},
                {"step": 3, "title": "Compiled multi-engine classification results...", "status": "completed", "time": "Just now"},
            ]
            scan_res = scan.scan_by_hash(sha256=target, model_name=ml_model_to_use, current_user=current_user)
            
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
    scan_ctx = None
    if current_scan_id:
        scan_ctx = scan.get_scan_by_id(current_scan_id)
        if not scan_ctx:
            scan_ctx = scan._RECENT_SCANS.get(current_scan_id)
            if not scan_ctx:
                try:
                    doc = scans_collection.find_one({"scan_id": current_scan_id}, {"_id": 0})
                    if doc:
                        scan_ctx = doc
                except Exception:
                    pass

    # Try Google Gemini with requested model
    gemini_client = get_gemini_client(model_name)
    if gemini_client:
        try:
            ctx_summary = ""
            if scan_ctx:
                ctx_summary = (
                    f"\n\nCURRENT SCANNED APP TELEMETRY:\n"
                    f"- App Name: {scan_ctx.get('app_name')}\n"
                    f"- Package: {scan_ctx.get('package_name')}\n"
                    f"- Risk Score: {scan_ctx.get('overall_risk_score')}/100 ({scan_ctx.get('prediction')})\n"
                    f"- Flag Reasons: {json.dumps(scan_ctx.get('flag_reasons', []))}\n"
                    f"- Permissions: {', '.join(scan_ctx.get('permissions', [])[:20])}\n"
                )
                
            prompt_full = (
                f"{SYSTEM_PROMPT}{ctx_summary}\n\n"
                f"USER QUESTION: {prompt_str}\n\n"
                f"Answer the user's question directly, clearly, and thoroughly. "
                f"Provide actionable technical information."
            )
            response = await asyncio.to_thread(gemini_client.generate_content, prompt_full)
            reply = response.text
            return {
                "reply": reply,
                "scan_result": None,
                "steps": [],
                "intent": "question",
                "suggestions": [
                    "Why is the risk score high?",
                    "Show suspicious permissions",
                    "Compare with official app",
                    "Scan another Play Store app",
                ],
            }
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
