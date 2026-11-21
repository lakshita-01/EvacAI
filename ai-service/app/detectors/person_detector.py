from pathlib import Path
from ultralytics import YOLO

PERSON_CLASS_ID = 0


class PersonDetector:
    """Detects people in images using a pretrained YOLO model."""

    def __init__(self, model_path: str | Path, confidence: float = 0.40):
        self.model = YOLO(str(model_path))
        self.confidence = confidence

    def detect(self, image) -> dict:
        results = self.model.predict(source=image, conf=self.confidence, verbose=False)
        people = []

        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                if int(box.cls[0]) != PERSON_CLASS_ID:
                    continue
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                people.append({
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2),
                    "confidence": round(float(box.conf[0]), 4),
                })

        return {"peopleCount": len(people), "people": people}
