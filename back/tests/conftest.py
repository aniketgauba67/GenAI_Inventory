"""Root conftest for all backend tests.

Provides shared fixtures (``client``, ``mock_db``) available to all test
directories including api/, edge_cases/, and integration/.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest


# ── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """TestClient for the full FastAPI app.

    The lifespan is NOT entered (no ``with`` block), so scheduler.start() is
    never called and no real DB connections are attempted at setup time.
    """
    from fastapi.testclient import TestClient
    from back.main import app

    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture
def mock_db():
    """A MagicMock that imitates a SQLAlchemy Session."""
    db = MagicMock()
    db.query.return_value.order_by.return_value.all.return_value = []
    db.query.return_value.filter.return_value.first.return_value = None
    db.query.return_value.filter.return_value.all.return_value = []
    db.query.return_value.all.return_value = []
    return db
