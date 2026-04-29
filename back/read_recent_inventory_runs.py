"""Read back the most recent persisted inventory runs from AWS RDS/Postgres.

Useful for confirming which `warehouse-snapshot` row is currently acting as the denominator
for volunteer ratio calculations.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from dotenv import load_dotenv

from db.database import SessionLocal
from db.models import InventoryRun


def parse_args() -> argparse.Namespace:
    """Parse command-line options for the inventory run reader."""
    parser = argparse.ArgumentParser(description="Read recent inventory_runs rows.")
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Number of recent runs to print. Use --limit 1 for the latest run.",
    )
    return parser.parse_args()


def main(limit: int = 5) -> None:
    """Fetch and print the most recent inventory runs."""
    load_dotenv(Path(__file__).resolve().parent / ".env")

    session = SessionLocal()
    try:
        runs = (
            session.query(InventoryRun)
            .order_by(InventoryRun.created_at.desc())
            .limit(limit)
            .all()
        )

        if not runs:
            print(
                json.dumps(
                    {
                        "ok": True,
                        "found": False,
                        "message": "No rows found in inventory_runs",
                        "runs": [],
                    },
                    indent=2,
                )
            )
            return

        print(
            json.dumps(
                {
                    "ok": True,
                    "found": True,
                    "count": len(runs),
                    "runs": [
                        {
                            "run_id": run.run_id,
                            "pantry_id": run.pantry_id,
                            "created_at": run.created_at.isoformat(),
                            "files": run.files,
                            "inventory": run.inventory,
                            "comparison": run.comparison,
                            "source": run.source,
                        }
                        for run in runs
                    ],
                },
                indent=2,
            )
        )
    finally:
        session.close()


if __name__ == "__main__":
    args = parse_args()
    main(limit=max(1, args.limit))
