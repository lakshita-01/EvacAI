"""
A* evacuation route planner.

f(n) = g(n) + h(n)
  g(n) = accumulated cost from start
  h(n) = Euclidean distance heuristic to nearest exit

Supports:
  - blocked nodes
  - blocked edges
  - risk-adjusted edge costs
  - multiple exits (selects safest reachable)
  - Dijkstra fallback (h=0)
"""
import heapq
import math
from app.config import EDGE_COST_MULTIPLIERS


def _euclidean(x1, y1, x2, y2) -> float:
    return math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)


def _effective_cost(base_cost: float, risk: str) -> float:
    multiplier = EDGE_COST_MULTIPLIERS.get(risk, 1.0)
    if multiplier == float("inf"):
        return float("inf")
    return base_cost * multiplier


def _build_adjacency(nodes: dict, edges: list[dict]) -> dict[str, list[tuple]]:
    """Build adjacency list: node_id → [(neighbor_id, cost, blocked, base_cost)]"""
    adj: dict[str, list] = {nid: [] for nid in nodes}
    for edge in edges:
        s, t = edge["source"], edge["target"]
        cost = _effective_cost(edge["distance"], edge.get("risk", "normal"))
        blocked = edge.get("blocked", False)
        if s in adj:
            adj[s].append((t, cost, blocked, edge["distance"]))
        if t in adj:
            adj[t].append((s, cost, blocked, edge["distance"]))
    return adj


def astar(
    nodes: dict,
    edges: list[dict],
    start_node: str,
    exits: list[str],
    algorithm: str = "astar",
) -> dict:
    """
    Run A* (or Dijkstra) from start_node to the best reachable exit.

    Returns route result dict.
    """
    if start_node not in nodes:
        return {"error": f"Start node '{start_node}' not found in graph"}

    available_exits = [e for e in exits if e in nodes and not nodes[e].get("blocked", False)]
    if not available_exits:
        return {"error": "No reachable exits available", "blockedNodes": exits}

    adj = _build_adjacency(nodes, edges)

    best_result = None
    best_cost = float("inf")

    for exit_node in available_exits:
        result = _run_astar(nodes, adj, start_node, exit_node, algorithm)
        if result and result.get("distance", float("inf")) < best_cost:
            best_cost = result["distance"]
            best_result = result

    if best_result is None:
        return {
            "error": "No route found to any exit",
            "startNode": start_node,
            "blockedNodes": [nid for nid, n in nodes.items() if n.get("blocked")],
        }

    return best_result


def reroute_via_nearest_door_to_stairs(
    nodes: dict,
    edges: list[dict],
    start_node: str,
    exits: list[str],
    algorithm: str = "astar",
) -> dict:
    """Route from the evacuation origin through its nearest usable door to stairs."""
    stair_nodes = [node_id for node_id, node in nodes.items() if node.get("type") == "stairs"]
    if not stair_nodes:
        return astar(nodes, edges, start_node, exits, algorithm)

    doors = [node_id for node_id, node in nodes.items() if node.get("type") == "door"]
    door_routes = []
    for door_id in doors:
        to_door = astar(nodes, edges, start_node, [door_id], algorithm)
        if "route" not in to_door:
            continue

        to_stairs = astar(nodes, edges, door_id, stair_nodes, algorithm)
        if "route" not in to_stairs:
            continue

        door_routes.append((to_door, to_stairs))

    if door_routes:
        to_door, to_stairs = min(
            door_routes,
            key=lambda paths: (
                paths[0]["distance"],
                paths[0]["distance"] + paths[1]["distance"],
                paths[0]["exitNode"],
                paths[1]["exitNode"],
            ),
        )
        risk_order = {"normal": 0, "moderate": 1, "high": 2, "critical": 3}
        risk = max(
            (to_door["risk"], to_stairs["risk"]),
            key=lambda level: risk_order.get(level, 0),
        )
        return {
            **to_stairs,
            "startNode": start_node,
            "route": to_door["route"] + to_stairs["route"][1:],
            "distance": round(to_door["distance"] + to_stairs["distance"], 2),
            "risk": risk,
        }

    stair_route = astar(nodes, edges, start_node, stair_nodes, algorithm)
    if "route" in stair_route:
        return stair_route

    return astar(nodes, edges, start_node, exits, algorithm)


def _run_astar(nodes: dict, adj: dict, start: str, goal: str, algorithm: str) -> dict | None:
    """Single-target A* search."""
    open_heap = []
    g_cost = {start: 0.0}
    came_from = {}

    def h(node_id: str) -> float:
        if algorithm == "dijkstra":
            return 0.0
        n = nodes[node_id]
        g = nodes[goal]
        return _euclidean(n["x"], n["y"], g["x"], g["y"])

    heapq.heappush(open_heap, (h(start), 0.0, start))

    while open_heap:
        f, g, current = heapq.heappop(open_heap)

        if current == goal:
            # Reconstruct path
            path = []
            node = current
            while node in came_from:
                path.append(node)
                node = came_from[node]
            path.append(start)
            path.reverse()

            # Determine overall risk
            risk_levels = [nodes[n].get("risk", "normal") for n in path]
            overall_risk = "normal"
            for r in ["critical", "high", "moderate"]:
                if r in risk_levels:
                    overall_risk = r
                    break

            return {
                "startNode": start,
                "exitNode": goal,
                "route": path,
                "distance": round(g, 2),
                "risk": overall_risk,
                "algorithm": algorithm,
            }

        if g > g_cost.get(current, float("inf")):
            continue

        if nodes.get(current, {}).get("blocked") and current != start:
            continue

        for neighbor, edge_cost, edge_blocked, base_cost in adj.get(current, []):
            if edge_blocked and current != start:
                continue
            if nodes.get(neighbor, {}).get("blocked"):
                continue
            if edge_cost == float("inf"):
                continue

            if edge_blocked:
                edge_cost = base_cost
            new_g = g + edge_cost
            if new_g < g_cost.get(neighbor, float("inf")):
                g_cost[neighbor] = new_g
                came_from[neighbor] = current
                f_new = new_g + h(neighbor)
                heapq.heappush(open_heap, (f_new, new_g, neighbor))

    return None  # No path found
