"""
Risk scoring engine.

ACADEMIC PROTOTYPE — not a certified fire-safety standard.
Weights are configurable via config.py RISK_WEIGHTS.

Score → Level:
  0–25   LOW
  26–50  MODERATE
  51–75  HIGH
  76–100 CRITICAL
"""
from app.config import RISK_WEIGHTS


def calculate_risk(fire_detected: bool, smoke_detected: bool, density_level: str) -> dict:
    score = 0

    if fire_detected:
        score += RISK_WEIGHTS["fire"]
    if smoke_detected:
        score += RISK_WEIGHTS["smoke"]
    if density_level == "HIGH":
        score += RISK_WEIGHTS["density_high"]
    elif density_level == "CRITICAL":
        score += RISK_WEIGHTS["density_critical"]

    score = min(score, 100)

    if score <= 25:
        level = "LOW"
    elif score <= 50:
        level = "MODERATE"
    elif score <= 75:
        level = "HIGH"
    else:
        level = "CRITICAL"

    return {"riskScore": score, "riskLevel": level}
