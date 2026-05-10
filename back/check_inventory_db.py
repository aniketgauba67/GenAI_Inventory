"""******************************* check_inventory_db.py ***************************************
 *
 *  Module: Check Inventory Db
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

from dotenv import load_dotenv
from sqlalchemy import inspect, text

from db.database import engine


def main() -> None:
    """Check database connectivity and table visibility without writing data."""
    load_dotenv()

    payload: dict[str, object] = {
        "ok": False,
        "connection": False,
        "inventory_runs_table": False,
        "details": {},
    }

    try:
        with engine.connect() as connection:
            version = connection.execute(text("SELECT version();")).scalar()
            current_db = connection.execute(text("SELECT current_database();")).scalar()
            payload["connection"] = True
            payload["details"] = {
                "database": current_db,
                "version": version,
            }

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        payload["inventory_runs_table"] = "inventory_runs" in tables
        payload["details"]["tables"] = tables
        payload["ok"] = True
    except Exception as exc:
        payload["details"] = {
            "error": str(exc),
        }

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
