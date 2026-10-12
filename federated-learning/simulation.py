"""
FedHealth — Federated Learning Simulation
==========================================
Implements a research-grade FL simulation using scikit-learn:
- Data partitioning (IID and Non-IID)
- Local client training
- FedAvg aggregation
- Per-round metrics tracking
- Comparison with centralized baseline

This is a simulation — not a production FL framework. For real FL,
consider using Flower (flwr) or PySyft.
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix,
)
from dataclasses import dataclass, field
from typing import Optional
import time
import hashlib
import json


# ---- Data Partitioning ----

def partition_iid(X: np.ndarray, y: np.ndarray, num_clients: int, seed: int = 42) -> list:
    """Partition data into IID splits for simulated clients."""
    rng = np.random.default_rng(seed)
    indices = rng.permutation(len(X))
    splits = np.array_split(indices, num_clients)
    return [(X[s], y[s]) for s in splits]


def partition_non_iid(X: np.ndarray, y: np.ndarray, num_clients: int, seed: int = 42) -> list:
    """
    Non-IID partition: sort by label, then distribute shards.
    Each client gets 2 shards, creating class imbalance.
    """
    rng = np.random.default_rng(seed)
    sorted_indices = np.argsort(y)
    num_shards = num_clients * 2
    shard_size = len(y) // num_shards
    shards = [sorted_indices[i * shard_size:(i + 1) * shard_size] for i in range(num_shards)]

    # Shuffle shard order, assign 2 per client
    shard_order = rng.permutation(num_shards)
    client_data = []
    for i in range(num_clients):
        idx = np.concatenate([shards[shard_order[2 * i]], shards[shard_order[2 * i + 1]]])
        rng.shuffle(idx)
        client_data.append((X[idx], y[idx]))
    return client_data


# ---- Local Training ----

@dataclass
class ClientResult:
    """Result from a single client's local training."""
    client_id: int
    coef: np.ndarray
    intercept: np.ndarray
    num_samples: int
    train_accuracy: float
    class_distribution: dict


def train_local_client(
    client_id: int,
    X_train: np.ndarray,
    y_train: np.ndarray,
    scaler: StandardScaler,
    max_iter: int = 200,
    C: float = 1.0,
    seed: int = 42,
) -> ClientResult:
    """Train a logistic regression model on a single client's data."""
    X_scaled = scaler.transform(X_train)

    model = LogisticRegression(
        max_iter=max_iter, C=C, random_state=seed, solver='lbfgs',
    )
    model.fit(X_scaled, y_train)

    y_pred = model.predict(X_scaled)
    accuracy = accuracy_score(y_train, y_pred)

    unique, counts = np.unique(y_train, return_counts=True)
    class_dist = {str(int(u)): int(c) for u, c in zip(unique, counts)}

    return ClientResult(
        client_id=client_id,
        coef=model.coef_,
        intercept=model.intercept_,
        num_samples=len(y_train),
        train_accuracy=accuracy,
        class_distribution=class_dist,
    )


# ---- FedAvg Aggregation ----

def fedavg_aggregate(client_results: list[ClientResult]) -> tuple[np.ndarray, np.ndarray]:
    """
    Federated Averaging: weighted average of model parameters.
    Weights are proportional to each client's sample count.
    """
    total_samples = sum(r.num_samples for r in client_results)

    agg_coef = np.zeros_like(client_results[0].coef)
    agg_intercept = np.zeros_like(client_results[0].intercept)

    for result in client_results:
        weight = result.num_samples / total_samples
        agg_coef += weight * result.coef
        agg_intercept += weight * result.intercept

    return agg_coef, agg_intercept


# ---- Evaluation ----

def evaluate_model(
    coef: np.ndarray,
    intercept: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    scaler: StandardScaler,
) -> dict:
    """Evaluate model parameters on test data."""
    model = LogisticRegression()
    model.coef_ = coef
    model.intercept_ = intercept
    model.classes_ = np.array([0, 1])

    X_scaled = scaler.transform(X_test)
    y_pred = model.predict(X_scaled)
    y_prob = model.predict_proba(X_scaled)[:, 1]

    cm = confusion_matrix(y_test, y_pred)

    return {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, y_prob)),
        'confusion_matrix': cm.tolist(),
        'num_test_samples': len(y_test),
    }


# ---- FL Simulation Runner ----

@dataclass
class RoundMetrics:
    round_number: int
    train_metrics: dict
    eval_metrics: dict
    client_metrics: list
    participating_clients: int
    duration_seconds: float


