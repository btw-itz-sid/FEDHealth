# Prediction model improvement and simpler application

Verified on 20 November 2026 using the existing PIMA data. These are exploratory research measurements, not clinical validation.

## What changed

The application can train two clearly labeled goals. The federated hospital model demonstrates local learning and FedAvg. The prediction baseline compares logistic regression, RBF SVM, random forest and histogram gradient boosting using three-fold cross-validation on development data, then refits the selected pipeline before final test scoring. The prediction search chooses by F1 to balance precision and recall in this imbalanced dataset. Median imputation, missing-value indicators and scaling are fitted within each CV fold.

The active predictor is now a **centralized Random Forest**, not a federated model. The original FedAvg proof run remains available in Architecture lab, with its original metrics and parameter trace. No result was relabeled as a different training method.

## Measured results on seed 42

Both runs retain the same 154 test records. The training budgets differ: the original proof uses 491 training rows and 123 validation rows; the prediction search uses cross-validation within all 614 development rows and refits on those rows. This compares complete pipelines, not the isolated effect of changing one algorithm.

| Measurement | Existing FedAvg proof | New prediction baseline |
|---|---:|---:|
| Test accuracy | 72.73% | 75.97% |
| Recall | 72.22% | 77.78% |
| Precision | 59.09% | 62.69% |
| F1 | 0.6500 | 0.6942 |
| ROC-AUC | 0.8126 | 0.8324 |
| Correct test predictions | 112 / 154 | 117 / 154 |
| False negatives | 15 | 12 |

The new confusion matrix is [[75, 25], [12, 42]], with true classes as rows and predicted classes as columns. The selected forest uses 200 trees, minimum leaf size 8, max_features 0.8 and balanced class weights.

Web experiment: `6572d1f5-7eac-44a0-b590-93e477007317`.
Serving artifact: `centralized_20261120_125147_1face2`, version `v1.0_20261120_125147`.

## Repeated holdouts and unsuccessful attempts

The frozen F1 search was reproduced on seeds 7, 21 and 42. Accuracies were 77.92%, 81.17% and 75.97%; the mean is 78.35%. Raw results and selection details are in `benchmarks/optimized-prediction-multiseed.csv` and `.json`. These holdouts overlap, so their mean is not an independent external validation or a confidence interval.

Accuracy-oriented FedAvg and centralized searches were also tried. They selected linear models by development CV and gave only 69.48% and 71.43% on the existing seed-42 test split, respectively. They were not activated. Their evidence remains in `optimized-fedavg-seed42.json` and `optimized-prediction-seed42.json`; the F1-selected forest result is in `optimized-prediction-f1-seed42.json`.

All searches fitted candidates without test records or labels. However, the test split had already been observed in earlier development, and the scoring strategy was revised after the unsuccessful attempts. Treat the reported improvement as exploratory; a fresh external dataset is needed for an unbiased generalization claim. The higher seed-21 score is not presented as the application's default accuracy.

## Why the extra ZIPs were not merged

See `DATASET_AUDIT.md`. One is an exact duplicate of PIMA; the 172,291-row file contains only 5,001 unique rows and lacks a schema; the 500-row and 50,000-row files use different features/labels. Larger incompatible datasets do not provide additional examples of the current prediction task. The 50,000-row risk dataset needs its source, labeling process, units and feature availability documented before a separate model is built. No patient rows or identifiers are in this report.

## Easier demonstration

The home screen now offers **Train model -> Results -> Assessment**. Advanced tools are collapsed in navigation. Training needs only a goal, a name and a validated dataset; model settings, the nine-run suite and previous runs are optional disclosures. Results show the latest run's accuracy, recall and F1 first; detailed comparison and charts are collapsed.

Hinglish explanation: "FedAvg experiment dikhata hai ki hospitals apne local data par learn karke sirf parameter updates share karte hain. Prediction ke liye humne separately centralized models compare kiye; ab active Random Forest estimate deta hai. Dono ke method aur results app mein clearly labeled hain."

Reproduce without changing the active app model:

```powershell
.\backend\ml-service\.venv\Scripts\python.exe scripts/run_model_optimization.py
```

Method references: [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html), [decision-threshold tuning](https://scikit-learn.org/stable/modules/classification_threshold.html), [random Fourier features](https://scikit-learn.org/stable/modules/generated/sklearn.kernel_approximation.RBFSampler.html).
