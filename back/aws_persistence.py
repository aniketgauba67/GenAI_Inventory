"""AWS database persistence for Sprint 1 inventory runs."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

ROOT_DIR = Path(__file__).resolve().parent.parent
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))


def env_flag(name: str, default: bool = False) -> bool:
    """Interpret common truthy environment variable values."""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def should_dry_run() -> bool:
    """Default to dry-run when required database configuration is incomplete."""
    if os.getenv("DRY_RUN") is not None:
        return env_flag("DRY_RUN")

    required_db_env = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]
    return any(not os.getenv(key) for key in required_db_env)


def build_run_record(
    required_output: dict,
    classification_artifact: dict,
    comparison_artifact: dict,
) -> dict:
    """Assemble the persistence payload for one processing run."""
    return {
        "pk": str(uuid4()),
        "createdAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "ok": required_output["ok"],
        "count": required_output["count"],
        "files": required_output["files"],
        "inventory": required_output["inventory"],
        "classification": classification_artifact["classification"],
        "summaryCounts": classification_artifact["summaryCounts"],
        "comparison": comparison_artifact,
        "stage": os.getenv("STAGE") or os.getenv("ENV"),
    }


def fetch_latest_inventory_snapshot() -> dict | None:
    """Return the most recent stored inventory snapshot, if available."""
    from database import SessionLocal  # noqa: E402
    from inventory_run_model import InventoryRun  # noqa: E402

    session = SessionLocal()
    try:
        latest_run = (
            session.query(InventoryRun)
            .order_by(InventoryRun.created_at.desc())
            .first()
        )
        return None if latest_run is None else latest_run.inventory
    finally:
        session.close()


def persist_inventory_run(run_record: dict) -> str:
    """Persist one inventory run to the existing AWS RDS Postgres database."""
    from database import Base, SessionLocal, engine  # noqa: E402
    from inventory_run_model import InventoryRun  # noqa: E402

    Base.metadata.create_all(bind=engine, tables=[InventoryRun.__table__])

    session = SessionLocal()
    try:
        session.add(
            InventoryRun(
                run_id=run_record["pk"],
                created_at=datetime.fromisoformat(run_record["createdAt"].replace("Z", "+00:00")),
                ok=run_record["ok"],
                count=run_record["count"],
                files=run_record["files"],
                inventory=run_record["inventory"],
                classification=run_record["classification"],
                summary_counts=run_record["summaryCounts"],
                comparison=run_record["comparison"],
                stage=run_record["stage"],
            )
        )
        session.commit()
        return run_record["pk"]
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
