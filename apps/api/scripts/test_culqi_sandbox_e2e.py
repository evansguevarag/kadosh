from datetime import datetime, timezone
from pathlib import Path
import sys

import httpx
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.schemas.culqi import CulqiChargeCreate
from app.schemas.payment_session import PaymentSessionCreate
from app.schemas.sale import SaleCreate, SaleItemCreate
from app.services.culqi_service import CulqiService
from app.services.payment_session_service import PaymentSessionService
from app.services.sale_service import SaleService


CULQI_TOKENS_URL = "https://api.culqi.com/v2/tokens"


def ensure_sandbox_keys() -> None:
    if not settings.culqi_public_key.startswith("pk_test_"):
        raise RuntimeError("Prueba bloqueada: CULQI_PUBLIC_KEY no es de sandbox.")
    if not settings.culqi_secret_key.startswith("sk_test_"):
        raise RuntimeError("Prueba bloqueada: CULQI_SECRET_KEY no es de sandbox.")


def create_test_token(email: str) -> str:
    response = httpx.post(
        CULQI_TOKENS_URL,
        headers={
            "Authorization": f"Bearer {settings.culqi_public_key}",
            "Content-Type": "application/json",
        },
        json={
            "card_number": "4111111111111111",
            "cvv": "123",
            "expiration_month": 12,
            "expiration_year": 2030,
            "email": email,
        },
        timeout=20,
    )
    data = response.json()
    if response.status_code >= 400 or not data.get("id"):
        message = data.get("user_message") or data.get("merchant_message") or data
        raise RuntimeError(f"Culqi no genero el token sandbox: {message}")
    return str(data["id"])


def main() -> None:
    ensure_sandbox_keys()
    db = SessionLocal()
    original_commit = db.commit
    sale_id = None
    variant_id = None
    initial_stock = None

    try:
        user = db.scalar(select(User).where(User.status == "ACTIVE").limit(1))
        variant = db.scalar(
            select(ProductVariant)
            .where(ProductVariant.status == "ACTIVE", ProductVariant.stock_quantity > 0)
            .order_by(ProductVariant.stock_quantity.desc())
            .limit(1)
        )
        if user is None or variant is None:
            raise RuntimeError("Se necesita un usuario y una variante activa con stock.")

        variant_id = variant.id
        initial_stock = variant.stock_quantity

        # Los servicios conservan su comportamiento normal, pero sus commits solo
        # hacen flush para poder revertir todos los datos locales al finalizar.
        db.commit = db.flush  # type: ignore[method-assign]

        sale = SaleService(db).create_sale(
            SaleCreate(
                items=[SaleItemCreate(product_variant_id=variant.id, quantity=1)],
                notes="PRUEBA E2E CULQI SANDBOX - REVERTIR LOCALMENTE",
            ),
            user,
        )
        sale_id = sale.id
        payment_session = PaymentSessionService(db).create_payment_session(
            PaymentSessionCreate(
                sale_id=sale.id,
                device_id="audit-culqi-sandbox",
                receipt_email="review@culqi.com",
                expires_in_minutes=10,
            ),
            user,
        )

        email = f"sandbox.{int(datetime.now(timezone.utc).timestamp())}@culqi.com"
        token_id = create_test_token(email)
        result = CulqiService(db).create_charge(
            CulqiChargeCreate(
                payment_session_id=payment_session.id,
                token_id=token_id,
                email=email,
            )
        )
        db.refresh(sale)
        db.refresh(payment_session)

        print("sandbox_charge", result.status)
        print("sale_status", sale.status)
        print("payment_session_status", payment_session.status)
        print("stock_delta_inside_transaction", initial_stock - variant.stock_quantity)

        if result.status != "PAID" or sale.status != "PAID":
            raise RuntimeError("El cargo sandbox no termino como PAID.")
        if payment_session.status != "PAID":
            raise RuntimeError("La sesion sandbox no termino como PAID.")
        if initial_stock - variant.stock_quantity != 1:
            raise RuntimeError("La venta sandbox no desconto exactamente una unidad.")
    finally:
        db.commit = original_commit  # type: ignore[method-assign]
        db.rollback()
        db.close()

    verification_db = SessionLocal()
    try:
        persisted_sale = verification_db.get(__import__("app.models.sale", fromlist=["Sale"]).Sale, sale_id)
        restored_variant = verification_db.get(ProductVariant, variant_id)
        print("local_test_sale_persisted", persisted_sale is not None)
        print("stock_restored", restored_variant.stock_quantity == initial_stock)
        if persisted_sale is not None or restored_variant.stock_quantity != initial_stock:
            raise RuntimeError("El aislamiento local de la prueba fallo.")
    finally:
        verification_db.close()


if __name__ == "__main__":
    main()
