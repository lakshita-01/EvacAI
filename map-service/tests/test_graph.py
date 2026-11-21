"""Tests for demo graph builder."""
import pytest
from app.graph.builder import build_demo_graph, build_graph_from_entities


def test_demo_graph_has_nodes():
    g = build_demo_graph()
    assert len(g["nodes"]) > 0


def test_demo_graph_has_exits():
    g = build_demo_graph()
    assert len(g["exits"]) >= 2


def test_demo_graph_exits_are_nodes():
    g = build_demo_graph()
    for exit_id in g["exits"]:
        assert exit_id in g["nodes"]
        assert g["nodes"][exit_id]["type"] == "exit"


def test_demo_graph_edges_reference_valid_nodes():
    g = build_demo_graph()
    node_ids = set(g["nodes"].keys())
    for edge in g["edges"]:
        assert edge["source"] in node_ids
        assert edge["target"] in node_ids


def test_demo_graph_is_flagged():
    g = build_demo_graph()
    assert g["isDemo"] is True


def test_dxf_walls_are_preserved_and_prevent_crossing_connections():
    bounds = {"minX": 0, "minY": 0, "maxX": 1000, "maxY": 1000}
    entities = [
        {
            "type": "lwpolyline",
            "category": "room",
            "points": [[90, 40], [110, 40], [110, 60], [90, 60]],
        },
        {
            "type": "lwpolyline",
            "category": "exit",
            "points": [[190, 40], [210, 40], [210, 60], [190, 60]],
        },
        {"type": "line", "category": "wall", "start": [150, 0], "end": [150, 100]},
    ]

    graph = build_graph_from_entities(entities, bounds)

    assert len(graph["walls"]) == 1
    assert graph["edges"] == []
