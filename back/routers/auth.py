from __future__ import annotations

import importlib
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, status

try:
    from ..schemas import (
        AuthenticatedUser,
        DirectorPasswordUpdateRequest,
        DirectorPasswordUpdateResponse,
        LoginRequest,
        LoginResponse,
        PantryCredentialRegistryResponse,
        PantryPasswordUpdateRequest,
        PantryPasswordUpdateResponse,
    )
except ImportError:
    from schemas import (
        AuthenticatedUser,
        DirectorPasswordUpdateRequest,
        DirectorPasswordUpdateResponse,
        LoginRequest,
        LoginResponse,
        PantryCredentialRegistryResponse,
        PantryPasswordUpdateRequest,
        PantryPasswordUpdateResponse,
    )

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

router = APIRouter(prefix="/auth", tags=["auth"])

DIRECTOR_IDENTIFIERS = {"director", "director@example.com"}
DEFAULT_DIRECTOR_EMAIL = "director@example.com"


def _get_crud_module():
    return importlib.import_module("crud")


def _build_director_user(username: str) -> AuthenticatedUser:
    return AuthenticatedUser(
        id="director",
        name="Director",
        email=username,
        pantryId="director",
        role="director",
    )


def _build_pantry_user(pantry_id: int, username: str) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=str(pantry_id),
        name=username,
        email=None,
        pantryId=str(pantry_id),
        role="pantry",
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest) -> LoginResponse:
    username = payload.username.strip()
    password = payload.password
    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required.",
        )

    if username.lower() in DIRECTOR_IDENTIFIERS:
        is_valid = _get_crud_module().check_director_credentials(DEFAULT_DIRECTOR_EMAIL, password)
        if is_valid:
            return LoginResponse(ok=True, user=_build_director_user(DEFAULT_DIRECTOR_EMAIL))
        return LoginResponse(
            ok=False,
            error="Invalid director credentials.",
        )

    pantry_id: int | None = None
    if username.isdigit():
        pantry_id = int(username)
    else:
        pantry_id = _get_crud_module().get_pantry_id_by_name(username)

    if pantry_id is None:
        return LoginResponse(ok=False, error="Pantry not found.")

    is_valid = _get_crud_module().check_credentials(pantry_id, password)
    if is_valid:
        return LoginResponse(ok=True, user=_build_pantry_user(pantry_id, username))

    return LoginResponse(ok=False, error="Invalid pantry credentials.")


@router.post("/director/password", response_model=DirectorPasswordUpdateResponse)
def update_director_password(
    payload: DirectorPasswordUpdateRequest,
) -> DirectorPasswordUpdateResponse:
    email = payload.email.strip().lower()
    new_password = payload.newPassword.strip()
    if not email or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and new password are required.",
        )

    if email != DEFAULT_DIRECTOR_EMAIL:
        return DirectorPasswordUpdateResponse(
            ok=False,
            error="Only the configured director account can be updated here.",
        )

    _get_crud_module().set_director_credentials(email, new_password)
    return DirectorPasswordUpdateResponse(
        ok=True,
        message="Director password updated successfully.",
    )


@router.get("/pantry-credentials", response_model=PantryCredentialRegistryResponse)
def list_pantry_credentials() -> PantryCredentialRegistryResponse:
    pantries = _get_crud_module().get_pantry_credential_registry()
    return PantryCredentialRegistryResponse(ok=True, pantries=pantries)


@router.post("/pantry/password", response_model=PantryPasswordUpdateResponse)
def update_pantry_password(
    payload: PantryPasswordUpdateRequest,
) -> PantryPasswordUpdateResponse:
    pantry_id_raw = payload.pantryId.strip()
    new_password = payload.newPassword.strip()
    if not pantry_id_raw or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pantry id and new password are required.",
        )

    if not pantry_id_raw.isdigit():
        return PantryPasswordUpdateResponse(
            ok=False,
            error="Pantry id must be numeric.",
        )

    pantry_id = int(pantry_id_raw)
    _get_crud_module().set_login_credentials(pantry_id, new_password)
    return PantryPasswordUpdateResponse(
        ok=True,
        message=f"Updated password for pantry {pantry_id_raw}.",
    )