"""
Validation endpoint — validates uploaded CSV datasets.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import io

router = APIRouter()

EXPECTED_COLUMNS = [
    'Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
    'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age', 'Outcome',
]

RANGE_CHECKS = {
    'Pregnancies': (0, 20),
    'Glucose': (0, 300),
    'BloodPressure': (0, 250),
    'SkinThickness': (0, 100),
    'Insulin': (0, 1000),
    'BMI': (0, 80),
    'DiabetesPedigreeFunction': (0, 3),
    'Age': (1, 120),
    'Outcome': (0, 1),
}


class ValidationResult(BaseModel):
    valid: bool
    num_rows: int
    num_columns: int
    warnings: list[str]
    errors: list[str]
    class_balance: float | None = None
    column_stats: dict | None = None


@router.post("/validate", response_model=ValidationResult)
async def validate_dataset(file: UploadFile = File(...)):
    """Validate an uploaded CSV against PIMA schema."""
    try:
        import pandas as pd
        import numpy as np

        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    errors: list[str] = []
    warnings: list[str] = []

    # Check columns
    missing_cols = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    extra_cols = [c for c in df.columns if c not in EXPECTED_COLUMNS]

    if missing_cols:
        errors.append(f"Missing columns: {', '.join(missing_cols)}")
    if extra_cols:
        warnings.append(f"Extra columns ignored: {', '.join(extra_cols)}")

    # Check row count
    if len(df) < 10:
        errors.append(f"Too few rows: {len(df)} (minimum 10)")
    elif len(df) < 100:
        warnings.append(f"Small dataset: {len(df)} rows")

    # Check data types
    for col in EXPECTED_COLUMNS:
        if col in df.columns and not pd.api.types.is_numeric_dtype(df[col]):
            errors.append(f"Column '{col}' must be numeric")

    # Range checks
    for col, (lo, hi) in RANGE_CHECKS.items():
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            if df[col].min() < lo:
                warnings.append(f"'{col}' has values below {lo}")
            if df[col].max() > hi:
                warnings.append(f"'{col}' has values above {hi}")

    # NaN check
    nan_count = int(df[EXPECTED_COLUMNS].isnull().sum().sum()) if not missing_cols else 0
    if nan_count > 0:
        warnings.append(f"{nan_count} missing values detected (will be imputed)")

    # Class balance
    class_balance = None
    if 'Outcome' in df.columns:
        positive_rate = float(df['Outcome'].mean())
        class_balance = positive_rate
        if positive_rate < 0.1 or positive_rate > 0.9:
            warnings.append(f"Severe class imbalance: {positive_rate:.1%} positive")

    # Stats
    column_stats = None
    if not missing_cols:
        stats = df[EXPECTED_COLUMNS].describe().to_dict()
        column_stats = {k: {sk: round(sv, 4) for sk, sv in v.items()} for k, v in stats.items()}

    return ValidationResult(
        valid=len(errors) == 0,
        num_rows=len(df),
        num_columns=len(df.columns),
        warnings=warnings,
        errors=errors,
        class_balance=class_balance,
        column_stats=column_stats,
    )
