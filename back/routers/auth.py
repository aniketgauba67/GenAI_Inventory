from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from back.operating_hours import normalize_operating_hours
from back.schemas import (
    AuthenticatedUser,
    DirectorPasswordUpdateRequest,
    DirectorPasswordUpdateResponse,
    PantryCredentialDeleteRequest,
    PantryCredentialDeleteResponse,
    LoginRequest,
    LoginResponse,
    PantryCreateRequest,
    PantryCreateResponse,
    PantryCredentialRegistryResponse,
    PantryManageUpdateRequest,
    PantryManageUpdateResponse,
    PantryPasswordUpdateRequest,
    PantryPasswordUpdateResponse,
    PantryScheduleUpdateRequest,
    PantryScheduleUpdateResponse,
    PantrySetStatusRequest,
    PantryToggleStatusRequest,
    PantryToggleStatusResponse,
)
from db import crud
from db.database import SessionLocal
from db.models import Pantry as PantryModel

router = APIRouter(prefix="/auth", tags=["auth"])

DIRECTOR_IDENTIFIERS = {"director", "director@example.com"}
DEFAULT_DIRECTOR_EMAIL = "director@example.com"


def _get_crud_module():
    return crud


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


@router.post("/pantry/create", response_model=PantryCreateResponse)
def create_pantry_with_login(payload: PantryCreateRequest) -> PantryCreateResponse:
    name = payload.name.strip()
    location_raw = (payload.location or "").strip()
    new_password = payload.newPassword.strip()

    if not name or not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pantry name and password are required.",
        )

    location = location_raw or None
    crud = _get_crud_module()
    pantry = crud.add_pantry(name=name, location=location)
    crud.set_login_credentials(pantry.id, new_password)

    return PantryCreateResponse(
        ok=True,
        pantry={
            "pantryId": str(pantry.id),
            "name": pantry.name,
            "location": pantry.location,
            "hasCredentials": True,
        },
        message=f"Created pantry {pantry.id} and initial login.",
    )


@router.post("/pantry/manage", response_model=PantryManageUpdateResponse)
def manage_pantry(payload: PantryManageUpdateRequest) -> PantryManageUpdateResponse:
    pantry_id_raw = payload.pantryId.strip()
    if not pantry_id_raw.isdigit():
        return PantryManageUpdateResponse(ok=False, error="Pantry id must be numeric.")

    pantry_id = int(pantry_id_raw)
    name = (payload.name or "").strip()
    location = (payload.location or "").strip()
    new_password = (payload.newPassword or "").strip()

    has_name_update = bool(name)
    has_location_update = bool(location)
    has_password_update = bool(new_password)
    if not (has_name_update or has_location_update or has_password_update):
        return PantryManageUpdateResponse(
            ok=False,
            error="No fields were provided. Fill at least one field to update.",
        )

    crud = _get_crud_module()
    if has_name_update or has_location_update:
        pantry = crud.update_pantry_metadata(
            pantry_id=pantry_id,
            name=name if has_name_update else None,
            location=location if has_location_update else None,
        )
        if pantry is None:
            return PantryManageUpdateResponse(ok=False, error="Pantry not found.")

    if has_password_update:
        crud.set_login_credentials(pantry_id, new_password)

    return PantryManageUpdateResponse(ok=True, message=f"Updated pantry {pantry_id_raw}.")


@router.post("/pantry/credentials/delete", response_model=PantryCredentialDeleteResponse)
def delete_pantry_credentials(
    payload: PantryCredentialDeleteRequest,
) -> PantryCredentialDeleteResponse:
    pantry_id_raw = payload.pantryId.strip()
    if not pantry_id_raw.isdigit():
        return PantryCredentialDeleteResponse(ok=False, error="Pantry id must be numeric.")

    pantry_id = int(pantry_id_raw)
    deleted = _get_crud_module().delete_login_credentials(pantry_id)
    if deleted:
        return PantryCredentialDeleteResponse(
            ok=True,
            message=f"Removed login credentials for pantry {pantry_id_raw}.",
        )

    return PantryCredentialDeleteResponse(
        ok=True,
        message=f"No login credentials existed for pantry {pantry_id_raw}.",
    )


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


