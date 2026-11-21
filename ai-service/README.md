# AI Service

FastAPI service for person detection, fire/smoke detection, crowd density, and risk analysis.

## Start
```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints
- `GET  /api/health`
- `GET  /api/model/info`
- `POST /api/analyze/frame` — multipart: file, camera_id, room_capacity

## Models
- Person: `models/person/yolo26n.pt` (pretrained YOLO)
- Fire/Smoke: `models/fire_smoke/best.pt` (train with `python training/train_fire_smoke.py`)

## Dataset
Classes (from data.yaml): `['smoke', 'fire']` → class 0 = smoke, class 1 = fire
Dataset location: `evac-ai/ai-service/fire_smoke_dataset/`

## Tests
```bash
pytest tests/test_person.py tests/test_analysis.py -v
```
