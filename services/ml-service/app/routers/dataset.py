"""FedHealth ML Service — Dataset validation router"""

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
import pandas as pd

from ..config import DATA_DIR
from ..schemas.schemas import DatasetValidationResponse
from ..services.dataset_service import load_csv, validate_dataset

router = APIRouter()


@router.post(
    "/datasets/validate",
    response_model=DatasetValidationResponse,
    summary="Validate an uploaded CSV dataset",
)
async def validate_uploaded_dataset(file: UploadFile = File(...)):
    """Upload and validate a CSV file against the PIMA diabetes schema.

    Checks: required columns, data types, binary target, missing values,
    biologically-invalid zeros, class balance, duplicates, value ranges.

    Returns validation status, errors, warnings, and descriptive statistics.
    """
    # File type check
    if file.content_type and file.content_type not in (
        "text/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Expected CSV.",
        )

    filename = file.filename or "upload.csv"
    # Sanitize filename — never trust user-provided names
    safe_name = f"{uuid.uuid4().hex}.csv"
    upload_path = DATA_DIR / "uploads" / safe_name

    try:
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        with open(upload_path, "wb") as f:
            content = await file.read()
            if len(content) > 50 * 1024 * 1024:  # 50 MB
                raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")
            f.write(content)

        df = load_csv(upload_path)
        result = validate_dataset(df)

        return DatasetValidationResponse(
            is_valid=result.is_valid,
            errors=result.errors,
            warnings=result.warnings,
            stats=result.stats,
        )
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Validation failed: {type(exc).__name__}")
    finally:
        # Clean up temp upload
        if upload_path.exists():
            upload_path.unlink()


@router.post(
    "/datasets/validate-local",
    response_model=DatasetValidationResponse,
    summary="Validate the local dataset file",
)
async def validate_local_dataset(filename: str = "diabetes.csv"):
    """Validate a dataset already present in the data/ directory."""
    # Prevent path traversal
    safe_filename = Path(filename).name
    dataset_path = DATA_DIR / safe_filename

    try:
        df = load_csv(dataset_path)
        result = validate_dataset(df)

        return DatasetValidationResponse(
            is_valid=result.is_valid,
            errors=result.errors,
            warnings=result.warnings,
            stats=result.stats,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
