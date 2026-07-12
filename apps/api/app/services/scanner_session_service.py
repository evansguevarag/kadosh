from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.scanner_session import ScannerScan, ScannerSession
from app.models.user import User
from app.schemas.scanner_session import (
    ScannerScanResponse,
    ScannerSessionCreateResponse,
    ScannerSessionPollResponse,
)


class ScannerSessionService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create_session(self, current_user: User, purpose: str) -> ScannerSessionCreateResponse:
        now = datetime.now(timezone.utc)
        self._remove_expired_sessions(now)

        normalized_purpose = purpose.strip().upper()
        if normalized_purpose not in {"POS_PRODUCT_SCAN", "RECEIPT_LOOKUP"}:
            raise HTTPException(status_code=400, detail="Propósito de escáner inválido.")

        session = ScannerSession(
            seller_id=current_user.id,
            pairing_token=token_urlsafe(32),
            purpose=normalized_purpose,
            expires_at=now + timedelta(hours=4),
        )

        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        return ScannerSessionCreateResponse(
            id=session.id,
            pairing_token=session.pairing_token,
            expires_at=session.expires_at,
            purpose=session.purpose,
        )

    def register_scan(
        self,
        *,
        session_id: UUID,
        pairing_token: str,
        code: str,
    ) -> ScannerScanResponse:
        now = datetime.now(timezone.utc)
        normalized_code = code.strip()

        if not normalized_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código escaneado está vacío.",
            )

        session = self._get_valid_session(session_id, now)

        if session.pairing_token != pairing_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Token de escáner inválido.",
            )

        scan = ScannerScan(
            scanner_session_id=session.id,
            code=normalized_code,
            created_at=now,
        )

        self.db.add(scan)
        self.db.commit()
        self.db.refresh(scan)

        return self._to_scan_response(scan)

    def poll_session(
        self,
        *,
        session_id: UUID,
        after_scan_id: UUID | None,
    ) -> ScannerSessionPollResponse:
        now = datetime.now(timezone.utc)
        session = self._get_valid_session(session_id, now)

        scans = list(
            self.db.scalars(
                select(ScannerScan)
                .where(ScannerScan.scanner_session_id == session.id)
                .order_by(ScannerScan.created_at.asc())
            ).all()
        )[-50:]

        scan_responses = [self._to_scan_response(scan) for scan in scans]

        if after_scan_id is not None:
            scan_responses = self._filter_scans_after(scan_responses, after_scan_id)

        return ScannerSessionPollResponse(
            session_id=session_id,
            purpose=session.purpose,
            scans=scan_responses,
        )

    def _get_valid_session(
        self,
        session_id: UUID,
        now: datetime,
    ) -> ScannerSession:
        session = self.db.get(ScannerSession, session_id)

        if session is None or session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de escáner no encontrada o expirada.",
            )

        expires_at = session.expires_at

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at <= now:
            session.status = "EXPIRED"
            self.db.commit()

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sesión de escáner no encontrada o expirada.",
            )

        return session

    def _remove_expired_sessions(self, now: datetime) -> None:
        expired_sessions = self.db.scalars(
            select(ScannerSession).where(
                ScannerSession.status == "ACTIVE",
                ScannerSession.expires_at <= now,
            )
        ).all()

        for session in expired_sessions:
            session.status = "EXPIRED"

        if expired_sessions:
            self.db.commit()

    @staticmethod
    def _to_scan_response(scan: ScannerScan) -> ScannerScanResponse:
        return ScannerScanResponse(
            id=scan.id,
            code=scan.code,
            created_at=scan.created_at,
        )

    @staticmethod
    def _filter_scans_after(
        scans: list[ScannerScanResponse],
        after_scan_id: UUID,
    ) -> list[ScannerScanResponse]:
        for index, scan in enumerate(scans):
            if scan.id == after_scan_id:
                return scans[index + 1 :]

        return scans
