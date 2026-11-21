"""
Coordinate normalization utilities.

Converts CAD coordinates → normalized [0,1] → canvas pixel coordinates.
"""
from app.config import CANVAS_WIDTH, CANVAS_HEIGHT


def normalize_coords(x: float, y: float, bounds: dict) -> tuple[float, float]:
    """CAD coordinate → normalized [0,1] space."""
    w = bounds["maxX"] - bounds["minX"] or 1
    h = bounds["maxY"] - bounds["minY"] or 1
    nx = (x - bounds["minX"]) / w
    ny = (y - bounds["minY"]) / h
    return nx, ny


def to_canvas(nx: float, ny: float, width: int = CANVAS_WIDTH, height: int = CANVAS_HEIGHT) -> tuple[float, float]:
    """Normalized [0,1] → canvas pixel coordinates. Y is flipped (CAD origin bottom-left)."""
    return round(nx * width, 2), round((1 - ny) * height, 2)


def cad_to_canvas(x: float, y: float, bounds: dict) -> tuple[float, float]:
    """Direct CAD → canvas pixel conversion."""
    nx, ny = normalize_coords(x, y, bounds)
    return to_canvas(nx, ny)


def camera_to_map(camera_x: float, camera_y: float, bounds: dict) -> tuple[float, float]:
    """
    Camera image coordinate → map coordinate.
    Currently a passthrough — requires calibration for real deployment.
    """
    return cad_to_canvas(camera_x, camera_y, bounds)
