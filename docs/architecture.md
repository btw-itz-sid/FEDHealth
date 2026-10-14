# FedHealth — Privacy-Preserving Diabetes Research Platform

## Architecture Overview

### System Diagram

```
         ┌──────────────────────┐
         │    React Web App     │
         │ (Patient/Researcher/ │
         │        Admin)        │
         └──────────┬───────────┘
                    │ HTTPS / REST
                    ▼
         ┌──────────────────────┐
         │   NestJS API Server  │
         │   (backend/api)      │
         │   Port: 3001         │
         ├──────────────────────┤
         │ • Auth (JWT+bcrypt)  │
         │ • RBAC               │
         │ • REST /api/v1/*     │
         │ • OpenAPI/Swagger    │
         │ • Rate Limiting      │
         │ • Audit Logging      │
         └────────┬─────────────┘
                  │
         ┌────────┴─────────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌──────────────────────┐
│ Neon PostgreSQL │    │ Python ML Service    │
│ (Serverless)    │    │ (backend/ml-service) │
│                 │    │ Port: 8000           │
│ • Users/Roles   │    ├──────────────────────┤
│ • Predictions   │    │ • Dataset validation │
│ • Experiments   │    │ • Centralized train  │
│ • Models        │    │ • FedAvg simulation  │
│ • Audit logs    │    │ • DP (clip + noise)  │
│ • Datasets      │    │ • Prediction         │
└─────────────────┘    └──────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Web Frontend | React + Vite + TypeScript + Tailwind | React 18, Vite 5 |
| API Backend | NestJS + TypeORM + TypeScript | NestJS 10 |
| ML Service | Python + FastAPI + scikit-learn | Python 3.12 |
| Database | Neon PostgreSQL (Serverless) | PostgreSQL 16 |
| Federated Learning | Custom FedAvg simulation (NumPy) | — |
| Authentication | JWT + bcrypt | — |

### Data Flow

1. **Patient Assessment**: Web App (patient view) → NestJS API → ML Service → prediction stored in PostgreSQL
2. **Research Experiment**: Web Dashboard → NestJS API → ML Service (train) → results stored in PostgreSQL
3. **Federated Training**: Web Dashboard → NestJS API → ML Service (`app/services/federated_service.py`) → simulated clients train locally → FedAvg aggregation (optionally clipped + noised for DP) → aggregated model registered; the API makes the active model serve patient predictions

### Security Boundaries

- All API endpoints require authentication (except health, register, login)
- Role-based access: Patient, Researcher, Administrator
- Record ownership enforced server-side
- JWT tokens with configurable expiry
- Passwords hashed with bcrypt
- CORS restricted to configured origins
- File uploads validated and sanitized
- No secrets in source control
