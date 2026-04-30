"""******************************* data.py ***************************************
 *
 *  Module: Backend Test Fixture Data
 *
 *  This module defines automated backend checks for backend test fixture data.
 *
 *  The module provides:
 *
 *  - pytest cases for API, domain, and workflow behavior.
 *  - mocked dependencies and fixtures where external services are not needed.
 *  - regression coverage for inventory, auth, upload, and chatbot flows.
 *
 *  Key Structures Used:
 *
 *  - pytest fixtures, FastAPI test clients, monkeypatching, and unittest mocks.
 *
 *  This module ensures:
 *
 *  - backend behavior remains stable as the application evolves.
 *  - database and service boundaries are tested without unsafe side effects.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""
from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any

from back.inventory_domain import INVENTORY_CATEGORIES

# ── Pantry fixtures ──────────────────────────────────────────────────────────

def make_pantry(
    pantry_id: int = 1,
    name: str = "Test Pantry",
    location: str | None = "123 Main St",
    is_open: bool = True,
    manual_override: bool = False,
    operating_hours: list[dict] | None = None,
) -> SimpleNamespace:
    """Return a mock Pantry ORM-like object."""
    return SimpleNamespace(
        id=pantry_id,
        name=name,
        location=location,
        is_open=is_open,
        manual_override=manual_override,
        operating_hours=operating_hours or [],
        created_at=datetime(2024, 1, 1, 9, 0, 0),
    )


PANTRY_OPEN = make_pantry(
    pantry_id=1,
    name="FPN Pantry A",
    location="10 Maple Ave, New York, NY",
    is_open=True,
    operating_hours=[
        {"day": "mon", "open": "09:00", "close": "17:00"},
        {"day": "wed", "open": "09:00", "close": "17:00"},
        {"day": "fri", "open": "09:00", "close": "13:00"},
    ],
)

PANTRY_CLOSED = make_pantry(
    pantry_id=2,
    name="FPN Pantry B",
    location="22 Oak Rd, Brooklyn, NY",
    is_open=False,
    manual_override=True,
)

PANTRY_NO_HOURS = make_pantry(
    pantry_id=3,
    name="FPN Pantry C",
    location=None,
    is_open=True,
    operating_hours=[],
)

ALL_PANTRIES = [PANTRY_OPEN, PANTRY_CLOSED, PANTRY_NO_HOURS]


# ── Inventory fixtures ───────────────────────────────────────────────────────

def make_full_inventory(default: int = 10) -> dict[str, int]:
    """Return a complete 19-category inventory with *default* quantity each."""
    return {cat: default for cat in INVENTORY_CATEGORIES}


def make_sparse_inventory(**overrides: int) -> dict[str, int]:
    """Return a 19-category inventory where every category starts at 0,
    then applies the provided overrides."""
    inv = {cat: 0 for cat in INVENTORY_CATEGORIES}
    inv.update(overrides)
    return inv


FULL_WAREHOUSE_INVENTORY = make_full_inventory(100)
HALF_CURRENT_INVENTORY = make_full_inventory(50)   # 50/100 = 0.50 → "Mid"
HIGH_CURRENT_INVENTORY = make_full_inventory(80)   # 80/100 = 0.80 → "High"
LOW_CURRENT_INVENTORY = make_full_inventory(20)    # 20/100 = 0.20 → "Low"
EMPTY_INVENTORY = make_full_inventory(0)           # 0/100 = 0.00 → "Out"


# ── InventoryRun fixtures ────────────────────────────────────────────────────

def make_run(
    run_id: str = "run-001",
    pantry_id: int = 1,
    source: str = "volunteer-submit",
    inventory: dict[str, int] | None = None,
    comparison: dict[str, Any] | None = None,
    created_at: datetime | None = None,
) -> SimpleNamespace:
    """Return a mock InventoryRun ORM-like object."""
    return SimpleNamespace(
        run_id=run_id,
        pantry_id=pantry_id,
        source=source,
        inventory=inventory or make_full_inventory(50),
        comparison=comparison or {},
        created_at=created_at or datetime(2024, 6, 1, 12, 0, 0),
    )


WAREHOUSE_RUN = make_run(
    run_id="wh-001",
    source="warehouse-snapshot",
    inventory=FULL_WAREHOUSE_INVENTORY,
    comparison={"note": "baseline"},
    created_at=datetime(2024, 5, 1, 8, 0, 0),
)

VOLUNTEER_RUN = make_run(
    run_id="vol-001",
    source="volunteer-submit",
    inventory=HALF_CURRENT_INVENTORY,
    comparison={
        "warehouseRunId": "wh-001",
        "warehouseInventory": FULL_WAREHOUSE_INVENTORY,
        "ratios": {cat: 0.5 for cat in INVENTORY_CATEGORIES},
        "levels": {cat: "Mid" for cat in INVENTORY_CATEGORIES},
        "summaryCounts": {"High": 0, "Mid": 19, "Low": 0, "Out": 0},
    },
    created_at=datetime(2024, 6, 1, 12, 0, 0),
)


# ── Auth fixtures ────────────────────────────────────────────────────────────

DIRECTOR_EMAIL = "director@example.com"
DIRECTOR_PASSWORD = "director-secret-123"

PANTRY_PASSWORD = "pantry-secret-456"

VALID_LOGIN_DIRECTOR = {"username": "director", "password": DIRECTOR_PASSWORD}
VALID_LOGIN_PANTRY   = {"username": "1",         "password": PANTRY_PASSWORD}
INVALID_LOGIN        = {"username": "director",  "password": "wrong-password"}

# ── Operating hours fixtures ─────────────────────────────────────────────────

VALID_HOURS = [
    {"day": "mon", "open": "09:00", "close": "17:00"},
    {"day": "wed", "open": "10:00", "close": "18:00"},
    {"day": "fri", "open": "08:30", "close": "14:00"},
]

VALID_HOURS_ALL_DAYS = [
    {"day": day, "open": "09:00", "close": "17:00"}
    for day in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
]
