"""
Hazard mapper: bridges AI detection results to graph node risk updates.

When a camera detects fire/smoke, this module:
  1. Finds the graph node associated with the camera
  2. Updates node risk level
  3. Blocks node if risk is CRITICAL
  4. Adjusts edge costs for adjacent edges
"""
from app.config import EDGE_COST_MULTIPLIERS


def apply_hazard_to_graph(
    nodes: dict,
    edges: list[dict],
    camera_node_id: str,
    risk_level: str,
) -> tuple[dict, list[dict]]:
    """
    Apply hazard from AI detection to the graph.

    risk_level: LOW | MODERATE | HIGH | CRITICAL

    Returns updated (nodes, edges).
    """
    risk_map = {
        "LOW": "normal",
        "MODERATE": "moderate",
        "HIGH": "high",
        "CRITICAL": "critical",
    }
    graph_risk = risk_map.get(risk_level.upper(), "normal")

    # Update node
    if camera_node_id in nodes:
        nodes[camera_node_id]["risk"] = graph_risk
        nodes[camera_node_id]["blocked"] = graph_risk == "critical"

    # Update adjacent edges
    for edge in edges:
        if edge["source"] == camera_node_id or edge["target"] == camera_node_id:
            edge["risk"] = graph_risk
            edge["blocked"] = graph_risk == "critical"
            multiplier = EDGE_COST_MULTIPLIERS.get(graph_risk, 1.0)
            edge["cost"] = edge["distance"] * multiplier

    return nodes, edges


def reset_node_hazard(nodes: dict, edges: list[dict], node_id: str) -> tuple[dict, list[dict]]:
    """Reset a node and its edges to normal risk."""
    if node_id in nodes:
        nodes[node_id]["risk"] = "normal"
        nodes[node_id]["blocked"] = False

    for edge in edges:
        if edge["source"] == node_id or edge["target"] == node_id:
            edge["risk"] = "normal"
            edge["blocked"] = False
            edge["cost"] = edge["distance"]

    return nodes, edges
