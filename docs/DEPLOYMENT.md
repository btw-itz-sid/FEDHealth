# FedHealth — Deployment Guide

## Prerequisites
- Node.js 18+
- Python 3.12+
- Neon PostgreSQL database
- (Optional) Android SDK for mobile builds

## Environment Setup

### 1. Create Neon Database
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project named "fedhealth"
3. Copy the connection string

### 2. Configure Environment
```bash
# Root level
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/fedhealth?sslmode=require
#   JWT_SECRET=<random 64+ char string>
```

### 3. Backend API
```bash
cd services/api
cp ../.env .env  # or create separate .env
npm install
npm run seed    # Creates demo users
npm run start:dev
```

### 4. ML Service
```bash
cd services/ml-service
python -m venv .venv
.venv/Scripts/activate  # Windows
# source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Web Dashboard
```bash
cd apps/web
cp .env.example .env
npm install
npm run dev  # http://localhost:5173
```

### 6. Mobile App
```bash
cd apps/mobile
npm install
npx expo start  # Scan QR with Expo Go
```

## Demo Accounts (After Seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@fedhealth.dev | AdminPass123! | Admin |
| researcher@fedhealth.dev | ResearchPass123! | Researcher |
| patient@fedhealth.dev | PatientPass123! | Patient |

## Running Experiments (CLI)
```bash
cd federated-learning
# Download PIMA dataset from Kaggle, save to data/diabetes.csv
python run_experiment.py --csv ../data/diabetes.csv --num-clients 5 --num-rounds 10
```

## Running Tests

### API Tests
```bash
cd services/api
npm test              # Unit tests
npm run test:e2e      # E2E (needs DATABASE_URL)
```

### ML Service Tests
```bash
cd services/ml-service
.venv/Scripts/activate
pytest tests/ -v
```

## Production Notes
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET` (64+ random chars)
- Enable `synchronize: false` in TypeORM and use migrations
- Configure rate limiting per environment
- Set up HTTPS with reverse proxy (nginx/Caddy)
- Monitor audit logs for security events
