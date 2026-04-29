"""******************************* list_pantries.py ***************************************
 *
 *  Module: List Pantries
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
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from __future__ import annotations

import json
from pathlib import Path

from dotenv import load_dotenv

from db.database import SessionLocal
from db.models import Pantry


def main() -> None:
    """Print all pantries as JSON."""
    load_dotenv(Path(__file__).resolve().parent / ".env")

    session = SessionLocal()
    try:
        pantries = session.query(Pantry).order_by(Pantry.id.asc()).all()
        print(
            json.dumps(
                {
                    "ok": True,
                    "count": len(pantries),
                    "pantries": [
                        {
                            "id": pantry.id,
                            "name": pantry.name,
                            "location": pantry.location,
                        }
                        for pantry in pantries
                    ],
                },
                indent=2,
            )
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
