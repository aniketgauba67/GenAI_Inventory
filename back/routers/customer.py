"""Public customer-facing pantry availability endpoints."""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, Query

try:
    from ..customer_inventory_state import resolve_customer_inventory_state
    from ..inventory_domain import (
        INVENTORY_CATEGORIES,
        load_latest_inventory_run,
    )
except ImportError:
    from customer_inventory_state import resolve_customer_inventory_state
    from inventory_domain import INVENTORY_CATEGORIES, load_latest_inventory_run

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import SessionLocal  # noqa: E402
from models import InventoryItem, InventoryRun, Pantry  # noqa: E402

router = APIRouter(prefix="/customer", tags=["customer"])


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
            item_levels_by_pantry[item.pantry_id][item.category_name] = str(item.status or "")
            item_original_by_pantry[item.pantry_id][item.category_name] = int(item.original_quantity or 0)

        payload = []
        for pantry in pantries:
            latest_submit = load_latest_inventory_run(db, InventoryRun, pantry.id, "volunteer-submit")
            latest_warehouse = load_latest_inventory_run(db, InventoryRun, pantry.id, "warehouse-snapshot")
            resolved = resolve_customer_inventory_state(
                latest_submit,
                latest_warehouse,
                fallback_levels=item_levels_by_pantry.get(pantry.id, {}),
                fallback_original_quantities=item_original_by_pantry.get(pantry.id, {}),
            )

            payload.append(
                {
                    "pantryId": str(pantry.id),
                    "name": pantry.name,
                    "location": pantry.location,
                    "lastUpdated": resolved["lastUpdated"],
                    "levels": resolved["levels"],
                    "originalQuantities": resolved["originalQuantities"],
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
            item_levels_by_pantry[item.pantry_id][item.category_name] = str(item.status or "")
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
            resolved = resolve_customer_inventory_state(
                latest_submit,
                latest_warehouse,
                fallback_levels=item_levels_by_pantry.get(pantry.id, {}),
                fallback_original_quantities=item_original_by_pantry.get(pantry.id, {}),
            )

            payload.append(
                {
                    "pantryId": str(pantry.id),
                    "name": pantry.name,
                    "location": pantry.location,
                    "lastUpdated": resolved["lastUpdated"],
                    "levels": resolved["levels"],
                    "originalQuantities": resolved["originalQuantities"],
                    "isOpen": pantry.is_open,
                    "manualOverride": pantry.manual_override,
                    "operatingHours": pantry.operating_hours or [],
                }
            )

        return {"ok": True, "pantries": payload}
    finally:
        db.close()
