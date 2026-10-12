"""FedHealth ML Service — Prediction router"""

from fastapi import APIRouter, HTTPException

from ..schemas.schemas import (
    ModelListResponse,
    ModelSummary,
    PredictionRequest,
    PredictionResponse,
)
from ..services.prediction_service import get_available_models, predict

router = APIRouter()


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Get diabetes risk prediction",
)
async def make_prediction(request: PredictionRequest):
    """Submit patient features for diabetes risk prediction.

    Uses the specified model or the latest available model.
    Returns the binary prediction, probability, risk level,
    and an explicit research disclaimer.

    This is a RESEARCH ESTIMATE, not a clinical diagnosis.
    """
    features = {
        "Pregnancies": request.Pregnancies,
        "Glucose": request.Glucose,
        "BloodPressure": request.BloodPressure,
        "SkinThickness": request.SkinThickness,
        "Insulin": request.Insulin,
        "BMI": request.BMI,
        "DiabetesPedigreeFunction": request.DiabetesPedigreeFunction,
        "Age": request.Age,
    }

    try:
        result = predict(features=features, model_id=request.model_id)
        return PredictionResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get(
    "/models",
    response_model=ModelListResponse,
    summary="List available trained models",
)
async def list_models():
    """List all trained models that are ready for inference."""
    models_data = get_available_models()
    models = [
        ModelSummary(
            model_id=m["model_id"],
            model_version=m["model_version"],
            model_type=m["model_type"],
            training_method=m["training_method"],
            created_at=m["created_at"],
            status=m["status"],
            metrics=m.get("metrics"),
        )
        for m in models_data
    ]
    return ModelListResponse(models=models, total=len(models))
