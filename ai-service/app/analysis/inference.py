import gradio as gr
import spaces

from app.analysis.analyzer import EvacuationAnalyzer

_analyzer = EvacuationAnalyzer()


@spaces.GPU(duration=60)
def analyze_image(image, room_capacity: int | float | None = None) -> dict:
    if image is None:
        raise gr.Error("Upload an image to analyze.")

    capacity = int(room_capacity or 50)
    if capacity <= 0:
        raise gr.Error("Room capacity must be greater than zero.")

    return _analyzer.analyze(image=image, room_capacity=capacity)
