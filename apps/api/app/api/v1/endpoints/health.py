from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "kadosh-pos-api",
        "message": "FastAPI backend is running correctly.",
    }
