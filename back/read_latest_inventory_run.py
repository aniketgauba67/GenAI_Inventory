"""Read back the latest persisted inventory run from AWS RDS/Postgres.

The output mirrors the lean `inventory_runs` schema:
- `inventory` = stored counts
- `comparison` = derived context such as warehouseRunId, ratios, and levels
"""

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
from models import InventoryRun  # noqa: E402


def main() -> None:
    """Fetch and print the most recent inventory run."""
    load_dotenv(Path(__file__).resolve().parent / ".env")

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
                        "pantry_id": latest_run.pantry_id,
                        "created_at": latest_run.created_at.isoformat(),
                        "files": latest_run.files,
                        "inventory": latest_run.inventory,
                        "comparison": latest_run.comparison,
                        "source": latest_run.source,
                    },
                },
                indent=2,
            )
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
