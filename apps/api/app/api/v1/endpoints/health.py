from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["System"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}
