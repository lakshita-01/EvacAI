import pytest
from PIL import Image
from app.analysis.analyzer import EvacuationAnalyzer
from app.config import FIRE_SMOKE_MODEL_PATH


@pytest.fixture(scope="module")
def analyzer():
    if not FIRE_SMOKE_MODEL_PATH.exists():
        pytest.skip("Fire/smoke model not found. Run training/train_fire_smoke.py first.")
    return EvacuationAnalyzer()


@pytest.fixture(scope="module")
def blank_image():
    return Image.new("RGB", (640, 480), color=(128, 128, 128))


def test_analyze_returns_dict(analyzer, blank_image):
    result = analyzer.analyze(image=blank_image, room_capacity=50)
    assert isinstance(result, dict)


def test_analyze_required_keys(analyzer, blank_image):
    result = analyzer.analyze(image=blank_image, room_capacity=50)
    assert all(k in result for k in (
        "peopleCount", "people",
        "fireDetected", "smokeDetected",
        "density", "densityLevel",
        "riskScore", "riskLevel",
    ))


def test_risk_level_valid(analyzer, blank_image):
    result = analyzer.analyze(image=blank_image, room_capacity=50)
    assert result["riskLevel"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")


def test_density_is_float(analyzer, blank_image):
    result = analyzer.analyze(image=blank_image, room_capacity=50)
    assert isinstance(result["density"], float)


def test_risk_score_in_range(analyzer, blank_image):
    result = analyzer.analyze(image=blank_image, room_capacity=50)
    assert 0 <= result["riskScore"] <= 100
