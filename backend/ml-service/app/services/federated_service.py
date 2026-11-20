"""FedHealth ML Service — Federated Learning Service

Simulated federated training of a logistic regression model on PIMA:
- Client partitioning: IID (uniform) or non-IID (Dirichlet label skew)
- Local training: mini-batch SGD starting from the current global weights
- Aggregation: FedAvg (sample-weighted mean of client weights)
- Optional differential privacy: per-client update clipping + Gaussian noise
- Local-only baseline: every client trains alone, no aggregation
- Optional class balancing: per-sample weights that up-weight the minority class

Simulation assumptions (documented for the research report):
- Imputer medians and scaler statistics are fit on the pooled training split
  and shared with all clients. A real deployment would need federated
  statistics or a fixed clinical normalisation.
- Class-balancing weights come from the pooled training prevalence, like a
  published population prior, so every method optimises the same objective.
- Validation monitors rounds; test is evaluated only after the final round.
- Clients are logical partitions in one process, not isolated remote hospitals.
- Seeded clipping/noise is educational and does not certify differential privacy.
"""

import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..config import (
    MODELS_DIR,
    PIMA_FEATURE_COLUMNS,
    PIMA_TARGET_COLUMN,
    PIMA_ZERO_INVALID_COLUMNS,
)
from .training_service import compute_dataset_fingerprint, compute_metrics, preprocess_pima
from .aggregation_service import ClientUpdate, aggregate_updates
from .evaluation_service import EVALUATION_PROTOCOL, VALIDATION_FRACTION, EvaluationSplit, make_evaluation_split
from .feature_service import SharedFeatureMap
from .optimization_service import (select_configuration, OPTIMIZATION_PROTOCOL, OPTIMIZED_ROUNDS,
    OPTIMIZED_EPOCHS, OPTIMIZED_LR, OPTIMIZED_BATCH)

DIRICHLET_ALPHA = 0.5
MIN_CLIENT_SAMPLES = 10
L2_PENALTY = 1e-4


# ---- Partitioning ----

def partition_iid(y: np.ndarray, num_clients: int, rng: np.random.Generator) -> list[np.ndarray]:
    return [np.sort(s) for s in np.array_split(rng.permutation(len(y)), num_clients)]


def partition_non_iid(
    y: np.ndarray,
    num_clients: int,
    rng: np.random.Generator,
    alpha: float = DIRICHLET_ALPHA,
) -> list[np.ndarray]:
    """Dirichlet label-skew partition (Hsu et al., 2019).

    For each class, client shares are drawn from Dir(alpha). Smaller alpha
    means more skew. Retries until every client has MIN_CLIENT_SAMPLES.
    """
    classes = np.unique(y)
    for _ in range(100):
        buckets: list[list[int]] = [[] for _ in range(num_clients)]
        for cls in classes:
            idx = rng.permutation(np.where(y == cls)[0])
            shares = rng.dirichlet([alpha] * num_clients)
            cuts = (np.cumsum(shares) * len(idx)).astype(int)[:-1]
            for client_id, part in enumerate(np.split(idx, cuts)):
                buckets[client_id].extend(part.tolist())
        if min(len(b) for b in buckets) >= MIN_CLIENT_SAMPLES:
            return [np.sort(np.array(b, dtype=int)) for b in buckets]
    raise ValueError(
        f"Could not build a non-IID partition with at least {MIN_CLIENT_SAMPLES} "
        f"samples per client. Use fewer clients."
    )


# ---- Model primitives ----

def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def _predict_proba(w: np.ndarray, b: float, X: np.ndarray) -> np.ndarray:
    return _sigmoid(X @ w + b)


def _log_loss(w: np.ndarray, b: float, X: np.ndarray, y: np.ndarray) -> float:
    p = np.clip(_predict_proba(w, b, X), 1e-12, 1 - 1e-12)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def local_sgd(
    w: np.ndarray,
    b: float,
    X: np.ndarray,
    y: np.ndarray,
    epochs: int,
    learning_rate: float,
    batch_size: int,
    rng: np.random.Generator,
    sample_weight: Optional[np.ndarray] = None,
    l2_penalty: float = L2_PENALTY,
) -> tuple[np.ndarray, float]:
    """Mini-batch SGD on (optionally weighted) logistic loss with a small L2 penalty."""
    w = w.copy()
    n = len(y)
    for _ in range(epochs):
        order = rng.permutation(n)
        for start in range(0, n, batch_size):
            batch = order[start:start + batch_size]
            Xb, yb = X[batch], y[batch]
            err = _predict_proba(w, b, Xb) - yb
            if sample_weight is not None:
                err = err * sample_weight[batch]
            w -= learning_rate * (Xb.T @ err / len(batch) + l2_penalty * w)
            b -= learning_rate * float(err.mean())
    return w, b


