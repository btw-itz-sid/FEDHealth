"""FedHealth ML Service — Training router"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
import pandas as pd

from ..config import DATA_DIR
from ..schemas.schemas import TrainRequest, TrainResponse
from ..services.dataset_service import load_csv, validate_dataset
from ..services.training_service import train_centralized

router = APIRouter()


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
    # Resolve dataset path
    if request.dataset_path:
        safe_name = Path(request.dataset_path).name
        dataset_path = DATA_DIR / safe_name
    else:
        dataset_path = DATA_DIR / "diabetes.csv"

    try:
        df = load_csv(dataset_path)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    # Validate first
    validation = validate_dataset(df)
    if not validation.is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset validation failed: {validation.errors}",
        )

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
