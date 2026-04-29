"""Sync seeded pantry operating hours into existing pantry rows without wiping data.

This script updates `pantries.operating_hours` in place using the source-of-truth
hours from `db/seed_real_pantries.py`. It matches rows by location first and
falls back to name when needed, so it can repair existing databases that were
seeded before the hours were corrected.

By default it does not rename pantries, which keeps existing pantry-name logins
stable. Use `--update-names` only if you also want the seasonal display names
from the seed data.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

from db.database import SessionLocal
from db.models import Pantry
from db.seed_real_pantries import REAL_PANTRIES

TIMEZONE = ZoneInfo("America/New_York")
DAY_MAP = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def normalize_text(value: str | None) -> str:
    """Collapse text to a stable alphanumeric key for fuzzy matching."""
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def time_to_minutes(value: str) -> int:
    """Convert HH:MM strings into minutes since midnight."""
    hour_str, minute_str = value.split(":", 1)
    return int(hour_str) * 60 + int(minute_str)


def compute_current_open_state(hours: list[dict]) -> bool:
    """Apply the same weekly schedule semantics used by the app."""
    now = datetime.now(TIMEZONE)
    current_day = DAY_MAP[now.weekday()]
    current_minutes = now.hour * 60 + now.minute

    for slot in hours:
        if slot.get("day") != current_day:
            continue

        open_value = slot.get("open")
        close_value = slot.get("close")
        if not isinstance(open_value, str) or not isinstance(close_value, str):
            continue

        if time_to_minutes(open_value) <= current_minutes < time_to_minutes(close_value):
            return True
    return False


def build_seed_lookup() -> tuple[dict[str, dict], dict[str, dict]]:
    """Index the seed data by normalized location and normalized name."""
    by_location: dict[str, dict] = {}
    by_name: dict[str, dict] = {}
    for entry in REAL_PANTRIES:
        by_location[normalize_text(entry.get("location"))] = entry
        by_name[normalize_text(entry.get("name"))] = entry
    return by_location, by_name


def sync_hours(update_names: bool = False) -> dict:
    """Update matching pantry rows and return a machine-readable summary."""
    session = SessionLocal()
    by_location, by_name = build_seed_lookup()

    matched_locations: set[str] = set()
    matched_names: set[str] = set()
    updated_rows: list[dict] = []
    unmatched_pantries: list[dict] = []

    try:
        pantries = session.query(Pantry).order_by(Pantry.id.asc()).all()

        for pantry in pantries:
            location_key = normalize_text(pantry.location)
            name_key = normalize_text(pantry.name)

            entry = by_location.get(location_key) or by_name.get(name_key)
            if entry is None:
                unmatched_pantries.append(
                    {
                        "id": pantry.id,
                        "name": pantry.name,
                        "location": pantry.location,
                    }
                )
                continue

            matched_locations.add(normalize_text(entry.get("location")))
            matched_names.add(normalize_text(entry.get("name")))

            next_hours = entry.get("operating_hours") or None
            changed_fields: list[str] = []

            if pantry.operating_hours != next_hours:
                pantry.operating_hours = next_hours
                changed_fields.append("operating_hours")

            if update_names and pantry.name != entry.get("name"):
                pantry.name = entry["name"]
                changed_fields.append("name")

            if changed_fields and not pantry.manual_override and next_hours:
                next_is_open = compute_current_open_state(next_hours)
                if pantry.is_open != next_is_open:
                    pantry.is_open = next_is_open
                    changed_fields.append("is_open")

            if changed_fields:
                updated_rows.append(
                    {
                        "id": pantry.id,
                        "name": pantry.name,
                        "location": pantry.location,
                        "changed": changed_fields,
                    }
                )

        session.commit()

        unmatched_seed_entries = [
            {
                "name": entry["name"],
                "location": entry["location"],
            }
            for entry in REAL_PANTRIES
            if normalize_text(entry.get("location")) not in matched_locations
            and normalize_text(entry.get("name")) not in matched_names
        ]

        return {
            "ok": True,
            "pantriesScanned": len(pantries),
            "updatedCount": len(updated_rows),
            "updatedPantries": updated_rows,
            "unmatchedExistingPantries": unmatched_pantries,
            "unmatchedSeedEntries": unmatched_seed_entries,
            "updateNames": update_names,
        }
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def main() -> None:
    """Run the sync and print a JSON summary."""
    parser = argparse.ArgumentParser(description="Sync pantry operating hours into the existing database.")
    parser.add_argument(
        "--update-names",
        action="store_true",
        help="Also update pantry names to the current seed-data display names.",
    )
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parent / ".env")
    result = sync_hours(update_names=args.update_names)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
