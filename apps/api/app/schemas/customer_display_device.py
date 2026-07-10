from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CustomerDisplayDeviceResponse(BaseModel):
    id: UUID
    device_name: str
    is_active: bool
    last_seen_at: datetime | None
    paired_by_user_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class PairingCodeCreateRequest(BaseModel):
    device_name: str = Field(
        min_length=3,
        max_length=120,
        examples=["Tablet Caja 1"],
    )


class PairingCodeCreateResponse(BaseModel):
    pairing_code_id: UUID
    device_name: str
    code: str
    expires_at: datetime


class PairCustomerDisplayDeviceRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, examples=["482913"])


class PairCustomerDisplayDeviceResponse(BaseModel):
    device_id: UUID
    device_name: str
    device_token: str


class CustomerDisplayDeviceTokenRequest(BaseModel):
    device_id: UUID
    device_token: str


class CustomerDisplayDeviceStatusResponse(BaseModel):
    device_id: UUID
    device_name: str
    is_active: bool
    last_seen_at: datetime | None
