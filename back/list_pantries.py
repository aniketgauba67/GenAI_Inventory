"""Read-only script to list pantries from the database."""

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
