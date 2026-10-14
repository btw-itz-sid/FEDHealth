# FedHealth — Privacy-Preserving Diabetes Risk Prediction

A full-stack research platform for comparing centralized, local, and federated learning approaches to diabetes risk prediction using the PIMA Indians Diabetes dataset.

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌───────────────┐
│  React Web   │────▶│  NestJS API  │────▶│  ML Service   │
│  App         │     │  (REST/JWT)  │     │  (FastAPI)    │
└──────────────┘     └──────┬───────┘     └───────┬───────┘
                            │                     │
                     ┌──────▼───────┐     ┌───────▼───────┐
                     │  Neon SQL    │     │  FL Simulator │
                     │  (Postgres)  │     │  (Python)     │
                     └──────────────┘     └───────────────┘
```

## 📂 Project Structure

```
├── frontend/             # React web app — patient, researcher, admin (Vite + Tailwind)
├── backend/
│   ├── api/              # NestJS backend API
│   ├── ml-service/       # Python ML service (FastAPI); starts with the API
│   └── federated-learning/  # Standalone FL experiment scripts
├── packages/
│   └── shared-types/     # Shared TypeScript type definitions
├── data/                 # Dataset instructions (CSVs gitignored)
└── docs/                 # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ / npm 9+
- Python 3.12+
- Neon SQL database (free tier: https://neon.tech)

### 1. Clone and Configure
```bash
cp .env.example .env
# Edit .env with your Neon DATABASE_URL and JWT_SECRET
```

### 2. Dataset
```bash
curl -o data/diabetes.csv https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv
```

### 3. Install once
```bash
cd backend/ml-service
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt

cd ../api
npm install
npm run seed        # demo users, first run only

cd ../../frontend
npm install
```

### 4. Start (two terminals)
Backend starts the API and the ML service together. Closing that window stops both.

```powershell
# Terminal 1 — backend (API on :3001, ML on :8000)
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1

# Terminal 2 — frontend (web app on :5173)
powershell -ExecutionPolicy Bypass -File scripts\start-frontend.ps1
```

Same thing as double-click: `scripts\start-backend.cmd` and `scripts\start-frontend.cmd`.

Swagger: http://localhost:3001/api/docs · App: http://localhost:5173

### 5. Load Demo Experiments
With all three services running, this uploads `data/diabetes.csv` (if no valid dataset exists) and runs the 9-experiment benchmark suite: centralized, FedAvg IID/non-IID, local-only IID/non-IID, and FedAvg + DP at ε = 0.5, 1, 5, 10.
```bash
backend/ml-service/.venv/Scripts/python scripts/demo_setup.py
```

The same suite can be started from the web app: **Experiments → Run benchmark suite**.

### Demo Accounts (created by `npm run seed`)
| Role | Email | Password |
|------|-------|----------|
| Patient | patient@fedhealth.dev | PatientPass123! |
| Researcher | researcher@fedhealth.dev | ResearchPass123! |
| Admin | admin@fedhealth.dev | AdminPass123! |

These are local development credentials only — change or remove them for any shared deployment.

## 🔬 Research Features

| Feature | Description |
|---------|-------------|
| **Centralized Baseline** | Standard logistic regression on pooled data |
| **FedAvg (IID)** | Federated averaging with uniform data distribution |
| **FedAvg (Non-IID)** | Federated averaging with skewed label distribution |
| **Local-Only** | Each client trains independently (no aggregation) |
| **Differential Privacy** | Clipped client updates + Gaussian noise, with per-round and cumulative ε |
| **Compare View** | Side-by-side metrics, per-round curves, privacy–utility chart, CSV export |
| **Model Registry** | One active model serves all patient risk assessments |
| **Per-Round Metrics** | Accuracy, F1, ROC-AUC tracked every FL round |
| **Confusion Matrices** | Visual comparison across all methods |

## 🔒 Security & Privacy

- **JWT Authentication** with bcrypt password hashing
- **Role-Based Access Control** (Patient, Researcher, Admin)
- **Input Validation** on all endpoints (class-validator)
- **Rate Limiting** via @nestjs/throttler
- **Helmet** HTTP security headers
- **CORS** whitelist configuration
- **Audit Logging** of all security-relevant events
- **Ownership-Scoped Queries** — patients only see their own data

## ⚠️ Disclaimer

This is an **educational and research** platform. All predictions are research estimates and must **not** be used for clinical diagnosis. Consult a qualified healthcare professional for medical advice.

## 📊 Dataset

The platform uses the **PIMA Indians Diabetes Dataset** (768 samples, 8 features, binary outcome). Download from [Kaggle](https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database) and place at `data/diabetes.csv`.

## 📝 License

This project is for educational purposes as part of a final-year engineering project.
