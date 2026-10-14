# AGENTS.md — FedHealth Project Guidelines

## Project Structure
This is a monorepo containing:
- `frontend/` — React web app for patients, researchers, and admins (Vite + TypeScript + Tailwind). This is the only frontend; there is no mobile app.
- `backend/api/` — NestJS backend API
- `backend/ml-service/` — Python ML service (FastAPI). `scripts/start-backend.ps1` starts this together with the API.
- `backend/federated-learning/` — Standalone FL experiment scripts (the app's FedAvg runs in `backend/ml-service/app/services/federated_service.py`)
- `packages/shared-types/` — Shared TypeScript type definitions
- `data/` — Dataset instructions (actual CSVs gitignored)
- `docs/` — Documentation

## Conventions
- TypeScript for all JS/TS code
- Python 3.12+ for ML service
- REST API versioned under `/api/v1`
- Environment variables for all secrets
- Neon PostgreSQL for persistence
- JWT for authentication
- bcrypt for password hashing

## Important Rules
- Never commit .env files or secrets
- Never hardcode credentials
- Always validate inputs server-side
- Predictions are research estimates — never claim clinical validity
- Keep test set separate from training data
- Use reproducible random seeds
