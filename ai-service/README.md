---
title: Evac-AI AI Service
emoji: "🚨"
colorFrom: red
colorTo: yellow
sdk: gradio
sdk_version: 6.32.0
app_file: app.py
python_version: "3.12.12"
---

# Evac-AI AI Service

FastAPI service for person detection, fire/smoke detection, crowd density, and risk analysis, with a Gradio image-analysis page.

## Hugging Face Space setup

Create a **Gradio Space** and upload the contents of this directory to its repository root. Do not copy model weights into the Space repository.

Create a separate **private model repository** with these paths:

```text
models/
├── person/
│   └── yolo26n.pt
└── fire_smoke/
    └── best.pt
```

In the Space settings, add:

- Variable `HF_MODEL_REPO_ID`: the private model repository ID, for example `your-account/evac-ai-models`.
- Secret `HF_TOKEN`: a read token that can access that private model repository.

The Space downloads both weights at startup. The token is never included in the repository. The public Space's source and API remain public; do not send sensitive images to it.

Select **ZeroGPU** in the Space's hardware settings. The shared `analyze_image` function is decorated with `@spaces.GPU`, and both YOLO models are moved to CUDA during startup when CUDA is available. The Space uses Python 3.12.12 and PyTorch 2.8 or newer, which are supported by ZeroGPU.

Free personal accounts in good standing (verified email and account older than 30 days) can host up to two ZeroGPU Spaces. Free accounts have a daily GPU usage quota, and Spaces may sleep while idle, so a first request can take longer. Do not select CPU Basic for this deployment if your account only offers ZeroGPU.

## Endpoints

- `GET /` — Gradio image-analysis interface
- `GET /api` — service status
- `GET /api/health`
- `GET /api/model/info`
- `POST /api/analyze/frame` — multipart fields: `file`, `camera_id`, and `room_capacity`
- `GET /gradio` — redirects to the Gradio image-analysis interface

Set the backend's `AI_SERVICE_URL` to the Space's base URL (without `/api`), for example `https://your-account-evac-ai.hf.space`.

## Local development

From this directory, install `requirements.txt` and run:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

The local FastAPI service uses the model paths in `app/config.py`. Run `python app.py` to serve the Gradio interface and FastAPI endpoints together on port `7860`.
Person detections use a `0.25` confidence threshold by default to improve recall for small or partially occluded people. Set `PERSON_CONFIDENCE` to tune this threshold; lower values may increase false positives. Smoke detections use `0.20` and fire detections use `0.40`; set `SMOKE_CONFIDENCE` or `FIRE_CONFIDENCE` to tune them independently.

## Model files

- Person: `models/person/yolo26n.pt` (pretrained YOLO)
- Fire/smoke: `models/fire_smoke/best.pt` (custom model; train with `python training/train_fire_smoke.py`)
- Class IDs from `data.yaml`: `0 = smoke`, `1 = fire`

## Tests

```powershell
python -m pytest tests\test_person.py tests\test_analysis.py -v
```
