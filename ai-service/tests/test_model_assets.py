import os

import pytest

from app import model_assets


def test_private_model_paths_are_downloaded_and_configured(monkeypatch):
    monkeypatch.setenv("HF_MODEL_REPO_ID", "owner/evac-ai-models")
    monkeypatch.setenv("HF_TOKEN", "read-token")
    downloads = []

    def fake_download(**kwargs):
        downloads.append(kwargs)
        return f"/cache/{kwargs['filename'].split('/')[-1]}"

    monkeypatch.setattr(model_assets, "hf_hub_download", fake_download)

    model_assets.configure_huggingface_model_paths()

    assert {call["filename"] for call in downloads} == {
        "models/person/yolo26n.pt",
        "models/fire_smoke/best.pt",
    }
    assert all(call["repo_id"] == "owner/evac-ai-models" for call in downloads)
    assert all(call["token"] == "read-token" for call in downloads)
    assert os.environ["PERSON_MODEL_PATH"] == "/cache/yolo26n.pt"
    assert os.environ["FIRE_SMOKE_MODEL_PATH"] == "/cache/best.pt"


def test_private_model_download_requires_token(monkeypatch):
    monkeypatch.setenv("HF_MODEL_REPO_ID", "owner/evac-ai-models")
    monkeypatch.delenv("HF_TOKEN", raising=False)

    with pytest.raises(RuntimeError, match="HF_TOKEN"):
        model_assets.configure_huggingface_model_paths()


def test_local_model_paths_are_left_unchanged_without_repo(monkeypatch):
    monkeypatch.delenv("HF_MODEL_REPO_ID", raising=False)
    monkeypatch.setenv("PERSON_MODEL_PATH", "local/person.pt")
    monkeypatch.setenv("FIRE_SMOKE_MODEL_PATH", "local/fire.pt")

    model_assets.configure_huggingface_model_paths()

    assert os.environ["PERSON_MODEL_PATH"] == "local/person.pt"
    assert os.environ["FIRE_SMOKE_MODEL_PATH"] == "local/fire.pt"
