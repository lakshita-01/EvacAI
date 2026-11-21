# Setup Guide

## Prerequisites

| Tool       | Version  |
|------------|----------|
| Python     | 3.11+    |
| Node.js    | 20+      |
| MongoDB    | 7+       |
| Git        | any      |

---

## Step 1 — Clone / Navigate

```bash
cd evac-ai/evacAI
```

---

## Step 2 — AI Service

```bash
cd ai-service
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Add person model (already included):
```
ai-service/models/person/yolo26n.pt  ✓
```

Train fire/smoke model (required for fire detection):
```bash
python training/train_fire_smoke.py
# Model saved to: models/fire_smoke/best.pt
```

Start:
```bash
uvicorn app.main:app --reload --port 8000
```

Verify: http://localhost:8000/docs

---

## Step 3 — Map Service

```bash
cd map-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Verify: http://localhost:8001/docs

Generate demo DXF (optional):
```bash
cd test_maps
python generate_demo_dxf.py
```

---

## Step 4 — Backend

```bash
cd backend
npm install
# .env is already configured for local development
npm run dev
```

Verify: http://localhost:3001

Seed demo cameras (one-time):
```bash
curl -X POST http://localhost:3001/api/cameras/seed-demo
```

---

## Step 5 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## Step 6 — Run Tests

```bash
# AI service — person detection + analysis (no best.pt needed)
cd ai-service
pytest tests/test_person.py tests/test_analysis.py -v

# Map service — graph + routing (no models needed)
cd map-service
pytest tests/ -v
```

---

## Environment Variables

`backend/.env`:
```
PORT=3001
MONGO_URI=mongodb://localhost:27017/evacai
AI_SERVICE_URL=http://localhost:8000
MAP_SERVICE_URL=http://localhost:8001
NODE_ENV=development
```

Never commit `.env` to version control.

---

## Startup Order

1. MongoDB
2. ai-service (port 8000)
3. map-service (port 8001)
4. backend (port 3001)
5. frontend (port 5173)
