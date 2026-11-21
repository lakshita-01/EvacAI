"""
Building graph builder.

Converts parsed DXF entities into a navigation graph.
Also provides the DEMO MAP for development/testing without a real DXF file.
"""
import math
from app.graph.models import GraphNode, GraphEdge
from app.config import EDGE_COST_MULTIPLIERS


def _distance(n1: GraphNode, n2: GraphNode) -> float:
    return math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2)


def segments_intersect(a: tuple[float, float], b: tuple[float, float],
                       c: tuple[float, float], d: tuple[float, float]) -> bool:
    def orientation(p, q, r):
        return (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])

    return (
        orientation(a, b, c) * orientation(a, b, d) < 0 and
        orientation(c, d, a) * orientation(c, d, b) < 0
    )


def build_graph_from_entities(entities: list[dict], bounds: dict) -> dict:
    """
    Build a navigation graph from parsed DXF entities.
    Rooms/exits/doors are identified by layer category.
    Nodes are connected if they are spatially adjacent.
    """
    from app.parsers.coords import cad_to_canvas

    nodes: dict[str, GraphNode] = {}
    edges: list[GraphEdge] = []
    walls: list[dict] = []
    node_counter = 1

    for entity in entities:
        category = entity.get("category", "unknown")
        if category == "wall":
            if entity["type"] == "line":
                wall_points = [entity["start"], entity["end"]]
            elif entity["type"] == "lwpolyline" and entity.get("points"):
                wall_points = entity["points"]
                if entity.get("closed"):
                    wall_points = [*wall_points, wall_points[0]]
            else:
                continue
            for start, end in zip(wall_points, wall_points[1:]):
                x1, y1 = cad_to_canvas(start[0], start[1], bounds)
                x2, y2 = cad_to_canvas(end[0], end[1], bounds)
                walls.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
            continue

        if category not in ("room", "corridor", "door", "stair", "exit"):
            continue

        # Use centroid of polyline or midpoint of line as node position
        if entity["type"] == "lwpolyline" and entity.get("points"):
            pts = entity["points"]
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
        elif entity["type"] == "line":
            cx = (entity["start"][0] + entity["end"][0]) / 2
            cy = (entity["start"][1] + entity["end"][1]) / 2
        else:
            continue

        cx_canvas, cy_canvas = cad_to_canvas(cx, cy, bounds)
        node_id = f"N{node_counter:02d}"
        node_type = "exit" if category == "exit" else category
        label = entity.get("text", node_id)

        nodes[node_id] = GraphNode(
            id=node_id,
            type=node_type,
            x=cx_canvas,
            y=cy_canvas,
            label=label,
        )
        node_counter += 1

    # Connect nodes that are within proximity threshold
    node_list = list(nodes.values())
    PROXIMITY = 150  # canvas pixels

    for i, n1 in enumerate(node_list):
        for n2 in node_list[i + 1:]:
            d = _distance(n1, n2)
            wall_crossed = any(segments_intersect(
                (n1.x, n1.y),
                (n2.x, n2.y),
                (wall["x1"], wall["y1"]),
                (wall["x2"], wall["y2"]),
            ) for wall in walls)
            if d <= PROXIMITY and not wall_crossed:
                edge = GraphEdge(source=n1.id, target=n2.id, distance=d)
                edges.append(edge)

    return {
        "nodes": {nid: n.to_dict() for nid, n in nodes.items()},
        "edges": [e.to_dict() for e in edges],
        "exits": [nid for nid, n in nodes.items() if n.type == "exit"],
        "walls": walls,
    }


def build_demo_graph() -> dict:
    """
    DEMO MAP — synthetic building for development and demonstration.
    Clearly labelled as demo data, not real CAD geometry.

    Layout:
        Room A ──── Corridor A ──── Junction ──── Exit A
                                        │
                    Room B ──── Corridor B ──── Exit B
                                        │
                                    Staircase
    """
    nodes = {
        "ROOM-A":    GraphNode("ROOM-A",    "room",     x=100,  y=400, label="Room A",     capacity=30),
        "ROOM-B":    GraphNode("ROOM-B",    "room",     x=100,  y=600, label="Room B",     capacity=25),
        "CORR-A":    GraphNode("CORR-A",    "corridor", x=300,  y=400, label="Corridor A", capacity=20),
        "CORR-B":    GraphNode("CORR-B",    "corridor", x=300,  y=600, label="Corridor B", capacity=20),
        "JUNCTION":  GraphNode("JUNCTION",  "junction", x=500,  y=400, label="Junction",   capacity=15),
        "STAIR":     GraphNode("STAIR",     "stairs",   x=500,  y=600, label="Staircase",  capacity=10),
        "EXIT-A":    GraphNode("EXIT-A",    "exit",     x=700,  y=300, label="Exit A",     capacity=100),
        "EXIT-B":    GraphNode("EXIT-B",    "exit",     x=700,  y=600, label="Exit B",     capacity=100),
    }

    raw_edges = [
        ("ROOM-A",   "CORR-A",   200),
        ("ROOM-A",   "JUNCTION", 420),  # alternative path bypassing CORR-A
        ("ROOM-B",   "CORR-B",   200),
        ("CORR-A",   "JUNCTION", 200),
        ("CORR-B",   "JUNCTION", 250),
        ("CORR-B",   "STAIR",    150),
        ("JUNCTION", "EXIT-A",   220),
        ("JUNCTION", "EXIT-B",   250),
        ("STAIR",    "EXIT-B",   180),
    ]

    edges = [GraphEdge(source=s, target=t, distance=d) for s, t, d in raw_edges]

    return {
        "mapId": "DEMO-MAP-001",
        "isDemo": True,
        "nodes": {nid: n.to_dict() for nid, n in nodes.items()},
        "edges": [e.to_dict() for e in edges],
        "exits": ["EXIT-A", "EXIT-B"],
        "cameras": [
            {"cameraId": "CAM-01", "nodeId": "CORR-A",  "name": "Corridor A Camera", "floor": 1},
            {"cameraId": "CAM-02", "nodeId": "ROOM-A",  "name": "Room A Camera",     "floor": 1},
            {"cameraId": "CAM-03", "nodeId": "ROOM-B",  "name": "Room B Camera",     "floor": 1},
            {"cameraId": "CAM-04", "nodeId": "JUNCTION","name": "Junction Camera",   "floor": 1},
        ],
    }
