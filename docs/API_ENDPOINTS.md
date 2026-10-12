# FedHealth — API Endpoints Documentation

## Base URL
```
http://localhost:3001/api/v1
```

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "MinEight8!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "patient"  // patient | researcher
}

Response 201:
{
  "user": { "id", "email", "firstName", "lastName", "role" },
  "accessToken": "jwt..."
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "MinEight8!" }

Response 200:
{ "user": {...}, "accessToken": "jwt..." }
```

### Get Profile
```http
GET /auth/users/me
Authorization: Bearer <token>

Response 200: { "id", "email", "firstName", "lastName", "role", "isActive" }
```

---

## Predictions (Requires Auth)

### Create Prediction
```http
POST /predictions
Authorization: Bearer <token>
Content-Type: application/json

{
  "Pregnancies": 6, "Glucose": 148, "BloodPressure": 72,
  "SkinThickness": 35, "Insulin": 0, "BMI": 33.6,
  "DiabetesPedigreeFunction": 0.627, "Age": 50
}

Response 201:
{
  "id": "uuid",
  "prediction": 1,
  "probability": 0.7234,
  "riskLevel": "High",
  "disclaimer": "...",
  "inputFeatures": {...}
}
```

### List Predictions
```http
GET /predictions?page=1&limit=10
Authorization: Bearer <token>

Response 200: { "items": [...], "total": 42, "page": 1, "limit": 10 }
```

---

## Datasets (Researcher/Admin Only)

### Upload Dataset
```http
POST /datasets/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <CSV file>
name: "pima_train_v1"

Response 201: { "id", "name", "status": "pending", "fileSize", ... }
```

### List Datasets
```http
GET /datasets?page=1&limit=20
Authorization: Bearer <token>
```

---

## Experiments (Researcher/Admin Only)

### Create Experiment
```http
POST /experiments
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Centralized Baseline",
  "datasetId": "uuid",
  "trainingMethod": "centralized",  // centralized | local_only | fedavg
  "randomSeed": 42,
  "testSize": 0.2,
  "numClients": 5,        // for federated
  "partitionType": "iid",  // iid | non_iid
  "numRounds": 10          // FL rounds
}

Response 201: { "id", "name", "status": "queued", ... }
```

### List Experiments
```http
GET /experiments?page=1&limit=20
```

### Get Experiment Detail
```http
GET /experiments/:id
Response: { ...experiment, "finalMetrics": {...}, "rounds": [...] }
```

---

## Models (Researcher/Admin Only)

### List Models
```http
GET /models?page=1&limit=20
```

---

## Admin (Admin Only)

### List Users
```http
GET /admin/users
```

### Change User Role
```http
PATCH /admin/users/:id/role
{ "role": "researcher" }
```

### Deactivate User
```http
PATCH /admin/users/:id/deactivate
```

### Audit Logs
```http
GET /admin/audit?page=1&limit=50
```

---

## Health Check (Public)
```http
GET /health
Response: { "status": "ok", "timestamp": "..." }
```

---

## Swagger UI
Interactive docs available at: `http://localhost:3001/api/docs`
