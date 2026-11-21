from app.analysis.density import calculate_density
from app.analysis.risk import calculate_risk


# ── Density tests ──────────────────────────────────────────────────────────

def test_density_low():
    r = calculate_density(10, 50)
    assert r["densityLevel"] == "LOW"
    assert r["density"] == 0.2


def test_density_medium():
    r = calculate_density(25, 50)
    assert r["densityLevel"] == "MEDIUM"


def test_density_high():
    r = calculate_density(40, 50)
    assert r["densityLevel"] == "HIGH"


def test_density_critical():
    r = calculate_density(60, 50)
    assert r["densityLevel"] == "CRITICAL"


def test_density_zero_capacity():
    r = calculate_density(10, 0)
    assert r["densityLevel"] == "UNKNOWN"
    assert r["density"] == 0.0


def test_density_percent():
    r = calculate_density(25, 50)
    assert r["densityPercent"] == 50.0


# ── Risk tests ─────────────────────────────────────────────────────────────

def test_risk_fire_alone():
    # fire=60 → score 60 → HIGH (51–75)
    r = calculate_risk(fire_detected=True, smoke_detected=False, density_level="LOW")
    assert r["riskScore"] == 60
    assert r["riskLevel"] == "HIGH"


def test_risk_fire_and_smoke():
    # fire=60 + smoke=20 → score 80 → CRITICAL (76–100)
    r = calculate_risk(fire_detected=True, smoke_detected=True, density_level="LOW")
    assert r["riskScore"] == 80
    assert r["riskLevel"] == "CRITICAL"


def test_risk_fire_smoke_crowd():
    r = calculate_risk(fire_detected=True, smoke_detected=True, density_level="CRITICAL")
    assert r["riskScore"] == 100
    assert r["riskLevel"] == "CRITICAL"


def test_risk_smoke_only():
    r = calculate_risk(fire_detected=False, smoke_detected=True, density_level="LOW")
    assert r["riskScore"] == 20
    assert r["riskLevel"] == "LOW"


def test_risk_no_hazard():
    r = calculate_risk(fire_detected=False, smoke_detected=False, density_level="LOW")
    assert r["riskScore"] == 0
    assert r["riskLevel"] == "LOW"


def test_risk_score_capped_at_100():
    r = calculate_risk(fire_detected=True, smoke_detected=True, density_level="CRITICAL")
    assert r["riskScore"] <= 100