def evaluate(w: np.ndarray, b: float, X: np.ndarray, y: np.ndarray, threshold: float = 0.5) -> dict[str, Any]:
    proba = _predict_proba(w, b, X)
    pred = (proba >= threshold).astype(int)
    metrics = compute_metrics(y_true=y, y_pred=pred, y_proba=proba)
    metrics["loss"] = round(_log_loss(w, b, X, y), 6)
    return metrics


# ---- Differential privacy ----

def gaussian_sigma(epsilon: float, delta: float, clip_norm: float) -> float:
    """Gaussian mechanism: sigma = C * sqrt(2 ln(1.25/delta)) / epsilon."""
    return clip_norm * float(np.sqrt(2 * np.log(1.25 / delta))) / epsilon


def privatize_update(
    delta_w: np.ndarray,
    delta_b: float,
    clip_norm: float,
    sigma: float,
    rng: np.random.Generator,
) -> tuple[np.ndarray, float, float]:
    """Clip a client update to L2 norm <= clip_norm, then add N(0, sigma^2) noise.

    Returns (noisy_delta_w, noisy_delta_b, pre_clip_norm).
    """
    flat = np.concatenate([delta_w, [delta_b]])
    norm = float(np.linalg.norm(flat))
    if norm > clip_norm:
        flat = flat * (clip_norm / norm)
    flat = flat + rng.normal(0.0, sigma, size=flat.shape)
    return flat[:-1], float(flat[-1]), norm


# ---- Persistence ----

def _save_model(
    w: np.ndarray,
    b: float,
    imputer: SimpleImputer,
    scaler: StandardScaler,
    metadata: dict[str, Any],
    feature_map: Optional[SharedFeatureMap] = None,
) -> None:
    classifier = LogisticRegression()
    classifier.coef_ = w.reshape(1, -1)
    classifier.intercept_ = np.array([b])
    classifier.classes_ = np.array([0, 1])
    classifier.n_features_in_ = len(w)

    steps = [("imputer", imputer), ("scaler", scaler)]
    if feature_map is not None:
        steps.append(("feature_map", feature_map))
    pipeline = Pipeline([*steps, ("classifier", classifier)])

    model_dir = MODELS_DIR / metadata["model_id"]
    model_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = model_dir / "pipeline.joblib"
    joblib.dump(pipeline, artifact_path)
    metadata["artifact_path"] = str(artifact_path)
    with open(model_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2, default=str)


# ---- Runner ----

