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

## Expected Results

### Centralized vs. Federated Comparison
- Centralized baseline: ~77-78% accuracy (PIMA dataset)
- FedAvg IID: Should approach centralized within 5-10 rounds
- FedAvg Non-IID: Typically 2-5% lower accuracy than IID
- Local-only: Highest variance, often worse mean accuracy

### Privacy-Utility Tradeoff
| ε (Privacy) | Expected Accuracy Drop |
|-------------|----------------------|
| 10.0 | Minimal (~0-1%) |
| 5.0 | Small (~1-2%) |
| 1.0 | Moderate (~3-5%) |
| 0.5 | Significant (~5-10%) |

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
