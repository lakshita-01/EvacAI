"""
Generate a minimal demo DXF floor plan for testing the CAD parser.
Run: python generate_demo_dxf.py
Output: demo_floor_plan.dxf
"""
import ezdxf


def generate():
    doc = ezdxf.new(dxfversion="R2010")
    msp = doc.modelspace()

    # Define layers
    for layer in ["WALLS", "ROOM", "CORRIDOR", "EXIT", "DOOR", "STAIR"]:
        doc.layers.add(layer)

    # Walls (outer boundary)
    walls = [(0,0,800,0), (800,0,800,600), (800,600,0,600), (0,600,0,0)]
    for x1,y1,x2,y2 in walls:
        msp.add_line((x1,y1), (x2,y2), dxfattribs={"layer": "WALLS"})

    # Room A (bottom-left)
    msp.add_lwpolyline(
        [(50,50),(250,50),(250,250),(50,250),(50,50)],
        dxfattribs={"layer": "ROOM", "closed": True}
    )
    msp.add_text("Room A", dxfattribs={"layer": "ROOM", "insert": (120, 140), "height": 15})

    # Room B (bottom-right)
    msp.add_lwpolyline(
        [(550,50),(750,50),(750,250),(550,250),(550,50)],
        dxfattribs={"layer": "ROOM", "closed": True}
    )
    msp.add_text("Room B", dxfattribs={"layer": "ROOM", "insert": (620, 140), "height": 15})

    # Corridor (center horizontal)
    msp.add_lwpolyline(
        [(250,200),(550,200),(550,300),(250,300),(250,200)],
        dxfattribs={"layer": "CORRIDOR", "closed": True}
    )
    msp.add_text("Corridor", dxfattribs={"layer": "CORRIDOR", "insert": (360, 245), "height": 12})

    # Staircase
    msp.add_lwpolyline(
        [(350,350),(450,350),(450,450),(350,450),(350,350)],
        dxfattribs={"layer": "STAIR", "closed": True}
    )
    msp.add_text("Stair", dxfattribs={"layer": "STAIR", "insert": (370, 395), "height": 12})

    # Exit A (top-left)
    msp.add_lwpolyline(
        [(50,500),(150,500),(150,580),(50,580),(50,500)],
        dxfattribs={"layer": "EXIT", "closed": True}
    )
    msp.add_text("Exit A", dxfattribs={"layer": "EXIT", "insert": (70, 535), "height": 12})

    # Exit B (top-right)
    msp.add_lwpolyline(
        [(650,500),(750,500),(750,580),(650,580),(650,500)],
        dxfattribs={"layer": "EXIT", "closed": True}
    )
    msp.add_text("Exit B", dxfattribs={"layer": "EXIT", "insert": (670, 535), "height": 12})

    # Doors
    msp.add_line((250, 220), (250, 280), dxfattribs={"layer": "DOOR"})
    msp.add_line((550, 220), (550, 280), dxfattribs={"layer": "DOOR"})

    doc.saveas("demo_floor_plan.dxf")
    print("Saved: demo_floor_plan.dxf")


if __name__ == "__main__":
    generate()
