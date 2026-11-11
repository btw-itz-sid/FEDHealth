"""
FedHealth — export the comparison table
=======================================
Writes one CSV row per experiment name, using the most recent completed run,
so repeated benchmark suites do not create duplicate rows.

Requires the API (port 3001) to be running:

    backend/ml-service/.venv/Scripts/python scripts/export_comparison.py
"""
import argparse
import csv
import os
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent

COLUMNS = [
    "name", "setup", "training_method", "partition", "balanced_classes",
    "clients", "rounds", "local_epochs", "learning_rate", "batch_size", "seed", "test_size",
    "accuracy", "precision", "recall", "f1_score", "roc_auc",
    "accuracy_std", "precision_std", "recall_std", "f1_score_std", "roc_auc_std",
    "epsilon_per_round", "total_epsilon", "delta_per_round", "cumulative_delta", "clip_norm",
    "cm_true0_pred0", "cm_true0_pred1", "cm_true1_pred0", "cm_true1_pred1", "confusion_matrix_scope",
    "train_samples", "test_samples", "communication_kb", "duration_seconds", "status",
]

METHOD_ORDER = {"centralized": 0, "fedavg": 1, "local_only": 2}
PARTITION_LABEL = {"iid": "IID", "non_iid": "Non-IID"}
METHOD_LABEL = {"centralized": "Centralized", "fedavg": "FedAvg", "local_only": "Local only"}


def setup_label(e: dict) -> str:
    parts = [METHOD_LABEL.get(e["trainingMethod"], e["trainingMethod"])]
    if e["partitionType"] in PARTITION_LABEL:
        parts.append(PARTITION_LABEL[e["partitionType"]])
    if e["differentialPrivacy"]:
        parts.append(f"DP eps={e['dpConfig']['epsilon']:g}")
    if e.get("balanceClasses"):
        parts.append("Balanced")
    return " | ".join(parts)


def sort_key(e: dict):
    eps = e["dpConfig"]["epsilon"] if e["differentialPrivacy"] else 0
    return (
        bool(e.get("balanceClasses")),
        e["differentialPrivacy"],
        eps,
        METHOD_ORDER.get(e["trainingMethod"], 9),
        e["partitionType"] != "none" and e["partitionType"] != "iid",
    )


def to_row(e: dict) -> dict:
    m = e.get("finalMetrics") or {}
    centralized = e["trainingMethod"] == "centralized"
    local_only = e["trainingMethod"] == "local_only"
    privacy = m.get("privacy") or {}
    cm = m.get("confusion_matrix") or [[None, None], [None, None]]
    comm = m.get("total_communication_bytes")
    row = {
        "name": e["name"],
        "setup": setup_label(e),
        "training_method": e["trainingMethod"],
        "partition": e["partitionType"],
        "balanced_classes": "yes" if e.get("balanceClasses") else "no",
        "clients": None if centralized else e["numClients"],
        "rounds": None if centralized else e["numRounds"],
        "local_epochs": None if centralized else e["localEpochs"],
        "learning_rate": None if centralized else e["learningRate"],
        "batch_size": None if centralized else e["batchSize"],
        "seed": e["randomSeed"],
        "test_size": e["testSize"],
        "epsilon_per_round": privacy.get("epsilon_per_round"),
        "total_epsilon": privacy.get("cumulative_epsilon"),
        "delta_per_round": privacy.get("delta_per_round"),
        "cumulative_delta": privacy.get("cumulative_delta"),
        "clip_norm": privacy.get("clip_norm"),
        "cm_true0_pred0": cm[0][0],
        "cm_true0_pred1": cm[0][1],
        "cm_true1_pred0": cm[1][0],
        "cm_true1_pred1": cm[1][1],
        "confusion_matrix_scope": (
            f"sum of {e['numClients']} clients each scored on the same test set"
            if local_only else "single held-out test set"
        ),
        "train_samples": m.get("num_train_samples"),
        "test_samples": m.get("num_test_samples"),
        "communication_kb": None if comm is None else round(comm / 1024, 1),
        "duration_seconds": e.get("durationSeconds"),
        "status": e["status"],
    }
    for key in ("accuracy", "precision", "recall", "f1_score", "roc_auc"):
        row[key] = m.get(key)
        row[f"{key}_std"] = m.get(f"{key}_std")
    return row


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default=os.getenv("FEDHEALTH_API", "http://localhost:3001/api/v1"))
    parser.add_argument("--email", default="researcher@fedhealth.dev")
    parser.add_argument("--password", default=os.getenv("FEDHEALTH_RESEARCHER_PASSWORD", "ResearchPass123!"))
    parser.add_argument("--out", default=str(ROOT / "docs" / "fedhealth-comparison.csv"))
    args = parser.parse_args()

    client = httpx.Client(base_url=args.api, timeout=60)
    login = client.post("/auth/login", json={"email": args.email, "password": args.password})
    if login.status_code not in (200, 201):
        print(f"Login failed ({login.status_code}): {login.text}")
        return 1
    client.headers["Authorization"] = f"Bearer {login.json()['accessToken']}"

    items = client.get("/experiments", params={"limit": 100}).json()["items"]
    latest: dict[str, dict] = {}
    for item in items:
        if item["status"] != "completed":
            continue
        if item["name"] not in latest or item["createdAt"] > latest[item["name"]]["createdAt"]:
            latest[item["name"]] = item

    experiments = [client.get(f"/experiments/{i['id']}").json() for i in latest.values()]
    experiments.sort(key=sort_key)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        for e in experiments:
            writer.writerow(to_row(e))

    print(f"Wrote {len(experiments)} experiments to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
