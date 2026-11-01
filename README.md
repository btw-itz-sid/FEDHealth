<div align="center">

# 🏥 FedHealth

### Privacy-Preserving Federated Learning for Diabetes Risk Prediction

A full-stack research platform that demonstrates how multiple hospitals can collaboratively train a machine learning model **without sharing patient data**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-Serverless-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)

</div>

---

## 📖 What is FedHealth?

FedHealth is a research platform built for a final-year engineering project. It shows how **Federated Learning (FL)** can be applied to healthcare — specifically diabetes risk prediction — while keeping patient data private.

### The Problem
Hospitals have valuable patient data that could improve ML models, but **they can't share it** due to privacy regulations (HIPAA, GDPR).

### The Solution — Federated Learning
Instead of sending data to a central server, each hospital trains a model locally and sends only the **model weight updates** (numbers, not records) to a central aggregator. The aggregator combines updates using **FedAvg** and sends the improved global model back.

```
  Hospital A          Hospital B          Hospital C
  ┌─────────┐         ┌─────────┐         ┌─────────┐
  │ Patient  │         │ Patient  │         │ Patient  │
  │  Data    │         │  Data    │         │  Data    │
  └────┬─────┘         └────┬─────┘         └────┬─────┘
       │                    │                    │
  ┌────▼─────┐         ┌────▼─────┐         ┌────▼─────┐
  │  Local   │         │  Local   │         │  Local   │
  │  Model   │         │  Model   │         │  Model   │
  └────┬─────┘         └────┬─────┘         └────┬─────┘
       │  weight updates    │                    │
       └────────────────────┼────────────────────┘
                            ▼
                   ┌─────────────────┐
                   │ Central Server  │
                   │ (FedAvg)        │
                   │                 │
                   │ Aggregates      │
                   │ updates →       │
                   │ Global Model    │
                   └────────┬────────┘
                            │
                     ┌──────▼──────┐
                     │ Evaluation  │
                     │ (Test Set)  │
                     │ 20% held    │
                     │ out data    │
                     └─────────────┘
```

> **Key insight**: Raw patient data **never leaves** the hospital. Only model weight updates are shared.

---

## 🏗️ System Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React Web App  │────▶│   NestJS API     │────▶│   ML Service     │
│   (Vite + TS +   │     │   (REST + JWT)   │     │   (FastAPI +     │
│    Tailwind)     │     │                  │     │    scikit-learn) │
│   :5173          │     │   :3001          │     │   :8000          │
└──────────────────┘     └───────┬──────────┘     └───────┬──────────┘
                                 │                        │
                          ┌──────▼──────────┐     ┌───────▼──────────┐
                          │ Neon PostgreSQL  │     │ FL Simulator     │
                          │ (users, exps,   │     │ (FedAvg, DP,     │
                          │  predictions)   │     │  partitioning)   │
                          └─────────────────┘     └──────────────────┘
