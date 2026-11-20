"""Numerical and data-boundary evidence for the architecture shown in the UI."""

import numpy as np
import pytest

from app.services.aggregation_service import ClientUpdate, aggregate_updates
from app.services.evaluation_service import make_evaluation_split
from app.services import federated_service
from app.services.training_service import train_centralized
from tests.test_training_service import make_valid_df


def test_sample_weighted_aggregation_and_no_patient_payload():
    before = np.array([0.2, -0.1])
    updates = [ClientUpdate(0, 100, np.array([0.3, 0.2])),
               ClientUpdate(1, 300, np.array([0.7, -0.2]))]
    after, trace = aggregate_updates(before, updates, ["Glucose", "bias"], round_number=2)
    np.testing.assert_allclose(after, [0.8, -0.2])
    np.testing.assert_array_equal(before, [0.2, -0.1])  # no mutation
    assert set(trace["client_updates"][0]) == {
        "client_id", "num_samples", "aggregation_weight", "delta"
    }
    assert sum(u["aggregation_weight"] for u in trace["client_updates"]) == 1


@pytest.mark.parametrize("updates", [
    [], [ClientUpdate(0, 0, np.zeros(2))],
    [ClientUpdate(0, 1, np.zeros(3))], [ClientUpdate(0, 1, np.array([np.nan, 1]))],
    [ClientUpdate(0, 1, np.zeros(2)), ClientUpdate(0, 1, np.zeros(2))],
])
def test_invalid_updates_rejected(updates):
    with pytest.raises(ValueError):
        aggregate_updates(np.zeros(2), updates, ["Glucose", "bias"], round_number=1)


def test_evaluation_split_disjoint_reproducible_and_complete():
    y = np.array([0, 1] * 100)
    split = make_evaluation_split(y, .2, 42)
    assert not set(split.train) & set(split.validation)
    assert not set(split.train) & set(split.test)
    assert not set(split.validation) & set(split.test)
    assert set(np.concatenate([split.train, split.validation, split.test])) == set(range(200))
    assert split.manifest() == make_evaluation_split(y, .2, 42).manifest()
    assert split.manifest() != make_evaluation_split(y, .2, 43).manifest()


@pytest.mark.parametrize("private", [False, True])
def test_real_rounds_reconstruct_and_broadcast_the_previous_model(private):
    result = federated_service.train_federated(
        make_valid_df(200), num_clients=3, num_rounds=3, local_epochs=2, dp_enabled=private,
    )
    previous = np.zeros(9)
    for round_result in result["rounds"]:
        assert round_result["eval_metrics"]["evaluation_split"] == "validation"
        trace = round_result["eval_metrics"]["federation_trace"]
        np.testing.assert_array_equal(trace["global_before"], previous)
        reconstructed = previous + sum(
            u["aggregation_weight"] * np.array(u["delta"]) for u in trace["client_updates"]
        )
        np.testing.assert_allclose(reconstructed, trace["global_after"], atol=1e-14)
        assert trace["total_train_samples"] == result["metrics"]["num_train_samples"]
        assert trace["updates_privatized"] is private
        assert len(trace["parameter_order"]) == 9
        previous = np.array(trace["global_after"])


def test_all_methods_share_the_exact_evaluation_split():
    df = make_valid_df(200)
    centralized = train_centralized(df)
    fedavg = federated_service.train_federated(df, num_clients=3, num_rounds=2)
    local = federated_service.train_federated(
        df, training_method="local_only", num_clients=3, num_rounds=2,
    )
    assert centralized["metrics"]["evaluation_manifest"] == fedavg["metrics"]["evaluation_manifest"]
    assert local["metrics"]["evaluation_manifest"] == fedavg["metrics"]["evaluation_manifest"]
    assert sum(c["num_samples"] for c in fedavg["clients"]) == 128


def test_test_data_is_evaluated_only_after_all_rounds(monkeypatch):
    actual_evaluate = federated_service.evaluate
    calls = []

    def recording_evaluate(w, b, X, y, **kwargs):
        calls.append(len(y))
        return actual_evaluate(w, b, X, y, **kwargs)

    monkeypatch.setattr(federated_service, "evaluate", recording_evaluate)
    federated_service.train_federated(make_valid_df(200), num_clients=3, num_rounds=3)
    # Validation (32) and training (128) each round, test (40) once at the end.
    assert calls == [32, 128, 32, 128, 32, 128, 40]
