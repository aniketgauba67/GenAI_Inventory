"""Local helper that exercises the submit and DB readback flow."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import SessionLocal  # noqa: E402
from inventory_run_model import InventoryRun  # noqa: E402

DEFAULT_SUBMISSION = {
    "Beverages": 5,
    "Juices": 2,
    "Cereal": 14,
    "Breakfast": 4,
    "Meat": 1,
    "Fish": 1,
    "Poultry": 3,
    "Frozen": 2,
    "Vegetables": 6,
    "Fruits": 4,
    "Nuts": 1,
    "Soup": 2,
    "Grains": 8,
    "Pasta": 7,
    "Snacks": 10,
    "Spices": 4,
    "Sauces": 2,
    "Condiments": 1,
    "Misc Products": 0,
}


def post_json(url: str, payload: dict) -> dict:
    """Send a JSON POST request and return the decoded JSON response."""
    body = json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def read_latest_run_from_db() -> dict:
    """Read the newest inventory run directly from the database."""
    session = SessionLocal()
    try:
        latest_run = session.query(InventoryRun).order_by(InventoryRun.created_at.desc()).first()
        if latest_run is None:
            return {"ok": True, "found": False, "message": "No rows found in inventory_runs"}
        return {
            "ok": True,
            "found": True,
            "run": {
                "run_id": latest_run.run_id,
                "created_at": latest_run.created_at.isoformat(),
                "inventory": latest_run.inventory,
                "classification": latest_run.classification,
                "summary_counts": latest_run.summary_counts,
                "comparison": latest_run.comparison,
            },
        }
    finally:
        session.close()


def main() -> None:
    """Run the local workflow check against a running backend."""
    load_dotenv(Path(__file__).resolve().parent / ".env")

    api_base = os.getenv("WORKFLOW_API_BASE", "http://localhost:8000")
    pantry_id = os.getenv("WORKFLOW_PANTRY_ID", "1")

    try:
        # This script intentionally exercises the real HTTP route, not internals.
        submit_response = post_json(
            f"{api_base}/volunteer/inventory/submit",
            {"pantryId": pantry_id, "inventory": DEFAULT_SUBMISSION},
        )
        latest_run = read_latest_run_from_db()

        print(
            json.dumps(
                {
                    "ok": True,
                    "pantryId": pantry_id,
                    "submitResponse": submit_response,
                    "latestRun": latest_run,
                },
                indent=2,
            )
        )
    except HTTPError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"HTTP {exc.code}",
                    "body": exc.read().decode("utf-8", errors="replace"),
                },
                indent=2,
            )
        )
    except URLError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))


if __name__ == "__main__":
    main()
