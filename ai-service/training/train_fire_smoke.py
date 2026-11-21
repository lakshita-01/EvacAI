"""
Fire/smoke YOLO training script.

Dataset: fire_smoke_dataset (14k+ images, classes: ['smoke', 'fire'])
  class 0 = smoke
  class 1 = fire

The original data.yaml has a Kaggle absolute path that doesn't work locally.
This script writes a corrected local data.yaml before training.

Usage:
    cd ai-service
    python training/train_fire_smoke.py

The trained model will be saved to:
    models/fire_smoke/best.pt
"""
import shutil
import yaml
from pathlib import Path
from ultralytics import YOLO

# ── Paths ──────────────────────────────────────────────────────────────────

# Root of ai-service/
AI_SERVICE_DIR = Path(__file__).resolve().parent.parent

# Shared dataset lives in the sibling evac-ai/ai-service/fire_smoke_dataset/
DATASET_ROOT = AI_SERVICE_DIR.parent.parent / "ai-service" / "fire_smoke_dataset" / "data"

# Where we write the corrected yaml (inside evacAI ai-service so YOLO can find it)
LOCAL_YAML = AI_SERVICE_DIR / "datasets" / "fire_smoke" / "data.yaml"

# Output model destination
OUTPUT_MODEL = AI_SERVICE_DIR / "models" / "fire_smoke" / "best.pt"


def write_local_yaml():
    """Write a corrected data.yaml with absolute local paths."""
    if not DATASET_ROOT.exists():
        raise FileNotFoundError(
            f"Dataset not found at: {DATASET_ROOT}\n"
            "Expected structure:\n"
            "  evac-ai/ai-service/fire_smoke_dataset/data/train/images/\n"
            "  evac-ai/ai-service/fire_smoke_dataset/data/val/images/"
        )

    config = {
        "path": str(DATASET_ROOT.parent),   # absolute path to fire_smoke_dataset/
        "train": "data/train/images",
        "val":   "data/val/images",
        "test":  "data/test/images",
        "nc":    2,
        "names": ["smoke", "fire"],          # class 0=smoke, class 1=fire
    }

    LOCAL_YAML.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCAL_YAML, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    print(f"Written corrected data.yaml → {LOCAL_YAML}")
    print(f"Dataset root              → {DATASET_ROOT.parent}")
    return LOCAL_YAML


def train():
    yaml_path = write_local_yaml()

    print(f"\nStarting training...")
    print(f"  data   : {yaml_path}")
    print(f"  epochs : 50")
    print(f"  imgsz  : 640")
    print(f"  batch  : 16\n")

    model = YOLO("yolo11n.pt")

    model.train(
        data=str(yaml_path),
        epochs=50,
        imgsz=640,
        batch=16,
        patience=10,
        project=str(AI_SERVICE_DIR / "runs" / "fire_smoke"),
        name="exp",
        exist_ok=True,
        pretrained=True,
        verbose=True,
    )

    # Copy best.pt to models/fire_smoke/best.pt
    best_src = AI_SERVICE_DIR / "runs" / "fire_smoke" / "exp" / "weights" / "best.pt"
    if best_src.exists():
        OUTPUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(best_src, OUTPUT_MODEL)
        print(f"\nModel saved → {OUTPUT_MODEL}")
    else:
        print(f"\nTraining complete. Locate best.pt in: {best_src.parent}")
        print("Then copy it to: models/fire_smoke/best.pt")


if __name__ == "__main__":
    train()
