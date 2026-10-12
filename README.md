# FedHealth 🏥🔒
### Privacy-Preserving Federated Learning & Healthcare Intelligence Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0+-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Neon_PostgreSQL-Serverless-00E699?logo=postgresql&logoColor=white)](https://neon.tech/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Executive Summary

**FedHealth** is a production-ready, full-stack federated healthcare research platform designed to train, evaluate, and deploy privacy-preserving machine learning models across decentralized medical silos. 

By leveraging **Federated Learning (FedAvg)** alongside **Differential Privacy (DP)**, FedHealth allows medical institutions and patient mobile devices to collaboratively train disease prediction models (e.g., Diabetes risk on the PIMA Indians dataset) without ever exchanging raw patient records or compromising patient anonymity.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT TIER                               │
│                                                                        │
│   ┌──────────────────────────────┐    ┌─────────────────────────────┐  │
│   │   Web Research Portal        │    │    Mobile Patient App       │  │
│   │   (Vite + React 18 + TS)     │    │    (React Native + Expo)    │  │
│   │   Port: 5173                 │    │                             │  │
│   └──────────────┬───────────────┘    └──────────────┬──────────────┘  │
└──────────────────┼───────────────────────────────────┼─────────────────┘
                   │                                   │
                   │ REST (JWT / Role-Based Access)    │
                   ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          ORCHESTRATION BACKEND                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                    NestJS API Core (v10)                       │   │
│   │  • Auth & RBAC (Patient / Researcher / Admin)                  │   │
│   │  • Audit Trail & Security Headers (Helmet, Throttler)          │   │
│   │  • Model & Experiment Registry                                 │   │
│   │  • Swagger OpenAPI (Port: 3001)                                │   │
│   └───────────────────────┬─────────────────┬──────────────────────┘   │
└───────────────────────────┼─────────────────┼──────────────────────────┘
                            │                 │
                SQL Over SSL│                 │ Internal Microservice IPC
                            ▼                 ▼
┌──────────────────────────────┐   ┌─────────────────────────────────────┐
│       PERSISTENCE TIER       │   │        MACHINE LEARNING CORE        │
│                              │   │                                     │
│   ┌──────────────────────┐   │   │   ┌──────────────────────────────┐  │
│   │ Neon Serverless      │   │   │   │  FastAPI ML Service          │  │
│   │ PostgreSQL           │   │   │   │  • Inference Engine          │  │
│   │ (7 Normalized Tables)│   │   │   │  • Baseline Model Training   │  │
│   └──────────────────────┘   │   │   │  • Port: 8000 (Swagger/Docs) │  │
└──────────────────────────────┘   │   └──────────────┬───────────────┘  │
                                   │                  │                  │
                                   │   ┌──────────────▼──────────────┐   │
                                   │   │  Federated Learning Sim     │   │
                                   │   │  • FedAvg (IID & Non-IID)   │   │
                                   │   │  • Differential Privacy     │   │
                                   │   └─────────────────────────────┘   │
                                   └─────────────────────────────────────┘
