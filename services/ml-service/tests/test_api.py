"""
FedHealth ML Service — Tests
"""
import pytest
from fastapi.testclient import TestClient
import os
import tempfile
import csv

from app.main import app

client = TestClient(app)


# ============ Health Tests ============

def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "ml-service"


# ============ Validation Tests ============

def create_test_csv(rows=100, valid=True):
    """Create a temporary CSV file for testing."""
    tmpfile = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='')
    writer = csv.writer(tmpfile)

    cols = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome']
    writer.writerow(cols)

    import random
    random.seed(42)
    for _ in range(rows):
        if valid:
            row = [
                random.randint(0, 15),
                random.randint(44, 199),
                random.randint(24, 122),
                random.randint(0, 99),
                random.randint(0, 846),
                round(random.uniform(18, 67), 1),
                round(random.uniform(0.08, 2.42), 3),
                random.randint(21, 81),
                random.randint(0, 1),
            ]
        else:
            row = ['invalid', 'data', 'here', 0, 0, 0, 0, 0, 'x']
        writer.writerow(row)

    tmpfile.close()
    return tmpfile.name


def test_validate_valid_csv():
    csv_path = create_test_csv(100, valid=True)
    try:
        with open(csv_path, 'rb') as f:
            response = client.post("/api/v1/validate", files={"file": ("test.csv", f, "text/csv")})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["num_rows"] == 100
        assert len(data["errors"]) == 0
    finally:
        os.unlink(csv_path)


def test_validate_small_csv():
    csv_path = create_test_csv(5, valid=True)
    try:
        with open(csv_path, 'rb') as f:
            response = client.post("/api/v1/validate", files={"file": ("test.csv", f, "text/csv")})
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False  # Too few rows
        assert any("Too few rows" in e for e in data["errors"])
    finally:
        os.unlink(csv_path)


# ============ Training + Prediction Integration ============

def test_train_and_predict():
    """Integration test: train a model, then predict."""
    csv_path = create_test_csv(200, valid=True)
    try:
        # Train
        response = client.post("/api/v1/train", json={
            "dataset_path": csv_path,
            "random_seed": 42,
            "test_size": 0.2,
        })
        assert response.status_code == 200
        train_data = response.json()
        assert "model_id" in train_data
        assert train_data["metrics"]["accuracy"] > 0
        assert train_data["training_method"] == "centralized"

        # Predict
        response = client.post("/api/v1/predict", json={
            "Pregnancies": 6,
            "Glucose": 148,
            "BloodPressure": 72,
            "SkinThickness": 35,
            "Insulin": 0,
            "BMI": 33.6,
            "DiabetesPedigreeFunction": 0.627,
            "Age": 50,
        })
        assert response.status_code == 200
        pred_data = response.json()
        assert pred_data["prediction"] in [0, 1]
        assert 0 <= pred_data["probability"] <= 1
        assert pred_data["risk_level"] in ["Low", "Moderate", "High"]
        assert "disclaimer" in pred_data
    finally:
        os.unlink(csv_path)


def test_predict_validation_error():
    """Test that invalid input is rejected."""
    response = client.post("/api/v1/predict", json={
        "Pregnancies": -1,  # Invalid
        "Glucose": 148,
        "BloodPressure": 72,
        "SkinThickness": 35,
        "Insulin": 0,
        "BMI": 33.6,
        "DiabetesPedigreeFunction": 0.627,
        "Age": 50,
    })
    assert response.status_code == 422  # Validation error
