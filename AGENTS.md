# AGENTS.md — FedHealth Project Guidelines

## Project Structure
This is a monorepo containing:
- `apps/web/` — React research dashboard (Vite + TypeScript + Tailwind)
- `apps/mobile/` — React Native patient app (Expo + TypeScript)
- `services/api/` — NestJS backend API
- `services/ml-service/` — Python ML service (FastAPI)
- `federated-learning/` — Flower-based FL implementation
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
