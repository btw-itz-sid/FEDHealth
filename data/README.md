# Dataset — PIMA Indians Diabetes

## About
This project uses the **PIMA Indians Diabetes Database** for its initial research baseline.
The dataset is originally from the National Institute of Diabetes and Digestive and Kidney Diseases.

## How to Obtain

### Option 1: Kaggle (Recommended)
1. Visit: https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database
2. Download `diabetes.csv`
3. Place it in this directory: `data/diabetes.csv`

### Option 2: UCI ML Repository
1. Visit: https://archive.ics.uci.edu/dataset/34/diabetes
2. Download the dataset
3. Rename to `diabetes.csv` and place in this directory

## Expected Schema

| Column | Type | Description | Valid Range |
|--------|------|-------------|-------------|
| Pregnancies | int | Number of pregnancies | 0–20 |
| Glucose | int | Plasma glucose concentration (2h OGTT) | 0–300 mg/dL |
| BloodPressure | int | Diastolic blood pressure | 0–200 mm Hg |
| SkinThickness | int | Triceps skin fold thickness | 0–100 mm |
| Insulin | int | 2-Hour serum insulin | 0–1000 μU/mL |
| BMI | float | Body mass index | 0–80 kg/m² |
| DiabetesPedigreeFunction | float | Diabetes pedigree function | 0.0–3.0 |
| Age | int | Age in years | 0–120 |
| Outcome | int | Binary target (1 = diabetes, 0 = no diabetes) | 0 or 1 |

## Missing Values
In the PIMA dataset, zero (0) values in Glucose, BloodPressure, SkinThickness, Insulin, and BMI
typically represent missing measurements, not actual zeros. The ML service handles this by
replacing these zeros with NaN before imputation.

## License
The original dataset is publicly available for research and educational purposes.
Verify the license terms from the source before any non-educational use.

## Important
- Do NOT commit the CSV file to version control
- The `.gitignore` excludes `data/*.csv`
- This dataset is used for research and education, not clinical validation
