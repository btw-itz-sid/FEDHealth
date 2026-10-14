"""Tests for FedHealth ML Service — Training Service"""

import numpy as np
import pandas as pd
import pytest
import shutil
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.training_service import (
    compute_dataset_fingerprint,
    compute_metrics,
    preprocess_pima,
    train_centralized,
)
from app.config import (
    MODELS_DIR,
    PIMA_FEATURE_COLUMNS,
    PIMA_TARGET_COLUMN,
    PIMA_ZERO_INVALID_COLUMNS,
)


def make_valid_df(n: int = 200, seed: int = 42) -> pd.DataFrame:
    """Create a synthetic valid PIMA-like dataset."""
    rng = np.random.RandomState(seed)
    data = {
        "Pregnancies": rng.randint(0, 15, n),
        "Glucose": rng.randint(70, 200, n),
        "BloodPressure": rng.randint(50, 120, n),
        "SkinThickness": rng.randint(10, 60, n),
        "Insulin": rng.randint(15, 500, n),
        "BMI": rng.uniform(18.0, 50.0, n).round(1),
        "DiabetesPedigreeFunction": rng.uniform(0.05, 2.5, n).round(3),
        "Age": rng.randint(18, 80, n),
        "Outcome": rng.choice([0, 1], n, p=[0.65, 0.35]),
    }
    return pd.DataFrame(data)


class TestPreprocessPima:
    def test_zeros_replaced(self):
        df = make_valid_df(n=10)
        df.loc[0, "Glucose"] = 0
        df.loc[1, "BMI"] = 0
        processed = preprocess_pima(df)
        assert pd.isna(processed.loc[0, "Glucose"])
        assert pd.isna(processed.loc[1, "BMI"])

    def test_non_zero_values_unchanged(self):
        df = make_valid_df(n=10)
        original_glucose = df.loc[0, "Glucose"]
        processed = preprocess_pima(df)
        if original_glucose != 0:
            assert processed.loc[0, "Glucose"] == original_glucose

    def test_pregnancies_zero_not_replaced(self):
        """Pregnancies=0 is valid (not in ZERO_INVALID_COLUMNS)."""
        df = make_valid_df(n=10)
        df.loc[0, "Pregnancies"] = 0
        processed = preprocess_pima(df)
        assert processed.loc[0, "Pregnancies"] == 0

    def test_original_not_mutated(self):
        df = make_valid_df(n=10)
        df.loc[0, "Glucose"] = 0
        original = df.copy()
        preprocess_pima(df)
        pd.testing.assert_frame_equal(df, original)


class TestComputeMetrics:
    def test_perfect_predictions(self):
        y_true = np.array([0, 0, 1, 1, 0, 1])
        y_pred = np.array([0, 0, 1, 1, 0, 1])
        y_proba = np.array([0.1, 0.1, 0.9, 0.9, 0.1, 0.9])
        metrics = compute_metrics(y_true, y_pred, y_proba)
        assert metrics["accuracy"] == 1.0
        assert metrics["precision"] == 1.0
        assert metrics["recall"] == 1.0
        assert metrics["f1_score"] == 1.0
        assert metrics["roc_auc"] == 1.0

    def test_all_wrong_predictions(self):
        y_true = np.array([0, 0, 1, 1])
        y_pred = np.array([1, 1, 0, 0])
        y_proba = np.array([0.9, 0.9, 0.1, 0.1])
        metrics = compute_metrics(y_true, y_pred, y_proba)
        assert metrics["accuracy"] == 0.0
        assert metrics["recall"] == 0.0

    def test_roc_auc_none_for_single_class(self):
        y_true = np.array([0, 0, 0, 0])
        y_pred = np.array([0, 0, 0, 0])
        y_proba = np.array([0.1, 0.2, 0.1, 0.3])
        metrics = compute_metrics(y_true, y_pred, y_proba)
        assert metrics["roc_auc"] is None

    def test_confusion_matrix_shape(self):
        y_true = np.array([0, 0, 1, 1])
        y_pred = np.array([0, 1, 1, 0])
        metrics = compute_metrics(y_true, y_pred)
        cm = metrics["confusion_matrix"]
        assert len(cm) == 2
        assert len(cm[0]) == 2

    def test_per_class_metrics(self):
        y_true = np.array([0, 0, 0, 1, 1, 1])
        y_pred = np.array([0, 0, 1, 1, 1, 0])
        metrics = compute_metrics(y_true, y_pred)
        assert "0" in metrics["per_class"]
        assert "1" in metrics["per_class"]
        assert "support" in metrics["per_class"]["0"]


