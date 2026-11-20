"""Internal API boundary. The ML port must also stay off the public network."""
import os
import secrets

from fastapi import Header, HTTPException


def validate_security_configuration():
    if os.getenv("NODE_ENV") == "production" and len(os.getenv("ML_SERVICE_KEY", "")) < 32:
        raise RuntimeError("Production requires ML_SERVICE_KEY with at least 32 characters")


def require_service_key(x_ml_service_key: str | None = Header(default=None)):
    expected = os.getenv("ML_SERVICE_KEY", "")
    if not expected:
        if os.getenv("NODE_ENV") == "production":
            raise HTTPException(status_code=503, detail="Service authentication is not configured")
        return  # Local development only; bind uvicorn to 127.0.0.1.
    if not x_ml_service_key or not secrets.compare_digest(x_ml_service_key, expected):
        raise HTTPException(status_code=401, detail="Service authentication required")
