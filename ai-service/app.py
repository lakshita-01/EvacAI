import os

import gradio as gr
from fastapi.responses import RedirectResponse

from app.model_assets import configure_huggingface_model_paths


def _build_app():
    configure_huggingface_model_paths()

    from app.api.routes import router
    from app.analysis.inference import analyze_image

    demo = gr.Interface(
        fn=analyze_image,
        inputs=[
            gr.Image(type="pil", label="Image"),
            gr.Number(value=50, precision=0, label="Room capacity"),
        ],
        outputs=gr.JSON(label="Analysis"),
        title="Evac-AI image analysis",
        description="Analyze an image for people, fire, smoke, density, and risk.",
        flagging_mode="never",
    )
    demo.queue()
    demo.app.include_router(router, prefix="/api")

    @demo.app.get("/api")
    def service_status():
        return {"service": "evac-ai", "status": "running", "version": "1.0.0"}

    @demo.app.get("/gradio", include_in_schema=False)
    def gradio_redirect():
        return RedirectResponse(url="/")

    return demo


demo = _build_app()
app = demo.app

if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=int(os.environ.get("PORT", "7860")),
        ssr_mode=False,
    )
