"""FedHealth ML Service — Training Service

Implements centralized model training with:
- PIMA-specific preprocessing (zero→NaN replacement)
- Median imputation + standard scaling
- Logistic regression baseline or development-CV-selected prediction model
- Reproducible train/test splits
- Full metric computation
- Model + metadata persistence
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .evaluation_service import EVALUATION_PROTOCOL, VALIDATION_FRACTION, make_evaluation_split

from ..config import (
    MODELS_DIR,
    PIMA_FEATURE_COLUMNS,
    PIMA_TARGET_COLUMN,
    PIMA_ZERO_INVALID_COLUMNS,
    RANDOM_SEED,
    TEST_SIZE,
)


def compute_dataset_fingerprint(df: pd.DataFrame) -> str:
    """Compute a SHA-256 fingerprint (first 16 hex chars) for reproducibility."""
    content = pd.util.hash_pandas_object(df).values.tobytes()
    return hashlib.sha256(content).hexdigest()[:16]


def preprocess_pima(df: pd.DataFrame) -> pd.DataFrame:
    """Replace biologically-invalid zeros with NaN in PIMA-specific columns.

    This must happen BEFORE imputation. The pipeline's SimpleImputer
    will handle the resulting NaN values.
    """
    df = df.copy()
    for col in PIMA_ZERO_INVALID_COLUMNS:
        if col in df.columns:
            df[col] = df[col].replace(0, np.nan)
    return df


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: Optional[np.ndarray] = None,
) -> dict[str, Any]:
    """Compute classification metrics from actual predictions.

    Handles ROC-AUC safely when only one class is present.
    """
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist()
    report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)

    metrics: dict[str, Any] = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 6),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 6),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 6),
        "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 6),
        "confusion_matrix": cm,
    }

    # ROC-AUC: only compute when both classes are present and probabilities exist
    if y_proba is not None and len(np.unique(y_true)) == 2:
        metrics["roc_auc"] = round(float(roc_auc_score(y_true, y_proba)), 6)
    else:
        metrics["roc_auc"] = None

    # Per-class metrics
    metrics["per_class"] = {}
    for cls_label in ["0", "1"]:
        if cls_label in report:
            metrics["per_class"][cls_label] = {
                "precision": round(report[cls_label]["precision"], 6),
                "recall": round(report[cls_label]["recall"], 6),
                "f1_score": round(report[cls_label]["f1-score"], 6),
                "support": int(report[cls_label]["support"]),
            }

    return metrics


def train_centralized(
    df: pd.DataFrame,
    random_seed: int = RANDOM_SEED,
    test_size: float = TEST_SIZE,
    balance_classes: bool = False,
    experiment_id: Optional[str] = None,
    experiment_name: Optional[str] = None,
    optimize: bool = False,
) -> dict[str, Any]:
    """Train a baseline or CV-selected centralized prediction pipeline.

    Steps:
    1. Preprocess (zero→NaN for PIMA columns)
    2. Extract features (X) and target (y)
    3. Stratified train/test split
    4. Build sklearn Pipeline: imputer → scaler → classifier
    5. Fit on training data ONLY
    6. Evaluate on held-out test set
    7. Save model artifact + metadata

    Returns a dictionary with model_id, metrics, and artifact info.
    """
    # 1. Preprocess
    df = preprocess_pima(df)
    dataset_fingerprint = compute_dataset_fingerprint(df)

    # 2. Extract X, y
    X = df[PIMA_FEATURE_COLUMNS].values.astype(np.float64)
    y = df[PIMA_TARGET_COLUMN].values.astype(np.int32)

    # Same disjoint train/validation/test indices as federated and local-only.
    split = make_evaluation_split(y, test_size, random_seed)
    if optimize:
        from .evaluation_service import EvaluationSplit
        split = EvaluationSplit(np.sort(np.concatenate([split.train, split.validation])),
            np.array([], dtype=int), split.test)
    X_train, y_train = X[split.train], y[split.train]
    X_validation, y_validation = X[split.validation], y[split.validation]
    X_test, y_test = X[split.test], y[split.test]

    # 4. Build pipeline (impute → scale → classify)
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression(
            random_state=random_seed,
            max_iter=1000,
            solver="lbfgs",
            class_weight="balanced" if balance_classes else None,
        )),
    ])

    # 5. Fit
    import time
    start_time = time.time()
    optimization = None
    if optimize:
        from .optimization_service import select_prediction_pipeline
        pipeline, optimization = select_prediction_pipeline(X_train, y_train, random_seed, objective="f1")
    else:
        pipeline.fit(X_train, y_train)
    training_duration = round(time.time() - start_time, 3)

    # 6. Evaluate
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    metrics = compute_metrics(y_true=y_test, y_pred=y_pred, y_proba=y_proba)
    metrics["num_train_samples"] = int(len(X_train))
    metrics["num_validation_samples"] = int(len(X_validation))
    metrics["num_test_samples"] = int(len(X_test))
    metrics["evaluation_protocol"] = EVALUATION_PROTOCOL
    metrics["evaluation_manifest"] = split.manifest()
    if optimize:
        metrics["evaluation_protocol"] = optimization["protocol"]
        metrics["evaluation_manifest"].update(protocol=optimization["protocol"], round_metrics_split="development_cv3_selection",
            validation_fraction_of_development=0, selection="3-fold CV within development; refit on development")
        metrics["optimization"] = optimization
        metrics["validation_metrics"] = {"accuracy": optimization["selected"]["accuracy"],
            "evaluation_split": "development_cv3_selection", "selection_estimate_only": True}
    else:
        metrics["validation_metrics"] = compute_metrics(
            y_validation, pipeline.predict(X_validation), pipeline.predict_proba(X_validation)[:, 1]
        )
    metrics["training_duration_seconds"] = training_duration

    # Also compute training metrics for loss/convergence tracking
    y_train_pred = pipeline.predict(X_train)
    y_train_proba = pipeline.predict_proba(X_train)[:, 1]
    train_metrics = compute_metrics(y_true=y_train, y_pred=y_train_pred, y_proba=y_train_proba)
    metrics["train_accuracy"] = train_metrics["accuracy"]
    metrics["train_roc_auc"] = train_metrics["roc_auc"]

    # 7. Persist model
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    model_id = f"centralized_{timestamp}_{uuid.uuid4().hex[:6]}"
    model_version = f"v1.0_{timestamp}"

    model_dir = MODELS_DIR / model_id
    model_dir.mkdir(parents=True, exist_ok=True)

    artifact_path = model_dir / "pipeline.joblib"
    joblib.dump(pipeline, artifact_path)

    metadata = {
        "model_id": model_id,
        "model_version": model_version,
        "model_type": type(pipeline.named_steps["classifier"]).__name__ if optimize else "logistic_regression",
        "training_method": "centralized",
        "feature_columns": PIMA_FEATURE_COLUMNS,
        "target_column": PIMA_TARGET_COLUMN,
        "preprocessing": {
            "zero_to_nan_columns": PIMA_ZERO_INVALID_COLUMNS,
            "imputer_strategy": "median",
            "missing_indicators": optimize,
            "scaler": "standard",
        },
        "training_config": {
            "random_seed": random_seed,
            "test_size": test_size,
            "selected_estimator": type(pipeline.named_steps["classifier"]).__name__,
            "optimize": optimize,
            "balance_classes": bool(pipeline.named_steps["classifier"].get_params().get("class_weight")),
            "evaluation_protocol": metrics["evaluation_protocol"],
            "validation_fraction_of_development": 0 if optimize else VALIDATION_FRACTION,
        },
        "dataset_fingerprint": dataset_fingerprint,
        "metrics": metrics,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "experiment_id": experiment_id,
        "experiment_name": experiment_name,
        "artifact_path": str(artifact_path),
        "status": "ready",
    }

    with open(model_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    return metadata
