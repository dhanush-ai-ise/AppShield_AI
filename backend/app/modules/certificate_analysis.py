"""
Module 5: Certificate Analysis
Extracts and validates the APK's signing certificate (SHA256 fingerprint,
issuer, validity window) against a trusted-certificate registry.
"""
from typing import Dict, Set

# In production this is a DB table populated from known-good publisher certs
# (e.g. scraped once from verified Play Store listings). Seed with examples.
TRUSTED_FINGERPRINTS: Dict[str, str] = {
    # "aa:bb:cc:...": "WhatsApp LLC"
}


def analyze_certificate(cert_info: Dict) -> Dict:
    """
    cert_info expected shape:
    {
        "sha256_fingerprint": str, "issuer": str, "self_signed": bool,
        "validity_years": float, "signature_algorithm": str
    }
    """
    fingerprint = cert_info.get("sha256_fingerprint", "")
    risk = 0.0
    reasons = []

    is_trusted = fingerprint in TRUSTED_FINGERPRINTS
    if is_trusted:
        return {
            "module": "certificate_analysis",
            "score": 0.02,
            "reasons": [f"Signed with a known trusted certificate ({TRUSTED_FINGERPRINTS[fingerprint]})."],
        }

    if cert_info.get("self_signed", True):
        risk += 0.4
        reasons.append("App is signed with a self-signed / untrusted certificate.")

    if cert_info.get("validity_years", 25) < 5:
        risk += 0.2
        reasons.append("Certificate validity period is unusually short.")

    weak_algos = {"MD5withRSA", "SHA1withRSA"}
    if cert_info.get("signature_algorithm") in weak_algos:
        risk += 0.25
        reasons.append(f"Uses a weak/deprecated signature algorithm ({cert_info.get('signature_algorithm')}).")

    risk = min(1.0, risk if reasons else 0.5)
    if not reasons:
        reasons.append("Certificate does not match any known trusted publisher — treated as unverified.")

    return {
        "module": "certificate_analysis",
        "score": round(risk, 4),
        "reasons": reasons,
    }