def train_federated(
    df: pd.DataFrame,
    training_method: str = "fedavg",
    partition_type: str = "iid",
    num_clients: int = 5,
    num_rounds: int = 10,
    local_epochs: int = 5,
    learning_rate: float = 0.1,
    batch_size: int = 32,
    random_seed: int = 42,
    test_size: float = 0.2,
    dp_enabled: bool = False,
    dp_epsilon: float = 1.0,
    dp_delta: float = 1e-5,
    dp_clip_norm: float = 1.0,
    balance_classes: bool = False,
    experiment_id: Optional[str] = None,
    experiment_name: Optional[str] = None,
    optimize: bool = False,
) -> dict[str, Any]:
    if num_clients < 2 or num_rounds < 1 or local_epochs < 1 or batch_size < 1:
        raise ValueError("Use at least two clients and positive rounds, epochs and batch size")
    if not 0 < learning_rate <= 1:
        raise ValueError("Learning rate must be in (0, 1]")
    if training_method not in ("fedavg", "local_only"):
        raise ValueError(f"Unsupported training method: {training_method}")
    if partition_type not in ("iid", "non_iid"):
        raise ValueError(f"Unsupported partition type: {partition_type}")
    if dp_enabled and training_method != "fedavg":
        raise ValueError("Differential privacy is only supported for FedAvg")

    if optimize and (training_method != "fedavg" or dp_enabled or partition_type != "iid"):
        raise ValueError("Automatic optimization supports IID FedAvg without added noise")

    started = time.time()
    rng = np.random.default_rng(random_seed)

    df = preprocess_pima(df)
    dataset_fingerprint = compute_dataset_fingerprint(df)
    X = df[PIMA_FEATURE_COLUMNS].values.astype(np.float64)
    y = df[PIMA_TARGET_COLUMN].values.astype(np.int32)

    # Hold test out before any preprocessing, partitioning or round evaluation.
    split = make_evaluation_split(y, test_size, random_seed)
    optimization = None
    decision_threshold = 0.5
    feature_map = None
    parameter_names = list(PIMA_FEATURE_COLUMNS)
    l2_penalty = L2_PENALTY
    if optimize:
        development = np.sort(np.concatenate([split.train, split.validation]))
        optimization = select_configuration(X[development], y[development], random_seed, num_clients)
        selected = optimization["selected"]
        balance_classes = selected["balanced"]
        decision_threshold = selected["decision_threshold"]
        num_rounds, local_epochs = OPTIMIZED_ROUNDS, OPTIMIZED_EPOCHS
        learning_rate, batch_size = OPTIMIZED_LR, OPTIMIZED_BATCH
        # Refit the selected configuration on all development rows; the test
        # indices remain untouched. There is no separate holdout validation here.
        split = EvaluationSplit(development, np.array([], dtype=int), split.test)
        if selected["features"] == "rbf":
            feature_map = SharedFeatureMap(gamma=selected["gamma"], n_components=selected["components"], random_state=random_seed)
            l2_penalty = 0.001
    X_train, y_train = X[split.train], y[split.train]
    X_validation, y_validation = X[split.validation], y[split.validation]
    X_test, y_test = X[split.test], y[split.test]
    if len(y_train) < num_clients * MIN_CLIENT_SAMPLES:
        raise ValueError(f"Need at least {MIN_CLIENT_SAMPLES} training samples per client; use fewer clients")

    imputer = SimpleImputer(strategy="median").fit(X_train)
    scaler = StandardScaler().fit(imputer.transform(X_train))
    X_train = scaler.transform(imputer.transform(X_train))
    X_test = scaler.transform(imputer.transform(X_test))
    if len(y_validation):
        X_validation = scaler.transform(imputer.transform(X_validation))
    if feature_map is not None:
        feature_map.fit(X_train)
        X_train, X_test = feature_map.transform(X_train), feature_map.transform(X_test)
        if len(y_validation):
            X_validation = feature_map.transform(X_validation)
        parameter_names += [f"RBF feature {i + 1}" for i in range(feature_map.n_components)]

    if partition_type == "non_iid":
        partitions = partition_non_iid(y_train, num_clients, rng)
    else:
        partitions = partition_iid(y_train, num_clients, rng)
    clients = [(X_train[idx], y_train[idx]) for idx in partitions]

    if balance_classes:
        # Same formula as sklearn's class_weight="balanced" on the training split
        class_weights = len(y_train) / (2 * np.bincount(y_train, minlength=2))
        client_sample_weights = [class_weights[cy] for _, cy in clients]
    else:
        client_sample_weights = [None for _ in clients]

    client_profiles = [
        {
            "client_id": cid,
            "num_samples": int(len(cy)),
            "class_distribution": {
                "0": int((cy == 0).sum()),
                "1": int((cy == 1).sum()),
            },
        }
        for cid, (_, cy) in enumerate(clients)
    ]

    num_features = X_train.shape[1]
    sigma = gaussian_sigma(dp_epsilon, dp_delta, dp_clip_norm) if dp_enabled else 0.0
    bytes_per_model = (num_features + 1) * 8

    rounds: list[dict[str, Any]] = []

    if training_method == "fedavg":
        global_w = np.zeros(num_features)
        global_b = 0.0

        for round_num in range(1, num_rounds + 1):
            round_start = time.time()
            updates: list[ClientUpdate] = []
            client_round_metrics = []

            for cid, (cx, cy) in enumerate(clients):
                w, b = local_sgd(global_w, global_b, cx, cy, local_epochs,
                                 learning_rate, batch_size, rng,
                                 client_sample_weights[cid], l2_penalty=l2_penalty)
                dw, db = w - global_w, b - global_b
                update_norm = float(np.linalg.norm(np.concatenate([dw, [db]])))
                if dp_enabled:
                    dw, db, update_norm = privatize_update(dw, db, dp_clip_norm, sigma, rng)

                # This is the complete server input: deltas + count, no X or y.
                updates.append(ClientUpdate(cid, len(cy), np.concatenate([dw, [db]])))

                local_pred = (_predict_proba(w, b, cx) >= 0.5).astype(int)
                client_round_metrics.append({
                    **client_profiles[cid],
                    "train_accuracy": round(float((local_pred == cy).mean()), 6),
                    "train_loss": round(_log_loss(w, b, cx, cy), 6),
                    "update_norm": round(update_norm, 6),
                })

            parameters, trace = aggregate_updates(
                np.concatenate([global_w, [global_b]]), updates,
                [*parameter_names, "bias"], round_number=round_num, noisy=dp_enabled,
            )
            global_w, global_b = parameters[:-1], float(parameters[-1])

            eval_metrics = evaluate(global_w, global_b,
                X_train if optimize else X_validation, y_train if optimize else y_validation,
                threshold=decision_threshold)
            eval_metrics["evaluation_split"] = "train" if optimize else "validation"
            eval_metrics["federation_trace"] = trace
            train_eval = evaluate(global_w, global_b, X_train, y_train)
            if dp_enabled:
                eval_metrics["privacy"] = {
                    "epsilon_per_round": dp_epsilon,
                    "cumulative_epsilon": round(dp_epsilon * round_num, 6),
                    "cumulative_delta": dp_delta * round_num,
                }

            rounds.append({
                "round_number": round_num,
                "train_metrics": {
                    "accuracy": train_eval["accuracy"],
                    "loss": train_eval["loss"],
                    "mean_client_accuracy": round(float(np.mean(
                        [c["train_accuracy"] for c in client_round_metrics])), 6),
                },
                "eval_metrics": eval_metrics,
                "client_metrics": client_round_metrics,
                "participating_clients": len(clients),
                "duration_seconds": round(time.time() - round_start, 4),
                # Each client downloads and uploads one parameter vector
                "communication_bytes": 2 * len(clients) * bytes_per_model,
            })

        # Test is evaluated once, after the fixed training schedule has finished.
        final_metrics = evaluate(global_w, global_b, X_test, y_test, threshold=decision_threshold)
        final_w, final_b = global_w, global_b
        # The exact parameter vector exchanged each round, in standardised feature space
        final_metrics["global_model"] = {
            "weights": {col: round(float(v), 6) for col, v in zip(parameter_names, final_w)},
            "bias": round(float(final_b), 6),
            "bytes_per_transfer": bytes_per_model,
        }

    else:
        client_weights = [(np.zeros(num_features), 0.0) for _ in clients]
        for round_num in range(1, num_rounds + 1):
            round_start = time.time()
            client_round_metrics = []
            for cid, (cx, cy) in enumerate(clients):
                w, b = local_sgd(*client_weights[cid], cx, cy, local_epochs,
                                 learning_rate, batch_size, rng,
                                 client_sample_weights[cid], l2_penalty=l2_penalty)
                client_weights[cid] = (w, b)
                validation_m = evaluate(w, b, X_validation, y_validation)
                client_round_metrics.append({
                    **client_profiles[cid],
                    "validation_accuracy": validation_m["accuracy"],
                    "validation_f1_score": validation_m["f1_score"],
                    "validation_roc_auc": validation_m["roc_auc"],
                })

            eval_metrics = _mean_client_metrics(client_weights, X_validation, y_validation)
            eval_metrics["evaluation_split"] = "validation"
            rounds.append({
                "round_number": round_num,
                "train_metrics": {},
                "eval_metrics": eval_metrics,
                "client_metrics": client_round_metrics,
                "participating_clients": len(clients),
                "duration_seconds": round(time.time() - round_start, 4),
                "communication_bytes": 0,
            })

        final_metrics = _mean_client_metrics(client_weights, X_test, y_test)
        final_w, final_b = None, None

    duration = round(time.time() - started, 3)
    final_metrics["num_train_samples"] = int(len(y_train))
    final_metrics["num_validation_samples"] = int(len(y_validation))
    final_metrics["num_test_samples"] = int(len(y_test))
    final_metrics["evaluation_protocol"] = OPTIMIZATION_PROTOCOL if optimize else EVALUATION_PROTOCOL
    final_metrics["evaluation_manifest"] = split.manifest()
    final_metrics["validation_metrics"] = {
        key: value for key, value in rounds[-1]["eval_metrics"].items()
        if key not in ("federation_trace", "privacy")
    }
    if optimize:
        manifest = final_metrics["evaluation_manifest"]
        manifest.update(protocol=OPTIMIZATION_PROTOCOL, round_metrics_split="train",
            validation_fraction_of_development=0, selection="3-fold CV within development; refit on development")
        selected_score = next(row for row in optimization["candidates"]
            if all(row[key] == value for key, value in optimization["selected"].items()))
        final_metrics["optimization"] = optimization
        final_metrics["decision_threshold"] = decision_threshold
        final_metrics["validation_metrics"] = {"accuracy": selected_score["selection_accuracy"],
            "evaluation_split": "development_cv3_selection", "selection_estimate_only": True}
    final_metrics["training_duration_seconds"] = duration
    final_metrics["total_communication_bytes"] = int(sum(r["communication_bytes"] for r in rounds))
    if dp_enabled:
        final_metrics["privacy"] = {
            "epsilon_per_round": dp_epsilon,
            "delta_per_round": dp_delta,
            "clip_norm": dp_clip_norm,
            "noise_sigma": round(sigma, 6),
            "cumulative_epsilon": round(dp_epsilon * num_rounds, 6),
            "cumulative_delta": dp_delta * num_rounds,
            "accounting": "basic composition (upper bound)",
            "guarantee": "educational_noise_simulation_only",
            "limitations": "Seeded noise, pooled preprocessing and unprotected diagnostics; not a certified DP guarantee.",
        }

    training_config = {
        "training_method": training_method,
        "partition_type": partition_type,
        "dirichlet_alpha": DIRICHLET_ALPHA if partition_type == "non_iid" else None,
        "num_clients": num_clients,
        "num_rounds": num_rounds,
        "local_epochs": local_epochs,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "random_seed": random_seed,
        "test_size": test_size,
        "dp_enabled": dp_enabled,
        "dp_epsilon": dp_epsilon if dp_enabled else None,
        "dp_delta": dp_delta if dp_enabled else None,
        "dp_clip_norm": dp_clip_norm if dp_enabled else None,
        "balance_classes": balance_classes,
        "evaluation_protocol": OPTIMIZATION_PROTOCOL if optimize else EVALUATION_PROTOCOL,
        "optimize": optimize,
        "decision_threshold": decision_threshold,
        "feature_map": "shared_random_fourier" if feature_map is not None else "linear",
        "l2_penalty": l2_penalty,
        "validation_fraction_of_development": 0 if optimize else VALIDATION_FRACTION,
        "preprocessing_scope": "pooled_training_split_simulation",
    }

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    created_at = datetime.now(timezone.utc).isoformat()
    model_id: Optional[str] = None
    model_version: Optional[str] = None

    if final_w is not None:
        prefix = "fedavg_dp" if dp_enabled else "fedavg"
        model_id = f"{prefix}_{timestamp}_{uuid.uuid4().hex[:6]}"
        model_version = f"v1.0_{timestamp}"
        _save_model(final_w, final_b, imputer, scaler, {
            "model_id": model_id,
            "model_version": model_version,
            "model_type": "rbf_logistic_regression" if feature_map is not None else "logistic_regression",
            "training_method": "fedavg_dp" if dp_enabled else "fedavg",
            "feature_columns": PIMA_FEATURE_COLUMNS,
            "target_column": PIMA_TARGET_COLUMN,
            "preprocessing": {
                "zero_to_nan_columns": PIMA_ZERO_INVALID_COLUMNS,
                "imputer_strategy": "median",
                "scaler": "standard",
            },
            "training_config": training_config,
            "dataset_fingerprint": dataset_fingerprint,
            "metrics": final_metrics,
            "decision_threshold": decision_threshold,
            "created_at": created_at,
            "experiment_id": experiment_id,
            "experiment_name": experiment_name,
            "status": "ready",
        }, feature_map=feature_map)

    return {
        "model_id": model_id,
        "model_version": model_version,
        "model_type": "rbf_logistic_regression" if feature_map is not None else "logistic_regression",
        "training_method": training_method,
        "feature_columns": PIMA_FEATURE_COLUMNS,
        "dataset_fingerprint": dataset_fingerprint,
        "metrics": final_metrics,
        "rounds": rounds,
        "clients": client_profiles,
        "training_config": training_config,
        "created_at": created_at,
        "status": "ready",
    }


def _mean_client_metrics(
    client_weights: list[tuple[np.ndarray, float]],
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> dict[str, Any]:
    """Average test metrics across independently trained local models."""
    per_client = [evaluate(w, b, X_test, y_test) for w, b in client_weights]
    keys = ["accuracy", "precision", "recall", "f1_score", "roc_auc", "loss"]
    result: dict[str, Any] = {}
    for key in keys:
        values = [m[key] for m in per_client if m.get(key) is not None]
        result[key] = round(float(np.mean(values)), 6) if values else None
        result[f"{key}_std"] = round(float(np.std(values)), 6) if values else None
    result["confusion_matrix"] = np.sum(
        [np.array(m["confusion_matrix"]) for m in per_client], axis=0
    ).tolist()
    return result
