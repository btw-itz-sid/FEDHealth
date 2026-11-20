# Incoming dataset audit — 20 November 2026

Scope: inspect the four user-supplied ZIPs for compatibility with FedHealth. CSV content was treated as data, not instructions. Archives were read in place without extracting or executing their contents. No patient records were copied into this report or source control.

## Findings

| Archive | CSV | Observed size | Compatibility and decision |
|---|---|---:|---|
| `archive (1).zip` | `diabetes.csv` | 768 rows, 9 columns | Same ordered columns and values as the existing `data/diabetes.csv`. Adds no new examples. Keep one copy. |
| `archive.zip` | `diabetes_dataset.csv` | 500 rows, 10 columns | Different schema. Missing PIMA Pregnancies, SkinThickness and DiabetesPedigreeFunction; includes gender/activity/family-history categories and an identifier. Do not append to PIMA. |
| `archive (2).zip` | `Synthetic diabetes 2 type prediction dataset.csv` | 172,291 rows if parsed without a header, 9 columns | Appears headerless: the default parser mistakes the first numeric row for column names. Only 5,001 unique rows; 167,290 duplicate rows (97.10%). No feature dictionary or target definition supplied. Do not train or merge without provenance and schema. |
| `archive (3).zip` | `diabetes_risk_prediction_dataset.csv` | 50,000 rows, 42 columns | Separate risk-classification schema with categorical inputs and derived score/recommendation fields. Has 20,810 missing cells across 17,321 rows. Not compatible with the current eight-feature pipeline. Needs independent validation and a new model/form. |

## Why more rows may not mean more information

The 172,291-row synthetic file repeats a much smaller set of examples. Splitting repeated copies at random could place the same record in training and test, inflating scores. Before any future experiment, establish the schema, deduplicate or group related examples before splitting, and keep synthetic evaluation separate from claims about real patients. Do not present 172,291 as independent patient observations.

The 50,000-row file has three target labels:

- High: 36,593 (73.186%).
- Moderate: 12,937 (25.874%).
- Low: 470 (0.940%).

Always predicting High would already achieve 73.186% raw accuracy on the full observed label distribution. A future experiment should compare to a majority baseline and use per-class recall, macro-F1 and balanced metrics, not headline accuracy alone. Test-set baseline values must be calculated on that actual test split.

Potential leakage candidates include `Diabetes_Risk_Score`, `AI_Health_Recommendation` and `Doctor_Consultation_Needed`. They may be derived from the target or the same rule used to assign it. Exclude them until a data dictionary explains how and when they were produced. Drop `Patient_ID` as a predictor. This is a leakage concern from the column semantics, not proof of how the dataset was generated. The source and labeling process were not supplied.

## What can be used now

The existing PIMA data supports the current end-to-end demonstration and the already measured v2 benchmarks. The duplicate archive should not be added as a second cohort. The remaining files should be kept outside the active training flow until their schema and origin are documented.

No incoming dataset was used to overwrite the active model, change the prediction form or generate a new clinical-performance claim.

## A larger, documented research option

The [UCI CDC Diabetes Health Indicators dataset](https://archive.ics.uci.edu/dataset/891/cdc+diabetes+health+indicators) lists 253,680 examples and 21 features. It offers a documented alternative for a separate survey-based diabetes experiment. Its variables differ from PIMA, so it requires a new data contract, preprocessing pipeline, prediction form and model registry family. It is not extra rows to append to the current CSV.

Before undertaking that extension, define the intended target and population, specify an evaluation protocol, establish a simple baseline, and document feature availability at prediction time. A larger survey is not clinical validation of the current PIMA model.

Source: [UCI dataset metadata](https://archive.ics.uci.edu/dataset/891/cdc+diabetes+health+indicators). Duplicate, schema, missingness and class-count figures above were computed directly from the provided local files with pandas.
