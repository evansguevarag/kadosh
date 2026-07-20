from fastapi import APIRouter, Depends

from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.document_lookup import DniLookupResponse
from app.services.document_lookup_service import DocumentLookupService

router = APIRouter(prefix="/document-lookup", tags=["Document Lookup"])


@router.get("/dni/{dni}", response_model=DniLookupResponse)
def lookup_dni(
    dni: str,
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
) -> DniLookupResponse:
    service = DocumentLookupService()

    return service.lookup_dni(dni)
