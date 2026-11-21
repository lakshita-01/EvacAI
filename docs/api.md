# Evac-AI API Documentation

Base URLs:
- Backend:     http://localhost:3001/api
- AI Service:  http://localhost:8000/api
- Map Service: http://localhost:8001/api

---

## Backend API

### Health
```
GET /ai/health
Response: { backend, aiService, mapService }
```

### Maps
```
GET  /maps/demo          → Load demo building + graph
GET  /maps/:id           → Get map by ID
GET  /maps               → List all buildings
```

### Cameras
```
GET  /cameras            → List cameras
POST /cameras            → Create camera
POST /cameras/seed-demo  → Seed demo cameras
PUT  /cameras/:id        → Update camera
```

### Analysis
```
GET  /analysis/current   → Latest 10 detections
POST /analysis/simulate  → Run simulation scenario
  Body: { scenario, mapId?, startNode? }
  Scenarios: normal | fire_room_a | smoke_corridor | crowd_room_b | fire_junction
```

### Routes
```
POST /routes/calculate   → Calculate route
  Body: { mapId, startNode, algorithm? }
POST /routes/reroute     → Apply hazard + reroute
  Body: { mapId, cameraId, nodeId, riskLevel, startNode? }
POST /routes/reset       → Reset node hazard
  Body: { mapId, nodeId }
GET  /routes/current     → Latest route
```

### Alerts
```
GET   /alerts            → Active alerts (resolved=false by default)
POST  /alerts            → Create alert
POST  /alerts/resolve-all → Resolve all alerts
PATCH /alerts/:id        → Resolve single alert
```

---

## AI Service API (port 8000)

```
GET  /api/health
GET  /api/model/info
POST /api/analyze/frame
  Form: file (image), camera_id, room_capacity
  Response: { timestamp, cameraId, people, fireSmoke, density, risk }
```

---

## Map Service API (port 8001)

```
GET  /api/health
GET  /api/maps/demo
POST /api/maps/upload          (DXF file upload)
GET  /api/maps/:id
GET  /api/maps/:id/graph
POST /api/routes/calculate     { mapId, startNode, algorithm }
POST /api/routes/reroute       { mapId, cameraId, nodeId, riskLevel, startNode }
POST /api/routes/reset-hazard  { mapId, nodeId }
```

---

## Socket.IO Events (port 3001)

### Server → Client
```
alert        → New alert object
stateUpdate  → { type, scenario, detection, route, mapId }
```

---

## Standard AI Response Format

```json
{
  "timestamp": "2026-01-01T10:00:00Z",
  "cameraId": "CAM-01",
  "people": {
    "count": 12,
    "detections": [{ "x1": 100, "y1": 80, "x2": 180, "y2": 320, "confidence": 0.87 }]
  },
  "fireSmoke": {
    "fireDetected": true,
    "fireConfidence": 0.91,
    "smokeDetected": true,
    "smokeConfidence": 0.76,
    "detections": [{ "label": "fire", "confidence": 0.91, "x1": 200, "y1": 150, "x2": 350, "y2": 300 }]
  },
  "density": { "value": 0.72, "percent": 72.0, "level": "HIGH" },
  "risk":    { "score": 80, "level": "HIGH" }
}
```

## Standard Route Response Format

```json
{
  "startNode": "ROOM-A",
  "exitNode": "EXIT-B",
  "route": ["ROOM-A", "CORR-A", "JUNCTION", "EXIT-B"],
  "distance": 650.0,
  "risk": "normal",
  "algorithm": "astar",
  "rerouted": true,
  "blockedNode": "CORR-A",
  "reason": "CRITICAL detected at CORR-A via CAM-01"
}
```
