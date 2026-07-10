from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ScannerSessionCreateResponse(BaseModel):
    id: UUID
    pairing_token: str
    expires_at: datetime


class ScannerScanCreate(BaseModel):
    pairing_token: str = Field(min_length=16, max_length=120)
    code: str = Field(min_length=1, max_length=120)


class ScannerScanResponse(BaseModel):
    id: UUID
    code: str
    created_at: datetime


class ScannerSessionPollResponse(BaseModel):
    session_id: UUID
    scans: list[ScannerScanResponse]
