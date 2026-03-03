"""Volunteer submission endpoint for saving the latest detected pantry stock."""

from __future__ import annotations

from datetime import datetime
from os import getenv
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

from database import SessionLocal  # noqa: E402
from inventory_run_model import InventoryRun  # noqa: E402
from models import Pantry  # noqa: E402

router = APIRouter(tags=["volunteer-inventory"])


class VolunteerInventorySubmitRequest(BaseModel):
    """Frontend submit payload from the volunteer review page."""

    pantryId: str
    inventory: dict[str, int]
def _load_previous_inventory_snapshot(db, pantry_identifier: str) -> dict[str, int] | None:
    """Fetch the most recent prior volunteer-submitted inventory for a pantry."""
    recent_runs = (
        db.query(InventoryRun)
        .order_by(InventoryRun.created_at.desc())
        .limit(100)
        .all()
    )
    for run in recent_runs:
        comparison = run.comparison or {}
        if comparison.get("pantryId") == pantry_identifier and comparison.get("source") == "volunteer-submit":
            return normalize_inventory(run.inventory)
    return None


@router.post("/volunteer/inventory/submit")
def submit_inventory(payload: VolunteerInventorySubmitRequest):
    """Persist a reviewed inventory snapshot and compute current levels."""
    ok, error = validate_inventory(payload.inventory)
    if not ok:
        return {"ok": False, "error": error}

    normalized_inventory = normalize_inventory(payload.inventory)

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
            "createdAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "ok": True,
            "count": 0,
            "files": [],
            "inventory": normalized_inventory,
            "classification": levels,
            "summaryCounts": summary_counts,
            "comparison": {
                "pantryId": payload.pantryId,
                "previousInventory": previous_inventory,
                "ratios": ratios,
                "source": "volunteer-submit",
            },
            "stage": getenv("STAGE") or getenv("ENV"),
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
