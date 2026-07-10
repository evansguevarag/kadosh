from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.password_reset_otp import PasswordResetOtp


class PasswordResetOtpRepository:
    """Repositorio de OTP para recuperacion de contrasena."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, otp: PasswordResetOtp) -> PasswordResetOtp:
        self.db.add(otp)
        self.db.commit()
        self.db.refresh(otp)

        return otp

    def find_latest_active_by_user(
        self,
        user_id: UUID,
        now: datetime,
    ) -> PasswordResetOtp | None:
        statement = (
            select(PasswordResetOtp)
            .where(
                PasswordResetOtp.user_id == user_id,
                PasswordResetOtp.consumed_at.is_(None),
                PasswordResetOtp.expires_at > now,
            )
            .order_by(PasswordResetOtp.created_at.desc())
            .limit(1)
        )

        return self.db.scalar(statement)

    def consume(self, otp: PasswordResetOtp, consumed_at: datetime) -> PasswordResetOtp:
        otp.consumed_at = consumed_at
        self.db.add(otp)
        self.db.commit()
        self.db.refresh(otp)

        return otp

    def consume_active_for_user(self, user_id: UUID, consumed_at: datetime) -> None:
        statement = (
            update(PasswordResetOtp)
            .where(
                PasswordResetOtp.user_id == user_id,
                PasswordResetOtp.consumed_at.is_(None),
            )
            .values(consumed_at=consumed_at)
        )

        self.db.execute(statement)
        self.db.commit()
