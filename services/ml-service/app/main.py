"""
FedHealth ML Service — FastAPI Application
============================================
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.routes import health, training, prediction, validation

app = FastAPI(
    title="FedHealth ML Service",
    description="Machine learning service for diabetes risk prediction",
    version="0.1.0",
)

# CORS
origins = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(training.router, prefix="/api/v1", tags=["Training"])
app.include_router(prediction.router, prefix="/api/v1", tags=["Prediction"])
app.include_router(validation.router, prefix="/api/v1", tags=["Validation"])
