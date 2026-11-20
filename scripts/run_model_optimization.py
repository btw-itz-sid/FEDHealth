"""Reproduce the frozen prediction search without changing the active app model."""

import csv
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "ml-service"))

import pandas as pd
from app.services import training_service

frame = pd.read_csv(ROOT / "data" / "diabetes.csv")
rows, evidence = [], []
with tempfile.TemporaryDirectory(prefix="fedhealth-selection-") as folder:
    original_storage = training_service.MODELS_DIR
    training_service.MODELS_DIR = Path(folder)
    try:
        for seed in (7, 21, 42):
            result = training_service.train_centralized(frame, random_seed=seed, optimize=True)
            m = result["metrics"]
            selected = m["optimization"]["selected"]
            row = {"seed": seed, "method": "centralized", "estimator": selected["estimator"],
                "selection_objective": "f1", "development_samples": m["num_train_samples"],
                "test_samples": m["num_test_samples"],
                "test_split_sha256": m["evaluation_manifest"]["splits"]["test"]["indices_sha256"],
                **{key: m[key] for key in ("accuracy", "precision", "recall", "f1_score", "roc_auc")}}
            rows.append(row)
            evidence.append({"seed": seed, "metrics": m, "training_config": result["training_config"]})
            print(json.dumps(row), flush=True)
    finally:
        training_service.MODELS_DIR = original_storage
output = ROOT / "docs" / "benchmarks"
output.mkdir(exist_ok=True)
with (output / "optimized-prediction-multiseed.csv").open("w", newline="") as handle:
    writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
(output / "optimized-prediction-multiseed.json").write_text(json.dumps(evidence, indent=2))
