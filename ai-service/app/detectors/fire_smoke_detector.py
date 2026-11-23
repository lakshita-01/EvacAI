from pathlib import Path

from app.config import FIRE_CONFIDENCE, FIRE_SMOKE_CLASS_NAMES, SMOKE_CONFIDENCE
from app.detectors.model_loader import load_yolo_model

# Dataset classes: 0=smoke, 1=fire  (from data.yaml: names: ['smoke', 'fire'])
SMOKE_CLASS_ID = 0
FIRE_CLASS_ID = 1


class FireSmokeDetector:
    """
    Detects fire and smoke using a custom-trained YOLO model.
    Class IDs are read from config, not hardcoded independently.
    """

    def __init__(
        self,
        model_path: str | Path,
        fire_confidence: float = FIRE_CONFIDENCE,
        smoke_confidence: float = SMOKE_CONFIDENCE,
    ):
        self.model = load_yolo_model(model_path)
        self.fire_confidence = fire_confidence
        self.smoke_confidence = smoke_confidence

    def detect(self, image) -> dict:
        results = self.model.predict(
            source=image,
            conf=min(self.fire_confidence, self.smoke_confidence),
            verbose=False,
        )

        fire_detected = False
        smoke_detected = False
        fire_confidence = 0.0
        smoke_confidence = 0.0
        detections = []

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                class_id = int(box.cls[0])
                conf = round(float(box.conf[0]), 4)
                label = FIRE_SMOKE_CLASS_NAMES.get(class_id)
                if label is None:
                    continue
                threshold = self.smoke_confidence if class_id == SMOKE_CLASS_ID else self.fire_confidence
                if conf < threshold:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "label": label,
                    "confidence": conf,
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2),
                })

                if class_id == FIRE_CLASS_ID:
                    fire_detected = True
                    fire_confidence = max(fire_confidence, conf)
                elif class_id == SMOKE_CLASS_ID:
                    smoke_detected = True
                    smoke_confidence = max(smoke_confidence, conf)

        return {
            "fireDetected": fire_detected,
            "fireConfidence": round(fire_confidence, 4),
            "smokeDetected": smoke_detected,
            "smokeConfidence": round(smoke_confidence, 4),
            "detections": detections,
        }
