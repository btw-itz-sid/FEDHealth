# FedHealth — measured research results (protocol v2)

Generated and verified on 20 November 2026. These are public-data research estimates, not clinical results.

## What was actually run

The runner `scripts/run_research_benchmark.py` executed 54 runs: 9 setups × 3 seeds × 2 class-balancing settings. Seeds: 7, 21, 42. Each federated/local-only run used 5 clients, 10 rounds, 5 local epochs, learning rate 0.1 and batch size 32. Non-IID partitioning uses Dirichlet label skew, alpha 0.5.

Every method uses the same stratified split for a given seed: **491 training / 123 validation / 154 test** on 768 records. Imputation and scaling fit training data only. Round monitoring uses validation; final test scoring occurs after the fixed training schedule. The runner verifies that all methods have identical split manifests for each seed.

Raw results:

- [Unweighted 27 runs](benchmarks/benchmark-v2.csv)
- [Balanced 27 runs](benchmarks/benchmark-v2-balanced.csv)
- [Unweighted configuration and split hashes](benchmarks/benchmark-v2.manifest.json)
- [Balanced configuration and split hashes](benchmarks/benchmark-v2-balanced.manifest.json)

These files contain aggregate results, not patient records. Benchmark artifacts are created temporarily and do not change the application's active model. The web benchmark suite defaults to **20 rounds**, so reproduce with the same rounds/settings before comparing it to the 10-round CLI results below.

## Results across three seeds

Mean ± sample standard deviation of test accuracy. Recall, F1 and ROC-AUC are the mean over the three seeds. This describes variability across overlapping random holdouts; it is not a confidence interval or evidence of clinical generalization.

| Setup | Unweighted accuracy | Balanced accuracy | Balanced recall | Balanced F1 | Balanced ROC-AUC |
|---|---:|---:|---:|---:|---:|
| Centralized | 0.7424 ± 0.0327 | 0.7381 ± 0.0198 | 0.6667 | 0.6406 | 0.8283 |
| FedAvg IID | 0.7359 ± 0.0487 | 0.7316 ± 0.0075 | 0.6790 | 0.6388 | 0.8303 |
| FedAvg non-IID | 0.7229 ± 0.0075 | 0.7424 ± 0.0135 | 0.5000 | 0.5725 | 0.8259 |
| Local-only IID | 0.7364 ± 0.0204 | 0.7247 ± 0.0189 | 0.6765 | 0.6322 | 0.8133 |
| Local-only non-IID | 0.6385 ± 0.0369 | 0.6164 ± 0.0364 | 0.6160 | 0.4366 | 0.8060 |
| FedAvg IID + noise, epsilon 0.5/round | 0.5996 ± 0.1155 | 0.6017 ± 0.1129 | 0.5556 | 0.4957 | 0.5930 |
| FedAvg IID + noise, epsilon 1/round | 0.6234 ± 0.0749 | 0.6082 ± 0.0865 | 0.5617 | 0.5009 | 0.6293 |
| FedAvg IID + noise, epsilon 5/round | 0.7056 ± 0.0637 | 0.7100 ± 0.0617 | 0.6049 | 0.5902 | 0.7438 |
| FedAvg IID + noise, epsilon 10/round | 0.7164 ± 0.0492 | 0.7186 ± 0.0470 | 0.6049 | 0.5987 | 0.7871 |

## Findings that the measurements support

- Balanced FedAvg IID has mean test accuracy 0.7316 versus centralized 0.7381: a difference of -0.65 percentage points in this run configuration. It is not guaranteed to match or outperform centralized training.
- In the balanced non-IID setup, FedAvg accuracy exceeds the local-only mean by 12.60 percentage points. The stronger comparison also needs recall/F1: local-only recall is higher here but its F1 is lower. Do not summarize every metric as an improvement.
- Balancing increases FedAvg IID mean recall from 0.5309 to 0.6790 in these runs. Accuracy falls slightly, illustrating why accuracy alone is insufficient.
- Larger seeded noise generally reduces utility in the reported mean results. Individual seeds need not change monotonically. Nominal epsilon values are experimental controls, not certified privacy budgets.
- Standard deviation varies substantially with setup. A single favorable seed would conceal this variation.

## Limitations to say clearly in the viva

1. Hospital clients are simulated partitions in one ML service, not real independent hospitals.
2. Training preprocessing statistics and balancing priors use the pooled training split; fully decentralized preprocessing is not implemented.
3. Local-only averages metrics across independent models. Its summed confusion matrix counts the shared test set once per client; it is not one ensemble's confusion matrix.
4. Centralized uses L-BFGS with sklearn's default regularization; clients use mini-batch SGD with L2 penalty 1e-4. The experiment compares these implementations rather than isolating communication alone.
5. Gaussian clipping/noise uses a reproducible seed, with unprotected metadata and diagnostics. Do not claim a patient-level DP guarantee, secure aggregation or regulatory compliance.
6. PIMA is small and population-specific. No external clinical validation was conducted.
7. Hyperparameters are fixed here. Future tuning must use training/validation only, followed by a predeclared final evaluation; do not repeatedly tune against the test figures in this document.

## Reproduce

From the repository root in PowerShell:

```powershell
.\backend\ml-service\.venv\Scripts\python.exe scripts/run_research_benchmark.py
.\backend\ml-service\.venv\Scripts\python.exe scripts/run_research_benchmark.py --balanced --output docs/benchmarks/benchmark-v2-balanced.csv
```

Use `--rounds 20 --output docs/benchmarks/benchmark-v2-20rounds.csv` to match the web suite's default schedule. This will create a separate result file rather than replacing the reported 10-round data.

## Historical results

The later accuracy/simplicity follow-up is recorded in [MODEL_IMPROVEMENT.md](MODEL_IMPROVEMENT.md). Its centralized CV/refit protocol uses 614 development records and is deliberately separate from this fixed 491/123/154 federated benchmark. Do not merge the two tables as a controlled algorithm-only comparison.

Experiments saved before this update used a two-way 614/154 split and monitored test every round. They remain visible in the app as legacy runs. Their scores are not directly comparable to protocol v2, which trains on fewer rows and uses independent validation. No old result was silently relabeled as a new measurement.

## Primary references

- [McMahan et al. (2017), FedAvg](https://proceedings.mlr.press/v54/mcmahan17a.html).
- [scikit-learn, avoiding preprocessing and evaluation leakage](https://scikit-learn.org/stable/common_pitfalls.html).
- [Zhu et al. (2019), Deep Leakage from Gradients](https://arxiv.org/abs/1906.08935).
