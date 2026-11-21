from pathlib import Path
from ultralytics import YOLO
from app.config import FIRE_SMOKE_CLASS_NAMES

# Dataset classes: 0=smoke, 1=fire  (from data.yaml: names: ['smoke', 'fire'])
SMOKE_CLASS_ID = 0
FIRE_CLASS_ID = 1


class FireSmokeDetector:
    """
    Detects fire and smoke using a custom-trained YOLO model.
    Class IDs are read from config, not hardcoded independently.
    """

    def __init__(self, model_path: str | Path, confidence: float = 0.40):
        self.model = YOLO(str(model_path))
        self.confidence = confidence

    def detect(self, image) -> dict:
        results = self.model.predict(source=image, conf=self.confidence, verbose=False)

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
