"""
Crowd density calculation.

Thresholds are configurable academic heuristics, not certified safety standards.
  0–40%  capacity → LOW
  40–70%           → MEDIUM
  70–100%          → HIGH
  >100%            → CRITICAL
"""


def calculate_density(people_count: int, room_capacity: int) -> dict:
    if room_capacity <= 0:
        return {"density": 0.0, "densityPercent": 0.0, "densityLevel": "UNKNOWN"}

    density = people_count / room_capacity
    percent = round(density * 100, 2)

    if density < 0.40:
        level = "LOW"
    elif density < 0.70:
        level = "MEDIUM"
    elif density <= 1.00:
        level = "HIGH"
    else:
        level = "CRITICAL"

    return {"density": round(density, 4), "densityPercent": percent, "densityLevel": level}
