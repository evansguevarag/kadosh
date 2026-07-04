from pydantic import BaseModel, Field


class DniLookupResponse(BaseModel):
    """Respuesta normalizada de consulta DNI."""

    dni: str = Field(examples=["12345678"])
    first_name: str = Field(examples=["JUAN CARLOS"])
    paternal_surname: str = Field(examples=["PEREZ"])
    maternal_surname: str = Field(examples=["LOPEZ"])
    full_name: str = Field(examples=["JUAN CARLOS PEREZ LOPEZ"])
    source: str = Field(default="APIPERU", examples=["APIPERU"])
