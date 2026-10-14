"""
FedHealth ML Service — API Tests
"""
import csv
import random

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.services import dataset_service

client = TestClient(app)

PIMA_COLUMNS = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome']

PATIENT = {
    "Pregnancies": 6,
    "Glucose": 148,
    "BloodPressure": 72,
    "SkinThickness": 35,
    "Insulin": 0,
    "BMI": 33.6,
    "DiabetesPedigreeFunction": 0.627,
    "Age": 50,
}


def write_pima_csv(path, rows=200):
    rng = random.Random(42)
    with open(path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(PIMA_COLUMNS)
        for _ in range(rows):
            glucose = rng.randint(60, 199)
            writer.writerow([
                rng.randint(0, 15),
                glucose,
                rng.randint(40, 120),
                rng.randint(10, 60),
                rng.randint(15, 600),
                round(rng.uniform(18, 60), 1),
                round(rng.uniform(0.08, 2.42), 3),
                rng.randint(21, 81),
                int(glucose > 130),
            ])


@pytest.fixture
def isolated_dirs(tmp_path, monkeypatch):
    """Point data/ and models/ at a temp dir so tests never touch real artifacts."""
    data_dir = tmp_path / "data"
    uploads_dir = data_dir / "uploads"
    models_dir = tmp_path / "models"
    uploads_dir.mkdir(parents=True)
    models_dir.mkdir()

    monkeypatch.setattr(dataset_service, "DATA_DIR", data_dir)
    monkeypatch.setattr(dataset_service, "UPLOADS_DIR", uploads_dir)
    from app.services import federated_service, prediction_service, training_service
    for module in (federated_service, prediction_service, training_service):
        monkeypatch.setattr(module, "MODELS_DIR", models_dir)
    monkeypatch.setattr(config, "MODELS_DIR", models_dir)

    write_pima_csv(uploads_dir / "test.csv")
    return data_dir


# ============ Health ============

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ml-service"


def test_health_under_ml_prefix():
    assert client.get("/api/v1/ml/health").status_code == 200


# ============ Datasets ============

def test_validate_local_dataset(isolated_dirs):
    response = client.post("/api/v1/ml/datasets/validate-local?filename=test.csv")
    assert response.status_code == 200
    assert response.json()["is_valid"] is True


def test_validate_local_rejects_path_traversal(isolated_dirs):
    response = client.post("/api/v1/ml/datasets/validate-local?filename=../../secret.csv")
    assert response.status_code == 404


# ============ Training + Prediction ============

def test_centralized_train_and_predict(isolated_dirs):
    response = client.post("/api/v1/ml/train/centralized", json={
        "dataset_path": "test.csv", "random_seed": 42, "test_size": 0.2,
    })
    assert response.status_code == 200, response.text
    trained = response.json()
    assert trained["training_method"] == "centralized"
    assert trained["metrics"]["accuracy"] > 0

    response = client.post("/api/v1/ml/predict", json={**PATIENT, "model_id": trained["model_id"]})
    assert response.status_code == 200, response.text
    pred = response.json()
    assert pred["prediction"] in [0, 1]
    assert 0 <= pred["probability"] <= 1
    assert pred["risk_level"] in ["Low", "Moderate", "High"]
    assert "disclaimer" in pred


@pytest.mark.parametrize("partition", ["iid", "non_iid"])
def test_fedavg_train_and_predict(isolated_dirs, partition):
    response = client.post("/api/v1/ml/train/federated", json={
        "dataset_path": "test.csv",
        "training_method": "fedavg",
        "partition_type": partition,
        "num_clients": 3,
        "num_rounds": 4,
    })
    assert response.status_code == 200, response.text
    result = response.json()
    assert len(result["rounds"]) == 4
    assert len(result["clients"]) == 3
    assert result["model_id"].startswith("fedavg_")

    response = client.post("/api/v1/ml/predict", json={**PATIENT, "model_id": result["model_id"]})
    assert response.status_code == 200, response.text


def test_fedavg_with_dp_reports_privacy(isolated_dirs):
    response = client.post("/api/v1/ml/train/federated", json={
        "dataset_path": "test.csv",
        "num_clients": 3,
        "num_rounds": 3,
        "dp_enabled": True,
        "dp_epsilon": 2.0,
    })
    assert response.status_code == 200, response.text
    privacy = response.json()["metrics"]["privacy"]
    assert privacy["cumulative_epsilon"] == pytest.approx(6.0)
    assert privacy["noise_sigma"] > 0


def test_local_only_has_no_model(isolated_dirs):
    response = client.post("/api/v1/ml/train/federated", json={
        "dataset_path": "test.csv",
        "training_method": "local_only",
        "num_clients": 3,
        "num_rounds": 2,
    })
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["model_id"] is None
    assert result["metrics"]["accuracy_std"] is not None


def test_dp_rejected_for_local_only(isolated_dirs):
    response = client.post("/api/v1/ml/train/federated", json={
        "dataset_path": "test.csv",
        "training_method": "local_only",
        "dp_enabled": True,
    })
    assert response.status_code == 400


def test_predict_validation_error():
    response = client.post("/api/v1/ml/predict", json={**PATIENT, "Pregnancies": -1})
    assert response.status_code == 422
