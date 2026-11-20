"""FedHealth ML Service — Configuration"""

import os
from pathlib import Path

# ---- Paths ----
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent.parent
MODELS_DIR = Path(os.getenv("MODELS_DIR", str(BASE_DIR / "models")))
DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))
UPLOADS_DIR = DATA_DIR / "uploads"
DEFAULT_DATASET = "diabetes.csv"
ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", str(PROJECT_ROOT / "artifacts")))

# Ensure directories exist
MODELS_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# ---- ML Configuration ----
RANDOM_SEED = int(os.getenv("RANDOM_SEED", "42"))
TEST_SIZE = 0.2

# ---- PIMA Dataset Schema ----
PIMA_FEATURE_COLUMNS = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
]

PIMA_TARGET_COLUMN = "Outcome"

# Columns where 0 represents a biologically invalid / missing value
PIMA_ZERO_INVALID_COLUMNS = [
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
]

# ---- Server ----
ML_SERVICE_HOST = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
ML_SERVICE_PORT = int(os.getenv("ML_SERVICE_PORT", "8000"))
