"""Public customer-facing pantry availability endpoints."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter

try:
    from ..inventory_domain import INVENTORY_CATEGORIES
except ImportError:
    from inventory_domain import INVENTORY_CATEGORIES

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import SessionLocal  # noqa: E402
from models import InventoryItem, InventoryRun, Pantry  # noqa: E402

router = APIRouter(prefix="/customer", tags=["customer"])

CUSTOMER_LEVELS = {"High", "Mid", "Low", "Out"}


def _normalize_customer_level(level: Any) -> str:
    """Map internal status values to customer display values."""
    normalized = str(level or "").strip().title()
    if normalized in CUSTOMER_LEVELS:
        return normalized
    return "Low"


def _baseline_to_reset_levels(baseline_inventory: dict[str, Any] | None) -> dict[str, str]:
    """After a manager upload, treat non-zero baseline categories as High immediately."""
    raw = baseline_inventory or {}
    levels: dict[str, str] = {}
    for category in INVENTORY_CATEGORIES:
        quantity = int(raw.get(category, 0) or 0)
        levels[category] = "Out" if quantity <= 0 else "High"
    return levels


def _compute_level_from_quantities(current_quantity: int, baseline_quantity: int) -> str:
    """Compute level from current/baseline quantities using workflow thresholds."""
    if current_quantity <= 0:
        return "Out"
    if baseline_quantity <= 0:
        return "High"
    ratio = current_quantity / baseline_quantity
    if ratio > 0.70:
        return "High"
    if ratio > 0.30:
        return "Mid"
    return "Low"


@router.get("/pantries")
def list_customer_pantries():
    """Return pantry list with latest customer-facing category levels."""
    db = SessionLocal()
    try:
        pantries = db.query(Pantry).order_by(Pantry.id.asc()).all()
        items = db.query(InventoryItem).all()

        item_levels_by_pantry: dict[int, dict[str, str]] = defaultdict(dict)
        item_original_by_pantry: dict[int, dict[str, int]] = defaultdict(dict)
        for item in items:
            item_levels_by_pantry[item.pantry_id][item.category_name] = _normalize_customer_level(
                item.status
            )
            item_original_by_pantry[item.pantry_id][item.category_name] = int(item.original_quantity or 0)

        payload = []
        for pantry in pantries:
            latest_submit = (
                db.query(InventoryRun)
                .filter(InventoryRun.pantry_id == pantry.id, InventoryRun.source == "volunteer-submit")
                .order_by(InventoryRun.created_at.desc())
                .first()
            )
            latest_warehouse = (
                db.query(InventoryRun)
                .filter(InventoryRun.pantry_id == pantry.id, InventoryRun.source == "warehouse-snapshot")
                .order_by(InventoryRun.created_at.desc())
                .first()
            )

            comparison = latest_submit.comparison if latest_submit and isinstance(latest_submit.comparison, dict) else {}
            run_levels = comparison.get("levels") if isinstance(comparison, dict) else {}
            run_warehouse_inventory = comparison.get("warehouseInventory") if isinstance(comparison, dict) else {}
            latest_warehouse_inventory = (
                latest_warehouse.inventory if latest_warehouse and isinstance(latest_warehouse.inventory, dict) else {}
            )
            should_use_volunteer_levels = (
                latest_submit is not None
                and (
                    latest_warehouse is None
                    or latest_submit.created_at >= latest_warehouse.created_at
                )
            )

            levels: dict[str, str] = {}
            original_quantities: dict[str, int] = {}
            if latest_submit is None and latest_warehouse is None:
                for category in INVENTORY_CATEGORIES:
                    levels[category] = item_levels_by_pantry.get(pantry.id, {}).get(category, "Low")
                    original_quantities[category] = int(
                        item_original_by_pantry.get(pantry.id, {}).get(category, 0)
                    )
                last_updated = None
            elif should_use_volunteer_levels:
                submit_inventory = latest_submit.inventory if isinstance(latest_submit.inventory, dict) else {}
                for category in INVENTORY_CATEGORIES:
                    if isinstance(run_warehouse_inventory, dict) and category in run_warehouse_inventory:
                        baseline_quantity = int(run_warehouse_inventory.get(category, 0) or 0)
                    elif isinstance(latest_warehouse_inventory, dict) and category in latest_warehouse_inventory:
                        baseline_quantity = int(latest_warehouse_inventory.get(category, 0) or 0)
                    else:
                        baseline_quantity = int(
                            item_original_by_pantry.get(pantry.id, {}).get(category, 0)
                        )

                    current_quantity = int(submit_inventory.get(category, 0) or 0)
                    levels[category] = _compute_level_from_quantities(current_quantity, baseline_quantity)
                    original_quantities[category] = baseline_quantity

                last_updated = latest_submit.created_at.isoformat() if latest_submit else None
            else:
                levels = _baseline_to_reset_levels(latest_warehouse_inventory)
                for category in INVENTORY_CATEGORIES:
                    if isinstance(latest_warehouse_inventory, dict) and category in latest_warehouse_inventory:
                        original_quantities[category] = int(latest_warehouse_inventory.get(category, 0) or 0)
                    else:
                        original_quantities[category] = int(
                            item_original_by_pantry.get(pantry.id, {}).get(category, 0)
                        )
                last_updated = latest_warehouse.created_at.isoformat() if latest_warehouse else None

            payload.append(
                {
                    "pantryId": str(pantry.id),
                    "name": pantry.name,
                    "location": pantry.location,
                    "lastUpdated": last_updated,
                    "levels": levels,
                    "originalQuantities": original_quantities,
                }
            )

        return {"ok": True, "pantries": payload}
    finally:
        db.close()
