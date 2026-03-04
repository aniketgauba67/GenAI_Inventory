"""Seed one warehouse-snapshot inventory run so the volunteer flow can be tested end-to-end.

This is only a local testing helper. It inserts the same shape that the future manager-side
warehouse form parser should write into `inventory_runs`.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import Base, SessionLocal, engine  # noqa: E402
from models import InventoryRun, Pantry  # noqa: E402


WAREHOUSE_SAMPLE_INVENTORY = {
    # These values act as the warehouse denominator during local volunteer-submit testing.
    "Beverages": 10,
    "Juices": 5,
    "Cereal": 20,
    "Breakfast": 8,
    "Meat": 4,
    "Fish": 3,
    "Poultry": 6,
    "Frozen": 7,
    "Vegetables": 12,
    "Fruits": 9,
    "Nuts": 2,
    "Soup": 5,
    "Grains": 11,
    "Pasta": 13,
    "Snacks": 15,
    "Spices": 6,
    "Sauces": 4,
    "Condiments": 3,
    "Misc Products": 1,
}


def main() -> None:
    """Insert one warehouse-snapshot run for pantry 1 by default, or a pantry id passed on the CLI."""
    load_dotenv(Path(__file__).resolve().parent / ".env")

    pantry_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1

    # Only ensure the unified run-history table exists; do not touch the rest of the schema.
    Base.metadata.create_all(bind=engine, tables=[InventoryRun.__table__])

    session = SessionLocal()
    try:
        pantry = session.query(Pantry).filter(Pantry.id == pantry_id).first()
        if pantry is None:
            print(json.dumps({"ok": False, "error": "Pantry not found", "pantryId": pantry_id}, indent=2))
            return

        run = InventoryRun(
            run_id=str(uuid4()),
            pantry_id=pantry.id,
            created_at=datetime.utcnow(),
            files=[
                {
                    "filename": "mock-warehouse-form.json",
                    "content_type": "application/json",
                    "size_bytes": 0,
                    "ok": True,
                }
            ],
            inventory=WAREHOUSE_SAMPLE_INVENTORY,
            comparison={
                "pantryId": str(pantry.id),
                "note": "Seeded warehouse totals for local workflow testing.",
            },
            source="warehouse-snapshot",
        )
        session.add(run)
        session.commit()

        print(
            json.dumps(
                {
                    "ok": True,
                    "runId": run.run_id,
                    "pantryId": pantry.id,
                    "pantryName": pantry.name,
                    "inventory": WAREHOUSE_SAMPLE_INVENTORY,
                },
                indent=2,
            )
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