```

| Component | Tech Stack | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 18, TypeScript, Tailwind CSS 4, Recharts, Vite | Interactive dashboard with architecture diagram, experiment management, risk assessment |
| **API** | NestJS, TypeORM, JWT, bcrypt, Helmet | REST API with auth, role-based access, audit logging |
| **ML Service** | Python 3.12, FastAPI, scikit-learn, NumPy | Federated training simulation, model serving, predictions |
| **Database** | Neon PostgreSQL (serverless) | Users, experiments, predictions, datasets, audit logs |

---

## 📂 Project Structure

```
FedHealth/
├── frontend/                    # React web app
│   └── src/
│       ├── app/                 # App.tsx — routing
│       ├── components/          # Shared UI components
│       │   ├── ArchitectureDiagram.tsx   # Interactive FL architecture visual
│       │   ├── QuickStartGuide.tsx       # Step-by-step demo walkthrough
│       │   └── layout/                  # Dashboard sidebar + header
│       ├── features/            # Page-level features
│       │   ├── overview/        # Dashboard with architecture + stats
│       │   ├── datasets/        # Upload & validate CSV datasets
│       │   ├── experiments/     # Create, run, view FL experiments
│       │   ├── compare/         # Side-by-side method comparison
│       │   ├── assess/          # Patient risk assessment form
│       │   ├── models/          # Model registry
│       │   ├── history/         # Patient prediction history
│       │   ├── auth/            # Login / Register
│       │   ├── admin/           # User management (admin only)
│       │   └── profile/         # User profile
│       ├── contexts/            # Auth context provider
│       ├── lib/                 # API client, formatters, PIMA config
│       └── styles/              # Design system (index.css)
│
├── backend/
│   ├── api/                     # NestJS backend API
│   │   └── src/
│   │       ├── modules/         # Auth, Users, Datasets, Experiments, Models, Predictions, Audit
│   │       └── database/        # TypeORM entities & migrations
│   │
│   ├── ml-service/              # Python ML service (FastAPI)
│   │   └── app/
│   │       ├── services/
│   │       │   ├── federated_service.py   # FedAvg + DP simulation
│   │       │   ├── training_service.py    # Centralized baseline
│   │       │   ├── prediction_service.py  # Model inference
│   │       │   └── dataset_service.py     # CSV validation
│   │       ├── routers/         # API endpoints
│   │       └── schemas/         # Pydantic models
│   │
│   └── federated-learning/      # Standalone experiment scripts
│       ├── simulation.py        # FL simulation (IID / Non-IID)
│       ├── differential_privacy.py  # DP mechanisms
│       └── run_experiment.py    # CLI experiment runner
│
├── packages/shared-types/       # Shared TypeScript type definitions
├── data/                        # Dataset instructions (CSVs gitignored)
├── docs/                        # Additional documentation
└── scripts/                     # Start scripts + demo setup
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ / npm 9+
- **Python** 3.12+
- **Neon PostgreSQL** database (free tier: [neon.tech](https://neon.tech))

### 1. Clone and Configure

```bash
git clone https://github.com/btw-itz-sid/FEDHealth.git
cd FedHealth
```

Copy the environment file and fill in your credentials:
```bash
# Root level
cp .env.example .env

# API backend
cp backend/api/.env.example backend/api/.env
# Edit backend/api/.env → set DATABASE_URL and JWT_SECRET
```

### 2. Download Dataset

```bash
curl -o data/diabetes.csv https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv
```

Or download manually from [Kaggle](https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database) and place at `data/diabetes.csv`.

### 3. Install Dependencies (one time)

```bash
# ML Service — Python virtual environment
cd backend/ml-service
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# API — Node.js
cd ../api
npm install
npm run seed        # Creates demo user accounts

# Frontend — React app
cd ../../frontend
npm install
```

### 4. Start the Platform (two terminals)

```powershell
# Terminal 1 — Backend (API on :3001 + ML on :8000)
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1

# Terminal 2 — Frontend (Web app on :5173)
powershell -ExecutionPolicy Bypass -File scripts\start-frontend.ps1
```

Or double-click: `scripts\start-backend.cmd` and `scripts\start-frontend.cmd`.

### 5. Open the App

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Web application |
| http://localhost:3001/api/docs | Swagger API documentation |

### Demo Accounts (created by `npm run seed`)

| Role | Email | Password | Access |
|------|-------|----------|--------|
| 🧑‍⚕️ Patient | patient@fedhealth.dev | PatientPass123! | Risk assessment, prediction history |
| 🔬 Researcher | researcher@fedhealth.dev | ResearchPass123! | Datasets, experiments, models, comparison |
| ⚙️ Admin | admin@fedhealth.dev | AdminPass123! | Everything + user management |

> These are local development credentials only.

### 6. Load Demo Experiments (optional)

With all services running, this uploads the dataset and runs the full 9-experiment benchmark suite:

```bash
backend\ml-service\.venv\Scripts\python scripts\demo_setup.py
```

---

## 📱 App Pages & Demo Flow

When presenting to your guide, follow this path through the app:

### Step 1: Overview Page — Architecture Diagram
The landing page shows an **interactive federated learning architecture diagram** with 5 clickable layers:

| Layer | What it shows |
|-------|--------------|
| **① Healthcare Centers** | 3 simulated hospitals with private patient data |
| **② Standardised Data** | Preprocessed health records at each site |
| **③ Local Models** | Each hospital trains its own logistic regression model |
| **④ Central Aggregator** | FedAvg server combines weight updates |
| **⑤ Evaluation** | Global model tested on 20% held-out test set |

Click any layer to expand detailed explanations.

### Step 2: Datasets Page — Upload CSV
Upload the PIMA Indians Diabetes CSV. The system validates it (checks columns, types, missing values) and shows dataset stats.

### Step 3: Experiments Page — Run Training
- Pick a **training method**: Centralized, FedAvg, or Local-Only
- Configure **clients** (hospitals), **rounds**, **partition type** (IID / Non-IID)
- Optionally enable **Differential Privacy** (ε, δ, clip norm)
- Or click **"Run benchmark suite"** to run all 9 methods at once

### Step 4: Experiment Detail — Per-Round Metrics
See accuracy/F1/ROC-AUC converge over rounds, client data distribution charts, confusion matrices, and privacy budget tracking.

### Step 5: Compare Page — Side-by-Side Analysis
Select 2+ experiments to compare:
- Bar charts for accuracy, F1, ROC-AUC
- Convergence curves overlaid
- Privacy-utility tradeoff chart
- Auto-generated research findings
- CSV export for your report

### Step 6: Risk Assessment — Live Prediction
Enter 8 health measurements (or use sample patients) to get a diabetes risk prediction from the **federated model** — trained without any single party seeing all the data.

---

## 🔬 Research Features

| Feature | Description |
|---------|-------------|
| **Centralized Baseline** | Standard logistic regression on pooled data (upper bound) |
| **FedAvg (IID)** | Federated averaging with uniform data distribution across clients |
| **FedAvg (Non-IID)** | Federated averaging with Dirichlet label skew (α=0.5) — realistic |
| **Local-Only** | Each client trains independently, no collaboration (lower bound) |
| **Differential Privacy** | Per-client update clipping + Gaussian noise (ε = 0.5, 1, 5, 10) |
| **Compare View** | Side-by-side metrics, convergence curves, privacy–utility chart, auto findings |
| **Model Registry** | One active model serves all patient risk assessments |
| **Per-Round Metrics** | Accuracy, F1, ROC-AUC, log-loss tracked every FL communication round |
| **Confusion Matrices** | Visual TP/TN/FP/FN comparison across all training methods |
| **Communication Cost** | Tracks bytes exchanged between nodes and server per round |
| **CSV/JSON Export** | Export all experiment data for use in your research report |

---

## 🔒 Security & Privacy

| Feature | Implementation |
|---------|---------------|
| **Authentication** | JWT tokens with bcrypt password hashing |
| **Role-Based Access** | Patient, Researcher, Admin — scoped API endpoints |
| **Input Validation** | class-validator on all DTOs, Zod on frontend |
| **Rate Limiting** | @nestjs/throttler prevents abuse |
| **HTTP Security** | Helmet headers (XSS, HSTS, etc.) |
| **CORS Whitelist** | Only allowed origins |
| **Audit Logging** | All security-relevant events logged |
| **Ownership Scoping** | Patients only see their own predictions |
| **Differential Privacy** | Optional DP on FL training (Gaussian mechanism) |
| **Data Never Leaves** | FL simulation ensures data stays at the simulated hospital node |

---

## 📊 Dataset

**PIMA Indians Diabetes Dataset** — 768 samples, 8 features, binary outcome (diabetes yes/no).

| Feature | Description | Unit |
|---------|-------------|------|
| Pregnancies | Number of times pregnant | count |
| Glucose | Plasma glucose concentration (2h OGTT) | mg/dL |
| BloodPressure | Diastolic blood pressure | mm Hg |
| SkinThickness | Triceps skin fold thickness | mm |
| Insulin | 2-hour serum insulin | μU/mL |
| BMI | Body mass index | kg/m² |
| DiabetesPedigreeFunction | Family history score | 0–2.42 |
| Age | Age in years | years |

Source: [UCI ML Repository](https://archive.ics.uci.edu/ml/datasets/pima+indians+diabetes) / [Kaggle](https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database)

---

## 🛠️ Tech Stack Summary

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS 4, Vite, Recharts, React Router, React Hook Form, Zod |
| **Backend API** | NestJS 10, TypeORM, JWT (Passport), bcrypt, Helmet, class-validator, Swagger |
| **ML Service** | Python 3.12, FastAPI, scikit-learn, NumPy, pandas, joblib |
| **Database** | Neon PostgreSQL (serverless), TypeORM migrations |
| **DevOps** | PowerShell start scripts, npm workspaces |

---

## 📚 Key Research References

- McMahan et al. (2017) — *Communication-Efficient Learning of Deep Networks from Decentralized Data* (FedAvg)
- Hsu et al. (2019) — *Measuring the Effects of Non-Identical Data Distribution for Federated Visual Classification* (Dirichlet Non-IID)
- Abadi et al. (2016) — *Deep Learning with Differential Privacy* (DP-SGD)
- Rieke et al. (2020) — *The Future of Digital Health with Federated Learning* (FL in healthcare)

---

## ⚠️ Disclaimer

This is an **educational and research** platform built as a final-year engineering project. All predictions are **research estimates** and must **not** be used for clinical diagnosis. The model is trained on the PIMA Indians Diabetes dataset (adult women of Pima heritage) and may not generalize to other populations. Always consult a qualified healthcare professional for medical advice.

---

## 📝 License

This project is for educational purposes as part of a final-year engineering project.
