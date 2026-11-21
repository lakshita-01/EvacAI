import io
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image

from app.analysis.analyzer import EvacuationAnalyzer
from app.config import DEFAULT_ROOM_CAPACITY

router = APIRouter()
_analyzer = EvacuationAnalyzer()


@router.get("/health")
def health():
    return {"status": "healthy", "service": "evac-ai", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/model/info")
def model_info():
    return {
        "personModel": "YOLOv8n (yolo26n.pt)",
        "fireSmokeModel": "Custom YOLO (best.pt)",
        "fireSmokeClasses": ["smoke", "fire"],
        "version": "1.0.0",
    }


@router.post("/analyze/frame")
async def analyze_frame(
    file: UploadFile = File(...),
    camera_id: str = Form("unknown"),
    room_capacity: int = Form(DEFAULT_ROOM_CAPACITY),
):
    if room_capacity <= 0:
        raise HTTPException(status_code=400, detail="room_capacity must be > 0")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or corrupted image file")

    result = _analyzer.analyze(image=image, room_capacity=room_capacity)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cameraId": camera_id,
        "people": {
            "count": result["peopleCount"],
            "detections": result["people"],
        },
        "fireSmoke": {
            "fireDetected": result["fireDetected"],
            "fireConfidence": result["fireConfidence"],
            "smokeDetected": result["smokeDetected"],
            "smokeConfidence": result["smokeConfidence"],
            "detections": result["detections"],
        },
        "density": {
            "value": result["density"],
            "percent": result["densityPercent"],
            "level": result["densityLevel"],
        },
        "risk": {
            "score": result["riskScore"],
            "level": result["riskLevel"],
        },
    }
