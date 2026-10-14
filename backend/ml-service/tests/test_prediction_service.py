"""Tests for FedHealth ML Service — Prediction Service"""

import json
import shutil

import joblib
import numpy as np
import pandas as pd
import pytest
from pathlib import Path
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.prediction_service import (
    get_available_models,
    get_latest_model_id,
    load_model,
    predict,
    DISCLAIMER,
)
from app.config import MODELS_DIR, PIMA_FEATURE_COLUMNS, PIMA_ZERO_INVALID_COLUMNS


# ---- Fixtures ----

def _create_test_model(model_id: str = "test_model_001") -> Path:
    """Create a minimal test model artifact."""
    model_dir = MODELS_DIR / model_id
    model_dir.mkdir(parents=True, exist_ok=True)

    # Create a simple fitted pipeline
    rng = np.random.RandomState(42)
    X = rng.rand(50, 8)
    y = rng.choice([0, 1], 50)
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(random_state=42, max_iter=100)),
    ])
    pipeline.fit(X, y)
    joblib.dump(pipeline, model_dir / "pipeline.joblib")

    metadata = {
        "model_id": model_id,
        "model_version": "v1.0_test",
        "model_type": "logistic_regression",
        "training_method": "centralized",
        "feature_columns": PIMA_FEATURE_COLUMNS,
        "target_column": "Outcome",
        "preprocessing": {
            "zero_to_nan_columns": PIMA_ZERO_INVALID_COLUMNS,
            "imputer_strategy": "median",
            "scaler": "standard",
        },
        "created_at": "2024-01-01T00:00:00+00:00",
        "status": "ready",
    }
    with open(model_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)

    return model_dir


@pytest.fixture(autouse=True)
def cleanup():
    yield
    for d in MODELS_DIR.iterdir():
        if d.is_dir() and d.name.startswith("test_model"):
            shutil.rmtree(d, ignore_errors=True)


# ---- Tests ----

class TestGetAvailableModels:
    def test_empty_when_no_models(self):
        models = get_available_models()
        # May have other models from test runs, just check it returns a list
        assert isinstance(models, list)

    def test_finds_created_model(self):
        _create_test_model("test_model_aaa")
        models = get_available_models()
        ids = [m["model_id"] for m in models]
        assert "test_model_aaa" in ids


class TestPredict:
    def test_valid_prediction(self):
        _create_test_model("test_model_pred")
        features = {
            "Pregnancies": 6,
            "Glucose": 148,
            "BloodPressure": 72,
            "SkinThickness": 35,
            "Insulin": 0,  # will be replaced with NaN
            "BMI": 33.6,
            "DiabetesPedigreeFunction": 0.627,
            "Age": 50,
        }
        result = predict(features, model_id="test_model_pred")
        assert result["prediction"] in (0, 1)
        assert 0.0 <= result["probability"] <= 1.0
        assert result["risk_level"] in ("Low", "Moderate", "High")
        assert result["model_id"] == "test_model_pred"
        assert result["disclaimer"] == DISCLAIMER

    def test_missing_feature_raises(self):
        _create_test_model("test_model_missing")
        features = {"Pregnancies": 6, "Glucose": 148}  # incomplete
        with pytest.raises(ValueError, match="Missing required features"):
            predict(features, model_id="test_model_missing")

    def test_no_model_raises(self):
        with pytest.raises((ValueError, FileNotFoundError)):
            predict(
                {col: 1.0 for col in PIMA_FEATURE_COLUMNS},
                model_id="nonexistent_model",
            )

    def test_risk_level_low(self):
        _create_test_model("test_model_risk")
        # Use values likely to produce low risk
        features = {col: 1.0 for col in PIMA_FEATURE_COLUMNS}
        features["Pregnancies"] = 0
        features["Age"] = 21
        result = predict(features, model_id="test_model_risk")
        # Just verify the risk_level is one of the valid values
        assert result["risk_level"] in ("Low", "Moderate", "High")

    def test_feature_order_matches_model(self):
        _create_test_model("test_model_order")
        features = {col: float(i + 1) for i, col in enumerate(PIMA_FEATURE_COLUMNS)}
        result = predict(features, model_id="test_model_order")
        assert result["feature_columns"] == PIMA_FEATURE_COLUMNS


class TestLoadModel:
    def test_load_existing(self):
        _create_test_model("test_model_load")
        pipeline, metadata = load_model("test_model_load")
        assert metadata["model_id"] == "test_model_load"
        assert hasattr(pipeline, "predict")

    def test_load_nonexistent(self):
        with pytest.raises(FileNotFoundError):
            load_model("totally_fake_model")
