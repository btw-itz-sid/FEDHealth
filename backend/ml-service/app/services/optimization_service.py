"""Fixed training-only CV search. No access to final test records or labels."""

import numpy as np
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler

from .feature_service import SharedFeatureMap

OPTIMIZATION_PROTOCOL = "development_cv3_fedavg_v3"
# Freeze this small search space before evaluating the final holdout.
CANDIDATES = [
    {"features": features, "gamma": gamma, "balanced": balanced, "components": 512 if features == "rbf" else 0}
    for features, gamma in (("linear", None), ("rbf", 0.01), ("rbf", 0.05), ("rbf", 0.2))
    for balanced in (False, True)
]
OPTIMIZED_ROUNDS = 40
OPTIMIZED_EPOCHS = 5
OPTIMIZED_LR = 0.05
OPTIMIZED_BATCH = 32


def select_prediction_pipeline(X: np.ndarray, y: np.ndarray, seed: int, objective: str = "accuracy"):
    """Compare fixed centralized candidates using development-only CV.

    This is a prediction baseline, never mislabeled as a federated model.
    """
    from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import GridSearchCV
    from sklearn.pipeline import Pipeline
    from sklearn.svm import SVC

    pipeline = Pipeline([("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("scaler", StandardScaler()), ("classifier", LogisticRegression())])
    candidates = [
        {"classifier": [LogisticRegression(max_iter=2000, random_state=seed)],
         "classifier__C": [0.1, 1.0, 10.0], "classifier__class_weight": [None, "balanced"]},
        {"classifier": [SVC(probability=True, random_state=seed)],
         "classifier__C": [0.5, 1.0, 3.0, 10.0], "classifier__gamma": ["scale", 0.03]},
        {"classifier": [RandomForestClassifier(n_estimators=200, max_features=0.8,
            random_state=seed, n_jobs=1)], "classifier__min_samples_leaf": [3, 8],
         "classifier__class_weight": [None, "balanced"]},
        {"classifier": [HistGradientBoostingClassifier(max_iter=120, max_leaf_nodes=7,
            learning_rate=0.05, min_samples_leaf=15, early_stopping=False, random_state=seed)],
         "classifier__l2_regularization": [1.0, 10.0]},
    ]
    search = GridSearchCV(pipeline, candidates, cv=StratifiedKFold(3, shuffle=True, random_state=seed),
        scoring={"accuracy": "accuracy", "roc_auc": "roc_auc", "recall": "recall", "f1": "f1"},
        refit=objective, n_jobs=1, error_score="raise")
    search.fit(X, y)
    records = []
    for i, params in enumerate(search.cv_results_["params"]):
        records.append({"estimator": type(params["classifier"]).__name__,
            "parameters": {key.removeprefix("classifier__"): value for key, value in params.items() if key != "classifier"},
            **{metric: round(float(search.cv_results_[f"mean_test_{metric}"][i]), 6)
               for metric in ("accuracy", "roc_auc", "recall", "f1")}})
    return search.best_estimator_, {"protocol": "development_cv3_prediction_v3",
        "selection_split": "development_only_cv3", "test_used_for_selection": False,
        "objective": objective, "selected": records[search.best_index_], "candidates": records}


def select_configuration(X: np.ndarray, y: np.ndarray, seed: int, num_clients: int) -> dict:
    # Lazy imports avoid a service import cycle.
    from .federated_service import local_sgd, partition_iid, _predict_proba

    if np.bincount(y, minlength=2).min() < 6:
        raise ValueError("Optimization needs at least six training examples in each class")
    folds = list(StratifiedKFold(3, shuffle=True, random_state=seed).split(X, y))
    scores = []
    for candidate in CANDIDATES:
        fold_scores = []
        out_of_fold = np.zeros(len(y))
        for train, validation in folds:
            # Fit both preprocessing steps inside each fold, without leakage.
            imputer = SimpleImputer(strategy="median").fit(X[train])
            scaler = StandardScaler().fit(imputer.transform(X[train]))
            cx = scaler.transform(imputer.transform(X[train]))
            vx = scaler.transform(imputer.transform(X[validation]))
            if candidate["features"] == "rbf":
                mapping = SharedFeatureMap(gamma=candidate["gamma"], n_components=candidate["components"], random_state=seed).fit(cx)
                cx, vx = mapping.transform(cx), mapping.transform(vx)
            rng = np.random.default_rng(seed)
            partitions = partition_iid(y[train], num_clients, rng)
            w, b = np.zeros(cx.shape[1]), 0.0
            weights = len(train) / (2 * np.bincount(y[train], minlength=2))
            for _ in range(OPTIMIZED_ROUNDS):
                next_w, next_b = np.zeros_like(w), 0.0
                for indices in partitions:
                    sample_weight = weights[y[train][indices]] if candidate["balanced"] else None
                    cw, cb = local_sgd(w, b, cx[indices], y[train][indices],
                        OPTIMIZED_EPOCHS, OPTIMIZED_LR, OPTIMIZED_BATCH, rng, sample_weight,
                        l2_penalty=0.001 if candidate["features"] == "rbf" else 0.0001)
                    share = len(indices) / len(train)
                    next_w += share * cw
                    next_b += share * cb
                w, b = next_w, next_b
            probabilities = _predict_proba(w, b, vx)
            out_of_fold[validation] = probabilities
            predicted = (probabilities >= 0.5).astype(int)
            fold_scores.append({"accuracy": float(accuracy_score(y[validation], predicted)),
                "recall": float(recall_score(y[validation], predicted, zero_division=0)),
                "roc_auc": float(roc_auc_score(y[validation], probabilities))})
        thresholds = [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65]
        threshold = max(thresholds, key=lambda t: (
            accuracy_score(y, out_of_fold >= t), -abs(t - 0.5)))
        scores.append({**candidate, "folds": fold_scores, "decision_threshold": threshold,
            "selection_accuracy": round(float(accuracy_score(y, out_of_fold >= threshold)), 6),
            **{f"mean_{key}": round(float(np.mean([fold[key] for fold in fold_scores])), 6)
               for key in ("accuracy", "recall", "roc_auc")}})
    # Accuracy is the declared objective. AUC and recall only break exact ties.
    chosen = max(scores, key=lambda row: (row["selection_accuracy"], row["mean_roc_auc"], row["mean_recall"]))
    return {"protocol": OPTIMIZATION_PROTOCOL, "selection_split": "development_only_cv3",
        "objective": "accuracy", "test_used_for_selection": False,
        "selected": {key: chosen[key] for key in ("features", "gamma", "balanced", "components", "decision_threshold")},
        "candidates": scores}
