from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.audit_log_service import AuditLogService


class UserService:
    """Administracion segura de cuentas internas."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.roles = RoleRepository(db)

    def list_users(self) -> list[UserResponse]:
        return [self._response(user) for user in self.users.find_all()]

    def create_user(self, payload: UserCreate, current_user: User) -> UserResponse:
        email = str(payload.email).lower().strip()
        if self.users.find_by_email(email):
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo.")
        if payload.document_number and self.users.find_by_document_number(payload.document_number):
            raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese DNI.")

        role = self._get_role(payload.role)
        user = User(
            role_id=role.id,
            first_name=payload.first_name,
            paternal_last_name=payload.paternal_last_name,
            maternal_last_name=payload.maternal_last_name,
            email=email,
            password_hash=hash_password(payload.password),
            document_number=payload.document_number,
            phone=payload.phone,
            status="ACTIVE",
            is_active=True,
        )
        self.db.add(user)
        self.db.flush()
        user.role = role
        AuditLogService(self.db).register_action(
            "CREATE", "USER", user.id, current_user,
            new_values={"email": email, "role": role.name, "is_active": True},
        )
        self.db.commit()
        self.db.refresh(user)
        return self._response(user)

    def update_user(
        self, user_id: UUID, payload: UserUpdate, current_user: User
    ) -> UserResponse:
        user = self.users.find_by_id(user_id)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "El usuario no existe.")

        changes = payload.model_dump(exclude_unset=True)
        required_fields = {
            "first_name", "paternal_last_name", "maternal_last_name",
            "document_number", "phone",
        }
        if any(field in changes and changes[field] is None for field in required_fields):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Nombres, apellidos, DNI y celular son obligatorios.",
            )
        old_values = {"email": user.email, "role": user.role.name, "is_active": user.is_active}

        if "email" in changes:
            email = str(changes["email"]).lower().strip()
            existing = self.users.find_by_email(email)
            if existing and existing.id != user.id:
                raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese correo.")
            user.email = email

        if changes.get("document_number"):
            existing = self.users.find_by_document_number(changes["document_number"])
            if existing and existing.id != user.id:
                raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe un usuario con ese DNI.")

        requested_role = changes.get("role")
        requested_active = changes.get("is_active")
        removes_admin = user.role.name == "ADMIN" and (
            requested_role == "EMPLOYEE" or requested_active is False
        )
        if removes_admin and self.users.count_active_by_role("ADMIN") <= 1:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Debe permanecer al menos un administrador activo.",
            )
        if user.id == current_user.id and requested_active is False:
            raise HTTPException(status.HTTP_409_CONFLICT, "No puedes desactivar tu propia cuenta.")

        if requested_role is not None:
            role = self._get_role(requested_role)
            user.role_id = role.id
            user.role = role
        for field in (
            "first_name", "paternal_last_name", "maternal_last_name",
            "document_number", "phone",
        ):
            if field in changes:
                value = changes[field]
                setattr(user, field, value.strip() if isinstance(value, str) else value)
        if requested_active is not None:
            user.is_active = requested_active
            user.status = "ACTIVE" if requested_active else "INACTIVE"
        if changes.get("password"):
            user.password_hash = hash_password(changes["password"])

        AuditLogService(self.db).register_action(
            "UPDATE", "USER", user.id, current_user, old_values=old_values,
            new_values={"email": user.email, "role": user.role.name, "is_active": user.is_active},
        )
        self.db.commit()
        self.db.refresh(user)
        return self._response(user)

    def _get_role(self, name: str):
        role = self.roles.find_by_name(name)
        if role is None or not role.is_active:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "El rol seleccionado no esta disponible.")
        return role

    @staticmethod
    def _response(user: User) -> UserResponse:
        return UserResponse.model_validate({
            "id": user.id, "first_name": user.first_name,
            "paternal_last_name": user.paternal_last_name,
            "maternal_last_name": user.maternal_last_name,
            "email": user.email, "document_number": user.document_number,
            "phone": user.phone, "role": user.role.name, "status": user.status,
            "is_active": user.is_active, "last_login_at": user.last_login_at,
            "created_at": user.created_at, "updated_at": user.updated_at,
        })
