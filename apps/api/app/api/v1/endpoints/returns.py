from fastapi import APIRouter, Depends, status
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
):
    return ReturnTransactionService(db).list_transactions()


@router.post("", response_model=ReturnTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_return(
    payload: ReturnTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ADMIN", "SELLER", "CASHIER")),
):
    return ReturnTransactionService(db).create_transaction(payload, current_user)
