import unittest
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock, patch
from uuid import uuid4

from pydantic import ValidationError
from fastapi import HTTPException

from app.schemas.return_transaction import ReturnTransactionCreate
from app.schemas.sale import SaleCreate
from app.schemas.payment_session import PaymentSessionCreate
from app.api.v1.endpoints.public_receipts import get_public_receipt
from app.models.payment_session import PaymentSession
from app.services.payment_session_service import (
    ALLOWED_PAYMENT_SESSION_STATUSES,
    PAYMENT_SESSION_TRANSITIONS,
)
from app.services.return_culqi_service import ReturnCulqiService


class SaleContractTests(unittest.TestCase):
    def test_client_cannot_override_catalog_price(self) -> None:
        with self.assertRaises(ValidationError):
            SaleCreate.model_validate(
                {
                    "items": [{
                        "product_variant_id": str(uuid4()),
                        "quantity": 1,
                        "unit_price": "0.01",
                        "discount_amount": "0.00",
                    }]
                }
            )

    @patch("app.api.v1.endpoints.public_receipts.SaleRepository")
    def test_cancelled_sale_has_no_public_receipt(
        self, repository_class: Mock
    ) -> None:
        repository_class.return_value.find_by_receipt_token.return_value = (
            SimpleNamespace(status="CANCELLED")
        )

        with self.assertRaises(HTTPException) as raised:
            get_public_receipt("cancelled-token", Mock())

        self.assertEqual(raised.exception.status_code, 404)

    @patch("app.api.v1.endpoints.public_receipts.SaleRepository")
    def test_pending_sale_has_no_public_receipt(
        self, repository_class: Mock
    ) -> None:
        repository_class.return_value.find_by_receipt_token.return_value = (
            SimpleNamespace(status="PENDING_PAYMENT")
        )

        with self.assertRaises(HTTPException) as raised:
            get_public_receipt("pending-token", Mock())

        self.assertEqual(raised.exception.status_code, 404)


class ReturnContractTests(unittest.TestCase):
    def test_duplicate_return_items_are_rejected(self) -> None:
        sale_item_id = uuid4()
        with self.assertRaises(ValidationError):
            ReturnTransactionCreate.model_validate(
                {
                    "original_sale_id": str(uuid4()),
                    "transaction_type": "RETURN",
                    "reason": "DEFECTIVE",
                    "item_condition": "DEFECTIVE",
                    "inventory_resolution": "DEFECTIVE",
                    "items": [
                        {"sale_item_id": str(sale_item_id), "quantity": 1},
                        {"sale_item_id": str(sale_item_id), "quantity": 1},
                    ],
                }
            )


class PaymentSessionContractTests(unittest.TestCase):
    def test_device_id_must_be_a_uuid(self) -> None:
        with self.assertRaises(ValidationError):
            PaymentSessionCreate.model_validate(
                {
                    "sale_id": str(uuid4()),
                    "device_id": "tablet-caja-01",
                }
            )

    def test_device_uuid_has_a_physical_foreign_key(self) -> None:
        foreign_keys = {
            foreign_key.target_fullname
            for foreign_key in PaymentSession.__table__.c.device_uuid.foreign_keys
        }

        self.assertEqual(foreign_keys, {"customer_display_devices.id"})

    def test_operator_cannot_declare_provider_outcomes(self) -> None:
        self.assertNotIn("PAID", ALLOWED_PAYMENT_SESSION_STATUSES)
        self.assertNotIn("FAILED", ALLOWED_PAYMENT_SESSION_STATUSES)

    def test_processing_cannot_transition_to_paid_manually(self) -> None:
        self.assertNotIn("PAID", PAYMENT_SESSION_TRANSITIONS["PROCESSING"])

    def test_processing_cannot_be_cancelled_or_expired_manually(self) -> None:
        self.assertEqual(PAYMENT_SESSION_TRANSITIONS["PROCESSING"], set())


class ReturnCulqiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = ReturnCulqiService.__new__(ReturnCulqiService)
        self.session = SimpleNamespace(id=uuid4(), provider_order_id="ord_test_1")
        self.settlement = SimpleNamespace(amount=Decimal("130.00"), currency="PEN")
        self.transaction = SimpleNamespace(id=uuid4())

    def test_provider_amount_must_match_settlement(self) -> None:
        with self.assertRaises(HTTPException):
            self.service._validate_provider_order(
                {"id": "ord_test_1", "amount": 1, "currency_code": "PEN"},
                self.session,
                self.settlement,
                self.transaction,
            )

    def test_provider_metadata_must_match_return(self) -> None:
        with self.assertRaises(HTTPException):
            self.service._validate_provider_order(
                {
                    "id": "ord_test_1",
                    "amount": 13000,
                    "currency_code": "PEN",
                    "metadata": {"return_transaction_id": str(uuid4())},
                },
                self.session,
                self.settlement,
                self.transaction,
            )

    @patch("app.services.return_culqi_service.httpx.delete")
    @patch("app.services.return_culqi_service.httpx.get")
    def test_pending_provider_order_is_deleted_before_local_cancel(
        self, get_mock: Mock, delete_mock: Mock
    ) -> None:
        self.service._headers = Mock(return_value={})
        get_mock.return_value = Mock(
            status_code=200,
            json=Mock(return_value={
                "id": "ord_test_1",
                "state": "pending",
                "amount": 13000,
                "currency_code": "PEN",
            }),
        )
        delete_mock.return_value = Mock(
            status_code=200,
            content=b"{}",
            json=Mock(return_value={"deleted": True}),
        )

        self.service.cancel_provider_order_if_unpaid(
            self.session, self.settlement, self.transaction
        )

        delete_mock.assert_called_once()
        self.assertEqual(self.session.raw_response, {"deleted": True})

    @patch("app.services.return_culqi_service.httpx.get")
    def test_already_deleted_provider_order_allows_local_cancel(
        self, get_mock: Mock
    ) -> None:
        self.service._headers = Mock(return_value={})
        get_mock.return_value = Mock(status_code=404)

        self.service.cancel_provider_order_if_unpaid(
            self.session, self.settlement, self.transaction
        )

        self.assertTrue(self.session.raw_response["deleted"])

    @patch("app.services.return_culqi_service.httpx.get")
    def test_paid_provider_order_cannot_be_cancelled(self, get_mock: Mock) -> None:
        self.service._headers = Mock(return_value={})
        get_mock.return_value = Mock(
            status_code=200,
            json=Mock(return_value={
                "id": "ord_test_1",
                "state": "paid",
                "amount": 13000,
                "currency_code": "PEN",
            }),
        )

        with self.assertRaises(HTTPException) as raised:
            self.service.cancel_provider_order_if_unpaid(
                self.session, self.settlement, self.transaction
            )

        self.assertEqual(raised.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
