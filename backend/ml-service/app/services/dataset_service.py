"""FedHealth ML Service — Dataset Validation Service

Validates uploaded CSV datasets against the expected PIMA schema,
checks for missing values, invalid zeros, class balance, duplicates,
and computes descriptive statistics.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Any
from dataclasses import dataclass, field

from ..config import (
    DATA_DIR,
    DEFAULT_DATASET,
    PIMA_FEATURE_COLUMNS,
    PIMA_TARGET_COLUMN,
    PIMA_ZERO_INVALID_COLUMNS,
    UPLOADS_DIR,
)


def resolve_dataset_path(filename: str | None) -> Path:
    """Map a dataset filename to a file inside data/uploads or data/.

    Only the base name is used, so callers cannot escape the data directory.
    """
    safe_name = Path(filename).name if filename else DEFAULT_DATASET
    for directory in (UPLOADS_DIR, DATA_DIR):
        candidate = directory / safe_name
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(f"Dataset file not found: {safe_name}")


@dataclass
class DatasetValidationResult:
    """Container for dataset validation outcomes."""
    is_valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)


def load_csv(path: str | Path) -> pd.DataFrame:
    """Load a CSV file into a DataFrame.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file cannot be parsed as CSV.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset file not found: {path}")
    if path.suffix.lower() != ".csv":
        raise ValueError(f"Expected a .csv file, got: {path.suffix}")
    if path.stat().st_size > 50 * 1024 * 1024:  # 50 MB limit
        raise ValueError("File exceeds maximum size of 50 MB")

    try:
        df = pd.read_csv(path)
    except Exception as exc:
        raise ValueError(f"Failed to parse CSV: {exc}") from exc

    return df


def validate_dataset(df: pd.DataFrame) -> DatasetValidationResult:
    """Validate a DataFrame against the PIMA diabetes dataset schema.

    Returns a DatasetValidationResult with errors, warnings, and
    descriptive statistics.
    """
    result = DatasetValidationResult()
    expected_columns = PIMA_FEATURE_COLUMNS + [PIMA_TARGET_COLUMN]

    # ---- Required columns ----
    missing_columns = [c for c in expected_columns if c not in df.columns]
    if missing_columns:
        result.is_valid = False
        result.errors.append(f"Missing required columns: {missing_columns}")
        return result

    extra_columns = [c for c in df.columns if c not in expected_columns]
    if extra_columns:
        result.warnings.append(f"Extra columns will be ignored: {extra_columns}")

    # ---- Empty dataset ----
    if len(df) == 0:
        result.is_valid = False
        result.errors.append("Dataset is empty (0 rows)")
        return result

    # ---- Numeric types ----
    for col in expected_columns:
        if not pd.api.types.is_numeric_dtype(df[col]):
            result.is_valid = False
            result.errors.append(
                f"Column '{col}' must be numeric, got {df[col].dtype}"
            )

    if not result.is_valid:
        return result

    # ---- Binary target ----
    unique_targets = sorted(df[PIMA_TARGET_COLUMN].dropna().unique().tolist())
    if not set(unique_targets).issubset({0, 1, 0.0, 1.0}):
        result.is_valid = False
        result.errors.append(
            f"Target column '{PIMA_TARGET_COLUMN}' must be binary (0/1), "
            f"found unique values: {unique_targets}"
        )
        return result

    # ---- NaN values ----
    nan_counts = df[expected_columns].isnull().sum()
    for col_name, count in nan_counts.items():
        if count > 0:
            result.warnings.append(f"Column '{col_name}' has {count} NaN values")

    # ---- Biologically-invalid zeros ----
    zero_invalid_counts: dict[str, int] = {}
    for col in PIMA_ZERO_INVALID_COLUMNS:
        if col in df.columns:
            zero_count = int((df[col] == 0).sum())
            zero_invalid_counts[col] = zero_count
            if zero_count > 0:
                result.warnings.append(
                    f"Column '{col}' has {zero_count} zero values "
                    f"(likely missing in PIMA dataset)"
                )

    # ---- Duplicates ----
    duplicate_count = int(df.duplicated().sum())
    if duplicate_count > 0:
        result.warnings.append(f"Found {duplicate_count} duplicate rows")

    # ---- Range checks (warnings only) ----
    range_checks: dict[str, tuple[float, float]] = {
        "Pregnancies": (0, 20),
        "Glucose": (0, 300),
        "BloodPressure": (0, 200),
        "SkinThickness": (0, 100),
        "Insulin": (0, 1000),
        "BMI": (0, 80),
        "DiabetesPedigreeFunction": (0, 3),
        "Age": (0, 120),
    }
    for col, (low, high) in range_checks.items():
        if col in df.columns:
            out_of_range = int(((df[col] < low) | (df[col] > high)).sum())
            if out_of_range > 0:
                result.warnings.append(
                    f"Column '{col}' has {out_of_range} values outside "
                    f"expected range [{low}, {high}]"
                )

    # ---- Class distribution ----
    class_dist = df[PIMA_TARGET_COLUMN].value_counts().to_dict()
    # Convert keys to int for JSON serialization
    class_dist = {int(k): int(v) for k, v in class_dist.items()}

    # ---- Feature statistics ----
    feature_stats: dict[str, dict[str, float]] = {}
    for col in PIMA_FEATURE_COLUMNS:
        if col in df.columns:
            series = df[col].dropna()
            feature_stats[col] = {
                "mean": round(float(series.mean()), 4),
                "std": round(float(series.std()), 4),
                "min": round(float(series.min()), 4),
                "max": round(float(series.max()), 4),
                "median": round(float(series.median()), 4),
                "q25": round(float(series.quantile(0.25)), 4),
                "q75": round(float(series.quantile(0.75)), 4),
            }

    result.stats = {
        "num_rows": len(df),
        "num_columns": len(df.columns),
        "class_distribution": class_dist,
        "class_balance": round(float(df[PIMA_TARGET_COLUMN].mean()), 4),
        "missing_values": {str(k): int(v) for k, v in nan_counts.items()},
        "zero_invalid_counts": zero_invalid_counts,
        "duplicate_rows": duplicate_count,
        "feature_stats": feature_stats,
    }

    return result
