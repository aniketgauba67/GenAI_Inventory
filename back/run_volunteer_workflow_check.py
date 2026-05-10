"""******************************* run_volunteer_workflow_check.py ***************************************
 *
 *  Module: Run Volunteer Workflow Check
 *
 *  This module supports the FastAPI backend for GenAI Inventory.
 *
 *  The module provides:
 *
 *  - backend helper functions or scripts.
 *  - shared runtime behavior for API and maintenance workflows.
 *
 *  Key Structures Used:
 *
 *  - Python modules, environment settings, and database helpers.
 *
 *  This module ensures:
 *
 *  - backend workflows remain organized by responsibility.
 *  - scripts can be run for local debugging and maintenance.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv

from db.database import SessionLocal
from db.models import InventoryRun

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
                "pantry_id": latest_run.pantry_id,
                "created_at": latest_run.created_at.isoformat(),
                "inventory": latest_run.inventory,
                "comparison": latest_run.comparison,
                "source": latest_run.source,
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
