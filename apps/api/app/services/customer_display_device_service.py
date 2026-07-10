import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.repositories.customer_display_device_repository import (
    CustomerDisplayDeviceRepository,
    CustomerDisplayPairingCodeRepository,
)
from app.schemas.customer_display_device import (
    CustomerDisplayDeviceResponse,
    CustomerDisplayDeviceStatusResponse,
    PairCustomerDisplayDeviceResponse,
    PairingCodeCreateResponse,
)


class CustomerDisplayDeviceService:
    def __init__(self) -> None:
        self.device_repository = CustomerDisplayDeviceRepository()
        self.pairing_code_repository = CustomerDisplayPairingCodeRepository()

    def list_devices(self, db: Session) -> list[CustomerDisplayDeviceResponse]:
        devices = self.device_repository.list_devices(db)

        return [
            CustomerDisplayDeviceResponse.model_validate(device)
            for device in devices
        ]

    def create_pairing_code(
        self,
        db: Session,
        *,
        device_name: str,
        created_by_user_id: UUID | None,
    ) -> PairingCodeCreateResponse:
        normalized_device_name = self._normalize_device_name(device_name)
        code = self._generate_pairing_code()
        code_hash = hash_password(self._build_pairing_code_secret(code))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        pairing_code = self.pairing_code_repository.create_pairing_code(
            db,
            code_hash=code_hash,
            device_name=normalized_device_name,
            expires_at=expires_at,
            created_by_user_id=created_by_user_id,
        )

        db.commit()

        return PairingCodeCreateResponse(
            pairing_code_id=pairing_code.id,
            device_name=pairing_code.device_name,
            code=code,
            expires_at=pairing_code.expires_at,
        )

    def pair_device(
        self,
        db: Session,
        *,
        code: str,
    ) -> PairCustomerDisplayDeviceResponse:
        available_codes = (
            self.pairing_code_repository.list_available_pairing_codes(db)
        )

        matched_pairing_code = None
        code_secret = self._build_pairing_code_secret(code)

        for pairing_code in available_codes:
            if verify_password(code_secret, pairing_code.code_hash):
                matched_pairing_code = pairing_code
                break

        if matched_pairing_code is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código de vinculación no es válido o ya expiró.",
            )

        device_token = secrets.token_urlsafe(48)
        device_token_hash = hash_password(device_token)

        existing_device = self.device_repository.get_latest_device_by_name(
            db,
            matched_pairing_code.device_name,
        )

        if existing_device is None:
            device = self.device_repository.create_device(
                db,
                device_name=matched_pairing_code.device_name,
                device_token_hash=device_token_hash,
                paired_by_user_id=matched_pairing_code.created_by_user_id,
            )
        else:
            device = self.device_repository.regenerate_device_token(
                db,
                existing_device,
                device_token_hash=device_token_hash,
                paired_by_user_id=matched_pairing_code.created_by_user_id,
            )

        self.pairing_code_repository.mark_as_used(
            db,
            matched_pairing_code,
            paired_device_id=device.id,
        )

        db.commit()

        return PairCustomerDisplayDeviceResponse(
            device_id=device.id,
            device_name=device.device_name,
            device_token=device_token,
        )

    def validate_device_token(
        self,
        db: Session,
        *,
        device_id: UUID,
        device_token: str,
    ) -> CustomerDisplayDeviceStatusResponse:
        device = self.device_repository.get_device_by_id(db, device_id)

        if device is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La tablet no está registrada.",
            )

        if not device.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La tablet está desactivada.",
            )

        if not verify_password(device_token, device.device_token_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El token de la tablet no es válido.",
            )

        updated_device = self.device_repository.update_last_seen(db, device)

        db.commit()

        return CustomerDisplayDeviceStatusResponse(
            device_id=updated_device.id,
            device_name=updated_device.device_name,
            is_active=updated_device.is_active,
            last_seen_at=updated_device.last_seen_at,
        )

    def deactivate_device(
        self,
        db: Session,
        *,
        device_id: UUID,
    ) -> CustomerDisplayDeviceResponse:
        device = self.device_repository.get_device_by_id(db, device_id)

        if device is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La tablet no está registrada.",
            )

        updated_device = self.device_repository.deactivate_device(db, device)

        db.commit()

        return CustomerDisplayDeviceResponse.model_validate(updated_device)

    def _generate_pairing_code(self) -> str:
        return f"{secrets.randbelow(900000) + 100000}"

    def _build_pairing_code_secret(self, code: str) -> str:
        return f"kadosh-pairing-code:{code.strip()}"

    def _normalize_device_name(self, device_name: str) -> str:
        normalized_device_name = device_name.strip()

        if not normalized_device_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de la tablet es obligatorio.",
            )

        return normalized_device_name
