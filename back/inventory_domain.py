"""Shared inventory and pantry helper utilities for the volunteer workflow."""

from __future__ import annotations

from typing import Any

INVENTORY_CATEGORIES = [
    "Beverages",
    "Juices",
    "Cereal",
    "Breakfast",
    "Meat",
    "Fish",
    "Poultry",
    "Frozen",
    "Vegetables",
    "Fruits",
    "Nuts",
    "Soup",
    "Grains",
    "Pasta",
    "Snacks",
    "Spices",
    "Sauces",
    "Condiments",
    "Misc Products",
]


def normalize_inventory(inventory: dict[str, Any] | None) -> dict[str, int]:
    """Return a complete 19-category inventory map with integer values."""
    raw = inventory or {}
    normalized: dict[str, int] = {}
    for category in INVENTORY_CATEGORIES:
        normalized[category] = int(raw.get(category, 0) or 0)
    return normalized


def accumulate_inventory_totals(
    totals: dict[str, int],
    inventory: dict[str, Any] | None,
) -> dict[str, int]:
    """Add one per-image inventory map into ``totals`` (e.g. multiple shelf photos)."""
    page_values = normalize_inventory(inventory)
    for category in INVENTORY_CATEGORIES:
        totals[category] += page_values[category]
    return totals


def validate_inventory(inventory: dict[str, Any] | None) -> tuple[bool, str | None]:
    """Validate that known category values are safe non-negative integers."""
    raw = inventory or {}
    for category, value in raw.items():
        if category not in INVENTORY_CATEGORIES:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return False, f"Invalid value for {category}"
        if numeric < 0:
            return False, f"Negative value for {category}"
        if not numeric.is_integer():
            return False, f"Non-integer value for {category}"
    return True, None


def compute_level_from_quantities(current_quantity: int, baseline_quantity: int) -> str:
    """Compute a single customer-facing level from current and baseline stock."""
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


def compute_ratios_and_levels(
    detected_inventory: dict[str, Any] | None,
    previous_inventory: dict[str, Any] | None,
) -> tuple[dict[str, float], dict[str, str]]:
    """Compute current-vs-previous ratios and High/Mid/Low/Out levels."""
    detected = normalize_inventory(detected_inventory)
    previous = normalize_inventory(previous_inventory)
    ratios: dict[str, float] = {}
    levels: dict[str, str] = {}

    for category in INVENTORY_CATEGORIES:
        detected_value = detected[category]
        previous_value = previous[category]
        # The first non-zero reading becomes the initial reference snapshot.
        if previous_value <= 0:
            ratio = 0.0 if detected_value <= 0 else 1.0
        else:
            ratio = round(detected_value / previous_value, 4)
        ratios[category] = ratio
        levels[category] = compute_level_from_quantities(detected_value, previous_value)

    return ratios, levels


def summarize_levels(levels: dict[str, str]) -> dict[str, int]:
    """Count how many categories fall into each level bucket."""
    summary = {"High": 0, "Mid": 0, "Low": 0, "Out": 0}
    for level in levels.values():
        if level in summary:
            summary[level] += 1
    return summary


def resolve_pantry(db, pantry_model, pantry_identifier: str):
    """Resolve a pantry by numeric id first, then by exact pantry name."""
    if pantry_identifier.isdigit():
        pantry = db.query(pantry_model).filter(pantry_model.id == int(pantry_identifier)).first()
        if pantry is not None:
            return pantry
    return db.query(pantry_model).filter(pantry_model.name == pantry_identifier).first()


def load_latest_inventory_run(db, run_model, pantry_id: int, source: str):
    """Fetch the latest inventory run for a pantry and source."""
    return (
        db.query(run_model)
        .filter(run_model.pantry_id == pantry_id)
        .filter(run_model.source == source)
        .order_by(run_model.created_at.desc())
        .first()
    )


def upsert_pantry_inventory_items(
    db,
    item_model,
    pantry_id: int,
    baseline_inventory: dict[str, int],
    current_inventory: dict[str, int] | None = None,
) -> None:
    """Keep inventory item rows aligned with baseline and latest current stock."""
    for category in INVENTORY_CATEGORIES:
        baseline_qty = int(baseline_inventory.get(category, 0))
        current_qty = baseline_qty if current_inventory is None else int(current_inventory.get(category, 0))

        item = (
            db.query(item_model)
            .filter(item_model.pantry_id == pantry_id, item_model.category_name == category)
            .first()
        )
        if item is None:
            item = item_model(
                pantry_id=pantry_id,
                category_name=category,
                original_quantity=baseline_qty,
                status="normal",
            )
            db.add(item)
        else:
            item.original_quantity = baseline_qty
        item.update_status(current_qty)
