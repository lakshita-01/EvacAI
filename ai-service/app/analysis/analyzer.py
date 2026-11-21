from pathlib import Path
from app.config import PERSON_MODEL_PATH, FIRE_SMOKE_MODEL_PATH, DEFAULT_CONFIDENCE
from app.detectors.person_detector import PersonDetector
from app.detectors.fire_smoke_detector import FireSmokeDetector
from app.analysis.density import calculate_density
from app.analysis.risk import calculate_risk


class EvacuationAnalyzer:
    """Orchestrates person detection, fire/smoke detection, density, and risk."""

    def __init__(
        self,
        person_model_path: Path = PERSON_MODEL_PATH,
        fire_smoke_model_path: Path = FIRE_SMOKE_MODEL_PATH,
    ):
        self.person_detector = PersonDetector(model_path=person_model_path, confidence=DEFAULT_CONFIDENCE)
        self.fire_smoke_detector = FireSmokeDetector(model_path=fire_smoke_model_path, confidence=DEFAULT_CONFIDENCE)

    def analyze(self, image, room_capacity: int) -> dict:
        person_result = self.person_detector.detect(image)
        hazard_result = self.fire_smoke_detector.detect(image)
        density_result = calculate_density(
            people_count=person_result["peopleCount"],
            room_capacity=room_capacity,
        )
        risk_result = calculate_risk(
            fire_detected=hazard_result["fireDetected"],
            smoke_detected=hazard_result["smokeDetected"],
            density_level=density_result["densityLevel"],
        )
        return {**person_result, **hazard_result, **density_result, **risk_result}
