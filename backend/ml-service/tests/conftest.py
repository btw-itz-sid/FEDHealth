"""Keep every test artifact away from the user's trained demo models."""

import pytest

from app import config
from app.services import federated_service, prediction_service, training_service


@pytest.fixture(autouse=True)
def isolated_model_storage(tmp_path, monkeypatch, request):
    models_dir = tmp_path / "isolated-models"
    models_dir.mkdir()
    for module in (config, federated_service, prediction_service, training_service):
        monkeypatch.setattr(module, "MODELS_DIR", models_dir)
    # Older test modules import this constant directly, including cleanup fixtures.
    if hasattr(request.module, "MODELS_DIR"):
        monkeypatch.setattr(request.module, "MODELS_DIR", models_dir)
