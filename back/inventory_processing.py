"""Sprint 1 detection-to-inventory transformation utilities."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

CATEGORY_KEYS = [
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


def load_json(path: Path) -> dict[str, Any]:
    """Load a JSON object from disk."""
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def classify_percentage(value: float) -> str:
    """Classify a numeric inventory percentage."""
    if value > 70:
        return "High"
    if value > 30:
        return "Medium"
    return "Low"


def build_inventory_map(raw_inventory: dict[str, Any]) -> dict[str, int]:
    """Normalize the inventory map to the exact category keys and integer values."""
    inventory_map: dict[str, int] = {}

    for category in CATEGORY_KEYS:
        inventory_map[category] = int(raw_inventory.get(category, 0))

    return inventory_map


def build_required_output(mock_input: dict[str, Any]) -> dict[str, Any]:
    """Transform mock detection input into the exact required API output shape."""
    files = mock_input["files"]
    inventory = build_inventory_map(mock_input.get("rawInventory", {}))

    return {
        "ok": bool(mock_input.get("ok", True)),
        "count": int(mock_input.get("count", len(files))),
        "files": [
            {
                "filename": file_info["filename"],
                "content_type": file_info["content_type"],
                "size_bytes": int(file_info["size_bytes"]),
                "ok": bool(file_info.get("ok", True)),
            }
            for file_info in files
        ],
        "inventory": inventory,
    }


def build_classification_artifact(required_output: dict[str, Any]) -> dict[str, Any]:
    """Build the separate classification artifact without changing the required output."""
    inventory = required_output["inventory"]
    classification = {
        category: classify_percentage(float(value))
        for category, value in inventory.items()
    }
    summary_counts = Counter(classification.values())

    return {
        "classification": classification,
        "summaryCounts": {
            "High": summary_counts.get("High", 0),
            "Medium": summary_counts.get("Medium", 0),
            "Low": summary_counts.get("Low", 0),
        },
    }


def build_comparison_artifact(
    current_inventory: dict[str, int],
    previous_inventory: dict[str, Any] | None,
) -> dict[str, Any]:
    """Compare the current inventory to the previous stored inventory snapshot."""
    normalized_previous = (
        build_inventory_map(previous_inventory) if previous_inventory is not None else None
    )
    delta: dict[str, int] = {}
    percentage_change: dict[str, float | None] = {}

    for category in CATEGORY_KEYS:
        current_value = int(current_inventory[category])
        previous_value = int(normalized_previous[category]) if normalized_previous is not None else 0
        delta[category] = current_value - previous_value

        if normalized_previous is None:
            percentage_change[category] = None
        elif previous_value == 0:
            percentage_change[category] = 0.0 if current_value == 0 else None
        else:
            change = ((current_value - previous_value) / previous_value) * 100
            percentage_change[category] = round(change, 1)

    return {
        "previousInventory": normalized_previous,
        "delta": delta,
        "percentageChange": percentage_change,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    """Write JSON to disk with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)
        file.write("\n")
