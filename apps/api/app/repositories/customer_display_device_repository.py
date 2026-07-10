from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer_display_device import (
    CustomerDisplayDevice,
    CustomerDisplayPairingCode,
)


class CustomerDisplayDeviceRepository:
    def list_devices(self, db: Session) -> list[CustomerDisplayDevice]:
        statement = (
            select(CustomerDisplayDevice)
            .order_by(
                CustomerDisplayDevice.is_active.desc(),
                CustomerDisplayDevice.created_at.desc(),
            )
        )

        return list(db.scalars(statement).all())

    def get_device_by_id(
        self,
        db: Session,
        device_id: UUID,
    ) -> CustomerDisplayDevice | None:
        return db.get(CustomerDisplayDevice, device_id)

    def get_latest_device_by_name(
        self,
        db: Session,
        device_name: str,
    ) -> CustomerDisplayDevice | None:
        normalized_device_name = device_name.strip()

        statement = (
            select(CustomerDisplayDevice)
            .where(CustomerDisplayDevice.device_name == normalized_device_name)
            .order_by(
                CustomerDisplayDevice.is_active.desc(),
                CustomerDisplayDevice.created_at.desc(),
            )
            .limit(1)
        )

        return db.scalars(statement).first()

    def create_device(
        self,
        db: Session,
        *,
        device_name: str,
        device_token_hash: str,
        paired_by_user_id: UUID | None,
    ) -> CustomerDisplayDevice:
        now = datetime.now(timezone.utc)

        device = CustomerDisplayDevice(
            id=uuid4(),
            device_name=device_name.strip(),
            device_token_hash=device_token_hash,
            is_active=True,
            last_seen_at=None,
            paired_by_user_id=paired_by_user_id,
            created_at=now,
            updated_at=now,
        )

        db.add(device)
        db.flush()
        db.refresh(device)

        return device

    def regenerate_device_token(
        self,
        db: Session,
        device: CustomerDisplayDevice,
        *,
        device_token_hash: str,
        paired_by_user_id: UUID | None,
    ) -> CustomerDisplayDevice:
        device.device_token_hash = device_token_hash
        device.is_active = True
        device.last_seen_at = None
        device.paired_by_user_id = paired_by_user_id
        device.updated_at = datetime.now(timezone.utc)

        db.add(device)
        db.flush()
        db.refresh(device)

        return device

    def update_last_seen(
        self,
        db: Session,
        device: CustomerDisplayDevice,
    ) -> CustomerDisplayDevice:
        device.last_seen_at = datetime.now(timezone.utc)
        device.updated_at = datetime.now(timezone.utc)

        db.add(device)
        db.flush()
        db.refresh(device)

        return device

    def deactivate_device(
        self,
        db: Session,
        device: CustomerDisplayDevice,
    ) -> CustomerDisplayDevice:
        device.is_active = False
        device.updated_at = datetime.now(timezone.utc)

        db.add(device)
        db.flush()
        db.refresh(device)

        return device


class CustomerDisplayPairingCodeRepository:
    def create_pairing_code(
        self,
        db: Session,
        *,
        code_hash: str,
        device_name: str,
        expires_at: datetime,
        created_by_user_id: UUID | None,
    ) -> CustomerDisplayPairingCode:
        pairing_code = CustomerDisplayPairingCode(
            id=uuid4(),
            code_hash=code_hash,
            device_name=device_name.strip(),
            expires_at=expires_at,
            used_at=None,
            created_by_user_id=created_by_user_id,
            paired_device_id=None,
            created_at=datetime.now(timezone.utc),
        )

        db.add(pairing_code)
        db.flush()
        db.refresh(pairing_code)

        return pairing_code

    def list_available_pairing_codes(
        self,
        db: Session,
    ) -> list[CustomerDisplayPairingCode]:
        now = datetime.now(timezone.utc)

        statement = (
            select(CustomerDisplayPairingCode)
            .where(
                CustomerDisplayPairingCode.used_at.is_(None),
                CustomerDisplayPairingCode.expires_at > now,
            )
            .order_by(CustomerDisplayPairingCode.created_at.desc())
        )

        return list(db.scalars(statement).all())

    def mark_as_used(
        self,
        db: Session,
        pairing_code: CustomerDisplayPairingCode,
        *,
        paired_device_id: UUID,
    ) -> CustomerDisplayPairingCode:
        pairing_code.used_at = datetime.now(timezone.utc)
        pairing_code.paired_device_id = paired_device_id

        db.add(pairing_code)
        db.flush()
        db.refresh(pairing_code)

        return pairing_code
