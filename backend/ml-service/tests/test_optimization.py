"""Regression checks for training-only selection, refit and serving parity."""

import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from app.config import PIMA_FEATURE_COLUMNS
from app.services import optimization_service, training_service, federated_service
from app.services.evaluation_service import EvaluationSplit, make_evaluation_split
from app.services.feature_service import SharedFeatureMap
from app.services.prediction_service import load_model, predict
from tests.test_training_service import make_valid_df


def fast_selector(X, y, seed, objective="f1"):
    pipeline = Pipeline([("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("classifier", RandomForestClassifier(n_estimators=12, min_samples_leaf=3, random_state=seed))])
    pipeline.fit(X, y)
    return pipeline, {"protocol": "development_cv3_prediction_v3", "objective": objective,
        "selected": {"estimator": "RandomForestClassifier", "accuracy": 0.7}, "candidates": []}


def test_refit_uses_development_only_and_serves_identical_predictions(monkeypatch):
    frame = make_valid_df(200)
    split = make_evaluation_split(frame.Outcome.to_numpy(), 0.2, 42)
    seen = []
    def selector(X, y, seed, objective):
        seen.append(X.copy())
        return fast_selector(X, y, seed, objective)
    monkeypatch.setattr(optimization_service, "select_prediction_pipeline", selector)
    result = training_service.train_centralized(frame, optimize=True)
    expected = training_service.preprocess_pima(frame)[PIMA_FEATURE_COLUMNS].to_numpy()
    np.testing.assert_allclose(seen[0], expected[np.sort(np.r_[split.train, split.validation])], equal_nan=True)
    assert result["metrics"]["num_train_samples"] == 160
    assert result["metrics"]["num_validation_samples"] == 0
    assert result["metrics"]["num_test_samples"] == 40
    pipeline, metadata = load_model(result["model_id"])
    predictions = pipeline.predict(expected[split.test])
    assert result["metrics"]["accuracy"] == round(float((predictions == frame.Outcome.to_numpy()[split.test]).mean()), 6)
    row = frame.iloc[split.test[0]]
    served = predict({key: float(row[key]) for key in PIMA_FEATURE_COLUMNS}, result["model_id"])
    assert served["prediction"] == int(predictions[0])
    assert metadata["training_method"] == "centralized"


def test_test_rows_and_labels_cannot_change_fitted_candidate(monkeypatch):
    frame = make_valid_df(200)
    split = EvaluationSplit(np.arange(120), np.arange(120, 160), np.arange(160, 200))
    monkeypatch.setattr(training_service, "make_evaluation_split", lambda *args: split)
    monkeypatch.setattr(optimization_service, "select_prediction_pipeline", fast_selector)
    original = training_service.train_centralized(frame, optimize=True)
    frame.loc[160:, "Glucose"] = 299
    frame.loc[160:, "Outcome"] = 1 - frame.loc[160:, "Outcome"]
    changed = training_service.train_centralized(frame, optimize=True)
    p1, _ = load_model(original["model_id"])
    p2, _ = load_model(changed["model_id"])
    np.testing.assert_array_equal(p1.predict_proba(frame.iloc[:120][PIMA_FEATURE_COLUMNS].to_numpy()),
        p2.predict_proba(frame.iloc[:120][PIMA_FEATURE_COLUMNS].to_numpy()))


def test_shared_basis_is_independent_of_patient_values():
    x = np.ones((10, 8))
    first = SharedFeatureMap(n_components=16, random_state=42).fit(x)
    second = SharedFeatureMap(n_components=16, random_state=42).fit(x * 999)
    np.testing.assert_array_equal(first.transform(x), second.transform(x))
    assert first.transform(x).shape == (10, 24)


def test_optimized_federated_pipeline_and_trace_preserve_feature_order(monkeypatch):
    chosen = {"features": "rbf", "gamma": 0.05, "balanced": True, "components": 8, "decision_threshold": 0.6}
    monkeypatch.setattr(federated_service, "select_configuration", lambda *args: {
        "selected": chosen, "candidates": [{**chosen, "selection_accuracy": 0.7}]})
    monkeypatch.setattr(federated_service, "OPTIMIZED_ROUNDS", 2)
    frame = make_valid_df(200)
    result = federated_service.train_federated(frame, optimize=True)
    trace = result["rounds"][0]["eval_metrics"]["federation_trace"]
    assert len(trace["parameter_order"]) == 17
    assert trace["parameter_order"][:8] == PIMA_FEATURE_COLUMNS
    assert result["rounds"][0]["eval_metrics"]["evaluation_split"] == "train"
    second = result["rounds"][1]["eval_metrics"]["federation_trace"]
    np.testing.assert_array_equal(trace["global_after"], second["global_before"])
    served = predict({key: float(frame.iloc[0][key]) for key in PIMA_FEATURE_COLUMNS}, result["model_id"])
    assert served["feature_columns"] == PIMA_FEATURE_COLUMNS
    assert served["prediction"] == int(served["probability"] >= 0.6)


@pytest.mark.parametrize("kwargs", [{"training_method": "local_only"}, {"dp_enabled": True}, {"partition_type": "non_iid"}])
def test_optimization_rejects_unsupported_federated_protocols(kwargs):
    with pytest.raises(ValueError, match="Automatic optimization"):
        federated_service.train_federated(make_valid_df(), optimize=True, **kwargs)
