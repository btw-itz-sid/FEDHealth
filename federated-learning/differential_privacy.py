"""
FedHealth — Differential Privacy Module
=========================================
Implements Gaussian mechanism for differential privacy in federated learning.
Adds calibrated noise to model updates before aggregation.

Key concepts:
- ε (epsilon): Privacy budget. Lower = more private. Typical: 1-10.
- δ (delta): Probability of privacy breach. Typical: 1e-5.
- Sensitivity: Maximum influence of one data point on the output.
- σ (sigma): Noise scale, calibrated from ε, δ, and sensitivity.
"""

import numpy as np
from dataclasses import dataclass
from typing import Optional


@dataclass
class DPConfig:
    """Differential privacy configuration."""
    epsilon: float = 1.0       # Privacy budget
    delta: float = 1e-5        # Privacy breach probability
    max_grad_norm: float = 1.0 # Gradient clipping bound (sensitivity)
    noise_multiplier: Optional[float] = None  # Override sigma if set

    def compute_sigma(self) -> float:
        """
        Compute noise standard deviation using the Gaussian mechanism.
        σ = sensitivity * sqrt(2 * ln(1.25/δ)) / ε
        """
        if self.noise_multiplier is not None:
            return self.noise_multiplier
        return self.max_grad_norm * np.sqrt(2 * np.log(1.25 / self.delta)) / self.epsilon


@dataclass
class PrivacyAccountant:
    """
    Simple privacy accountant that tracks cumulative privacy loss.
    Uses basic composition theorem: total ε = sum of per-round ε.
    """
    total_epsilon: float = 0.0
    total_delta: float = 0.0
    rounds_consumed: int = 0
    budget_epsilon: float = 10.0  # Total privacy budget
    budget_delta: float = 1e-4

    def consume(self, epsilon: float, delta: float) -> bool:
        """
        Record privacy expenditure for one round.
        Returns True if within budget, False if budget exceeded.
        """
        self.total_epsilon += epsilon
        self.total_delta += delta
        self.rounds_consumed += 1

        return self.is_within_budget()

    def is_within_budget(self) -> bool:
        return (self.total_epsilon <= self.budget_epsilon and
                self.total_delta <= self.budget_delta)

    def remaining_epsilon(self) -> float:
        return max(0, self.budget_epsilon - self.total_epsilon)

    def to_dict(self) -> dict:
        return {
            'total_epsilon': self.total_epsilon,
            'total_delta': self.total_delta,
            'rounds_consumed': self.rounds_consumed,
            'budget_epsilon': self.budget_epsilon,
            'budget_delta': self.budget_delta,
            'remaining_epsilon': self.remaining_epsilon(),
            'within_budget': self.is_within_budget(),
        }


