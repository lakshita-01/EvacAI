from app.detectors import model_loader


class FakeModel:
    def __init__(self):
        self.device = None

    def to(self, device: str):
        self.device = device
        return self


def test_load_yolo_model_moves_to_cuda_when_available(monkeypatch):
    model = FakeModel()
    monkeypatch.setattr(model_loader, "YOLO", lambda _: model)
    monkeypatch.setattr(model_loader.torch.cuda, "is_available", lambda: True)

    loaded_model = model_loader.load_yolo_model("model.pt")

    assert loaded_model is model
    assert model.device == "cuda"


def test_load_yolo_model_keeps_cpu_when_cuda_is_unavailable(monkeypatch):
    model = FakeModel()
    monkeypatch.setattr(model_loader, "YOLO", lambda _: model)
    monkeypatch.setattr(model_loader.torch.cuda, "is_available", lambda: False)

    loaded_model = model_loader.load_yolo_model("model.pt")

    assert loaded_model is model
    assert model.device is None
