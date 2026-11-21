"""
Evaluate the trained fire/smoke model.

Usage:
    cd ai-service
    python training/evaluate.py
"""
from pathlib import Path
from ultralytics import YOLO
from app.config import FIRE_SMOKE_MODEL_PATH

AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
LOCAL_YAML = AI_SERVICE_DIR / "datasets" / "fire_smoke" / "data.yaml"


def evaluate():
    if not FIRE_SMOKE_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {FIRE_SMOKE_MODEL_PATH}\n"
            "Run: python training/train_fire_smoke.py"
        )
    if not LOCAL_YAML.exists():
        raise FileNotFoundError(
            f"data.yaml not found: {LOCAL_YAML}\n"
            "Run training first — it writes the corrected yaml automatically."
        )

    print(f"Evaluating: {FIRE_SMOKE_MODEL_PATH}")
    model = YOLO(str(FIRE_SMOKE_MODEL_PATH))
    metrics = model.val(data=str(LOCAL_YAML))
    print(metrics)


if __name__ == "__main__":
    evaluate()
