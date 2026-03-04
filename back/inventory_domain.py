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


def compute_ratios_and_levels(
    detected_inventory: dict[str, Any] | None,
    previous_inventory: dict[str, Any] | None,
) -> tuple[dict[str, float], dict[str, str]]:
    """Compute current-vs-previous ratios and High/Mid/Low levels."""
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

        if ratio > 0.70:
            levels[category] = "High"
        elif ratio > 0.30:
            levels[category] = "Mid"
        else:
            levels[category] = "Low"

    return ratios, levels


def summarize_levels(levels: dict[str, str]) -> dict[str, int]:
    """Count how many categories fall into each level bucket."""
    summary = {"High": 0, "Mid": 0, "Low": 0}
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
