"""Read back the most recent persisted inventory runs from AWS RDS/Postgres."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import SessionLocal  # noqa: E402
from inventory_run_model import InventoryRun  # noqa: E402


def main(limit: int = 5) -> None:
    """Fetch and print the most recent inventory runs."""
    load_dotenv()

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
                            "created_at": run.created_at.isoformat(),
                            "ok": run.ok,
                            "count": run.count,
                            "inventory": run.inventory,
                            "classification": run.classification,
                            "summary_counts": run.summary_counts,
                            "stage": run.stage,
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
    main()
