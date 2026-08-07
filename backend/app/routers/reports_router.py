"""
PDF report generation for completed scans.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import tempfile

from app.db.mongo import scans_collection

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{scan_id}/pdf")
def download_pdf_report(scan_id: str):
    scan = scans_collection.find_one({"scan_id": scan_id}, {"_id": 0})
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
