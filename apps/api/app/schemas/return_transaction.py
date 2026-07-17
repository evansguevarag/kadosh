from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReturnItemCreate(BaseModel):
    sale_item_id: UUID
    quantity: int = Field(gt=0)


class ReplacementItemCreate(BaseModel):
    product_variant_id: UUID
    quantity: int = Field(gt=0)


class ReturnTransactionCreate(BaseModel):
    original_sale_id: UUID
    transaction_type: str
    reason: str = Field(min_length=2, max_length=40)
    item_condition: str = Field(min_length=2, max_length=30)
    inventory_resolution: str
    settlement_method: str | None = Field(default=None, max_length=40)
    settlement_reference: str | None = Field(default=None, max_length=120)
    settlement_device_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=500)
    items: list[ReturnItemCreate] = Field(min_length=1)
    replacements: list[ReplacementItemCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_transaction(self):
        self.transaction_type = self.transaction_type.strip().upper()
        self.inventory_resolution = self.inventory_resolution.strip().upper()

        if self.transaction_type not in {"RETURN", "EXCHANGE"}:
            raise ValueError("El tipo debe ser devolución o cambio.")
        if self.inventory_resolution not in {
            "RESTOCK", "DEFECTIVE", "REVIEW", "DAMAGE", "SUPPLIER_RETURN"
        }:
            raise ValueError("El destino de inventario no es válido.")
        if self.transaction_type == "RETURN" and self.replacements:
            raise ValueError("Una devolución no puede incluir reemplazos.")
        if self.transaction_type == "EXCHANGE" and not self.replacements:
            raise ValueError("Un cambio debe incluir al menos un reemplazo.")

        item_ids = [item.sale_item_id for item in self.items]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError("Cada producto recibido debe aparecer una sola vez.")

        replacement_ids = [item.product_variant_id for item in self.replacements]
        if len(replacement_ids) != len(set(replacement_ids)):
            raise ValueError("Cada producto de reemplazo debe aparecer una sola vez.")

        return self

    model_config = ConfigDict(extra="forbid")


class ReturnItemResponse(BaseModel):
    id: UUID
    sale_item_id: UUID
    quantity: int
    unit_value: Decimal
    subtotal: Decimal
    model_config = ConfigDict(from_attributes=True)


class ReplacementItemResponse(BaseModel):
    id: UUID
    product_variant_id: UUID
    product_name: str
    variant_sku: str
    size: str | None
    color: str | None
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    model_config = ConfigDict(from_attributes=True)


class ReturnSettlementResponse(BaseModel):
    id: UUID
    direction: str
    method: str | None
    amount: Decimal
    currency: str
    status: str
    operation_reference: str | None
    settled_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReturnTransactionResponse(BaseModel):
    id: UUID
    return_number: str
    original_sale_id: UUID
    processed_by_id: UUID
    transaction_type: str
    reason: str
    item_condition: str
    inventory_resolution: str
    returned_value: Decimal
    replacement_value: Decimal
    difference_amount: Decimal
    settlement_method: str | None
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    items: list[ReturnItemResponse]
    replacements: list[ReplacementItemResponse]
    settlement: ReturnSettlementResponse | None
    model_config = ConfigDict(from_attributes=True)
