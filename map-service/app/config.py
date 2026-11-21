from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Coordinate system
CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 800

# Route cost multipliers per risk level
EDGE_COST_MULTIPLIERS = {
    "normal": 1.0,
    "moderate": 2.0,
    "high": 5.0,
    "critical": 1_000_000_000.0,
}

# Demo map flag
DEMO_MAP_ID = "DEMO-MAP-001"
