"""
PDF report generation for completed scans.
"""
from datetime import datetime, timezone
from typing import List, Optional
import tempfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.db.mongo import scans_collection
from app.routers.scan import get_scan_by_id

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{scan_id}/pdf")
def download_pdf_report(scan_id: str):
    scan = get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    c = canvas.Canvas(tmp.name, pagesize=A4)
    width, height = A4

    y = height - 50
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, "AppShield AI — Scan Report")
    y -= 30

    c.setFont("Helvetica", 11)
    for line in [
        f"App: {scan.get('app_name')}  ({scan.get('package_name')})",
        f"Prediction: {scan.get('prediction')}   Confidence: {scan.get('confidence')}%",
        f"Overall Risk Score: {scan.get('overall_risk_score')}/100",
        f"Model Used: {scan.get('model_used')}",
        "",
        "Top Risk Contributors:",
    ]:
        c.drawString(50, y, line)
        y -= 20

    for contributor in scan.get("top_contributors", [])[:6]:
        c.drawString(70, y, f"- {contributor['label']}: {contributor['impact_percent']}%")
        y -= 18

    y -= 10
    c.drawString(50, y, "Why this app was flagged:")
    y -= 20
    for reason in scan.get("flag_reasons", [])[:6]:
        c.drawString(70, y, f"- {reason['reason']}")
        y -= 18

    c.showPage()
    c.save()

    return FileResponse(tmp.name, media_type="application/pdf", filename=f"appshield_report_{scan_id}.pdf")


class BatchReportRequest(BaseModel):
    scan_ids: List[str]
    title: Optional[str] = "AppShield AI — Combined Batch Scan Report"


@router.post("/batch/pdf")
def download_batch_pdf_report(req: BatchReportRequest):
    if not req.scan_ids:
        raise HTTPException(status_code=400, detail="No scan IDs provided.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    c = canvas.Canvas(tmp.name, pagesize=A4)
    width, height = A4

    # Page 1: Executive Summary
    y = height - 50
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, y, req.title or "AppShield AI — Batch Scan Report")
    y -= 25

    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Total Scanned Apps: {len(req.scan_ids)}  |  Generated on: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    y -= 35

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Batch Summary Overview")
    y -= 20

    c.setFont("Helvetica-Bold", 9)
    c.drawString(50, y, "App Name")
    c.drawString(200, y, "Package")
    c.drawString(380, y, "Risk Score")
    c.drawString(450, y, "Verdict")
    c.drawString(510, y, "Confidence")
    y -= 15

    c.setFont("Helvetica", 8)
    scans_data = []
    for sid in req.scan_ids:
        sc = get_scan_by_id(sid)
        if sc:
            scans_data.append(sc)
            app_name = (sc.get("app_name") or "Unknown")[:24]
            pkg = (sc.get("package_name") or "")[:28]
            score = f"{sc.get('overall_risk_score', 0)}/100"
            pred = sc.get("prediction", "N/A")
            conf = f"{sc.get('confidence', '')}%"

            c.drawString(50, y, app_name)
            c.drawString(200, y, pkg)
            c.drawString(380, y, score)
            c.drawString(450, y, pred)
            c.drawString(510, y, conf)
            y -= 16

            if y < 80:
                c.showPage()
                y = height - 50
                c.setFont("Helvetica-Bold", 10)
                c.drawString(50, y, "Batch Summary Overview (Cont.)")
                y -= 25
                c.setFont("Helvetica", 8)

    # Detailed pages for each app
    for sc in scans_data:
        c.showPage()
        y = height - 50
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, f"Report: {sc.get('app_name', 'Unknown')}")
        y -= 25

        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Package: {sc.get('package_name')}  |  Risk Score: {sc.get('overall_risk_score')}/100  |  Verdict: {sc.get('prediction')}")
        y -= 25

        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Risk Analysis Contributors:")
        y -= 18

        c.setFont("Helvetica", 9)
        for contributor in sc.get("top_contributors", [])[:6]:
            c.drawString(70, y, f"- {contributor.get('label')}: {contributor.get('impact_percent')}%")
            y -= 16

        y -= 10
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, y, "Key Flag Reasons:")
        y -= 18

        c.setFont("Helvetica", 9)
        for reason in sc.get("flag_reasons", [])[:6]:
            c.drawString(70, y, f"- {reason.get('reason')}")
            y -= 16

    c.showPage()
    c.save()

    return FileResponse(tmp.name, media_type="application/pdf", filename="appshield_batch_report.pdf")
