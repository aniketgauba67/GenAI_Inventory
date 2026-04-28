"""Shared helpers for resolving customer-facing pantry inventory state."""

from __future__ import annotations

from typing import Any

try:
    from .inventory_domain import INVENTORY_CATEGORIES, compute_level_from_quantities
except ImportError:
    from inventory_domain import INVENTORY_CATEGORIES, compute_level_from_quantities

CUSTOMER_LEVELS = {"High", "Mid", "Low", "Out"}


def normalize_customer_level(level: Any) -> str:
    """Map internal status values to customer display values."""
    normalized = str(level or "").strip().title()
    if normalized in CUSTOMER_LEVELS:
        return normalized
    return "Low"


def baseline_to_reset_levels(baseline_inventory: dict[str, Any] | None) -> dict[str, str]:
    """After a manager upload, treat non-zero baseline categories as High immediately."""
    raw = baseline_inventory or {}
    levels: dict[str, str] = {}
    for category in INVENTORY_CATEGORIES:
        quantity = int(raw.get(category, 0) or 0)
        levels[category] = "Out" if quantity <= 0 else "High"
    return levels


def resolve_customer_inventory_state(
    latest_submit: Any,
    latest_warehouse: Any,
    fallback_levels: dict[str, Any] | None = None,
    fallback_original_quantities: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Resolve one pantry's current customer-facing inventory state.

    Precedence rule:
    - Prefer the latest volunteer submission when it is the same time or newer than
      the latest warehouse snapshot.
    - Otherwise fall back to the latest warehouse snapshot.
    - If neither exists, fall back to legacy pantry item data.
    """
    fallback_levels = fallback_levels or {}
    fallback_original_quantities = fallback_original_quantities or {}

    comparison = (
        latest_submit.comparison
        if latest_submit is not None and isinstance(latest_submit.comparison, dict)
        else {}
    )
    run_warehouse_inventory = (
        comparison.get("warehouseInventory")
        if isinstance(comparison.get("warehouseInventory"), dict)
        else {}
    )
    latest_warehouse_inventory = (
        latest_warehouse.inventory
        if latest_warehouse is not None and isinstance(latest_warehouse.inventory, dict)
        else {}
    )
    should_use_volunteer = (
        latest_submit is not None
        and (latest_warehouse is None or latest_submit.created_at >= latest_warehouse.created_at)
    )

    levels: dict[str, str] = {}
    original_quantities: dict[str, int] = {}
    current_inventory: dict[str, int] = {}

    if latest_submit is None and latest_warehouse is None:
        for category in INVENTORY_CATEGORIES:
            current_quantity = int(fallback_original_quantities.get(category, 0) or 0)
            current_inventory[category] = current_quantity
            original_quantities[category] = current_quantity
            levels[category] = normalize_customer_level(fallback_levels.get(category, "Low"))

        return {
            "source": "fallback",
            "lastUpdated": None,
            "levels": levels,
            "originalQuantities": original_quantities,
            "currentInventory": current_inventory,
        }

    if should_use_volunteer:
        submit_inventory = latest_submit.inventory if isinstance(latest_submit.inventory, dict) else {}
        for category in INVENTORY_CATEGORIES:
            if category in run_warehouse_inventory:
                baseline_quantity = int(run_warehouse_inventory.get(category, 0) or 0)
            elif category in latest_warehouse_inventory:
                baseline_quantity = int(latest_warehouse_inventory.get(category, 0) or 0)
            else:
                baseline_quantity = int(fallback_original_quantities.get(category, 0) or 0)

            current_quantity = int(submit_inventory.get(category, 0) or 0)
            current_inventory[category] = current_quantity
            original_quantities[category] = baseline_quantity
            levels[category] = compute_level_from_quantities(current_quantity, baseline_quantity)

        return {
            "source": "volunteer-submit",
            "lastUpdated": latest_submit.created_at.isoformat(),
            "levels": levels,
            "originalQuantities": original_quantities,
            "currentInventory": current_inventory,
        }

    levels = baseline_to_reset_levels(latest_warehouse_inventory)
    for category in INVENTORY_CATEGORIES:
        if category in latest_warehouse_inventory:
            quantity = int(latest_warehouse_inventory.get(category, 0) or 0)
        else:
            quantity = int(fallback_original_quantities.get(category, 0) or 0)
        current_inventory[category] = quantity
        original_quantities[category] = quantity

    return {
        "source": "warehouse-snapshot",
        "lastUpdated": latest_warehouse.created_at.isoformat() if latest_warehouse else None,
        "levels": levels,
        "originalQuantities": original_quantities,
        "currentInventory": current_inventory,
    }