def clip_model_update(
    coef: np.ndarray,
    intercept: np.ndarray,
    global_coef: np.ndarray,
    global_intercept: np.ndarray,
    max_norm: float,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Clip the model update (delta) to bound sensitivity.
    update = local_params - global_params
    clipped_update = update * min(1, max_norm / ||update||)
    """
    delta_coef = coef - global_coef
    delta_intercept = intercept - global_intercept

    # Flatten all deltas into one vector for norm computation
    delta_flat = np.concatenate([delta_coef.flatten(), delta_intercept.flatten()])
    norm = np.linalg.norm(delta_flat)

    if norm > max_norm:
        scale = max_norm / norm
        delta_coef *= scale
        delta_intercept *= scale

    return global_coef + delta_coef, global_intercept + delta_intercept


def add_gaussian_noise(
    coef: np.ndarray,
    intercept: np.ndarray,
    sigma: float,
    seed: Optional[int] = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Add Gaussian noise to model parameters for differential privacy.
    Noise ~ N(0, σ²I)
    """
    rng = np.random.default_rng(seed)

    noisy_coef = coef + rng.normal(0, sigma, size=coef.shape)
    noisy_intercept = intercept + rng.normal(0, sigma, size=intercept.shape)

    return noisy_coef, noisy_intercept


def apply_dp_to_update(
    local_coef: np.ndarray,
    local_intercept: np.ndarray,
    global_coef: np.ndarray,
    global_intercept: np.ndarray,
    dp_config: DPConfig,
    seed: Optional[int] = None,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Full DP pipeline for a single client update:
    1. Clip the model update
    2. Add calibrated Gaussian noise
    """
    # Step 1: Clip
    clipped_coef, clipped_intercept = clip_model_update(
        local_coef, local_intercept,
        global_coef, global_intercept,
        dp_config.max_grad_norm,
    )

    # Step 2: Add noise
    sigma = dp_config.compute_sigma()
    noisy_coef, noisy_intercept = add_gaussian_noise(
        clipped_coef, clipped_intercept, sigma, seed,
    )

    return noisy_coef, noisy_intercept


def run_dp_federated_simulation(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    num_clients: int = 5,
    num_rounds: int = 10,
    partition_type: str = 'iid',
    dp_config: Optional[DPConfig] = None,
    seed: int = 42,
    max_iter_per_round: int = 50,
):
    """
    Federated learning with differential privacy.
    Same as run_federated_simulation but with DP noise injection.
    """
    # Import from simulation module
    from simulation import (
        partition_iid,
        partition_non_iid,
        train_local_client,
        evaluate_model,
        RoundMetrics,
        FLExperimentResult,
    )
    from sklearn.preprocessing import StandardScaler
    import time

    if dp_config is None:
        dp_config = DPConfig()

    accountant = PrivacyAccountant(
        budget_epsilon=dp_config.epsilon * num_rounds * 2,  # generous budget
        budget_delta=dp_config.delta * num_rounds,
    )

    start_time = time.time()

    scaler = StandardScaler()
    scaler.fit(X_train)

    # Partition
    if partition_type == 'non_iid':
        client_data = partition_non_iid(X_train, y_train, num_clients, seed)
    else:
        client_data = partition_iid(X_train, y_train, num_clients, seed)

    # Initialize
    from sklearn.linear_model import LogisticRegression
    init_model = LogisticRegression(max_iter=1, random_state=seed, solver='lbfgs')
    X_init = scaler.transform(X_train[:10])
    init_model.fit(X_init, y_train[:10])
    global_coef = init_model.coef_.copy()
    global_intercept = init_model.intercept_.copy()

    round_history = []

    for round_num in range(1, num_rounds + 1):
        round_start = time.time()

        client_results = []
        for i, (X_client, y_client) in enumerate(client_data):
            result = train_local_client(
                i, X_client, y_client, scaler,
                max_iter=max_iter_per_round, seed=seed + round_num,
            )

            # Apply DP: clip + noise
            dp_coef, dp_intercept = apply_dp_to_update(
                result.coef, result.intercept,
                global_coef, global_intercept,
                dp_config,
                seed=seed + round_num * 1000 + i,
            )
            result.coef = dp_coef
            result.intercept = dp_intercept
            client_results.append(result)

        # Track privacy
        accountant.consume(dp_config.epsilon, dp_config.delta)

        # Aggregate (FedAvg on noisy updates)
        from simulation import fedavg_aggregate
        global_coef, global_intercept = fedavg_aggregate(client_results)

        eval_metrics = evaluate_model(global_coef, global_intercept, X_test, y_test, scaler)
        eval_metrics['privacy'] = accountant.to_dict()

        round_metrics = RoundMetrics(
            round_number=round_num,
            train_metrics={
                'mean_client_accuracy': float(np.mean([r.train_accuracy for r in client_results])),
            },
            eval_metrics=eval_metrics,
            client_metrics=[
                {'client_id': r.client_id, 'num_samples': r.num_samples, 'train_accuracy': r.train_accuracy}
                for r in client_results
            ],
            participating_clients=len(client_results),
            duration_seconds=time.time() - round_start,
        )
        round_history.append(round_metrics)

    return FLExperimentResult(
        training_method='fedavg_dp',
        partition_type=partition_type,
        num_clients=num_clients,
        num_rounds=num_rounds,
        random_seed=seed,
        final_metrics={**round_history[-1].eval_metrics, 'dp_config': {
            'epsilon': dp_config.epsilon,
            'delta': dp_config.delta,
            'max_grad_norm': dp_config.max_grad_norm,
            'sigma': dp_config.compute_sigma(),
        }},
        round_history=round_history,
        total_duration_seconds=time.time() - start_time,
        global_coef=global_coef,
        global_intercept=global_intercept,
    )
