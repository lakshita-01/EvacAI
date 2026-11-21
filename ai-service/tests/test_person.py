import pytest
from PIL import Image
from app.detectors.person_detector import PersonDetector
from app.config import PERSON_MODEL_PATH


@pytest.fixture(scope="module")
def detector():
    return PersonDetector(model_path=PERSON_MODEL_PATH)


@pytest.fixture(scope="module")
def blank_image():
    return Image.new("RGB", (640, 480), color=(128, 128, 128))


def test_detect_returns_dict(detector, blank_image):
    result = detector.detect(blank_image)
    assert isinstance(result, dict)


def test_detect_has_required_keys(detector, blank_image):
    result = detector.detect(blank_image)
    assert "peopleCount" in result
    assert "people" in result


def test_people_count_non_negative(detector, blank_image):
    result = detector.detect(blank_image)
    assert result["peopleCount"] >= 0


def test_person_bbox_fields(detector, blank_image):
    result = detector.detect(blank_image)
    for person in result["people"]:
        assert all(k in person for k in ("x1", "y1", "x2", "y2", "confidence"))
        assert 0.0 <= person["confidence"] <= 1.0
