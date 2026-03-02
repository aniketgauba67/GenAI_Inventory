"""Read back the latest persisted inventory run from AWS RDS/Postgres."""

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


def main() -> None:
    """Fetch and print the most recent inventory run."""
    load_dotenv()

    session = SessionLocal()
    try:
        latest_run = (
            session.query(InventoryRun)
            .order_by(InventoryRun.created_at.desc())
            .first()
        )

        if latest_run is None:
            print(
                json.dumps(
                    {
                        "ok": True,
                        "found": False,
                        "message": "No rows found in inventory_runs",
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
                    "run": {
                        "run_id": latest_run.run_id,
                        "created_at": latest_run.created_at.isoformat(),
                        "ok": latest_run.ok,
                        "count": latest_run.count,
                        "files": latest_run.files,
                        "inventory": latest_run.inventory,
                        "classification": latest_run.classification,
                        "summary_counts": latest_run.summary_counts,
                        "comparison": latest_run.comparison,
                        "stage": latest_run.stage,
                    },
                },
                indent=2,
            )
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
