"""Tests for FedHealth ML Service — Dataset Validation"""

import numpy as np
import pandas as pd
import pytest

import sys
from pathlib import Path

# Add parent to path so we can import the app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.dataset_service import validate_dataset
from app.config import PIMA_FEATURE_COLUMNS, PIMA_TARGET_COLUMN


def make_valid_df(n: int = 100, seed: int = 42) -> pd.DataFrame:
    """Create a synthetic valid PIMA-like dataset for testing."""
    rng = np.random.RandomState(seed)
    data = {
        "Pregnancies": rng.randint(0, 15, n),
        "Glucose": rng.randint(70, 200, n),
        "BloodPressure": rng.randint(50, 120, n),
        "SkinThickness": rng.randint(10, 60, n),
        "Insulin": rng.randint(15, 500, n),
        "BMI": rng.uniform(18.0, 50.0, n).round(1),
        "DiabetesPedigreeFunction": rng.uniform(0.05, 2.5, n).round(3),
        "Age": rng.randint(18, 80, n),
        "Outcome": rng.choice([0, 1], n, p=[0.65, 0.35]),
    }
    return pd.DataFrame(data)


class TestValidateDataset:
    """Tests for validate_dataset()."""

    def test_valid_dataset(self):
        df = make_valid_df()
        result = validate_dataset(df)
        assert result.is_valid is True
        assert len(result.errors) == 0
        assert result.stats["num_rows"] == 100
        assert result.stats["num_columns"] == 9
        assert 0 in result.stats["class_distribution"]
        assert 1 in result.stats["class_distribution"]

    def test_missing_columns(self):
        df = make_valid_df()
        df = df.drop(columns=["Glucose", "BMI"])
        result = validate_dataset(df)
        assert result.is_valid is False
        assert any("Missing required columns" in e for e in result.errors)

    def test_empty_dataset(self):
        df = pd.DataFrame(columns=PIMA_FEATURE_COLUMNS + [PIMA_TARGET_COLUMN])
        result = validate_dataset(df)
        assert result.is_valid is False
        assert any("empty" in e.lower() for e in result.errors)

    def test_non_numeric_column(self):
        df = make_valid_df()
        df["Glucose"] = "high"
        result = validate_dataset(df)
        assert result.is_valid is False
        assert any("numeric" in e.lower() for e in result.errors)

    def test_non_binary_target(self):
        df = make_valid_df()
        df["Outcome"] = [0, 1, 2] * 33 + [0]
        result = validate_dataset(df)
        assert result.is_valid is False
        assert any("binary" in e.lower() for e in result.errors)

    def test_zero_values_warning(self):
        df = make_valid_df()
        # Set some Glucose values to 0 (biologically invalid)
        df.loc[:4, "Glucose"] = 0
        result = validate_dataset(df)
        assert result.is_valid is True  # Zeros are warnings, not errors
        assert any("Glucose" in w and "zero" in w.lower() for w in result.warnings)
        assert result.stats["zero_invalid_counts"]["Glucose"] == 5

    def test_nan_values_warning(self):
        df = make_valid_df()
        df.loc[:2, "Insulin"] = np.nan
        result = validate_dataset(df)
        assert result.is_valid is True
        assert any("Insulin" in w and "NaN" in w for w in result.warnings)

    def test_duplicate_rows_warning(self):
        df = make_valid_df(n=10)
        df = pd.concat([df, df.iloc[:3]], ignore_index=True)
        result = validate_dataset(df)
        assert result.stats["duplicate_rows"] >= 3
        assert any("duplicate" in w.lower() for w in result.warnings)

    def test_feature_statistics(self):
        df = make_valid_df()
        result = validate_dataset(df)
        stats = result.stats["feature_stats"]
        for col in PIMA_FEATURE_COLUMNS:
            assert col in stats
            assert "mean" in stats[col]
            assert "std" in stats[col]
            assert "min" in stats[col]
            assert "max" in stats[col]
            assert "median" in stats[col]

    def test_class_balance(self):
        df = make_valid_df()
        result = validate_dataset(df)
        balance = result.stats["class_balance"]
        assert 0.0 < balance < 1.0

    def test_extra_columns_warning(self):
        df = make_valid_df()
        df["ExtraCol"] = 999
        result = validate_dataset(df)
        assert result.is_valid is True
        assert any("Extra columns" in w for w in result.warnings)


class TestLoadCsvEdgeCases:
    """Test load_csv edge cases."""

    def test_file_not_found(self):
        from app.services.dataset_service import load_csv
        with pytest.raises(FileNotFoundError):
            load_csv("/nonexistent/path.csv")

    def test_wrong_extension(self):
        from app.services.dataset_service import load_csv
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"a,b\n1,2\n")
            tmp = f.name
        with pytest.raises(ValueError, match="Expected a .csv"):
            load_csv(tmp)
        Path(tmp).unlink(missing_ok=True)