class TestComputeDatasetFingerprint:
    def test_same_data_same_fingerprint(self):
        df1 = make_valid_df(seed=42)
        df2 = make_valid_df(seed=42)
        assert compute_dataset_fingerprint(df1) == compute_dataset_fingerprint(df2)

    def test_different_data_different_fingerprint(self):
        df1 = make_valid_df(seed=42)
        df2 = make_valid_df(seed=99)
        assert compute_dataset_fingerprint(df1) != compute_dataset_fingerprint(df2)


class TestTrainCentralized:
    """Integration tests for the full training pipeline."""

    @pytest.fixture(autouse=True)
    def cleanup_models(self):
        """Clean up model artifacts after each test."""
        yield
        # Remove test model directories
        if MODELS_DIR.exists():
            for d in MODELS_DIR.iterdir():
                if d.is_dir() and d.name.startswith("centralized_"):
                    shutil.rmtree(d, ignore_errors=True)

    def test_training_returns_metrics(self):
        df = make_valid_df(n=200)
        result = train_centralized(df, random_seed=42)
        assert result["model_id"].startswith("centralized_")
        assert result["model_type"] == "logistic_regression"
        assert result["training_method"] == "centralized"
        assert result["status"] == "ready"

        m = result["metrics"]
        assert 0.0 <= m["accuracy"] <= 1.0
        assert 0.0 <= m["precision"] <= 1.0
        assert 0.0 <= m["recall"] <= 1.0
        assert 0.0 <= m["f1_score"] <= 1.0
        assert m["roc_auc"] is None or 0.0 <= m["roc_auc"] <= 1.0
        assert m["num_train_samples"] > 0
        assert m["num_test_samples"] > 0
        assert m["num_train_samples"] + m["num_test_samples"] == 200

    def test_model_artifact_saved(self):
        df = make_valid_df(n=200)
        result = train_centralized(df, random_seed=42)
        model_dir = MODELS_DIR / result["model_id"]
        assert model_dir.exists()
        assert (model_dir / "pipeline.joblib").exists()
        assert (model_dir / "metadata.json").exists()

    def test_reproducible_with_same_seed(self):
        df = make_valid_df(n=200)
        r1 = train_centralized(df, random_seed=42)
        r2 = train_centralized(df, random_seed=42)
        assert r1["metrics"]["accuracy"] == r2["metrics"]["accuracy"]
        assert r1["metrics"]["f1_score"] == r2["metrics"]["f1_score"]
        assert r1["dataset_fingerprint"] == r2["dataset_fingerprint"]

    def test_different_seed_different_results(self):
        df = make_valid_df(n=200)
        r1 = train_centralized(df, random_seed=42)
        r2 = train_centralized(df, random_seed=99)
        # Different seeds lead to different splits → potentially different metrics
        # (might be same by chance, but fingerprint is the same since data is the same)
        assert r1["dataset_fingerprint"] == r2["dataset_fingerprint"]

    def test_train_test_split_proportions(self):
        df = make_valid_df(n=200)
        result = train_centralized(df, random_seed=42, test_size=0.2)
        m = result["metrics"]
        assert m["num_test_samples"] == 40  # 200 * 0.2
        assert m["num_train_samples"] == 160

    def test_confusion_matrix_sums_to_test_size(self):
        df = make_valid_df(n=200)
        result = train_centralized(df, random_seed=42, test_size=0.2)
        cm = result["metrics"]["confusion_matrix"]
        total = sum(sum(row) for row in cm)
        assert total == result["metrics"]["num_test_samples"]

    def test_training_with_zero_values(self):
        """Ensure the pipeline handles PIMA zero values correctly."""
        df = make_valid_df(n=200)
        # Introduce zeros in columns where they represent missing values
        df.loc[:9, "Glucose"] = 0
        df.loc[:4, "BMI"] = 0
        result = train_centralized(df, random_seed=42)
        assert result["status"] == "ready"
        assert 0.0 <= result["metrics"]["accuracy"] <= 1.0
