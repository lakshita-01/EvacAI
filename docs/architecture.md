# Evac-AI Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         EVAC-AI SYSTEM                          │
├──────────────┬──────────────────┬──────────────┬───────────────┤
│  ai-service  │   map-service    │   backend    │   frontend    │
│  :8000       │   :8001          │   :3001      │   :5173       │
│              │                  │              │               │
│ WHAT is      │ WHERE is it      │ HOW are      │ HOW does the  │
│ happening?   │ happening?       │ services     │ user see it?  │
│              │ Where to go?     │ connected?   │               │
└──────────────┴──────────────────┴──────────────┴───────────────┘
```

## Data Flow

```
CAD/DXF File
     │
     ▼
map-service/parsers/dxf_parser.py
     │  (entities: walls, rooms, doors, exits)
     ▼
map-service/graph/builder.py
     │  (nodes: room/corridor/exit, edges: connections)
     ▼
map-service/routing/astar.py
     │  (initial evacuation route)
     ▼
backend (stores in MongoDB)
     │
     ▼
frontend (renders SVG floor map + route)

         ┌──────────────────────────────┐
         │  CCTV Image / Video Frame    │
         └──────────────┬───────────────┘
                        │
                        ▼
              ai-service/detectors/
              person_detector.py  ──► peopleCount
              fire_smoke_detector.py ► fireDetected, smokeDetected
                        │
                        ▼
              ai-service/analysis/
              density.py  ──► densityLevel
              risk.py     ──► riskScore, riskLevel
                        │
                        ▼
              backend/analysis.controller.js
                        │
              camera → nodeId mapping
                        │
                        ▼
              map-service/routing/hazard_mapper.py
              (node.blocked = true, edge.cost = ∞)
                        │
                        ▼
              map-service/routing/astar.py
              (recalculate with blocked nodes/edges)
                        │
                        ▼
              backend → Socket.IO broadcast
                        │
                        ▼
              frontend (new route + alert displayed)
```

## A* Algorithm

```
f(n) = g(n) + h(n)

g(n) = accumulated edge cost from start node
       (cost = distance × risk_multiplier)

h(n) = Euclidean distance to goal exit (admissible heuristic)

Risk multipliers (configurable):
  normal   → 1.0×
  moderate → 2.0×
  high     → 5.0×
  critical → ∞ (blocked)
```

## Mermaid: Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User/Frontend
    participant B as Backend
    participant A as AI Service
    participant M as Map Service
    participant DB as MongoDB

    U->>B: POST /api/analysis/simulate {scenario}
    B->>M: POST /api/routes/reroute {nodeId, riskLevel}
    M->>M: apply_hazard_to_graph()
    M->>M: astar() with blocked nodes
    M-->>B: {route, rerouted, blockedNode}
    B->>DB: Save Detection + Route + Alerts
    B-->>U: Socket.IO emit('stateUpdate')
    U->>U: Update FloorMap + AlertPanel
```

## Mermaid: ER Diagram

```mermaid
erDiagram
    Building ||--o{ Camera : has
    Camera ||--o{ Detection : captures
    Detection ||--o{ Alert : triggers
    Detection ||--o{ Route : generates

    Building {
        string name
        string mapId
        bool isDemo
        object graphData
    }
    Camera {
        string cameraId
        string nodeId
        string mapId
        string status
    }
    Detection {
        string cameraId
        bool fireDetected
        bool smokeDetected
        int peopleCount
        string riskLevel
    }
    Alert {
        string type
        string severity
        string message
        bool resolved
    }
    Route {
        string startNode
        string exitNode
        array route
        bool rerouted
    }
```
