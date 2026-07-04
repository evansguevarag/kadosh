import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.document_lookup import DniLookupResponse


class DocumentLookupService:
    """Servicio para consultar documentos usando proveedores externos."""

    def lookup_dni(self, dni: str) -> DniLookupResponse:
        """Consulta datos básicos de una persona por DNI usando ApiPeruDev."""

        normalized_dni = dni.strip()

        if not normalized_dni.isdigit() or len(normalized_dni) != 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El DNI debe tener exactamente 8 dígitos.",
            )

        if not settings.apiperu_token:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Token de ApiPeru no configurado en el servidor.",
            )

        url = f"{settings.apiperu_base_url.rstrip('/')}/dni"

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.apiperu_token}",
        }

        payload = {
            "dni": normalized_dni,
        }

        try:
            with httpx.Client(timeout=10) as client:
                response = client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="La consulta a ApiPeru demoró demasiado.",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo conectar con ApiPeru.",
            ) from exc

        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Token de ApiPeru inválido o sin permisos.",
            )

        if response.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontraron datos para el DNI ingresado.",
            )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="ApiPeru respondió con un error al consultar el DNI.",
            )

        data = response.json()

        success = bool(data.get("success", True))

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontraron datos para el DNI ingresado.",
            )

        person_data = data.get("data") or data

        first_name = str(
            person_data.get("nombres")
            or person_data.get("nombre")
            or ""
        ).strip()

        paternal_surname = str(
            person_data.get("apellido_paterno")
            or person_data.get("apellidoPaterno")
            or ""
        ).strip()

        maternal_surname = str(
            person_data.get("apellido_materno")
            or person_data.get("apellidoMaterno")
            or ""
        ).strip()

        full_name = " ".join(
            value
            for value in [first_name, paternal_surname, maternal_surname]
            if value
        ).strip()

        if not first_name or not full_name:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="ApiPeru no devolvió datos completos para el DNI ingresado.",
            )

        return DniLookupResponse(
            dni=normalized_dni,
            first_name=first_name,
            paternal_surname=paternal_surname,
            maternal_surname=maternal_surname,
            full_name=full_name,
            source="APIPERU",
        )
