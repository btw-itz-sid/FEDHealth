"""FedHealth ML Service — Federated Learning Service

Simulated federated training of a logistic regression model on PIMA:
- Client partitioning: IID (uniform) or non-IID (Dirichlet label skew)
- Local training: mini-batch SGD starting from the current global weights
- Aggregation: FedAvg (sample-weighted mean of client weights)
- Optional differential privacy: per-client update clipping + Gaussian noise
- Local-only baseline: every client trains alone, no aggregation

Simulation assumptions (documented for the research report):
- Imputer medians and scaler statistics are fit on the pooled training split
  and shared with all clients. A real deployment would need federated
  statistics or a fixed clinical normalisation.
- The test split is held out before partitioning and never seen by clients.
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
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ..config import (
    MODELS_DIR,
    PIMA_FEATURE_COLUMNS,
    PIMA_TARGET_COLUMN,
    PIMA_ZERO_INVALID_COLUMNS,
)
from .training_service import compute_dataset_fingerprint, compute_metrics, preprocess_pima

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
) -> tuple[np.ndarray, float]:
    """Mini-batch SGD on logistic loss with a small L2 penalty."""
    w = w.copy()
    n = len(y)
    for _ in range(epochs):
        order = rng.permutation(n)
        for start in range(0, n, batch_size):
            batch = order[start:start + batch_size]
            Xb, yb = X[batch], y[batch]
            err = _predict_proba(w, b, Xb) - yb
            w -= learning_rate * (Xb.T @ err / len(batch) + L2_PENALTY * w)
            b -= learning_rate * float(err.mean())
    return w, b


def evaluate(w: np.ndarray, b: float, X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
    proba = _predict_proba(w, b, X)
    pred = (proba >= 0.5).astype(int)
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
) -> None:
    classifier = LogisticRegression()
    classifier.coef_ = w.reshape(1, -1)
    classifier.intercept_ = np.array([b])
    classifier.classes_ = np.array([0, 1])
    classifier.n_features_in_ = len(w)

    pipeline = Pipeline([
        ("imputer", imputer),
        ("scaler", scaler),
        ("classifier", classifier),
    ])

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
    experiment_id: Optional[str] = None,
    experiment_name: Optional[str] = None,
) -> dict[str, Any]:
    if training_method not in ("fedavg", "local_only"):
        raise ValueError(f"Unsupported training method: {training_method}")
    if partition_type not in ("iid", "non_iid"):
        raise ValueError(f"Unsupported partition type: {partition_type}")
    if dp_enabled and training_method != "fedavg":
        raise ValueError("Differential privacy is only supported for FedAvg")

    started = time.time()
    rng = np.random.default_rng(random_seed)

    df = preprocess_pima(df)
    dataset_fingerprint = compute_dataset_fingerprint(df)
    X = df[PIMA_FEATURE_COLUMNS].values.astype(np.float64)
    y = df[PIMA_TARGET_COLUMN].values.astype(np.int32)

    # Same split as the centralized baseline for a fair comparison
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_seed, stratify=y,
    )

    imputer = SimpleImputer(strategy="median").fit(X_train)
    scaler = StandardScaler().fit(imputer.transform(X_train))
    X_train = scaler.transform(imputer.transform(X_train))
    X_test = scaler.transform(imputer.transform(X_test))

    if partition_type == "non_iid":
        partitions = partition_non_iid(y_train, num_clients, rng)
    else:
        partitions = partition_iid(y_train, num_clients, rng)
    clients = [(X_train[idx], y_train[idx]) for idx in partitions]

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
        total = sum(len(cy) for _, cy in clients)

        for round_num in range(1, num_rounds + 1):
            round_start = time.time()
            agg_dw = np.zeros(num_features)
            agg_db = 0.0
            client_round_metrics = []

            for cid, (cx, cy) in enumerate(clients):
                w, b = local_sgd(global_w, global_b, cx, cy, local_epochs,
                                 learning_rate, batch_size, rng)
                dw, db = w - global_w, b - global_b
                update_norm = float(np.linalg.norm(np.concatenate([dw, [db]])))
                if dp_enabled:
                    dw, db, update_norm = privatize_update(dw, db, dp_clip_norm, sigma, rng)

                weight = len(cy) / total
                agg_dw += weight * dw
                agg_db += weight * db

                local_pred = (_predict_proba(w, b, cx) >= 0.5).astype(int)
                client_round_metrics.append({
                    **client_profiles[cid],
                    "train_accuracy": round(float((local_pred == cy).mean()), 6),
                    "train_loss": round(_log_loss(w, b, cx, cy), 6),
                    "update_norm": round(update_norm, 6),
                })

            global_w = global_w + agg_dw
            global_b = global_b + agg_db

            eval_metrics = evaluate(global_w, global_b, X_test, y_test)
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

        final_metrics = dict(rounds[-1]["eval_metrics"])
        final_w, final_b = global_w, global_b

    else:
        client_weights = [(np.zeros(num_features), 0.0) for _ in clients]
        for round_num in range(1, num_rounds + 1):
            round_start = time.time()
            client_round_metrics = []
            for cid, (cx, cy) in enumerate(clients):
                w, b = local_sgd(*client_weights[cid], cx, cy, local_epochs,
                                 learning_rate, batch_size, rng)
                client_weights[cid] = (w, b)
                test_m = evaluate(w, b, X_test, y_test)
                client_round_metrics.append({
                    **client_profiles[cid],
                    "test_accuracy": test_m["accuracy"],
                    "test_f1_score": test_m["f1_score"],
                    "test_roc_auc": test_m["roc_auc"],
                })

            eval_metrics = _mean_client_metrics(client_weights, X_test, y_test)
            rounds.append({
                "round_number": round_num,
                "train_metrics": {},
                "eval_metrics": eval_metrics,
                "client_metrics": client_round_metrics,
                "participating_clients": len(clients),
                "duration_seconds": round(time.time() - round_start, 4),
                "communication_bytes": 0,
            })

        final_metrics = dict(rounds[-1]["eval_metrics"])
        final_w, final_b = None, None

    duration = round(time.time() - started, 3)
    final_metrics["num_train_samples"] = int(len(y_train))
    final_metrics["num_test_samples"] = int(len(y_test))
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
            "model_type": "logistic_regression",
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
            "created_at": created_at,
            "experiment_id": experiment_id,
            "experiment_name": experiment_name,
            "status": "ready",
        })

    return {
        "model_id": model_id,
        "model_version": model_version,
        "model_type": "logistic_regression",
        "training_method": training_method,
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
