"""******************************* test_customer.py ***************************************
 *
 *  Module: Backend API Test Customer Test
 *
 *  This module defines automated backend checks for backend api test customer test.
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
from unittest.mock import MagicMock, patch

import pytest

from back.inventory_domain import INVENTORY_CATEGORIES

pytestmark = pytest.mark.api


def _make_pantry(
    pantry_id: int = 1,
    name: str = "Test Pantry",
    location: str = "123 Main St",
    is_open: bool = True,
    manual_override: bool = False,
    operating_hours: list | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=pantry_id,
        name=name,
        location=location,
        is_open=is_open,
        manual_override=manual_override,
        operating_hours=operating_hours or [],
    )


def _make_session_returning(pantries, items=None):
    """Build a mock DB session that returns the given pantries and items."""
    db = MagicMock()
    db.__enter__ = lambda s: s
    db.__exit__ = MagicMock(return_value=False)
    # pantries query chain
    db.query.return_value.order_by.return_value.all.return_value = pantries
    # items query chain (second call)
    db.query.return_value.all.return_value = items or []
    return db


# ── GET /customer/pantries ────────────────────────────────────────────────────

class TestListCustomerPantries:

    def test_empty_db_returns_empty_list(self, client):
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = []
        mock_db.query.return_value.all.return_value = []

        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            resp = client.get("/customer/pantries")

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["pantries"] == []

    def test_single_pantry_returned(self, client):
        pantry = _make_pantry(pantry_id=1, name="FPN A", is_open=True)
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = [pantry]
        mock_db.query.return_value.all.return_value = []

        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            resp = client.get("/customer/pantries")

        assert resp.status_code == 200
        pantries = resp.json()["pantries"]
        assert len(pantries) == 1
        assert pantries[0]["name"] == "FPN A"
        assert pantries[0]["isOpen"] is True
        assert pantries[0]["pantryId"] == "1"

    def test_pantry_has_required_fields(self, client):
        pantry = _make_pantry()
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = [pantry]
        mock_db.query.return_value.all.return_value = []

        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            resp = client.get("/customer/pantries")

        p = resp.json()["pantries"][0]
        for field in ("pantryId", "name", "location", "isOpen", "manualOverride",
                      "operatingHours", "levels", "lastUpdated"):
            assert field in p, f"Missing field: {field}"

    def test_levels_has_all_19_categories(self, client):
        pantry = _make_pantry()
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = [pantry]
        mock_db.query.return_value.all.return_value = []

        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            resp = client.get("/customer/pantries")

        levels = resp.json()["pantries"][0]["levels"]
        assert set(levels.keys()) == set(INVENTORY_CATEGORIES)

    def test_multiple_pantries_all_returned(self, client):
        pantries = [_make_pantry(i, f"Pantry {i}") for i in range(1, 4)]
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = pantries
        mock_db.query.return_value.all.return_value = []

        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            resp = client.get("/customer/pantries")

        assert len(resp.json()["pantries"]) == 3

    def test_closed_pantry_is_included_in_list(self, client):
        pantry = _make_pantry(is_open=False, manual_override=True)
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = [pantry]
        mock_db.query.return_value.all.return_value = []

        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            resp = client.get("/customer/pantries")

        p = resp.json()["pantries"][0]
        assert p["isOpen"] is False
        assert p["manualOverride"] is True


# ── GET /customer/pantries-by-time ────────────────────────────────────────────

class TestListPantriesByTime:

    MON_HOURS = [{"day": "mon", "open": "09:00", "close": "17:00"}]

    def _call(self, client, day: str, time: str, pantries=None):
        mock_db = MagicMock()
        mock_db.query.return_value.order_by.return_value.all.return_value = pantries or []
        mock_db.query.return_value.all.return_value = []
        with (
            patch("back.routers.customer.SessionLocal", return_value=mock_db),
            patch("back.routers.customer.load_latest_inventory_run", return_value=None),
        ):
            return client.get(f"/customer/pantries-by-time?day={day}&time={time}")

    def test_within_hours_returns_pantry(self, client):
        pantry = _make_pantry(operating_hours=self.MON_HOURS)
        resp = self._call(client, "mon", "12:00", [pantry])
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert len(data["pantries"]) == 1

    def test_outside_hours_excludes_pantry(self, client):
        pantry = _make_pantry(operating_hours=self.MON_HOURS)
        resp = self._call(client, "mon", "20:00", [pantry])
        assert resp.json()["pantries"] == []

    def test_pantry_without_hours_is_excluded(self, client):
        pantry = _make_pantry(operating_hours=[])  # no hours configured
        resp = self._call(client, "mon", "12:00", [pantry])
        assert resp.json()["pantries"] == []

    def test_wrong_day_excludes_pantry(self, client):
        pantry = _make_pantry(operating_hours=self.MON_HOURS)
        resp = self._call(client, "tue", "12:00", [pantry])
        assert resp.json()["pantries"] == []

    def test_invalid_day_returns_error(self, client):
        resp = self._call(client, "monday", "12:00")
        data = resp.json()
        assert data["ok"] is False
        assert "Invalid day" in data["error"]

    def test_invalid_time_format_returns_error(self, client):
        resp = self._call(client, "mon", "25:99")
        data = resp.json()
        assert data["ok"] is False

    def test_time_format_without_colon_returns_error(self, client):
        resp = self._call(client, "mon", "1200")
        assert resp.json()["ok"] is False

    def test_missing_day_param_is_422(self, client):
        resp = client.get("/customer/pantries-by-time?time=12:00")
        assert resp.status_code == 422

    def test_missing_time_param_is_422(self, client):
        resp = client.get("/customer/pantries-by-time?day=mon")
        assert resp.status_code == 422

    def test_all_valid_days_accepted(self, client):
        for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun"):
            resp = self._call(client, day, "12:00")
            assert resp.json()["ok"] is True, f"Failed for day: {day}"

    def test_exactly_at_open_time(self, client):
        pantry = _make_pantry(operating_hours=self.MON_HOURS)  # 09:00–17:00
        resp = self._call(client, "mon", "09:00", [pantry])
        assert len(resp.json()["pantries"]) == 1

    def test_exactly_at_close_time_is_excluded(self, client):
        pantry = _make_pantry(operating_hours=self.MON_HOURS)
        resp = self._call(client, "mon", "17:00", [pantry])
        assert resp.json()["pantries"] == []
