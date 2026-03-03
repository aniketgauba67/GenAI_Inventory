"""Read-only script to list pantries from the database."""

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
from models import Pantry  # noqa: E402


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
