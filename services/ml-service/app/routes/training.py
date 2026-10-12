"""
Training endpoint — trains centralized logistic regression model.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json
import uuid
from datetime import datetime

router = APIRouter()


class TrainRequest(BaseModel):
    dataset_path: str
    random_seed: int = 42
    test_size: float = 0.2
    max_iter: int = 500
    C: float = 1.0


class TrainResponse(BaseModel):
    model_id: str
    model_version: str
    metrics: dict
    feature_columns: list[str]
    training_method: str
    duration_seconds: float


@router.post("/train", response_model=TrainResponse)
async def train_model(request: TrainRequest):
    """Train a centralized logistic regression model on the specified dataset."""
    try:
        import pandas as pd
        import numpy as np
        from sklearn.model_selection import train_test_split
        from sklearn.linear_model import LogisticRegression
        from sklearn.preprocessing import StandardScaler
        from sklearn.impute import SimpleImputer
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score, f1_score,
            roc_auc_score, confusion_matrix,
        )
        import joblib
        import time

        start = time.time()

        # Load data
        if not os.path.exists(request.dataset_path):
            raise HTTPException(status_code=404, detail=f"Dataset not found: {request.dataset_path}")

        df = pd.read_csv(request.dataset_path)

        feature_cols = [
            'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
            'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age',
        ]

        X = df[feature_cols].copy()
        y = df['Outcome'].values

        # Handle zero-as-missing
        zero_invalid = ['Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI']
        for col in zero_invalid:
            X.loc[X[col] == 0, col] = np.nan

        # Impute + scale
        imputer = SimpleImputer(strategy='median')
        X_imputed = imputer.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_imputed, y, test_size=request.test_size,
            random_state=request.random_seed, stratify=y,
        )

        scaler = StandardScaler()
        X_train_sc = scaler.fit_transform(X_train)
        X_test_sc = scaler.transform(X_test)

        # Train
        model = LogisticRegression(
            max_iter=request.max_iter, C=request.C,
            random_state=request.random_seed, solver='lbfgs',
        )
        model.fit(X_train_sc, y_train)

        # Evaluate
        y_pred = model.predict(X_test_sc)
        y_prob = model.predict_proba(X_test_sc)[:, 1]
        cm = confusion_matrix(y_test, y_pred)

        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, y_prob)),
            'confusion_matrix': cm.tolist(),
            'num_train_samples': len(X_train),
            'num_test_samples': len(X_test),
        }

        # Save model
        model_id = str(uuid.uuid4())
        model_version = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        model_dir = os.path.join(os.getenv('MODEL_DIR', './models'), model_id)
        os.makedirs(model_dir, exist_ok=True)

        joblib.dump(model, os.path.join(model_dir, 'model.joblib'))
        joblib.dump(scaler, os.path.join(model_dir, 'scaler.joblib'))
        joblib.dump(imputer, os.path.join(model_dir, 'imputer.joblib'))

        with open(os.path.join(model_dir, 'metadata.json'), 'w') as f:
            json.dump({
                'model_id': model_id,
                'model_version': model_version,
                'feature_columns': feature_cols,
                'metrics': metrics,
                'training_config': {
                    'max_iter': request.max_iter,
                    'C': request.C,
                    'random_seed': request.random_seed,
                    'test_size': request.test_size,
                },
            }, f, indent=2)

        duration = time.time() - start

        return TrainResponse(
            model_id=model_id,
            model_version=model_version,
            metrics=metrics,
            feature_columns=feature_cols,
            training_method='centralized',
            duration_seconds=round(duration, 3),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
