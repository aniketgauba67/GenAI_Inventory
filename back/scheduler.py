"""******************************* scheduler.py ***************************************
 *
 *  Module: Scheduler
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

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from db.database import SessionLocal
from db.models import Pantry

logger = logging.getLogger(__name__)

TIMEZONE = ZoneInfo("America/New_York")
INTERVAL_SECONDS = 60
INITIAL_DELAY_SECONDS = 5

DAY_MAP = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}


def _time_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _is_within_schedule(now: datetime, hours: list[dict]) -> bool:
    """Return True if *now* falls inside any operating window."""
    current_day = DAY_MAP[now.weekday()]
    current_minutes = now.hour * 60 + now.minute

    for slot in hours:
        if slot.get("day") != current_day:
            continue
        open_min = _time_to_minutes(slot["open"])
        close_min = _time_to_minutes(slot["close"])
        if open_min <= current_minutes < close_min:
            return True
    return False


def sync_open_status() -> int:
    """Check every pantry and flip is_open where needed. Returns count of changes."""
    now = datetime.now(TIMEZONE)
    db = SessionLocal()
    changed = 0
    try:
        pantries = db.query(Pantry).filter(
            Pantry.operating_hours.isnot(None),
            Pantry.manual_override == False,  # noqa: E712
        ).all()
        for pantry in pantries:
            hours = pantry.operating_hours
            if not isinstance(hours, list):
                continue
            should_be_open = _is_within_schedule(now, hours)
            if pantry.is_open != should_be_open:
                pantry.is_open = should_be_open
                changed += 1
        if changed:
            db.commit()
            logger.info("Scheduler: updated %d pantry open/close states at %s", changed, now.strftime("%H:%M"))
    except Exception:
        db.rollback()
        logger.exception("Scheduler: error syncing open status")
    finally:
        db.close()
    return changed


async def _loop() -> None:
    """Run pantry status syncs without blocking the FastAPI event loop."""
    await asyncio.sleep(INITIAL_DELAY_SECONDS)
    while True:
        await asyncio.to_thread(sync_open_status)
        await asyncio.sleep(INTERVAL_SECONDS)


_task: asyncio.Task | None = None


def start() -> None:
    """Launch the background scheduler task."""
    global _task
    if _task is not None:
        return
    _task = asyncio.create_task(_loop())
    logger.info("Open/close scheduler started (every %ds, tz=%s)", INTERVAL_SECONDS, TIMEZONE)


def stop() -> None:
    """Cancel the background scheduler task."""
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
        logger.info("Open/close scheduler stopped")