```

---

## 📂 Repository Monorepo Structure

```text
FEDHealth/
├── apps/
│   ├── web/                     # Premium React research dashboard (Vite, TS, Tailwind)
│   └── mobile/                  # React Native patient companion application (Expo)
├── services/
│   ├── api/                     # NestJS backend API (TypeORM, Neon PostgreSQL, JWT Auth)
│   └── ml-service/              # Python FastAPI machine learning microservice
├── federated-learning/          # Flower/FedAvg simulation engine with Differential Privacy
├── packages/
│   └── shared-types/            # Shared TypeScript data transfer objects & interfaces
├── data/                        # Dataset schemas & instructions (PIMA dataset)
├── docs/                        # Complete technical specifications & research papers
│   ├── architecture.md          # In-depth architectural designs
│   ├── API_ENDPOINTS.md         # Exhaustive REST API reference
│   ├── DEPLOYMENT.md            # Production deployment walkthrough
│   └── RESEARCH_NOTES.md        # FL vs Centralized benchmarking findings
├── .env.example                 # Root environment template
└── README.md                    # Primary documentation & setup guide
```

---

## 🔬 Core Research Capabilities

| Paradigm | Architecture | Privacy Guarantee | Target Use Case |
| :--- | :--- | :--- | :--- |
| **Centralized Baseline** | Pooled Logistic Regression | None (Centralized data transfer required) | Theoretical performance upper-bound |
| **FedAvg (IID)** | Distributed clients, uniform label distribution | Raw data never leaves local environment | Standard multi-hospital collaborative studies |
| **FedAvg (Non-IID)** | Skewed label partitions across clients | Zero client data pooling; robust aggregation | Real-world demographic healthcare variance |
| **Differential Privacy (DP)** | Laplace / Gaussian noise on model gradients | Mathematical $(\epsilon, \delta)$-Differential Privacy | High-threat adversarial privacy compliance |
| **Local-Only Training** | Client isolated training | Maximum privacy; high model variance | Single-institution baseline comparison |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0+ / npm 9.0.0+
- **Python**: v3.12+
- **Database**: Free serverless PostgreSQL instance on [Neon](https://neon.tech)

---

### Step 1: Environment Setup

Create an environment configuration file:
```bash
cp .env.example .env
```
Provide your database URL and secret keys:
```env
DATABASE_URL=postgresql://neondb_owner:<password>@<neon-host>/neondb?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-key-32chars
ML_SERVICE_URL=http://localhost:8000
PORT=3001
```

---

### Step 2: Backend Orchestration API (NestJS)

```bash
cd services/api
npm install
npm run start:dev
```
- **REST API**: `http://localhost:3001`
- **Interactive Swagger Docs**: `http://localhost:3001/api/docs`

---

### Step 3: Python Machine Learning Microservice (FastAPI)

```bash
cd services/ml-service

# Create virtual environment
python -m venv .venv

# Activate environment
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start microservice
uvicorn app.main:app --reload --port 8000
```
- **ML Endpoint**: `http://127.0.0.1:8000`
- **FastAPI OpenAPI Docs**: `http://127.0.0.1:8000/docs`

---

### Step 4: Web Research Dashboard (React + Vite)

```bash
cd apps/web
npm install
npm run dev
```
- **Dashboard URL**: `http://localhost:5173`
- Default Admin: `admin@fedhealth.dev` / `AdminPass123!`

---

### Step 5: Mobile Patient App (Expo)

```bash
cd apps/mobile
npm install
npx expo start
```
- Scan QR code using Expo Go app on iOS or Android.

---

### Step 6: Federated Learning Simulations

To execute the federated experiments and evaluate round-by-round convergence:
```bash
cd federated-learning
python run_experiment.py --csv ../data/diabetes.csv --rounds 10 --clients 3
```

To run Differential Privacy benchmark sweeps:
```bash
python dp_experiments.py --csv ../data/diabetes.csv
```

---

## 🔐 Security & Compliance Architecture

- **Cryptographic Authentication**: JWT access tokens signed with HMAC-SHA256, BCrypt password salt rounds ($10$).
- **Role-Based Access Control (RBAC)**: Strictly separated access tiers for `patient`, `researcher`, and `admin`.
- **Ownership Scoping**: Patients are strictly restricted to querying and generating predictions on their own health records.
- **Defensive API Hardening**: Automated schema parsing via `class-validator`, rate limiting via `@nestjs/throttler`, CORS origin filtering, and OWASP HTTP security headers using `helmet`.
- **Immutable Audit Logging**: Security-relevant mutations (model registration, prediction executions, role changes) recorded to `audit_logs` table.

---

## 📊 Dataset Reference

The models utilize the standardized **PIMA Indians Diabetes Database**:
- **Instances**: 768 samples
- **Attributes**: 8 clinical markers (Pregnancies, Glucose, Blood Pressure, Skin Thickness, Insulin, BMI, Diabetes Pedigree Function, Age)
- **Target**: Binary outcome ($0$: Non-diabetic, $1$: Diabetic)
- **Source**: National Institute of Diabetes and Digestive and Kidney Diseases (NIDDK) via Kaggle.

---

## ⚠️ Research Disclaimer

> **IMPORTANT**: FedHealth is an academic and clinical research simulation system. Model outputs and risk percentages generated by this platform are research estimates and **must not be construed as clinical diagnosis or medical recommendations**. Always consult licensed medical professionals for healthcare decisions.

---

## 📄 License & Attribution

Distributed under the **MIT License**. Created by [btw-itz-sid](https://github.com/btw-itz-sid).
Contributions and academic collaborations are welcome!
