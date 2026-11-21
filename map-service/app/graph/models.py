"""
Graph node and edge data models.
"""
from dataclasses import dataclass, field
from typing import Literal


NodeType = Literal["room", "corridor", "door", "stairs", "exit", "junction"]
RiskLevel = Literal["normal", "moderate", "high", "critical"]


@dataclass
class GraphNode:
    id: str
    type: NodeType
    x: float
    y: float
    label: str = ""
    floor: int = 1
    blocked: bool = False
    risk: RiskLevel = "normal"
    capacity: int = 50

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "x": self.x,
            "y": self.y,
            "label": self.label,
            "floor": self.floor,
            "blocked": self.blocked,
            "risk": self.risk,
            "capacity": self.capacity,
        }


@dataclass
class GraphEdge:
    source: str
    target: str
    distance: float
    cost: float = 0.0
    blocked: bool = False
    risk: RiskLevel = "normal"

    def __post_init__(self):
        if self.cost == 0.0:
            self.cost = self.distance

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "target": self.target,
            "distance": round(self.distance, 2),
            "cost": round(self.cost, 2),
            "blocked": self.blocked,
            "risk": self.risk,
        }
