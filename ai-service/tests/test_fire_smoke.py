import pytest
from PIL import Image
from app.detectors.fire_smoke_detector import FireSmokeDetector
from app.config import FIRE_SMOKE_MODEL_PATH


@pytest.fixture(scope="module")
def detector():
    if not FIRE_SMOKE_MODEL_PATH.exists():
        pytest.skip(f"Fire/smoke model not found: {FIRE_SMOKE_MODEL_PATH}. Run training/train_fire_smoke.py first.")
    return FireSmokeDetector(model_path=FIRE_SMOKE_MODEL_PATH)


@pytest.fixture(scope="module")
def blank_image():
    return Image.new("RGB", (640, 480), color=(200, 100, 50))


def test_detect_returns_dict(detector, blank_image):
    result = detector.detect(blank_image)
    assert isinstance(result, dict)


def test_detect_has_required_keys(detector, blank_image):
    result = detector.detect(blank_image)
    assert all(k in result for k in ("fireDetected", "fireConfidence", "smokeDetected", "smokeConfidence", "detections"))


def test_fire_detected_is_bool(detector, blank_image):
    result = detector.detect(blank_image)
    assert isinstance(result["fireDetected"], bool)


def test_detection_labels_valid(detector, blank_image):
    result = detector.detect(blank_image)
    for det in result["detections"]:
        assert det["label"] in ("fire", "smoke")
        assert 0.0 <= det["confidence"] <= 1.0
