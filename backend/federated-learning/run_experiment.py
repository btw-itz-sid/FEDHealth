"""
FedHealth — Experiment Runner
==============================
CLI script to run centralized, local-only, and federated experiments
and compare their results. Outputs metrics to JSON for the dashboard.

Usage:
  cd backend/federated-learning
  python run_experiment.py --csv ../../data/diabetes.csv
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Add parent paths
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent / 'ml-service'))

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

from simulation import (
    run_federated_simulation,
    run_local_only_simulation,
)


def preprocess_pima(df: pd.DataFrame) -> tuple:
    """Preprocess PIMA dataset (handle zero-as-missing, impute, scale)."""
    ZERO_INVALID_COLS = ['Glucose', 'BloodPressure', 'SkinThickness', 'Insulin', 'BMI']
    feature_cols = ['Pregnancies', 'Glucose', 'BloodPressure', 'SkinThickness',
                    'Insulin', 'BMI', 'DiabetesPedigreeFunction', 'Age']
    target_col = 'Outcome'

    X = df[feature_cols].copy()
    y = df[target_col].values

    # Replace 0 with NaN for physiologically invalid zeros
    for col in ZERO_INVALID_COLS:
        X.loc[X[col] == 0, col] = np.nan

    # Impute missing values
    imputer = SimpleImputer(strategy='median')
    X_imputed = imputer.fit_transform(X)

    return X_imputed, y


def run_centralized(X_train, y_train, X_test, y_test, seed=42):
    """Run centralized baseline."""
    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)

    model = LogisticRegression(max_iter=500, random_state=seed, solver='lbfgs')
    model.fit(X_train_sc, y_train)

    y_pred = model.predict(X_test_sc)
    y_prob = model.predict_proba(X_test_sc)[:, 1]
    cm = confusion_matrix(y_test, y_pred)

    return {
        'training_method': 'centralized',
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, y_prob)),
        'confusion_matrix': cm.tolist(),
        'num_train_samples': len(X_train),
        'num_test_samples': len(X_test),
    }


def main():
    parser = argparse.ArgumentParser(description='FedHealth Experiment Runner')
    parser.add_argument('--csv', type=str, default='../../data/diabetes.csv',
                        help='Path to PIMA CSV dataset')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--test-size', type=float, default=0.2, help='Test split ratio')
    parser.add_argument('--num-clients', type=int, default=5, help='Number of FL clients')
    parser.add_argument('--num-rounds', type=int, default=10, help='FL communication rounds')
    parser.add_argument('--output', type=str, default='results/', help='Output directory')
    args = parser.parse_args()

    print('=' * 60)
    print('FedHealth — Experiment Runner')
    print('=' * 60)

    # Load dataset
    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f'ERROR: Dataset not found at {csv_path}')
        print('Download the PIMA Indians Diabetes dataset and place it at data/diabetes.csv')
        sys.exit(1)

    df = pd.read_csv(csv_path)
    print(f'Dataset: {csv_path.name} ({len(df)} rows, {len(df.columns)} columns)')

    X, y = preprocess_pima(df)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )
    print(f'Train: {len(X_train)} | Test: {len(X_test)} | Seed: {args.seed}')
    print()

    results = {}

    # 1. Centralized Baseline
    print('[1/4] Running Centralized Baseline...')
    t0 = time.time()
    results['centralized'] = run_centralized(X_train, y_train, X_test, y_test, args.seed)
    results['centralized']['duration_seconds'] = time.time() - t0
    print(f'  Accuracy: {results["centralized"]["accuracy"]:.4f}')
    print(f'  F1:       {results["centralized"]["f1_score"]:.4f}')
    print(f'  ROC-AUC:  {results["centralized"]["roc_auc"]:.4f}')
    print()

    # 2. FedAvg IID
    print(f'[2/4] Running FedAvg (IID, {args.num_clients} clients, {args.num_rounds} rounds)...')
    t0 = time.time()
    fl_iid = run_federated_simulation(
        X_train, y_train, X_test, y_test,
        num_clients=args.num_clients, num_rounds=args.num_rounds,
        partition_type='iid', seed=args.seed,
    )
    results['fedavg_iid'] = {
        'training_method': 'fedavg',
        'partition_type': 'iid',
        'num_clients': args.num_clients,
        'num_rounds': args.num_rounds,
        **fl_iid.final_metrics,
        'duration_seconds': time.time() - t0,
        'round_history': [
            {
                'round': r.round_number,
                'accuracy': r.eval_metrics['accuracy'],
                'f1_score': r.eval_metrics['f1_score'],
                'roc_auc': r.eval_metrics['roc_auc'],
            }
            for r in fl_iid.round_history
        ],
    }
    print(f'  Accuracy: {fl_iid.final_metrics["accuracy"]:.4f}')
    print(f'  F1:       {fl_iid.final_metrics["f1_score"]:.4f}')
    print(f'  ROC-AUC:  {fl_iid.final_metrics["roc_auc"]:.4f}')
    print()

    # 3. FedAvg Non-IID
    print(f'[3/4] Running FedAvg (Non-IID, {args.num_clients} clients, {args.num_rounds} rounds)...')
    t0 = time.time()
    fl_noniid = run_federated_simulation(
        X_train, y_train, X_test, y_test,
        num_clients=args.num_clients, num_rounds=args.num_rounds,
        partition_type='non_iid', seed=args.seed,
    )
    results['fedavg_non_iid'] = {
        'training_method': 'fedavg',
        'partition_type': 'non_iid',
        'num_clients': args.num_clients,
        'num_rounds': args.num_rounds,
        **fl_noniid.final_metrics,
        'duration_seconds': time.time() - t0,
        'round_history': [
            {
                'round': r.round_number,
                'accuracy': r.eval_metrics['accuracy'],
                'f1_score': r.eval_metrics['f1_score'],
                'roc_auc': r.eval_metrics['roc_auc'],
            }
            for r in fl_noniid.round_history
        ],
    }
    print(f'  Accuracy: {fl_noniid.final_metrics["accuracy"]:.4f}')
    print(f'  F1:       {fl_noniid.final_metrics["f1_score"]:.4f}')
    print(f'  ROC-AUC:  {fl_noniid.final_metrics["roc_auc"]:.4f}')
    print()

    # 4. Local-Only
    print(f'[4/4] Running Local-Only ({args.num_clients} clients, IID)...')
    t0 = time.time()
    local_result = run_local_only_simulation(
        X_train, y_train, X_test, y_test,
        num_clients=args.num_clients, partition_type='iid', seed=args.seed,
    )
    results['local_only'] = {
        **local_result,
        'duration_seconds': time.time() - t0,
    }
    print(f'  Mean Accuracy: {local_result["mean_accuracy"]:.4f} (±{local_result["std_accuracy"]:.4f})')
    print()

    # 5. DP Federated Experiments
    print(f'[5/5] Running DP FedAvg experiments (privacy-utility tradeoff)...')
    from dp_experiments import run_dp_experiments
    dp_results = run_dp_experiments(
        X_train, y_train, X_test, y_test,
        num_clients=args.num_clients, num_rounds=args.num_rounds, seed=args.seed,
    )
    results.update(dp_results)
    print()

    # Summary
    print('=' * 60)
    print('COMPARISON SUMMARY')
    print('=' * 60)
    print(f'{"Method":<30} {"Accuracy":>10} {"F1":>10} {"ROC-AUC":>10}')
    print('-' * 60)
    for key in ['centralized', 'fedavg_iid', 'fedavg_non_iid']:
        r = results[key]
        print(f'{key:<30} {r["accuracy"]:>10.4f} {r["f1_score"]:>10.4f} {r["roc_auc"]:>10.4f}')
    print(f'{"local_only (mean)":<30} {results["local_only"]["mean_accuracy"]:>10.4f} {"—":>10} {"—":>10}')

    # DP results
    print()
    print('DP FedAvg (Privacy-Utility Tradeoff):')
    print(f'{"  ε (epsilon)":<30} {"Accuracy":>10} {"σ (noise)":>10}')
    print('-' * 50)
    for key, val in sorted(dp_results.items()):
        print(f'  ε={val["epsilon"]:<25} {val["accuracy"]:>10.4f} {val["sigma"]:>10.4f}')
    print()

    # Save results
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f'experiment_results_seed{args.seed}.json'
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    print(f'Results saved to {output_file}')


if __name__ == '__main__':
    main()

