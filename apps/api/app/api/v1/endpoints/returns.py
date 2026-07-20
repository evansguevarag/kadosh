from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_db
from app.api.v1.security import require_roles
from app.models.user import User
from app.schemas.return_transaction import (
    ReturnTransactionCreate,
    ReturnTransactionResponse,
)
from app.services.return_transaction_service import ReturnTransactionService

router = APIRouter(prefix="/returns", tags=["Returns"])


@router.get("", response_model=list[ReturnTransactionResponse])
def list_returns(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
):
    return ReturnTransactionService(db).list_transactions(
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=ReturnTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_return(
    payload: ReturnTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
):
    return ReturnTransactionService(db).create_transaction(payload, current_user)


@router.patch("/{transaction_id}/cancel", response_model=ReturnTransactionResponse)
def cancel_pending_return(
    transaction_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "EMPLOYEE")),
):
    return ReturnTransactionService(db).cancel_pending_transaction(
        transaction_id, current_user
    )
