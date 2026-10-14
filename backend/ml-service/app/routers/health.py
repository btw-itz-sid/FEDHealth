"""FedHealth ML Service — Health check router"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Health check")
async def health_check():
    return {
        "status": "healthy",
        "service": "ml-service",
        "version": "0.1.0",
    }
