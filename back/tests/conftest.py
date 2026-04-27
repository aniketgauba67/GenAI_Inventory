"""Root conftest for all backend tests.

Sets up sys.path so that both ``back/`` and ``db/`` are importable as top-level
packages, which is required by the FastAPI application and all its routers.

Also provides shared fixtures (``client``, ``mock_db``) available to all test
directories including api/, edge_cases/, and integration/.
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ── sys.path setup ──────────────────────────────────────────────────────────
_REPO_ROOT = Path(__file__).resolve().parents[2]   # GenAI_Inventory/
_BACK_DIR  = _REPO_ROOT / "back"
_DB_DIR    = _REPO_ROOT / "db"

for _dir in (_BACK_DIR, _DB_DIR):
    _s = str(_dir)
    if _s not in sys.path:
        sys.path.insert(0, _s)


# ── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """TestClient for the full FastAPI app.

    The lifespan is NOT entered (no ``with`` block), so scheduler.start() is
    never called and no real DB connections are attempted at setup time.
    """
    from fastapi.testclient import TestClient
    import main

    return TestClient(main.app, raise_server_exceptions=True)


@pytest.fixture
def mock_db():
    """A MagicMock that imitates a SQLAlchemy Session."""
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = []
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.all.return_value = []
    return db
