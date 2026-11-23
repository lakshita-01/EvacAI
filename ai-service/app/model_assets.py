import os

from huggingface_hub import hf_hub_download


def configure_huggingface_model_paths() -> None:
    repo_id = os.environ.get("HF_MODEL_REPO_ID")
    if not repo_id:
        return

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN is required to download private model weights.")

    person_model_path = hf_hub_download(
        repo_id=repo_id,
        filename="models/person/yolo26n.pt",
        repo_type="model",
        token=token,
    )
    fire_smoke_model_path = hf_hub_download(
        repo_id=repo_id,
        filename="models/fire_smoke/best.pt",
        repo_type="model",
        token=token,
    )

    os.environ["PERSON_MODEL_PATH"] = person_model_path
    os.environ["FIRE_SMOKE_MODEL_PATH"] = fire_smoke_model_path
