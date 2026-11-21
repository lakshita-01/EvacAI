"""Tests for A* routing engine."""
import pytest
from app.routing.astar import astar, reroute_via_nearest_door_to_stairs
from app.graph.builder import build_demo_graph


@pytest.fixture
def demo():
    return build_demo_graph()


def test_normal_route(demo):
    result = astar(demo["nodes"], demo["edges"], "ROOM-A", demo["exits"])
    assert "route" in result
    assert result["route"][0] == "ROOM-A"
    assert result["route"][-1] in demo["exits"]


def test_route_reaches_exit(demo):
    result = astar(demo["nodes"], demo["edges"], "ROOM-B", demo["exits"])
    assert result["exitNode"] in demo["exits"]


def test_blocked_node_reroutes(demo):
    nodes = {k: dict(v) for k, v in demo["nodes"].items()}
    nodes["CORR-A"]["blocked"] = True
    nodes["CORR-A"]["risk"] = "critical"

    edges = [dict(e) for e in demo["edges"]]
    for edge in edges:
        if edge["source"] == "CORR-A" or edge["target"] == "CORR-A":
            edge["blocked"] = True

    result = astar(nodes, edges, "ROOM-A", demo["exits"])
    assert "route" in result
    assert "CORR-A" not in result["route"]


def test_blocked_start_can_evacuate(demo):
    nodes = {k: dict(v) for k, v in demo["nodes"].items()}
    nodes["ROOM-A"]["blocked"] = True
    nodes["ROOM-A"]["risk"] = "critical"

    edges = [dict(e) for e in demo["edges"]]
    for edge in edges:
        if edge["source"] == "ROOM-A" or edge["target"] == "ROOM-A":
            edge["blocked"] = True
            edge["risk"] = "critical"

    result = astar(nodes, edges, "ROOM-A", demo["exits"])
    assert "route" in result
    assert result["route"][0] == "ROOM-A"
    assert result["route"][-1] in demo["exits"]
    assert result["distance"] < 1000


def test_no_exit_available(demo):
    nodes = {k: dict(v) for k, v in demo["nodes"].items()}
    for exit_id in demo["exits"]:
        nodes[exit_id]["blocked"] = True

    result = astar(nodes, demo["edges"], "ROOM-A", demo["exits"])
    assert "error" in result


def test_invalid_start_node(demo):
    result = astar(demo["nodes"], demo["edges"], "NONEXISTENT", demo["exits"])
    assert "error" in result


def test_dijkstra_fallback(demo):
    result = astar(demo["nodes"], demo["edges"], "ROOM-A", demo["exits"], algorithm="dijkstra")
    assert "route" in result
    assert result["algorithm"] == "dijkstra"


def test_risk_weighted_route(demo):
    nodes = {k: dict(v) for k, v in demo["nodes"].items()}
    edges = [dict(e) for e in demo["edges"]]

    # Make CORR-A high risk (not blocked, just expensive)
    nodes["CORR-A"]["risk"] = "high"
    for edge in edges:
        if edge["source"] == "CORR-A" or edge["target"] == "CORR-A":
            edge["risk"] = "high"
            edge["cost"] = edge["distance"] * 5.0

    result = astar(nodes, edges, "ROOM-A", demo["exits"])
    assert "route" in result
    # Route should still find an exit, possibly avoiding CORR-A
    assert result["exitNode"] in demo["exits"]


def test_reroute_uses_nearest_door_and_ends_at_stairs():
    nodes = {
        "ROOM": {"id": "ROOM", "type": "room", "x": 0, "y": 0},
        "DOOR-1": {"id": "DOOR-1", "type": "door", "x": 10, "y": 0},
        "DOOR-2": {"id": "DOOR-2", "type": "door", "x": 20, "y": 0},
        "STAIRS": {"id": "STAIRS", "type": "stairs", "x": 40, "y": 0},
        "EXIT": {"id": "EXIT", "type": "exit", "x": 50, "y": 0},
    }
    edges = [
        {"source": "ROOM", "target": "DOOR-1", "distance": 10},
        {"source": "ROOM", "target": "DOOR-2", "distance": 20},
        {"source": "DOOR-1", "target": "STAIRS", "distance": 30},
        {"source": "DOOR-2", "target": "STAIRS", "distance": 5},
        {"source": "STAIRS", "target": "EXIT", "distance": 10},
    ]

    result = reroute_via_nearest_door_to_stairs(nodes, edges, "ROOM", ["EXIT"])

    assert result["route"] == ["ROOM", "DOOR-1", "STAIRS"]
    assert result["exitNode"] == "STAIRS"


def test_reroute_falls_back_to_exit_when_map_has_no_stairs():
    nodes = {
        "ROOM": {"id": "ROOM", "type": "room", "x": 0, "y": 0},
        "EXIT": {"id": "EXIT", "type": "exit", "x": 10, "y": 0},
    }
    edges = [{"source": "ROOM", "target": "EXIT", "distance": 10}]

    result = reroute_via_nearest_door_to_stairs(nodes, edges, "ROOM", ["EXIT"])

    assert result["route"] == ["ROOM", "EXIT"]
    assert result["exitNode"] == "EXIT"


def test_reroute_falls_back_to_exit_when_stairs_are_unreachable():
    nodes = {
        "ROOM": {"id": "ROOM", "type": "room", "x": 0, "y": 0},
        "DOOR": {"id": "DOOR", "type": "door", "x": 10, "y": 0},
        "STAIRS": {"id": "STAIRS", "type": "stairs", "x": 20, "y": 0, "blocked": True},
        "EXIT": {"id": "EXIT", "type": "exit", "x": 30, "y": 0},
    }
    edges = [
        {"source": "ROOM", "target": "DOOR", "distance": 10},
        {"source": "DOOR", "target": "STAIRS", "distance": 10},
        {"source": "ROOM", "target": "EXIT", "distance": 30},
    ]

    result = reroute_via_nearest_door_to_stairs(nodes, edges, "ROOM", ["EXIT"])

    assert result["route"] == ["ROOM", "EXIT"]
    assert result["exitNode"] == "EXIT"
