"""Reproduce the v2 research comparison without changing the active app models.

Run with backend/ml-service/.venv/Scripts/python scripts/run_research_benchmark.py.
Outputs contain aggregate metrics and split hashes, never patient records.
"""

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "ml-service"))

import pandas as pd

from app.services import federated_service, training_service
from app.services.dataset_service import validate_dataset


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=ROOT / "data" / "diabetes.csv")
    parser.add_argument("--seeds", type=int, nargs="+", default=[7, 21, 42])
    parser.add_argument("--rounds", type=int, default=10)
    parser.add_argument("--clients", type=int, default=5)
    parser.add_argument("--local-epochs", type=int, default=5)
    parser.add_argument("--balanced", action="store_true")
    parser.add_argument("--epsilon", type=float, nargs="*", default=[.5, 1, 5, 10])
    parser.add_argument("--output", type=Path, default=ROOT / "docs" / "benchmarks" / "benchmark-v2.csv")
    args = parser.parse_args()
    if args.rounds < 1 or args.clients < 2 or args.local_epochs < 1 or any(e <= 0 for e in args.epsilon):
        parser.error("rounds/epochs/epsilon must be positive and clients >= 2")

    dataset = pd.read_csv(args.dataset)
    validation = validate_dataset(dataset)
    if not validation.is_valid:
        parser.error(f"Invalid dataset: {validation.errors}")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    artifacts = ROOT / "artifacts"
    artifacts.mkdir(exist_ok=True)
    rows = []
    manifests = {}
    # All benchmark artifacts are disposable and isolated from the model registry.
    with TemporaryDirectory(prefix="benchmark-", dir=artifacts) as storage:
        previous_federated = federated_service.MODELS_DIR
        previous_centralized = training_service.MODELS_DIR
        federated_service.MODELS_DIR = training_service.MODELS_DIR = Path(storage)
        try:
            for seed in args.seeds:
                setups = [("centralized", "none", None), ("local_only", "iid", None),
                          ("local_only", "non_iid", None), ("fedavg", "iid", None),
                          ("fedavg", "non_iid", None)]
                setups += [("fedavg", "iid", epsilon) for epsilon in args.epsilon]
                for method, partition, epsilon in setups:
                    if method == "centralized":
                        result = training_service.train_centralized(
                            dataset, random_seed=seed, balance_classes=args.balanced,
                        )
                    else:
                        result = federated_service.train_federated(
                            dataset, training_method=method, partition_type=partition,
                            random_seed=seed, num_clients=args.clients, num_rounds=args.rounds,
                            local_epochs=args.local_epochs, balance_classes=args.balanced,
                            dp_enabled=epsilon is not None, dp_epsilon=epsilon or 1,
                        )
                    metrics = result["metrics"]
                    manifest = metrics["evaluation_manifest"]
                    if seed in manifests and manifests[seed] != manifest:
                        raise RuntimeError("Evaluation split mismatch between training methods")
                    manifests[seed] = manifest
                    rows.append({
                        "method": method, "partition": partition, "epsilon_per_round": epsilon,
                        "seed": seed, "balanced": args.balanced,
                        "dataset_fingerprint": result["dataset_fingerprint"],
                        "evaluation_protocol": metrics["evaluation_protocol"],
                        "train_samples": metrics["num_train_samples"],
                        "validation_samples": metrics["num_validation_samples"],
                        "test_samples": metrics["num_test_samples"],
                        "train_split_sha256": manifest["splits"]["train"]["indices_sha256"],
                        "clients": args.clients if method != "centralized" else None,
                        "rounds": args.rounds if method != "centralized" else None,
                        "local_epochs": args.local_epochs if method != "centralized" else None,
                        **{key: metrics[key] for key in ("accuracy", "precision", "recall", "f1_score", "roc_auc")},
                        "validation_accuracy": metrics["validation_metrics"]["accuracy"],
                        "parameter_communication_bytes": metrics.get("total_communication_bytes", 0),
                    })
                    print(f"seed={seed} {method}/{partition} epsilon={epsilon}: accuracy={metrics['accuracy']:.4f}", flush=True)
        finally:
            federated_service.MODELS_DIR = previous_federated
            training_service.MODELS_DIR = previous_centralized

    with args.output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    manifest_output = args.output.with_suffix(".manifest.json")
    manifest_output.write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset_fingerprint": rows[0]["dataset_fingerprint"],
        "config": {"seeds": args.seeds, "rounds": args.rounds, "clients": args.clients,
                   "local_epochs": args.local_epochs, "balanced": args.balanced,
                   "learning_rate": .1, "batch_size": 32, "test_fraction": .2,
                   "epsilon_per_round": args.epsilon, "delta_per_round": 1e-5, "clip_norm": 1},
        "evaluation_manifests": manifests,
        "privacy_note": "Seeded update noise is an educational mechanism, not certified DP.",
        "statistics_note": "Seeds vary holdout splits. Report mean and sample standard deviation as descriptive variability, not a confidence interval.",
    }, indent=2), encoding="utf-8")
    print(f"Saved {len(rows)} measured runs to {args.output}", flush=True)


if __name__ == "__main__":
    main()
