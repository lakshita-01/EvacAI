import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

PERSON_MODEL_PATH = Path(os.getenv(
    "PERSON_MODEL_PATH",
    str(BASE_DIR / "models" / "person" / "yolo26n.pt"),
))
FIRE_SMOKE_MODEL_PATH = Path(os.getenv(
    "FIRE_SMOKE_MODEL_PATH",
    str(BASE_DIR / "models" / "fire_smoke" / "best.pt"),
))

DEFAULT_CONFIDENCE = 0.40
DEFAULT_ROOM_CAPACITY = 50

# Dataset classes (read from data.yaml: names: ['smoke', 'fire'])
# class 0 = smoke, class 1 = fire
FIRE_SMOKE_CLASS_NAMES = {0: "smoke", 1: "fire"}

# Risk weights (configurable, academic prototype)
RISK_WEIGHTS = {
    "fire": 60,
    "smoke": 20,
    "density_high": 15,
    "density_critical": 20,
}

# Edge cost multipliers for route planning
EDGE_COST = {
    "normal": 1.0,
    "moderate": 2.0,
    "high": 5.0,
    "critical": float("inf"),
}
