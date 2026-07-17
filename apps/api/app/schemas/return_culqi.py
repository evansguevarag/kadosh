from uuid import UUID

from pydantic import BaseModel, EmailStr


class ReturnCulqiOrderCreate(BaseModel):
    settlement_session_id: UUID
    email: EmailStr


class ReturnCulqiOrderConfirm(BaseModel):
    settlement_session_id: UUID
    culqi_order_id: str


class ReturnCulqiChargeCreate(BaseModel):
    settlement_session_id: UUID
    token_id: str
    email: EmailStr


class ReturnCulqiChargeResponse(BaseModel):
    settlement_session_id: UUID
    return_transaction_id: UUID
    culqi_charge_id: str | None
    status: str
    message: str


class ReturnCulqiOrderResponse(BaseModel):
    settlement_session_id: UUID
    return_transaction_id: UUID
    culqi_order_id: str
    amount: int
    currency: str
    status: str
    order_state: str
    message: str
