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
from app.utils.report_generator import generate_scan_pdf, generate_batch_pdf
from app.routers.scan import get_scan_by_id

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{scan_id}/pdf")
def download_pdf_report(scan_id: str):
    scan = get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.close()
    
    # Generate publication-grade high-fidelity PDF
    generate_scan_pdf(scan, output_path=tmp.name)

    import re
    app_raw = (scan.get("app_name") or "app").replace(" ", "_")
    app_name_safe = re.sub(r"[^a-zA-Z0-9_\-]", "", app_raw).lower() or "app"
    clean_sid = re.sub(r"[^a-zA-Z0-9_\-]", "", scan_id)[:8] or "scan"
    return FileResponse(tmp.name, media_type="application/pdf", filename=f"AppShield_Report_{app_name_safe}_{clean_sid}.pdf")


class BatchReportRequest(BaseModel):
    scan_ids: List[str]
    title: Optional[str] = "AppShield AI — Combined Batch Scan Report"


@router.post("/batch/pdf")
def download_batch_pdf_report(req: BatchReportRequest):
    if not req.scan_ids:
        raise HTTPException(status_code=400, detail="No scan IDs provided.")

    scans_data = []
    for sid in req.scan_ids:
        sc = get_scan_by_id(sid)
        if sc:
            scans_data.append(sc)

    if not scans_data:
        raise HTTPException(status_code=404, detail="No valid scans found for the given IDs.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.close()

    generate_batch_pdf(scans_data, output_path=tmp.name, title=req.title)

    return FileResponse(tmp.name, media_type="application/pdf", filename="AppShield_Batch_Scan_Report.pdf")

