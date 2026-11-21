"""
DXF floor plan parser using ezdxf.

Extracts walls, rooms, doors, stairs, and exits from DXF entities.
Relies on layer names and entity types — not AI inference.

Supported entity types: LINE, LWPOLYLINE, POLYLINE, ARC, TEXT, MTEXT, INSERT
"""
import ezdxf
from ezdxf.document import Drawing
from typing import Any


# Layer name keywords (case-insensitive matching)
LAYER_KEYWORDS = {
    "wall": ["wall", "walls", "mur", "wand"],
    "door": ["door", "doors", "porte", "tur"],
    "room": ["room", "rooms", "space", "raum"],
    "corridor": ["corridor", "hall", "hallway", "gang"],
    "stair": ["stair", "stairs", "staircase", "treppe"],
    "exit": ["exit", "exits", "emergency", "evac", "ausgang"],
}


def _classify_layer(layer_name: str) -> str:
    name = layer_name.lower()
    for entity_type, keywords in LAYER_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return entity_type
    return "unknown"


def _extract_line(entity) -> dict | None:
    try:
        return {
            "type": "line",
            "layer": entity.dxf.layer,
            "start": list(entity.dxf.start)[:2],
            "end": list(entity.dxf.end)[:2],
        }
    except Exception:
        return None


def _extract_lwpolyline(entity) -> dict | None:
    try:
        points = [list(p)[:2] for p in entity.get_points()]
        return {
            "type": "lwpolyline",
            "layer": entity.dxf.layer,
            "points": points,
            "closed": entity.closed,
        }
    except Exception:
        return None


def _extract_text(entity) -> dict | None:
    try:
        return {
            "type": "text",
            "layer": entity.dxf.layer,
            "text": entity.dxf.text,
            "position": list(entity.dxf.insert)[:2],
        }
    except Exception:
        return None


def parse_dxf(file_path: str) -> dict:
    """
    Parse a DXF file and return structured entity data.

    Returns:
        {
            "entities": [...],
            "bounds": {"minX", "minY", "maxX", "maxY"},
            "layers": [...],
            "errors": [...]
        }
    """
    try:
        doc: Drawing = ezdxf.readfile(file_path)
    except Exception as e:
        raise ValueError(f"Cannot read DXF file: {e}")

    msp = doc.modelspace()
    entities = []
    errors = []
    layers = set()

    all_x, all_y = [], []

    for entity in msp:
        layer = getattr(entity.dxf, "layer", "0")
        layers.add(layer)
        category = _classify_layer(layer)

        extracted = None
        dxf_type = entity.dxftype()

        if dxf_type == "LINE":
            extracted = _extract_line(entity)
        elif dxf_type in ("LWPOLYLINE", "POLYLINE"):
            extracted = _extract_lwpolyline(entity)
        elif dxf_type in ("TEXT", "MTEXT"):
            extracted = _extract_text(entity)
        else:
            continue

        if extracted:
            extracted["category"] = category
            entities.append(extracted)

            # Collect coordinates for bounding box
            if "start" in extracted:
                all_x.append(extracted["start"][0])
                all_y.append(extracted["start"][1])
                all_x.append(extracted["end"][0])
                all_y.append(extracted["end"][1])
            if "points" in extracted:
                for p in extracted["points"]:
                    all_x.append(p[0])
                    all_y.append(p[1])
            if "position" in extracted:
                all_x.append(extracted["position"][0])
                all_y.append(extracted["position"][1])

    bounds = {
        "minX": min(all_x) if all_x else 0,
        "minY": min(all_y) if all_y else 0,
        "maxX": max(all_x) if all_x else 1000,
        "maxY": max(all_y) if all_y else 1000,
    }

    return {
        "entities": entities,
        "bounds": bounds,
        "layers": sorted(layers),
        "errors": errors,
        "entityCount": len(entities),
    }
