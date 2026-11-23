import copy
import math
import tempfile
import os
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, Body
from pydantic import BaseModel, Field
from typing import Literal

from app.graph.builder import build_demo_graph, build_graph_from_entities, segments_intersect
from app.parsers.dxf_parser import parse_dxf
from app.routing.astar import astar, reroute_via_nearest_door_to_stairs
from app.routing.hazard_mapper import apply_hazard_to_graph, reset_node_hazard

router = APIRouter()

# In-memory graph store (keyed by mapId)
# In production this would be persisted to MongoDB via the backend
_graphs: dict[str, dict] = {}


def _next_map_id() -> str:
    map_id = f"MAP-{uuid4().hex[:8].upper()}"
    while map_id in _graphs:
        map_id = f"MAP-{uuid4().hex[:8].upper()}"
    return map_id


# ─── Health ──────────────────────────────────────────────────────────────────

@router.get("/health")
def health():
    return {"status": "healthy", "service": "evac-ai-map"}


# ─── Demo Map ─────────────────────────────────────────────────────────────────

@router.get("/maps/demo")
def get_demo_map():
    if "DEMO-MAP-001" not in _graphs:
        demo = build_demo_graph()
        _graphs[demo["mapId"]] = copy.deepcopy(demo)
    return copy.deepcopy(_graphs["DEMO-MAP-001"])


# ─── DXF Upload ───────────────────────────────────────────────────────────────

