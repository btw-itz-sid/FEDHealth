"""FedHealth ML Service — Training router"""

from fastapi import APIRouter, HTTPException
import pandas as pd

from ..schemas.schemas import (
    FederatedTrainRequest,
    FederatedTrainResponse,
    TrainRequest,
    TrainResponse,
)
from ..services.dataset_service import load_csv, resolve_dataset_path, validate_dataset
from ..services.federated_service import train_federated
from ..services.training_service import train_centralized

router = APIRouter()


def _load_validated_dataset(dataset_path: str | None) -> pd.DataFrame:
    try:
        df = load_csv(resolve_dataset_path(dataset_path))
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    validation = validate_dataset(df)
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset validation failed: {validation.errors}",
        )
    return df


@router.post(
    "/train/centralized",
    response_model=TrainResponse,
    summary="Train a centralized baseline model",
)
async def train_centralized_model(request: TrainRequest):
    """Train a logistic regression model on the full dataset (centralized baseline).

    Steps:
    1. Load and validate the dataset
    2. Preprocess (zero→NaN for PIMA columns)
    3. Split train/test with stratification
    4. Train logistic regression pipeline
    5. Evaluate on held-out test set
    6. Save model artifact and metadata

    Returns the model ID, metrics, and training configuration.
    """
    df = _load_validated_dataset(request.dataset_path)

    try:
        result = train_centralized(
            df=df,
            random_seed=request.random_seed,
            test_size=request.test_size,
            experiment_id=request.experiment_id,
            experiment_name=request.experiment_name,
        )

        return TrainResponse(
            model_id=result["model_id"],
            model_version=result["model_version"],
            model_type=result["model_type"],
            training_method=result["training_method"],
            dataset_fingerprint=result["dataset_fingerprint"],
            metrics=result["metrics"],
            training_config=result["training_config"],
            created_at=result["created_at"],
            status=result["status"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {type(exc).__name__}: {str(exc)}",
        )


@router.post(
    "/train/federated",
    response_model=FederatedTrainResponse,
    summary="Run a FedAvg or local-only simulation",
)
async def train_federated_model(request: FederatedTrainRequest):
    """Simulate federated training across partitioned clients.

    - fedavg: clients train locally from the global weights each round and the
      server averages their updates (optionally with differential privacy).
    - local_only: clients never share anything; metrics are averaged across clients.

    Every round is evaluated on the same held-out test split as the
    centralized baseline.
    """
    df = _load_validated_dataset(request.dataset_path)

    try:
        result = train_federated(
            df=df,
            training_method=request.training_method,
            partition_type=request.partition_type,
            num_clients=request.num_clients,
            num_rounds=request.num_rounds,
            local_epochs=request.local_epochs,
            learning_rate=request.learning_rate,
            batch_size=request.batch_size,
            random_seed=request.random_seed,
            test_size=request.test_size,
            dp_enabled=request.dp_enabled,
            dp_epsilon=request.dp_epsilon,
            dp_delta=request.dp_delta,
            dp_clip_norm=request.dp_clip_norm,
            experiment_id=request.experiment_id,
            experiment_name=request.experiment_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Training failed: {type(exc).__name__}: {str(exc)}",
        )

    return FederatedTrainResponse(**result)
