"""FedHealth ML Service — Pydantic Schemas for API validation"""

from pydantic import BaseModel, Field
from typing import Any, Literal, Optional


# ---- Dataset Schemas ----

class DatasetValidationResponse(BaseModel):
    is_valid: bool
    errors: list[str]
    warnings: list[str]
    stats: dict[str, Any]


# ---- Training Schemas ----

class TrainRequest(BaseModel):
    """Request to train a centralized model."""
    dataset_path: Optional[str] = Field(
        None,
        description="Path to CSV file. If not provided, uses data/diabetes.csv"
    )
    random_seed: int = Field(42, ge=0, le=999999, description="Random seed for reproducibility")
    test_size: float = Field(0.2, gt=0.05, lt=0.5, description="Fraction of data for testing")
    experiment_id: Optional[str] = Field(None, description="Associated experiment ID")
    experiment_name: Optional[str] = Field(None, description="Experiment name")


class TrainResponse(BaseModel):
    model_id: str
    model_version: str
    model_type: str
    training_method: str
    dataset_fingerprint: str
    metrics: dict[str, Any]
    training_config: dict[str, Any]
    created_at: str
    status: str


class FederatedTrainRequest(BaseModel):
    """Request to run a federated (FedAvg) or local-only simulation."""
    dataset_path: Optional[str] = Field(
        None,
        description="Dataset filename in data/uploads or data/. Defaults to diabetes.csv",
    )
    training_method: Literal["fedavg", "local_only"] = "fedavg"
    partition_type: Literal["iid", "non_iid"] = "iid"
    num_clients: int = Field(5, ge=2, le=20)
    num_rounds: int = Field(10, ge=1, le=100)
    local_epochs: int = Field(5, ge=1, le=50)
    learning_rate: float = Field(0.1, gt=0, le=1)
    batch_size: int = Field(32, ge=8, le=256)
    random_seed: int = Field(42, ge=0, le=999999)
    test_size: float = Field(0.2, gt=0.05, lt=0.5)
    dp_enabled: bool = False
    dp_epsilon: float = Field(1.0, ge=0.05, le=100)
    dp_delta: float = Field(1e-5, gt=0, lt=0.1)
    dp_clip_norm: float = Field(1.0, gt=0, le=100)
    experiment_id: Optional[str] = None
    experiment_name: Optional[str] = None


class FederatedTrainResponse(BaseModel):
    model_id: Optional[str]
    model_version: Optional[str]
    model_type: str
    training_method: str
    dataset_fingerprint: str
    metrics: dict[str, Any]
    rounds: list[dict[str, Any]]
    clients: list[dict[str, Any]]
    training_config: dict[str, Any]
    created_at: str
    status: str


# ---- Prediction Schemas ----

class PredictionRequest(BaseModel):
    """Input features for diabetes risk prediction."""
    Pregnancies: float = Field(..., ge=0, le=20, description="Number of pregnancies")
    Glucose: float = Field(..., ge=0, le=300, description="Plasma glucose concentration (mg/dL)")
    BloodPressure: float = Field(..., ge=0, le=200, description="Diastolic blood pressure (mm Hg)")
    SkinThickness: float = Field(..., ge=0, le=100, description="Triceps skin fold thickness (mm)")
    Insulin: float = Field(..., ge=0, le=1000, description="2-Hour serum insulin (μU/mL)")
    BMI: float = Field(..., ge=0, le=80, description="Body mass index (kg/m²)")
    DiabetesPedigreeFunction: float = Field(
        ..., ge=0, le=3.0,
        description="Diabetes pedigree function"
    )
    Age: float = Field(..., ge=1, le=120, description="Age in years")
    model_id: Optional[str] = Field(None, description="Specific model ID. If null, uses latest.")


class PredictionResponse(BaseModel):
    prediction: int
    probability: float
    risk_level: str
    risk_label: str
    model_id: str
    model_version: str
    model_type: str
    training_method: str
    feature_columns: list[str]
    disclaimer: str


# ---- Model Schemas ----

class ModelSummary(BaseModel):
    model_id: str
    model_version: str
    model_type: str
    training_method: str
    created_at: str
    status: str
    metrics: Optional[dict[str, Any]] = None


class ModelListResponse(BaseModel):
    models: list[ModelSummary]
    total: int
