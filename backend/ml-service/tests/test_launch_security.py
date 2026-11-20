import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.security import validate_security_configuration
from app.services.dataset_service import validate_dataset
from app.services.prediction_service import load_model
from tests.test_dataset_service import make_valid_df


def test_private_endpoints_require_service_key(monkeypatch):
    monkeypatch.setenv('ML_SERVICE_KEY', 'test-only-internal-service-key')
    client = TestClient(app)
    assert client.get('/api/v1/health').status_code == 200
    for path in ['/api/v1/ml/models', '/api/v1/ml/train/centralized', '/api/v1/ml/datasets/validate-local']:
        response = client.get(path) if path.endswith('/models') else client.post(path, json={})
        assert response.status_code == 401
    assert client.get('/api/v1/ml/models', headers={'X-ML-Service-Key': 'wrong'}).status_code == 401
    assert client.get('/api/v1/ml/models', headers={'X-ML-Service-Key': 'test-only-internal-service-key'}).status_code == 200


def test_production_cannot_start_without_service_key(monkeypatch):
    monkeypatch.setenv('NODE_ENV', 'production')
    monkeypatch.delenv('ML_SERVICE_KEY', raising=False)
    with pytest.raises(RuntimeError, match='ML_SERVICE_KEY'):
        validate_security_configuration()


@pytest.mark.parametrize('model_id', ['../outside', '/tmp/model', 'C:\\models', '..', 'a/b', 'x' * 129])
def test_model_ids_cannot_escape_artifact_directory(model_id):
    with pytest.raises(ValueError, match='identifier'):
        load_model(model_id)


@pytest.mark.parametrize('case', ['infinity', 'missing_target', 'single_class', 'empty_feature', 'duplicate'])
def test_unsafe_training_data_is_rejected(case):
    data = make_valid_df()
    if case == 'infinity': data.loc[0, 'BMI'] = np.inf
    elif case == 'missing_target': data.loc[0, 'Outcome'] = np.nan
    elif case == 'single_class': data['Outcome'] = 0
    elif case == 'empty_feature': data['Insulin'] = 0
    else: data = pd.concat([data, data.iloc[:1]], ignore_index=True)
    result = validate_dataset(data)
    assert not result.is_valid
    assert result.errors


def test_busy_training_returns_conflict_and_health_remains_available():
    from app.routers.training import training_lock
    client = TestClient(app)
    training_lock.acquire()
    try:
        assert client.post('/api/v1/ml/train/centralized', json={}).status_code == 409
        assert client.get('/api/v1/health').status_code == 200
    finally:
        training_lock.release()
