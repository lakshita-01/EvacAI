"""
Webcam Streamer — captures frames from laptop webcam and sends to backend.
Usage:
    python webcam_streamer.py --camera-id CAM-01 --interval 1.5
"""
import argparse
import time
import io
import sys
import requests
import cv2
from PIL import Image

BACKEND_URL = "http://localhost:3001"

CAMERA_MAP = {
    "CAM-01": {"nodeId": "CORR-A",   "roomCapacity": 50},
    "CAM-02": {"nodeId": "ROOM-A",   "roomCapacity": 30},
    "CAM-03": {"nodeId": "ROOM-B",   "roomCapacity": 30},
    "CAM-04": {"nodeId": "JUNCTION", "roomCapacity": 40},
}


def frame_to_jpeg_bytes(frame) -> bytes:
    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def send_frame(camera_id: str, jpeg_bytes: bytes, room_capacity: int):
    try:
        resp = requests.post(
            f"{BACKEND_URL}/api/analysis/live",
            files={"file": ("frame.jpg", jpeg_bytes, "image/jpeg")},
            data={"camera_id": camera_id, "room_capacity": str(room_capacity)},
            timeout=10,
        )
        data = resp.json()
        risk = data.get("risk", {}).get("level", "?")
        fire = data.get("fireSmoke", {}).get("fireDetected", False)
        smoke = data.get("fireSmoke", {}).get("smokeDetected", False)
        people = data.get("people", {}).get("count", 0)
        print(f"[{camera_id}] people={people} fire={fire} smoke={smoke} risk={risk}")
    except Exception as e:
        print(f"[{camera_id}] send error: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--camera-id", default="CAM-01", choices=list(CAMERA_MAP.keys()))
    parser.add_argument("--interval", type=float, default=1.5, help="Seconds between frames")
    parser.add_argument("--device", type=int, default=0, help="Webcam device index")
    args = parser.parse_args()

    cam_cfg = CAMERA_MAP[args.camera_id]
    cap = cv2.VideoCapture(args.device)
    if not cap.isOpened():
        print("ERROR: Cannot open webcam")
        sys.exit(1)

    print(f"Streaming webcam as {args.camera_id} → node {cam_cfg['nodeId']} (Ctrl+C to stop)")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("WARNING: Failed to grab frame, retrying...")
                time.sleep(1)
                continue

            jpeg = frame_to_jpeg_bytes(frame)
            send_frame(args.camera_id, jpeg, cam_cfg["roomCapacity"])
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        cap.release()


if __name__ == "__main__":
    main()
