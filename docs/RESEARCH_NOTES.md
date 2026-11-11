# FedHealth — Federated Learning Research Notes

## Background

### What is Federated Learning?
Federated Learning (FL) is a machine learning paradigm where multiple clients collaboratively train a model without sharing their raw data. Instead:

1. A central server sends the current global model to all clients
2. Each client trains the model on its local data
3. Clients send model updates (not raw data) back to the server
4. The server aggregates updates to improve the global model
5. This process repeats for multiple communication rounds

### Why is FL relevant for diabetes prediction?
- Patient health data is sensitive and regulated (HIPAA, GDPR)
- Hospitals cannot freely share patient records
- FL enables collaborative model training across institutions
- Privacy is preserved because raw data never leaves the local site

## Algorithms Implemented

### FedAvg (Federated Averaging)
- **Paper:** McMahan et al., 2017 — "Communication-Efficient Learning of Deep Networks from Decentralized Data"
- **Method:** Weighted average of client model parameters, weights proportional to dataset size
- **Advantage:** Simple, communication-efficient, works well for IID data

### Data Partitioning Strategies

| Strategy | Description | Real-World Analog |
|----------|-------------|-------------------|
| **IID** | Random uniform split across clients | Each hospital sees similar patient demographics |
| **Non-IID** | Sorted by label, shards assigned to clients | Hospitals specialize (e.g., one sees mostly diabetic patients) |

### Differential Privacy
- **Mechanism:** Gaussian noise addition to model updates
- **Components:**
  - **Gradient clipping:** Bounds sensitivity of individual contributions
  - **Noise calibration:** σ = sensitivity × √(2 ln(1.25/δ)) / ε
  - **Privacy accounting:** Tracks cumulative (ε, δ) budget consumption

## Measured Results

All eighteen experiments use the same held-out split: seed 42, 20% test, 614 train / 154 test. Each benchmark was run twice: once with the standard (unweighted) loss, once with class balancing. Full table: `docs/fedhealth-comparison.csv`, regenerated with `scripts/export_comparison.py`.

| Experiment | Unweighted Acc | Recall | F1 | ROC-AUC | Balanced Acc | Recall | F1 | ROC-AUC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Centralized baseline | 0.708 | 0.500 | 0.545 | 0.813 | 0.734 | 0.704 | 0.650 | 0.813 |
| FedAvg IID | 0.695 | 0.500 | 0.535 | 0.811 | 0.727 | 0.685 | 0.638 | 0.811 |
| FedAvg Non-IID | 0.714 | 0.519 | 0.560 | 0.812 | 0.714 | 0.630 | 0.607 | 0.810 |
| Local only IID (mean of 5) | 0.718 | 0.515 | 0.560 | 0.796 | 0.714 | 0.667 | 0.621 | 0.795 |
| Local only Non-IID (mean of 5) | 0.642 | 0.500 | 0.424 | 0.771 | 0.642 | 0.559 | 0.465 | 0.772 |
| FedAvg IID + DP ε=0.5 (cumulative ε=10) | 0.630 | 0.611 | 0.537 | 0.657 | 0.623 | 0.630 | 0.540 | 0.666 |
| FedAvg IID + DP ε=1 (cumulative ε=20) | 0.649 | 0.556 | 0.526 | 0.701 | 0.636 | 0.611 | 0.541 | 0.710 |
| FedAvg IID + DP ε=5 (cumulative ε=100) | 0.682 | 0.519 | 0.533 | 0.769 | 0.708 | 0.630 | 0.602 | 0.772 |
| FedAvg IID + DP ε=10 (cumulative ε=200) | 0.714 | 0.519 | 0.560 | 0.791 | 0.708 | 0.593 | 0.587 | 0.795 |

FedAvg IID reaches 98–99% of the centralized accuracy without pooling raw records. On non-IID data, FedAvg beats clients training alone by 7 accuracy points and about 14 F1 points. Stronger privacy (lower ε per round) costs accuracy and ROC-AUC. Local-only confusion matrices in the CSV are the sum of five clients scored on the same test set, not a single 154-row matrix.

### Class balancing

Only 35% of records are diabetic, so the unweighted model under-predicts the positive class and misses half the diabetic patients in the test set (recall 0.50). Class balancing weights each training sample by `n / (2 · n_class)`, using the pooled training-split prevalence, so every method optimises the same objective. Centralized uses scikit-learn's `class_weight="balanced"`; FedAvg and local-only apply the same weights inside each client's SGD step.

The decision was made with 5-fold cross-validation on the training split only (recall 0.575 → 0.701, F1 0.655 → 0.672, ROC-AUC 0.843 → 0.844), before the held-out results above were produced. On the test set, balancing raises recall by 11–20 points for centralized and FedAvg, without changing ROC-AUC. The model ranks patients the same way, but its decision threshold moves towards catching more cases. Precision stays about the same (0.60 → 0.60 centralized), so the extra positives are mostly true diabetic cases.

### Would more data help?

A learning curve on the training split (5-fold CV, logistic regression) shows validation ROC-AUC rising from 0.803 at 98 rows to 0.838 at about 300 rows, then flattening (0.843 at 491 rows), with train and validation scores close together. The model is limited by the 8 features and the linear decision boundary, not by the number of rows. More PIMA-style records would add little. A meaningful jump would need richer features (for example HbA1c), which means a different dataset and patient form.

These are research estimates on 768 records. They are not clinically valid.

## Dataset: PIMA Indians Diabetes

- **Source:** National Institute of Diabetes and Digestive and Kidney Diseases
- **Samples:** 768 females of Pima Indian heritage, age ≥ 21
- **Features:** 8 health measurements (Glucose, BMI, Age, etc.)
- **Target:** Binary (0 = no diabetes, 1 = diabetes)
- **Class balance:** ~35% positive (diabetes)
- **Known issues:** Zero values in Glucose, BP, etc. represent missing data

## References

1. McMahan, H. B., et al. (2017). "Communication-Efficient Learning of Deep Networks from Decentralized Data." AISTATS.
2. Kairouz, P., et al. (2021). "Advances and Open Problems in Federated Learning." Foundations and Trends in ML.
3. Dwork, C. & Roth, A. (2014). "The Algorithmic Foundations of Differential Privacy." Foundations and Trends in TCS.
4. Smith, J. W., et al. (1988). "Using the ADAP Learning Algorithm to Forecast the Onset of Diabetes Mellitus." SCAMC.
