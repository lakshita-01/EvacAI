# Evac-AI

An academic prototype for visualizing building hazards and evacuation routes. Evac-AI combines floor-plan maps, hazard simulations, AI-assisted image analysis, and route planning in a web dashboard.

> **Safety notice:** Evac-AI is a prototype for demonstration and decision-support research. It is not certified for real emergency response. Do not rely on it as a replacement for approved evacuation plans or safety professionals.

## Features

- Import DXF floor plans or upload PNG/JPG plans for manual map review.
- Simulate fire, smoke, crowding, blocked areas, and custom-severity hazards.
- Visualize hazards, alerts, and evacuation routes on the selected map.
- Reroute from an affected area through a connected door to the nearest reachable stairs; use a reachable exit if stairs are unavailable.
- Analyze images for people, fire, and smoke with the AI service.
- Zoom the floor map from 67% to 200%.

## Architecture

| Service | Technology | Local port | Responsibility |
| --- | --- | ---: | --- |
| `frontend` | React, Vite | 5173 | Dashboard, maps, simulations, and alerts |
| `backend` | Node.js, Express, Socket.IO, MongoDB | 3001 | API, persistence, and service coordination |
| `map-service` | Python, FastAPI | 8001 | Floor-plan processing, building graphs, and routing |
| `ai-service` | Python, FastAPI, Ultralytics | 8000 | Person and fire/smoke image analysis |

## Requirements

- Windows with PowerShell (the included helper scripts are PowerShell scripts)
- Node.js 20+
- Python 3.11+
- Docker Desktop for local MongoDB

## Run locally

Run these commands from the repository root:

```powershell
# Install Node.js dependencies
Set-Location .\backend
npm ci
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
}

Set-Location ..\frontend
npm ci

# Install Python dependencies in a virtual environment
Set-Location ..
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\ai-service\requirements.txt
python -m pip install -r .\map-service\requirements.txt
```

Start Docker Desktop, then start the application:

```powershell
.\start-local.ps1
```

Open [http://localhost:5173](http://localhost:5173). The script starts MongoDB if it is not already available and launches the four application services. Logs are written to `%LOCALAPPDATA%\EvacAI\logs`.

Stop the application services with:

```powershell
.\stop-local.ps1
```

MongoDB remains running so local data is preserved. Docker Compose configuration is in [`docker-compose.yml`](./docker-compose.yml).

### Local configuration

The backend reads its settings from `backend/.env`; a starter file is provided at [`backend/.env.example`](./backend/.env.example). Keep `.env` files and credentials out of Git.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `PORT` | Backend HTTP port | `3001` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/evacai` |
| `AI_SERVICE_URL` | AI service base URL | `http://127.0.0.1:8000` |
| `MAP_SERVICE_URL` | Map service base URL | `http://127.0.0.1:8001` |

## AI model files

The AI service loads both model files when it starts:

- `ai-service/models/person/yolo26n.pt`
- `ai-service/models/fire_smoke/best.pt`

The custom fire/smoke model is excluded by `.gitignore`. For Hugging Face deployment, keep both model files in a private Hugging Face model repository and configure the Space with `HF_MODEL_REPO_ID` and a read-only `HF_TOKEN` secret. See [`ai-service/README.md`](./ai-service/README.md) for the required repository paths.

If you instead put the custom model in a **private source repository**, add it explicitly:

```powershell
git add -f ai-service/models/fire_smoke/best.pt
```

Do not force-add model weights to a public repository.

## Tests and build

Run each command from the repository root:

```powershell
Set-Location .\backend
npm test

Set-Location ..\map-service
python -m pytest tests -v

Set-Location ..\ai-service
python -m pytest tests\test_model_assets.py tests\test_person.py tests\test_analysis.py -v

Set-Location ..\frontend
npm run build
```

The fire/smoke detector tests require the custom model file.

## Deploy

Deployment configuration is included in [`render.yaml`](./render.yaml) and [`frontend/vercel.json`](./frontend/vercel.json).

1. Create a MongoDB Atlas cluster and database user. Configure Atlas Network Access to allow the Render backend to connect. Add the Atlas URI as the `MONGO_URI` secret on Render; never put it in source control.
2. Connect the repository to Render as a Blueprint, using the repository root containing `render.yaml`. It creates free web services for the backend and map service. Set `AI_SERVICE_URL` to the Hugging Face Space base URL and `MAP_SERVICE_URL` to the map service's public Render URL.
3. Deploy the AI service as a Hugging Face Gradio Space using [`ai-service/README.md`](./ai-service/README.md). Store model weights in a private Hugging Face model repository and configure the Space's `HF_MODEL_REPO_ID` variable and `HF_TOKEN` secret.
4. Import the repository into Vercel with the project root set to `frontend`, build command `npm run build`, and output directory `dist`.
5. Add these Vercel build environment variables, replacing the host with the public Render backend URL:

   ```text
   VITE_API_URL=https://<backend-host>/api
   VITE_SOCKET_URL=https://<backend-host>
   ```

6. Deploy the frontend after the Render backend is available. Verify the backend root (`/`), `/api/ai/health`, and the deployed dashboard.

Render's free services sleep when idle and share a monthly free-instance-hours allowance. Hugging Face Spaces may also sleep; the AI service uses ZeroGPU and free accounts have a daily GPU usage quota. Atlas network access should be restricted as much as your hosting setup allows. This app has no user authentication, and uploaded map graphs are held in map-service memory; treat it as a public demo and do not upload sensitive building plans.

## Project layout

```text
.
├── ai-service/       Python AI analysis service
├── backend/          Node.js API and MongoDB integration
├── docs/             Project documentation
├── frontend/         React dashboard
├── map-service/      Floor-plan processing and route planning
├── docker-compose.yml
├── render.yaml
├── start-local.ps1
└── stop-local.ps1
```

## Limitations

- Image-based floor plans require operator-marked rooms, exits, connections, and walls; image upload does not automatically infer building topology.
- AI detection quality depends on model weights, training data, camera placement, and image conditions.
- Risk scoring is a prototype heuristic, not a certified safety standard.
- Map graphs are stored in map-service memory and need to be reloaded after that service restarts.
- The application has no authentication and is not designed for sensitive or production emergency use.

## License

No license file is currently included. Add a license if you intend to grant others permission to reuse or distribute this project.
