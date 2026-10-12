"""
Prediction endpoint — returns diabetes risk predictions.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import os
import glob

router = APIRouter()


class PredictionInput(BaseModel):
    Pregnancies: float = Field(ge=0, le=20)
    Glucose: float = Field(ge=0, le=300)
    BloodPressure: float = Field(ge=0, le=250)
    SkinThickness: float = Field(ge=0, le=100)
    Insulin: float = Field(ge=0, le=1000)
    BMI: float = Field(ge=0, le=80)
    DiabetesPedigreeFunction: float = Field(ge=0, le=3)
    Age: float = Field(ge=1, le=120)


class PredictionOutput(BaseModel):
    prediction: int
    probability: float
    risk_level: str
    confidence: float
    model_id: str
    disclaimer: str


def get_latest_model_dir() -> str:
    """Find the most recently created model directory."""
    model_base = os.getenv('MODEL_DIR', './models')
    if not os.path.exists(model_base):
        raise HTTPException(status_code=503, detail="No trained models available")

    model_dirs = [d for d in glob.glob(os.path.join(model_base, '*')) if os.path.isdir(d)]
    if not model_dirs:
        raise HTTPException(status_code=503, detail="No trained models available")

    return max(model_dirs, key=os.path.getmtime)


@router.post("/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    """Generate diabetes risk prediction from health metrics."""
    try:
        import numpy as np
        import joblib
        import json

        model_dir = get_latest_model_dir()
        model = joblib.load(os.path.join(model_dir, 'model.joblib'))
        scaler = joblib.load(os.path.join(model_dir, 'scaler.joblib'))
        imputer = joblib.load(os.path.join(model_dir, 'imputer.joblib'))

        with open(os.path.join(model_dir, 'metadata.json')) as f:
            metadata = json.load(f)

        # Prepare input
        features = np.array([[
            input_data.Pregnancies, input_data.Glucose, input_data.BloodPressure,
            input_data.SkinThickness, input_data.Insulin, input_data.BMI,
            input_data.DiabetesPedigreeFunction, input_data.Age,
        ]])

        # Handle zero-as-missing
        zero_cols = [1, 2, 3, 4, 5]  # Glucose, BP, SkinThickness, Insulin, BMI
        for idx in zero_cols:
            if features[0, idx] == 0:
                features[0, idx] = np.nan

        features_imputed = imputer.transform(features)
        features_scaled = scaler.transform(features_imputed)

        prediction = int(model.predict(features_scaled)[0])
        probabilities = model.predict_proba(features_scaled)[0]
        prob_positive = float(probabilities[1])

        # Risk level
        if prob_positive >= 0.7:
            risk_level = "High"
        elif prob_positive >= 0.4:
            risk_level = "Moderate"
        else:
            risk_level = "Low"

        confidence = float(max(probabilities))

        return PredictionOutput(
            prediction=prediction,
            probability=round(prob_positive, 4),
            risk_level=risk_level,
            confidence=round(confidence, 4),
            model_id=metadata.get('model_id', 'unknown'),
            disclaimer=(
                "This is a research estimate only. This prediction is NOT a medical diagnosis. "
                "Please consult a qualified healthcare professional for medical advice."
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