@dataclass
class FLExperimentResult:
    training_method: str
    partition_type: str
    num_clients: int
    num_rounds: int
    random_seed: int
    final_metrics: dict
    round_history: list[RoundMetrics]
    total_duration_seconds: float
    global_coef: Optional[np.ndarray] = None
    global_intercept: Optional[np.ndarray] = None


def run_federated_simulation(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    num_clients: int = 5,
    num_rounds: int = 10,
    partition_type: str = 'iid',
    seed: int = 42,
    max_iter_per_round: int = 50,
) -> FLExperimentResult:
    """
    Run a complete federated learning simulation.

    Each round:
    1. Distribute global model to clients
    2. Each client trains locally
    3. Aggregate using FedAvg
    4. Evaluate global model on test set
    """
    start_time = time.time()

    # Fit scaler on all training data (shared preprocessing)
    scaler = StandardScaler()
    scaler.fit(X_train)

    # Partition data
    if partition_type == 'non_iid':
        client_data = partition_non_iid(X_train, y_train, num_clients, seed)
    else:
        client_data = partition_iid(X_train, y_train, num_clients, seed)

    # Initialize global model (random init via one-step fit)
    init_model = LogisticRegression(max_iter=1, random_state=seed, solver='lbfgs')
    X_init = scaler.transform(X_train[:10])
    init_model.fit(X_init, y_train[:10])
    global_coef = init_model.coef_
    global_intercept = init_model.intercept_

    round_history = []

    for round_num in range(1, num_rounds + 1):
        round_start = time.time()

        # Local training
        client_results = []
        for i, (X_client, y_client) in enumerate(client_data):
            result = train_local_client(
                client_id=i,
                X_train=X_client,
                y_train=y_client,
                scaler=scaler,
                max_iter=max_iter_per_round,
                seed=seed + round_num,
            )
            client_results.append(result)

        # FedAvg aggregation
        global_coef, global_intercept = fedavg_aggregate(client_results)

        # Evaluate global model
        eval_metrics = evaluate_model(global_coef, global_intercept, X_test, y_test, scaler)

        # Compile round metrics
        round_metrics = RoundMetrics(
            round_number=round_num,
            train_metrics={
                'mean_client_accuracy': float(np.mean([r.train_accuracy for r in client_results])),
                'min_client_accuracy': float(np.min([r.train_accuracy for r in client_results])),
                'max_client_accuracy': float(np.max([r.train_accuracy for r in client_results])),
            },
            eval_metrics=eval_metrics,
            client_metrics=[
                {
                    'client_id': r.client_id,
                    'num_samples': r.num_samples,
                    'train_accuracy': r.train_accuracy,
                    'class_distribution': r.class_distribution,
                }
                for r in client_results
            ],
            participating_clients=len(client_results),
            duration_seconds=time.time() - round_start,
        )
        round_history.append(round_metrics)

    total_duration = time.time() - start_time
    final_metrics = round_history[-1].eval_metrics

    return FLExperimentResult(
        training_method='fedavg',
        partition_type=partition_type,
        num_clients=num_clients,
        num_rounds=num_rounds,
        random_seed=seed,
        final_metrics=final_metrics,
        round_history=round_history,
        total_duration_seconds=total_duration,
        global_coef=global_coef,
        global_intercept=global_intercept,
    )


def run_local_only_simulation(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    num_clients: int = 5,
    partition_type: str = 'iid',
    seed: int = 42,
) -> dict:
    """
    Local-only baseline: each client trains independently, no aggregation.
    Returns per-client metrics for comparison.
    """
    scaler = StandardScaler()
    scaler.fit(X_train)

    if partition_type == 'non_iid':
        client_data = partition_non_iid(X_train, y_train, num_clients, seed)
    else:
        client_data = partition_iid(X_train, y_train, num_clients, seed)

    client_metrics = []
    for i, (X_client, y_client) in enumerate(client_data):
        result = train_local_client(i, X_client, y_client, scaler, seed=seed)
        eval_m = evaluate_model(result.coef, result.intercept, X_test, y_test, scaler)
        client_metrics.append({
            'client_id': i,
            'num_samples': result.num_samples,
            'train_accuracy': result.train_accuracy,
            'eval_metrics': eval_m,
        })

    return {
        'training_method': 'local_only',
        'partition_type': partition_type,
        'num_clients': num_clients,
        'client_metrics': client_metrics,
        'mean_accuracy': float(np.mean([m['eval_metrics']['accuracy'] for m in client_metrics])),
        'std_accuracy': float(np.std([m['eval_metrics']['accuracy'] for m in client_metrics])),
    }
