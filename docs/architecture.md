# FedHealth — Privacy-Preserving Diabetes Research Platform

## Architecture Overview

### System Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  React Web App  │    │ React Native App │    │ Expo Mobile App   │
│  (Researcher)   │    │   (Patient)      │    │   (Android)       │
└────────┬────────┘    └────────┬─────────┘    └─────────┬─────────┘
         │                      │                         │
         └──────────┬───────────┴─────────────────────────┘
                    │ HTTPS / REST
                    ▼
         ┌──────────────────────┐
         │   NestJS API Server  │
         │   (services/api)     │
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
│ (Serverless)    │    │ (services/ml-service)│
│                 │    │ Port: 8000           │
│ • Users/Roles   │    ├──────────────────────┤
│ • Predictions   │    │ • Dataset validation │
│ • Experiments   │    │ • Centralized train  │
│ • Models        │    │ • FedAvg (Flower)    │
│ • Audit logs    │    │ • DP-SGD             │
│ • Datasets      │    │ • Prediction         │
└─────────────────┘    └──────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Web Frontend | React + Vite + TypeScript + Tailwind | React 18, Vite 5 |
| Mobile Frontend | React Native + Expo + TypeScript | Expo SDK 51 |
| API Backend | NestJS + TypeORM + TypeScript | NestJS 10 |
| ML Service | Python + FastAPI + scikit-learn | Python 3.12 |
| Database | Neon PostgreSQL (Serverless) | PostgreSQL 16 |
| Federated Learning | Flower | 1.11 |
| Authentication | JWT + bcrypt | — |

### Data Flow

1. **Patient Assessment**: Mobile App → NestJS API → ML Service → prediction stored in PostgreSQL
2. **Research Experiment**: Web Dashboard → NestJS API → ML Service (train) → results stored in PostgreSQL
3. **Federated Training**: Web Dashboard → NestJS API → ML Service → Flower server → simulated clients → aggregated model

### Security Boundaries

- All API endpoints require authentication (except health, register, login)
- Role-based access: Patient, Researcher, Administrator
- Record ownership enforced server-side
- JWT tokens with configurable expiry
- Passwords hashed with bcrypt
- CORS restricted to configured origins
- File uploads validated and sanitized
- No secrets in source control
