"""******************************* volunteer_inventory.py ***************************************
 *
 *  Module: Backend Router
 *
 *  This module defines API endpoints for the GenAI Inventory backend.
 *
 *  The module provides:
 *
 *  - FastAPI route handlers.
 *  - request validation and response shaping.
 *  - service or database calls for one workflow area.
 *
 *  Key Structures Used:
 *
 *  - FastAPI router objects, Pydantic schemas, and SQLAlchemy helpers.
 *
 *  This module ensures:
 *
 *  - frontend API calls have stable backend endpoints.
 *  - route logic remains grouped by workflow.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

from back.aws_persistence import persist_inventory_run
from back.inventory_domain import (
    compute_ratios_and_levels,
    load_latest_inventory_run,
    normalize_inventory,
    resolve_pantry,
    summarize_levels,
    upsert_pantry_inventory_items,
    validate_inventory,
)
from db.database import Base, SessionLocal
from db.models import InventoryItem, InventoryRun, Pantry

router = APIRouter(tags=["volunteer-inventory"])


def _ensure_inventory_run_table(db) -> None:
    """Create the run-history table against the current session bind.

    Using the session's bind keeps tests isolated from the production engine when
    SessionLocal is mocked.
    """
    Base.metadata.create_all(bind=db.get_bind(), tables=[InventoryRun.__table__])


def _utc_timestamp() -> str:
    """Return an ISO-8601 UTC timestamp with a trailing Z."""
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


class VolunteerInventorySubmitRequest(BaseModel):
    """Frontend submit payload from the volunteer review page.

    `inventory` is the reviewed current pantry stock after Gemini detection and manual edits.
    """

    pantryId: str
    inventory: dict[str, int]


class WarehouseInventorySnapshotRequest(BaseModel):
    """Structured warehouse form extraction payload stored as a warehouse snapshot run.

    Manager-side form parsing should convert the form into the fixed 19-category inventory
    map before calling this endpoint.
    """

    pantryId: str
    inventory: dict[str, int]
    files: list[dict] | None = None


@router.post("/warehouse/inventory/snapshot")
def store_warehouse_inventory_snapshot(payload: WarehouseInventorySnapshotRequest):
    """Store the latest parsed warehouse form totals as a unified inventory run."""
    if payload.pantryId.strip().lower() == "director":
        return {"ok": False, "error": "Director must choose a real pantry ID first."}
    ok, error = validate_inventory(payload.inventory)
    if not ok:
        return {"ok": False, "error": error}

    normalized_inventory = normalize_inventory(payload.inventory)

    db = SessionLocal()
    try:
        # Create the run-history table if it does not exist yet, without touching other tables.
        _ensure_inventory_run_table(db)

        pantry = resolve_pantry(db, Pantry, payload.pantryId)
        if pantry is None:
            return {"ok": False, "error": "Pantry not found"}

        upsert_pantry_inventory_items(db, InventoryItem, pantry.id, normalized_inventory)
        db.commit()

        run_record = {
            "pk": str(uuid4()),
            "pantryId": pantry.id,
            "createdAt": _utc_timestamp(),
            "files": payload.files or [],
            "inventory": normalized_inventory,
            "comparison": {
                # Keep a small breadcrumb so later readers know why this row exists.
                "pantryId": str(pantry.id),
                "note": "Latest warehouse form totals used as denominator for volunteer ratios.",
            },
            "source": "warehouse-snapshot",
        }

        persisted_run_id = persist_inventory_run(run_record)

        return {
            "ok": True,
            "runId": persisted_run_id,
            "pantryId": str(pantry.id),
            "inventory": normalized_inventory,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


@router.post("/volunteer/inventory/submit")
def submit_inventory(payload: VolunteerInventorySubmitRequest):
    """Persist a reviewed pantry snapshot and compute current levels.

    The denominator is the latest `warehouse-snapshot` run for the same pantry.
    The current pantry stock is stored in `inventory`, while the derived ratios/levels are
    stored in `comparison`.
    """
    if payload.pantryId.strip().lower() == "director":
        return {"ok": False, "error": "Director must choose a real pantry ID first."}
    ok, error = validate_inventory(payload.inventory)
    if not ok:
        return {"ok": False, "error": error}

    normalized_inventory = normalize_inventory(payload.inventory)

    db = SessionLocal()
    try:
        # Ensure the run-history table exists before we query or insert into it.
        _ensure_inventory_run_table(db)

        pantry = resolve_pantry(db, Pantry, payload.pantryId)
        if pantry is None:
            return {"ok": False, "error": "Pantry not found"}

        warehouse_run = load_latest_inventory_run(db, InventoryRun, pantry.id, "warehouse-snapshot")
        if warehouse_run is None:
            return {"ok": False, "error": "Warehouse inventory not found"}

        # Warehouse inventory is the comparison baseline: current pantry stock / latest warehouse import.
        warehouse_inventory = normalize_inventory(warehouse_run.inventory)
        upsert_pantry_inventory_items(
            db,
            InventoryItem,
            pantry.id,
            warehouse_inventory,
            normalized_inventory,
        )
        db.commit()

        ratios, levels = compute_ratios_and_levels(normalized_inventory, warehouse_inventory)
        summary_counts = summarize_levels(levels)

        run_record = {
            "pk": str(uuid4()),
            "pantryId": pantry.id,
            "createdAt": _utc_timestamp(),
            "files": [],
            "inventory": normalized_inventory,
            "comparison": {
                # Keep pantry id in the JSON as well because it makes debugging stored rows easier.
                "pantryId": str(pantry.id),
                # Link back to the exact warehouse run used as the denominator.
                "warehouseRunId": warehouse_run.run_id,
                # Store the warehouse totals actually used for the ratio computation.
                "warehouseInventory": warehouse_inventory,
                # Derived metrics are grouped here because the lean schema keeps only one JSON comparison field.
                "ratios": ratios,
                "levels": levels,
                "summaryCounts": summary_counts,
                "source": "warehouse-snapshot",
            },
            "source": "volunteer-submit",
        }

        persisted_run_id = persist_inventory_run(run_record)

        return {
            "ok": True,
            "runId": persisted_run_id,
            "warehouseRunId": warehouse_run.run_id,
            "warehouseInventory": warehouse_inventory,
            "ratios": ratios,
            "levels": levels,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()
