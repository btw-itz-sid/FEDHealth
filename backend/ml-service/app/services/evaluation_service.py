"""One reproducible evaluation protocol shared by every training method."""

import hashlib
from dataclasses import dataclass

import numpy as np
from sklearn.model_selection import train_test_split

EVALUATION_PROTOCOL = "stratified_train_validation_test_v2"
VALIDATION_FRACTION = 0.2  # Fraction of the development pool, after holding out test.


@dataclass(frozen=True)
class EvaluationSplit:
    train: np.ndarray
    validation: np.ndarray
    test: np.ndarray

    def manifest(self) -> dict:
        """Expose counts and reproducible hashes, never records or row IDs."""
        return {
            "protocol": EVALUATION_PROTOCOL,
            "validation_fraction_of_development": VALIDATION_FRACTION,
            "round_metrics_split": "validation",
            "final_metrics_split": "test",
            "preprocessing_fit_split": "train",
            "splits": {
                name: {
                    "count": int(len(indices)),
                    "indices_sha256": hashlib.sha256(
                        np.sort(indices).astype("<i8").tobytes()
                    ).hexdigest(),
                }
                for name, indices in (
                    ("train", self.train), ("validation", self.validation), ("test", self.test)
                )
            },
        }


def make_evaluation_split(y: np.ndarray, test_size: float, seed: int) -> EvaluationSplit:
    indices = np.arange(len(y))
    development, test = train_test_split(
        indices, test_size=test_size, random_state=seed, stratify=y,
    )
    train, validation = train_test_split(
        development, test_size=VALIDATION_FRACTION,
        random_state=seed, stratify=y[development],
    )
    return EvaluationSplit(train, validation, test)
