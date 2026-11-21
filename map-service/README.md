# Map Service

FastAPI service for DXF floor plan parsing, building graph generation, and A* evacuation routing.

## Start
```bash
uvicorn app.main:app --reload --port 8001
```

## Endpoints
- `GET  /api/health`
- `GET  /api/maps/demo`              — Load demo building graph
- `POST /api/maps/upload`            — Upload .dxf file
- `GET  /api/maps/:id`
- `GET  /api/maps/:id/graph`
- `POST /api/routes/calculate`       — A* route from startNode to best exit
- `POST /api/routes/reroute`         — Apply hazard + recalculate route
- `POST /api/routes/reset-hazard`    — Reset node to normal

## Demo Map
The demo map has 8 nodes: Room A, Room B, Corridor A, Corridor B, Junction, Staircase, Exit A, Exit B.
No DXF file needed for demo mode.

## Tests
```bash
pytest tests/ -v
```
