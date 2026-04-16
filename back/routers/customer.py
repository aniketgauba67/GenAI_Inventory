"""Public customer-facing pantry availability endpoints."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Query

try:
    from ..inventory_domain import (
        INVENTORY_CATEGORIES,
        compute_level_from_quantities,
        load_latest_inventory_run,
    )
except ImportError:
    from inventory_domain import INVENTORY_CATEGORIES, compute_level_from_quantities, load_latest_inventory_run

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


def _time_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    try:
        h, m = t.split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        return -1


def _is_within_schedule(day: str, time_minutes: int, hours: list[dict]) -> bool:
    """Return True if time falls inside any operating window for the given day."""
    for slot in hours:
        if slot.get("day") != day:
            continue
        try:
            open_min = _time_to_minutes(slot["open"])
            close_min = _time_to_minutes(slot["close"])
            if open_min <= time_minutes < close_min:
                return True
        except (KeyError, TypeError):
            continue
    return False


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
            latest_submit = load_latest_inventory_run(db, InventoryRun, pantry.id, "volunteer-submit")
            latest_warehouse = load_latest_inventory_run(db, InventoryRun, pantry.id, "warehouse-snapshot")

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
                    levels[category] = compute_level_from_quantities(current_quantity, baseline_quantity)
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
                    "isOpen": pantry.is_open,
                    "manualOverride": pantry.manual_override,
                    "operatingHours": pantry.operating_hours or [],
                }
            )

        return {"ok": True, "pantries": payload}
    finally:
        db.close()


@router.get("/pantries-by-time")
def list_pantries_by_time(
    day: str = Query(..., description="Day of week (mon-sun)"),
    time: str = Query(..., description="Time in HH:MM format (24-hour)"),
):
    """Return pantries open at a specific day and time.
    
    Query parameters:
    - day: Day of week (mon, tue, wed, thu, fri, sat, sun)
    - time: Time in 24-hour format (HH:MM), e.g., "14:30"
    """
    # Validate day
    valid_days = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    day = day.lower().strip()
    if day not in valid_days:
        return {"ok": False, "error": f"Invalid day. Must be one of: {', '.join(valid_days)}", "pantries": []}

    # Validate and convert time
    try:
        time_parts = time.strip().split(":")
        if len(time_parts) != 2:
            raise ValueError("Time must be in HH:MM format")
        hour = int(time_parts[0])
        minute = int(time_parts[1])
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("Hour must be 0-23, minute must be 0-59")
        time_minutes = hour * 60 + minute
    except (ValueError, AttributeError) as e:
        return {"ok": False, "error": f"Invalid time format: {str(e)}", "pantries": []}

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
            # Skip pantries without operating hours
            if not pantry.operating_hours or not isinstance(pantry.operating_hours, list):
                continue

            # Check if pantry is open at the specified time
            if not _is_within_schedule(day, time_minutes, pantry.operating_hours):
                continue

            latest_submit = load_latest_inventory_run(db, InventoryRun, pantry.id, "volunteer-submit")
            latest_warehouse = load_latest_inventory_run(db, InventoryRun, pantry.id, "warehouse-snapshot")

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
                    levels[category] = compute_level_from_quantities(current_quantity, baseline_quantity)
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
                    "isOpen": pantry.is_open,
                    "manualOverride": pantry.manual_override,
                    "operatingHours": pantry.operating_hours or [],
                }
            )

        return {"ok": True, "pantries": payload}
    finally:
        db.close()
