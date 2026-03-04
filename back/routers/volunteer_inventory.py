"""Volunteer submission endpoint for saving the latest detected pantry stock."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

try:
    from ..aws_persistence import persist_inventory_run
    from ..inventory_domain import (
        INVENTORY_CATEGORIES,
        compute_ratios_and_levels,
        normalize_inventory,
        resolve_pantry,
        summarize_levels,
        validate_inventory,
    )
except ImportError:
    from aws_persistence import persist_inventory_run
    from inventory_domain import (
        INVENTORY_CATEGORIES,
        compute_ratios_and_levels,
        normalize_inventory,
        resolve_pantry,
        summarize_levels,
        validate_inventory,
    )

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import Base, SessionLocal, engine  # noqa: E402
from models import InventoryRun, Pantry  # noqa: E402

router = APIRouter(tags=["volunteer-inventory"])


class VolunteerInventorySubmitRequest(BaseModel):
    """Frontend submit payload from the volunteer review page."""

    pantryId: str
    inventory: dict[str, int]
def _load_previous_inventory_snapshot(db, pantry_identifier: str) -> dict[str, int] | None:
    """Fetch the most recent prior volunteer-submitted inventory for a pantry."""
    pantry = resolve_pantry(db, Pantry, pantry_identifier)
    if pantry is None:
        return None

    latest_run = (
        db.query(InventoryRun)
        .filter(InventoryRun.pantry_id == pantry.id)
        .filter(InventoryRun.source == "volunteer-submit")
        .order_by(InventoryRun.created_at.desc())
        .first()
    )

    if latest_run is None:
        return None

    return normalize_inventory(latest_run.inventory)


@router.post("/volunteer/inventory/submit")
def submit_inventory(payload: VolunteerInventorySubmitRequest):
    """Persist a reviewed inventory snapshot and compute current levels."""
    ok, error = validate_inventory(payload.inventory)
    if not ok:
        return {"ok": False, "error": error}

    normalized_inventory = normalize_inventory(payload.inventory)

    Base.metadata.create_all(bind=engine, tables=[InventoryRun.__table__])

    db = SessionLocal()
    try:
        pantry = resolve_pantry(db, Pantry, payload.pantryId)
        if pantry is None:
            return {"ok": False, "error": "Pantry not found"}

        # Compare this submit against the pantry's last volunteer snapshot.
        previous_inventory = _load_previous_inventory_snapshot(db, payload.pantryId)
        ratios, levels = compute_ratios_and_levels(normalized_inventory, previous_inventory)
        summary_counts = summarize_levels(levels)

        run_record = {
            "pk": str(uuid4()),
            "pantryId": pantry.id,
            "createdAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "files": [],
            "inventory": normalized_inventory,
            "comparison": {
                "pantryId": payload.pantryId,
                "previousInventory": previous_inventory,
                "ratios": ratios,
                "source": "volunteer-submit",
            },
            "source": "volunteer-submit",
        }

        persisted_run_id = persist_inventory_run(run_record)

        return {
            "ok": True,
            "runId": persisted_run_id,
            "previousInventory": previous_inventory,
            "ratios": ratios,
            "levels": levels,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()
