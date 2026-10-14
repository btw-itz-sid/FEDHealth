"""
FedHealth — demo setup
======================
Prepares a running stack for a live demo:
1. Logs in as the seeded researcher
2. Uploads data/diabetes.csv (if no valid dataset exists yet) and waits for validation
3. Runs the benchmark suite (centralized, FedAvg IID/non-IID, local-only, FedAvg+DP)
4. Waits for every experiment to finish and prints a results table

Requires the API (port 3001) and ML service (port 8000) to be running.
Run with the ML service virtualenv, which already has httpx:

    backend/ml-service/.venv/Scripts/python scripts/demo_setup.py
"""
import argparse
import os
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent

SUITE = [
    {"name": "Centralized baseline", "trainingMethod": "centralized", "partitionType": "none"},
    {"name": "FedAvg IID", "trainingMethod": "fedavg", "partitionType": "iid"},
    {"name": "FedAvg Non-IID", "trainingMethod": "fedavg", "partitionType": "non_iid"},
    {"name": "Local only IID", "trainingMethod": "local_only", "partitionType": "iid"},
    {"name": "Local only Non-IID", "trainingMethod": "local_only", "partitionType": "non_iid"},
] + [
    {
        "name": f"FedAvg IID + DP eps={eps}",
        "trainingMethod": "fedavg",
        "partitionType": "iid",
        "differentialPrivacy": True,
        "dpConfig": {"epsilon": eps, "delta": 1e-5, "clipNorm": 1.0},
    }
    for eps in (0.5, 1, 5, 10)
]

FEDERATED_DEFAULTS = {"numClients": 5, "numRounds": 20, "localEpochs": 5, "learningRate": 0.1, "batchSize": 32}


def wait_for(predicate, timeout: float, interval: float = 1.5):
    deadline = time.time() + timeout
    while time.time() < deadline:
        result = predicate()
        if result:
            return result
        time.sleep(interval)
    raise TimeoutError("Timed out waiting for the API")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default=os.getenv("FEDHEALTH_API", "http://localhost:3001/api/v1"))
    parser.add_argument("--email", default="researcher@fedhealth.dev")
    parser.add_argument("--password", default=os.getenv("FEDHEALTH_RESEARCHER_PASSWORD", "ResearchPass123!"))
    parser.add_argument("--csv", default=str(ROOT / "data" / "diabetes.csv"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    client = httpx.Client(base_url=args.api, timeout=60)

    login = client.post("/auth/login", json={"email": args.email, "password": args.password})
    if login.status_code != 201 and login.status_code != 200:
        print(f"Login failed ({login.status_code}): {login.text}. Did you run `npm run seed`?")
        return 1
    client.headers["Authorization"] = f"Bearer {login.json()['accessToken']}"

    datasets = client.get("/datasets", params={"limit": 100}).json()["items"]
    dataset = next((d for d in datasets if d["status"] == "valid"), None)
    if dataset is None:
        csv_path = Path(args.csv)
        if not csv_path.exists():
            print(f"Dataset not found at {csv_path}. See data/README.md.")
            return 1
        print(f"Uploading {csv_path.name} …")
        with open(csv_path, "rb") as f:
            upload = client.post(
                "/datasets",
                files={"file": (csv_path.name, f, "text/csv")},
                data={"name": "PIMA Indians Diabetes", "description": "768 patients, 8 features"},
            )
        upload.raise_for_status()
        dataset_id = upload.json()["id"]

        def validated():
            d = client.get(f"/datasets/{dataset_id}").json()
            return d if d["status"] in ("valid", "invalid") else None

        dataset = wait_for(validated, timeout=60)
        if dataset["status"] != "valid":
            print(f"Dataset is invalid: {dataset.get('validationResult')}")
            return 1
    print(f"Using dataset '{dataset['name']}' ({dataset['numRows']} rows)")

    ids = []
    for spec in SUITE:
        body = {"datasetId": dataset["id"], "randomSeed": args.seed, "testSize": 0.2, **spec}
        if spec["trainingMethod"] != "centralized":
            body.update(FEDERATED_DEFAULTS)
        response = client.post("/experiments", json=body)
        response.raise_for_status()
        ids.append(response.json()["id"])
        print(f"  started: {spec['name']}")

    def all_done():
        exps = [client.get(f"/experiments/{i}").json() for i in ids]
        return exps if all(e["status"] in ("completed", "failed", "cancelled") for e in exps) else None

    experiments = wait_for(all_done, timeout=300)

    print()
    print(f"{'Experiment':<30} {'Status':<10} {'Accuracy':>9} {'F1':>7} {'ROC-AUC':>8}")
    print("-" * 68)
    for e in experiments:
        m = e.get("finalMetrics") or {}
        fmt = lambda v: f"{v:.3f}" if isinstance(v, (int, float)) else "—"
        print(f"{e['name']:<30} {e['status']:<10} {fmt(m.get('accuracy')):>9} {fmt(m.get('f1_score')):>7} {fmt(m.get('roc_auc')):>8}")
        if e["status"] == "failed":
            print(f"    error: {e.get('errorMessage')}")

    failed = [e for e in experiments if e["status"] != "completed"]
    print()
    print("Open http://localhost:5173/compare to see the comparison charts.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
