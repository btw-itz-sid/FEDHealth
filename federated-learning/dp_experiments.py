"""
FedHealth — DP Experiment Extension
Adds DP experiments to the CLI runner.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from differential_privacy import DPConfig, run_dp_federated_simulation


def run_dp_experiments(X_train, y_train, X_test, y_test, num_clients=5, num_rounds=10, seed=42):
    """Run DP experiments with varying epsilon values."""
    epsilons = [0.5, 1.0, 5.0, 10.0]
    results = {}

    for eps in epsilons:
        print(f'  DP FedAvg (ε={eps})...')
        dp_config = DPConfig(epsilon=eps, delta=1e-5, max_grad_norm=1.0)

        result = run_dp_federated_simulation(
            X_train, y_train, X_test, y_test,
            num_clients=num_clients, num_rounds=num_rounds,
            partition_type='iid', dp_config=dp_config, seed=seed,
        )

        key = f'fedavg_dp_eps{eps}'
        results[key] = {
            'training_method': 'fedavg_dp',
            'epsilon': eps,
            'delta': 1e-5,
            'sigma': dp_config.compute_sigma(),
            **result.final_metrics,
            'duration_seconds': result.total_duration_seconds,
        }
        print(f'    Accuracy: {result.final_metrics["accuracy"]:.4f} | σ={dp_config.compute_sigma():.4f}')

    return results
