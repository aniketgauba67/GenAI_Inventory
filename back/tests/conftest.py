"""******************************* conftest.py ***************************************
 *
 *  Module: Backend Test Configuration
 *
 *  This module defines automated backend checks for backend test configuration.
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
