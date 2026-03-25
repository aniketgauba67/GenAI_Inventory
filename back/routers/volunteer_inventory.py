"""Warehouse import and volunteer submission endpoints for the active pantry workflow.

The working schema stores both warehouse imports and volunteer submissions in the same
`inventory_runs` table. The `source` field tells the app which kind of row it is reading.
"""

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
from models import InventoryItem, InventoryRun, Pantry  # noqa: E402

router = APIRouter(tags=["volunteer-inventory"])


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


def _load_latest_run_by_source(db, pantry_identifier: str, source: str) -> InventoryRun | None:
    """Fetch the latest inventory run for a pantry and logical source."""
    pantry = resolve_pantry(db, Pantry, pantry_identifier)
    if pantry is None:
        return None

    return (
        db.query(InventoryRun)
        .filter(InventoryRun.pantry_id == pantry.id)
        .filter(InventoryRun.source == source)
        .order_by(InventoryRun.created_at.desc())
        .first()
    )


def _upsert_pantry_inventory_items(db, pantry_id: int, baseline_inventory: dict[str, int], current_inventory: dict[str, int] | None = None) -> None:
    """Keep `inventory_items` in sync with warehouse baseline and latest pantry status.

    - `baseline_inventory` is written to `original_quantity`.
    - If `current_inventory` is provided, `status` is updated from that current stock.
    """
    for category in INVENTORY_CATEGORIES:
        baseline_qty = int(baseline_inventory.get(category, 0))
        current_qty = baseline_qty if current_inventory is None else int(current_inventory.get(category, 0))

        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.pantry_id == pantry_id, InventoryItem.category_name == category)
            .first()
        )
        if item is None:
            item = InventoryItem(
                pantry_id=pantry_id,
                category_name=category,
                original_quantity=baseline_qty,
                status="Normal", 
            )
            db.add(item)
        else:
            item.original_quantity = baseline_qty
        # Uses inbuilt db model method to update status based on the latest current quantity
        item.update_status(current_qty)


@router.post("/warehouse/inventory/snapshot")
def store_warehouse_inventory_snapshot(payload: WarehouseInventorySnapshotRequest):
    """Store the latest parsed warehouse form totals as a unified inventory run."""
    if payload.pantryId.strip().lower() == "director":
        return {"ok": False, "error": "Director must choose a real pantry ID first."}
    ok, error = validate_inventory(payload.inventory)
    if not ok:
        return {"ok": False, "error": error}

    normalized_inventory = normalize_inventory(payload.inventory)

    # Create the run-history table if it does not exist yet, without touching other tables.
    Base.metadata.create_all(bind=engine, tables=[InventoryRun.__table__])

    db = SessionLocal()
    try:
        pantry = resolve_pantry(db, Pantry, payload.pantryId)
        if pantry is None:
            return {"ok": False, "error": "Pantry not found"}

        _upsert_pantry_inventory_items(db, pantry.id, normalized_inventory)
        db.commit()

        run_record = {
            "pk": str(uuid4()),
            "pantryId": pantry.id,
            "createdAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
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

    # Ensure the run-history table exists before we query or insert into it.
    Base.metadata.create_all(bind=engine, tables=[InventoryRun.__table__])

    db = SessionLocal()
    try:
        pantry = resolve_pantry(db, Pantry, payload.pantryId)
        if pantry is None:
            return {"ok": False, "error": "Pantry not found"}

        warehouse_run = _load_latest_run_by_source(db, payload.pantryId, "warehouse-snapshot")
        if warehouse_run is None:
            return {"ok": False, "error": "Warehouse inventory not found"}

        # Warehouse inventory is the comparison baseline: current pantry stock / latest warehouse import.
        warehouse_inventory = normalize_inventory(warehouse_run.inventory)
        _upsert_pantry_inventory_items(db, pantry.id, warehouse_inventory, normalized_inventory)
        db.commit()

        ratios, levels = compute_ratios_and_levels(normalized_inventory, warehouse_inventory)
        summary_counts = summarize_levels(levels)

        run_record = {
            "pk": str(uuid4()),
            "pantryId": pantry.id,
            "createdAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
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