@router.post("/pantry/schedule", response_model=PantryScheduleUpdateResponse)
def update_pantry_schedule(
    payload: PantryScheduleUpdateRequest,
) -> PantryScheduleUpdateResponse:
    pantry_id_raw = payload.pantryId.strip()
    if not pantry_id_raw.isdigit():
        return PantryScheduleUpdateResponse(ok=False, error="Pantry id must be numeric.")

    normalized_hours, error = normalize_operating_hours(payload.operatingHours)
    if error:
        return PantryScheduleUpdateResponse(ok=False, error=error)

    pantry_id = int(pantry_id_raw)
    result = _get_crud_module().update_pantry_operating_hours(pantry_id, normalized_hours)
    if result is None:
        return PantryScheduleUpdateResponse(ok=False, error=f"Pantry {pantry_id_raw} not found.")

    if normalized_hours:
        if result.get("manualOverride"):
            message = "Operating hours saved. Current open/closed state is still manually overridden."
        else:
            message = "Operating hours saved and current open/closed status refreshed."
    else:
        if result.get("manualOverride"):
            message = "Operating hours cleared. Current open/closed state is still manually overridden."
        else:
            message = "Operating hours cleared. Pantry is now using manual open/closed status only."

    return PantryScheduleUpdateResponse(
        ok=True,
        pantryId=result["pantryId"],
        operatingHours=result.get("operatingHours", []),
        isOpen=result.get("isOpen"),
        manualOverride=result.get("manualOverride"),
        message=message,
    )


@router.post("/pantry/toggle-status", response_model=PantryToggleStatusResponse)
def toggle_pantry_status(payload: PantryToggleStatusRequest) -> PantryToggleStatusResponse:
    pantry_id_raw = payload.pantryId.strip()
    if not pantry_id_raw.isdigit():
        return PantryToggleStatusResponse(ok=False, error="Pantry id must be numeric.")

    pantry_id = int(pantry_id_raw)
    result = _get_crud_module().toggle_pantry_status(pantry_id)
    if result is None:
        return PantryToggleStatusResponse(ok=False, error=f"Pantry {pantry_id_raw} not found.")

    status_label = "open" if result["isOpen"] else "closed"
    return PantryToggleStatusResponse(
        ok=True,
        pantryId=result["pantryId"],
        isOpen=result["isOpen"],
        manualOverride=result.get("manualOverride", True),
        message=f"Pantry is now {status_label} (manual override on).",
    )


@router.post("/pantry/set-status", response_model=PantryToggleStatusResponse)
def set_pantry_status(payload: PantrySetStatusRequest) -> PantryToggleStatusResponse:
    pantry_id_raw = payload.pantryId.strip()
    if not pantry_id_raw.isdigit():
        return PantryToggleStatusResponse(ok=False, error="Pantry id must be numeric.")

    pantry_id = int(pantry_id_raw)
    result = _get_crud_module().set_pantry_status(pantry_id, payload.isOpen)
    if result is None:
        return PantryToggleStatusResponse(ok=False, error=f"Pantry {pantry_id_raw} not found.")

    status_label = "open" if result["isOpen"] else "closed"
    return PantryToggleStatusResponse(
        ok=True,
        pantryId=result["pantryId"],
        isOpen=result["isOpen"],
        manualOverride=result.get("manualOverride", True),
        message=f"Pantry is now {status_label} (manual override on).",
    )


@router.post("/pantry/clear-override", response_model=PantryToggleStatusResponse)
def clear_pantry_override(payload: PantryToggleStatusRequest) -> PantryToggleStatusResponse:
    """Remove manual override and immediately re-evaluate the schedule."""
    from datetime import datetime

    from back.scheduler import TIMEZONE, _is_within_schedule

    pantry_id_raw = payload.pantryId.strip()
    if not pantry_id_raw.isdigit():
        return PantryToggleStatusResponse(ok=False, error="Pantry id must be numeric.")

    pantry_id = int(pantry_id_raw)

    db = SessionLocal()
    try:
        pantry = db.query(PantryModel).filter(PantryModel.id == pantry_id).first()
        if pantry is None:
            return PantryToggleStatusResponse(ok=False, error=f"Pantry {pantry_id_raw} not found.")

        pantry.manual_override = False

        hours = pantry.operating_hours
        if isinstance(hours, list) and hours:
            now = datetime.now(TIMEZONE)
            pantry.is_open = _is_within_schedule(now, hours)

        db.commit()
        db.refresh(pantry)

        status_label = "open" if pantry.is_open else "closed"
        return PantryToggleStatusResponse(
            ok=True,
            pantryId=str(pantry.id),
            isOpen=pantry.is_open,
            manualOverride=False,
            message=f"Switched to auto schedule (currently {status_label}).",
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
