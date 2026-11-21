"""Tests for user-reviewed floor-plan drafts."""
from fastapi.testclient import TestClient
import ezdxf

from app.main import app


client = TestClient(app)


def draft_payload():
    return {
        "nodes": [
            {"id": "ROOM-1", "type": "room", "x": 100, "y": 120, "label": "Room 1"},
            {"id": "EXIT-1", "type": "exit", "x": 500, "y": 120, "label": "Exit 1"},
        ],
        "edges": [{"source": "ROOM-1", "target": "EXIT-1"}],
        "exits": ["EXIT-1"],
    }


def test_create_draft_map_builds_route_graph():
    payload = draft_payload()
    payload["imageData"] = "data:image/png;base64,AAAA"
    payload["walls"] = [{"x1": 0, "y1": 700, "x2": 1200, "y2": 700}]
    response = client.post("/api/maps/draft", json=payload)

    assert response.status_code == 200
    graph = response.json()
    assert graph["sourceType"] == "image"
    assert graph["imageData"] == "data:image/png;base64,AAAA"
    assert len(graph["walls"]) == 1
    assert graph["exits"] == ["EXIT-1"]
    assert graph["edges"][0]["distance"] == 400
    assert graph["nodes"]["ROOM-1"]["risk"] == "normal"


def test_create_draft_map_requires_exit_and_connection():
    payload = draft_payload()
    payload["exits"] = []

    response = client.post("/api/maps/draft", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == "Mark at least one area as an exit"

    payload = draft_payload()
    payload["edges"] = []
    response = client.post("/api/maps/draft", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == "Connect the areas so evacuation routes can be calculated"

    payload = draft_payload()
    payload["nodes"].append(
        {"id": "ROOM-2", "type": "room", "x": 300, "y": 120, "label": "Room 2"}
    )
    response = client.post("/api/maps/draft", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == "Connect every room to an exit"

    payload = draft_payload()
    payload["walls"] = [{"x1": 300, "y1": 0, "x2": 300, "y2": 200}]
    response = client.post("/api/maps/draft", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == "A connection crosses a marked wall"

    payload = draft_payload()
    payload["imageData"] = "data:image/jpeg;base64,AAAA"
    response = client.post("/api/maps/draft", json=payload)

    assert response.status_code == 422
    assert response.json()["detail"] == "Floor-plan image must be a PNG smaller than 6 MB"


def test_reset_all_hazards_clears_nodes_and_edges():
    graph = client.post("/api/maps/draft", json=draft_payload()).json()
    map_id = graph["mapId"]

    hazard_response = client.post(
        "/api/routes/reroute",
        json={
            "mapId": map_id,
            "cameraId": "USER",
            "nodeId": "ROOM-1",
            "riskLevel": "HIGH",
            "startNode": "ROOM-1",
        },
    )
    assert hazard_response.status_code == 200

    reset_response = client.post("/api/routes/reset-all", json={"mapId": map_id})
    assert reset_response.status_code == 200

    updated = client.get(f"/api/maps/{map_id}").json()
    assert updated["nodes"]["ROOM-1"]["risk"] == "normal"
    assert updated["edges"][0]["risk"] == "normal"
    assert updated["edges"][0]["blocked"] is False


def test_reroute_uses_nearest_door_and_ends_at_stairs():
    payload = {
        "nodes": [
            {"id": "ROOM-1", "type": "room", "x": 100, "y": 120, "label": "Room 1"},
            {"id": "DOOR-1", "type": "door", "x": 200, "y": 120, "label": "Door 1"},
            {"id": "CORRIDOR-1", "type": "corridor", "x": 300, "y": 120, "label": "Corridor 1"},
            {"id": "STAIRS-1", "type": "stairs", "x": 400, "y": 120, "label": "Stairs 1"},
            {"id": "EXIT-1", "type": "exit", "x": 500, "y": 120, "label": "Exit 1"},
        ],
        "edges": [
            {"source": "ROOM-1", "target": "DOOR-1"},
            {"source": "DOOR-1", "target": "CORRIDOR-1"},
            {"source": "CORRIDOR-1", "target": "STAIRS-1"},
            {"source": "STAIRS-1", "target": "EXIT-1"},
        ],
        "exits": ["EXIT-1"],
    }
    graph = client.post("/api/maps/draft", json=payload).json()

    response = client.post(
        "/api/routes/reroute",
        json={
            "mapId": graph["mapId"],
            "cameraId": "USER",
            "nodeId": "ROOM-1",
            "riskLevel": "CRITICAL",
            "startNode": "ROOM-1",
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["route"] == ["ROOM-1", "DOOR-1", "CORRIDOR-1", "STAIRS-1"]
    assert result["exitNode"] == "STAIRS-1"
    assert result["destinationType"] == "stairs"


def test_upload_dxf_builds_a_map_and_preserves_walls(tmp_path):
    document = ezdxf.new()
    document.layers.new("ROOM")
    document.layers.new("EXIT")
    document.layers.new("WALL")
    modelspace = document.modelspace()
    modelspace.add_lwpolyline(
        [(99.5, 49), (100.5, 49), (100.5, 51), (99.5, 51)],
        close=True,
        dxfattribs={"layer": "ROOM"},
    )
    modelspace.add_lwpolyline(
        [(99.6, 49), (100.6, 49), (100.6, 51), (99.6, 51)],
        close=True,
        dxfattribs={"layer": "EXIT"},
    )
    modelspace.add_line((100.05, 0), (100.05, 100), dxfattribs={"layer": "WALL"})
    dxf_path = tmp_path / "floor-plan.dxf"
    document.saveas(dxf_path)

    response = client.post(
        "/api/maps/upload",
        files={"file": ("floor-plan.dxf", dxf_path.read_bytes(), "application/dxf")},
    )

    assert response.status_code == 200
    graph = response.json()
    assert graph["sourceType"] == "dxf"
    assert len(graph["nodes"]) == 2
    assert len(graph["walls"]) == 1
    assert graph["edges"] == []