@router.post("/maps/upload")
async def upload_dxf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Only .dxf files are supported")

    with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        parsed = parse_dxf(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        os.unlink(tmp_path)

    graph = build_graph_from_entities(parsed["entities"], parsed["bounds"])
    map_id = f"MAP-{len(_graphs) + 1:03d}"
    graph["mapId"] = map_id
    graph["isDemo"] = False
    graph["sourceType"] = "dxf"
    graph["bounds"] = parsed["bounds"]
    graph["layers"] = parsed["layers"]
    _graphs[map_id] = copy.deepcopy(graph)

    return graph


# ─── Get Map ──────────────────────────────────────────────────────────────────

@router.get("/maps/{map_id}")
def get_map(map_id: str):
    if map_id not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
    return _graphs[map_id]


class RestoreMapRequest(BaseModel):
    mapData: dict


@router.post("/maps/restore")
def restore_map(req: RestoreMapRequest):
    map_id = req.mapData.get("mapId")
    if not map_id:
        raise HTTPException(status_code=422, detail="Stored map is missing its mapId")
    _graphs[map_id] = copy.deepcopy(req.mapData)
    return _graphs[map_id]


@router.get("/maps/{map_id}/graph")
def get_graph(map_id: str):
    if map_id not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
    g = _graphs[map_id]
    return {"nodes": g["nodes"], "edges": g["edges"], "exits": g["exits"]}


# ─── Route Calculation ────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    mapId: str
    startNode: str
    algorithm: Optional[str] = "astar"


@router.post("/routes/calculate")
def calculate_route(req: RouteRequest):
    if req.mapId not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{req.mapId}' not found")

    g = _graphs[req.mapId]
    result = astar(
        nodes=g["nodes"],
        edges=g["edges"],
        start_node=req.startNode,
        exits=g["exits"],
        algorithm=req.algorithm or "astar",
    )

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return result


# ─── Hazard Update ────────────────────────────────────────────────────────────

class HazardRequest(BaseModel):
    mapId: str
    cameraId: str
    nodeId: str
    riskLevel: str  # LOW | MODERATE | HIGH | CRITICAL
    startNode: Optional[str] = None


@router.post("/routes/reroute")
def reroute(req: HazardRequest):
    if req.mapId not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{req.mapId}' not found")

    g = _graphs[req.mapId]

    # Apply hazard to graph (mutates in-place copy)
    nodes, edges = apply_hazard_to_graph(
        nodes=copy.deepcopy(g["nodes"]),
        edges=copy.deepcopy(g["edges"]),
        camera_node_id=req.nodeId,
        risk_level=req.riskLevel,
    )

    # Persist updated graph
    _graphs[req.mapId]["nodes"] = nodes
    _graphs[req.mapId]["edges"] = edges

    if not req.startNode:
        return {"message": "Hazard applied", "nodeId": req.nodeId, "riskLevel": req.riskLevel}

    # Recalculate route
    result = reroute_via_nearest_door_to_stairs(
        nodes=nodes,
        edges=edges,
        start_node=req.startNode,
        exits=g["exits"],
    )

    if "error" in result:
        return {
            "rerouted": False,
            "reason": result["error"],
            "blockedNode": req.nodeId,
        }

    result["destinationType"] = nodes[result["exitNode"]].get("type")

    return {
        **result,
        "rerouted": True,
        "blockedNode": req.nodeId,
        "reason": f"{req.riskLevel} detected at {req.nodeId} via camera {req.cameraId}",
    }


class ResetRequest(BaseModel):
    mapId: str
    nodeId: str


class ResetAllRequest(BaseModel):
    mapId: str


@router.post("/routes/reset-all")
def reset_all_hazards(req: ResetAllRequest):
    if req.mapId not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{req.mapId}' not found")

    graph = _graphs[req.mapId]
    for node in graph["nodes"].values():
        node["risk"] = "normal"
        node["blocked"] = False
    for edge in graph["edges"]:
        edge["risk"] = "normal"
        edge["blocked"] = False
        edge["cost"] = edge["distance"]

    return {"message": f"All hazards reset for map '{req.mapId}'"}


@router.post("/routes/reset-hazard")
def reset_hazard(req: ResetRequest):
    if req.mapId not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{req.mapId}' not found")

    g = _graphs[req.mapId]
    nodes, edges = reset_node_hazard(
        nodes=copy.deepcopy(g["nodes"]),
        edges=copy.deepcopy(g["edges"]),
        node_id=req.nodeId,
    )
    _graphs[req.mapId]["nodes"] = nodes
    _graphs[req.mapId]["edges"] = edges

    return {"message": f"Hazard reset for node {req.nodeId}"}


class DraftNode(BaseModel):
    id: str
    type: Literal["room", "corridor", "door", "stairs", "exit", "junction"]
    x: float
    y: float
    label: str
    capacity: int = 50


class DraftEdge(BaseModel):
    source: str
    target: str


class DraftWall(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DraftMapRequest(BaseModel):
    nodes: list[DraftNode]
    edges: list[DraftEdge]
    exits: list[str]
    cameraNodeIds: list[str] = Field(default_factory=list)
    walls: list[DraftWall] = Field(default_factory=list)
    imageData: Optional[str] = None


@router.post("/maps/draft")
def create_draft_map(req: DraftMapRequest):
    return _save_draft_map(req)


@router.put("/maps/{map_id}/draft")
def update_draft_map(map_id: str, req: DraftMapRequest):
    if map_id not in _graphs:
        raise HTTPException(status_code=404, detail=f"Map '{map_id}' not found")
    return _save_draft_map(req, map_id)


def _save_draft_map(req: DraftMapRequest, map_id: Optional[str] = None):
    if req.imageData and (
        not req.imageData.startswith("data:image/png;base64,") or len(req.imageData) > 6 * 1024 * 1024
    ):
        raise HTTPException(status_code=422, detail="Floor-plan image must be a PNG smaller than 6 MB")

    if len(req.nodes) < 2:
        raise HTTPException(status_code=422, detail="Add at least two areas to the floor plan")

    node_ids = [node.id for node in req.nodes]
    if len(set(node_ids)) != len(node_ids):
        raise HTTPException(status_code=422, detail="Node identifiers must be unique")

    nodes = {}
    for node in req.nodes:
        if not node.id.strip() or not node.label.strip():
            raise HTTPException(status_code=422, detail="Every area needs an identifier and label")
        if not (0 <= node.x <= 1200 and 0 <= node.y <= 800):
            raise HTTPException(status_code=422, detail="Area positions must be within the floor-plan canvas")
        if node.capacity < 1:
            raise HTTPException(status_code=422, detail="Area capacity must be positive")
        nodes[node.id] = {
            **node.model_dump(),
            "floor": 1,
            "blocked": False,
            "risk": "normal",
        }

    declared_exits = set(req.exits)
    graph_exits = {node_id for node_id, node in nodes.items() if node["type"] == "exit"}
    if not graph_exits or declared_exits != graph_exits:
        raise HTTPException(status_code=422, detail="Mark at least one area as an exit")
    room_ids = {node_id for node_id, node in nodes.items() if node["type"] == "room"}
    if not room_ids:
        raise HTTPException(status_code=422, detail="Mark at least one room")
    if len(set(req.cameraNodeIds)) != len(req.cameraNodeIds) or not set(req.cameraNodeIds).issubset(room_ids):
        raise HTTPException(status_code=422, detail="Cameras must be assigned to unique room areas")

    walls = []
    for wall in req.walls:
        if not all(0 <= value_x <= 1200 and 0 <= value_y <= 800 for value_x, value_y in (
            (wall.x1, wall.y1), (wall.x2, wall.y2)
        )):
            raise HTTPException(status_code=422, detail="Wall positions must be within the floor-plan canvas")
        walls.append(wall.model_dump())

    edges = []
    seen_edges = set()
    for edge in req.edges:
        if edge.source not in nodes or edge.target not in nodes:
            raise HTTPException(status_code=422, detail="Connections must reference existing areas")
        if edge.source == edge.target:
            raise HTTPException(status_code=422, detail="An area cannot connect to itself")
        if any(segments_intersect(
            (nodes[edge.source]["x"], nodes[edge.source]["y"]),
            (nodes[edge.target]["x"], nodes[edge.target]["y"]),
            (wall["x1"], wall["y1"]),
            (wall["x2"], wall["y2"]),
        ) for wall in walls):
            raise HTTPException(status_code=422, detail="A connection crosses a marked wall")
        pair = tuple(sorted((edge.source, edge.target)))
        if pair in seen_edges:
            continue
        seen_edges.add(pair)
        distance = math.hypot(
            nodes[edge.source]["x"] - nodes[edge.target]["x"],
            nodes[edge.source]["y"] - nodes[edge.target]["y"],
        )
        edges.append({
            "source": edge.source,
            "target": edge.target,
            "distance": round(distance, 2),
            "cost": round(distance, 2),
            "blocked": False,
            "risk": "normal",
        })

    if not edges:
        raise HTTPException(status_code=422, detail="Connect the areas so evacuation routes can be calculated")

    adjacency = {node_id: set() for node_id in nodes}
    for edge in edges:
        adjacency[edge["source"]].add(edge["target"])
        adjacency[edge["target"]].add(edge["source"])
    reachable = set(graph_exits)
    frontier = list(graph_exits)
    while frontier:
        current = frontier.pop()
        for neighbor in adjacency[current] - reachable:
            reachable.add(neighbor)
            frontier.append(neighbor)
    if not room_ids.issubset(reachable):
        raise HTTPException(status_code=422, detail="Connect every room to an exit")

    map_id = map_id or _next_map_id()
    graph = {
        "mapId": map_id,
        "isDemo": False,
        "sourceType": "image",
        "nodes": nodes,
        "edges": edges,
        "exits": sorted(graph_exits),
        "walls": walls,
        "imageData": req.imageData,
        "cameras": [
            {
                "cameraId": f"CAM-{node_id}",
                "nodeId": node_id,
                "name": f"{nodes[node_id]['label']} Camera",
                "floor": 1,
            }
            for node_id in req.cameraNodeIds
        ],
    }
    _graphs[map_id] = copy.deepcopy(graph)
    return graph
