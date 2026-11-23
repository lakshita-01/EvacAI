from pathlib import Path

import torch
from ultralytics import YOLO


def load_yolo_model(model_path: str | Path) -> YOLO:
    model = YOLO(str(model_path))
    if torch.cuda.is_available():
        model.to("cuda")
    return model
