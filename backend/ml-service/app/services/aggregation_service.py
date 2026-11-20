"""FedAvg's server boundary: accepts model deltas and counts, never patient rows.

The transport is in-process in this educational simulator. Keeping this contract
separate makes the numerical boundary inspectable without claiming network isolation.
"""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class ClientUpdate:
    client_id: int
    num_samples: int
    delta: np.ndarray  # Feature-weight deltas followed by bias delta.


def aggregate_updates(
    global_parameters: np.ndarray, updates: list[ClientUpdate], parameter_order: list[str],
    *, round_number: int, noisy: bool = False,
) -> tuple[np.ndarray, dict]:
    """Return theta(t+1) = theta(t) + sum(n_k / N * delta_k), plus its trace."""
    if not updates:
        raise ValueError("FedAvg requires at least one client update")
    if global_parameters.ndim != 1 or len(parameter_order) != len(global_parameters):
        raise ValueError("Global model and parameter names must describe one vector")
    if not np.isfinite(global_parameters).all():
        raise ValueError("Global parameters must be finite")
    if len({u.client_id for u in updates}) != len(updates):
        raise ValueError("Duplicate client update")
    for update in updates:
        if update.num_samples <= 0:
            raise ValueError("Client sample counts must be positive")
        if update.delta.shape != global_parameters.shape or not np.isfinite(update.delta).all():
            raise ValueError("Client update must match the model shape and contain finite values")

    total = sum(u.num_samples for u in updates)
    weighted_delta = np.zeros_like(global_parameters, dtype=np.float64)
    payloads = []
    for update in updates:
        share = update.num_samples / total
        weighted_delta += share * update.delta
        payloads.append({
            "client_id": update.client_id,
            "num_samples": update.num_samples,
            "aggregation_weight": share,
            "delta": update.delta.tolist(),
        })
    next_parameters = global_parameters + weighted_delta
    return next_parameters, {
        "schema_version": 1,
        "round_number": round_number,
        "algorithm": "sample_weighted_fedavg",
        "parameter_order": parameter_order,
        "initialization": "zeros" if round_number == 1 else "previous_global_model",
        "global_before": global_parameters.tolist(),
        "client_updates": payloads,
        "weighted_delta": weighted_delta.tolist(),
        "global_after": next_parameters.tolist(),
        "total_train_samples": total,
        "updates_privatized": noisy,
        "transport": "in_process_simulation",
        "parameter_bytes_per_vector": int(global_parameters.size * 8),
    }
