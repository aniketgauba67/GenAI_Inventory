"""API tests for /volunteer/inventory/submit and /warehouse/inventory/snapshot."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from back.inventory_domain import INVENTORY_CATEGORIES

pytestmark = pytest.mark.api


def _full_inventory(qty: int = 50) -> dict:
    return {cat: qty for cat in INVENTORY_CATEGORIES}


def _make_pantry(pantry_id: int = 1) -> SimpleNamespace:
    return SimpleNamespace(id=pantry_id, name=f"Pantry {pantry_id}")


def _make_run(run_id: str, inventory: dict, source: str = "warehouse-snapshot") -> SimpleNamespace:
    return SimpleNamespace(
        run_id=run_id,
        inventory=inventory,
        source=source,
    )


def _mock_db_with_pantry(pantry=None):
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = pantry
    db.query.return_value.filter.return_value.all.return_value = []
    return db


# ── POST /volunteer/inventory/submit ─────────────────────────────────────────

class TestVolunteerInventorySubmit:

    def test_successful_submit(self, client):
        pantry = _make_pantry(1)
        warehouse = _make_run("wh-1", _full_inventory(100))
        db = _mock_db_with_pantry(pantry)

        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("routers.volunteer_inventory.load_latest_inventory_run", return_value=warehouse),
            patch("routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("routers.volunteer_inventory.persist_inventory_run", return_value="new-run-id"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": _full_inventory(50),
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "runId" in data
        assert "levels" in data
        assert set(data["levels"].keys()) == set(INVENTORY_CATEGORIES)

    def test_all_mid_levels_when_at_50_pct(self, client):
        pantry = _make_pantry(1)
        warehouse = _make_run("wh-1", _full_inventory(100))
        db = _mock_db_with_pantry(pantry)

        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("routers.volunteer_inventory.load_latest_inventory_run", return_value=warehouse),
            patch("routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("routers.volunteer_inventory.persist_inventory_run", return_value="run-x"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": _full_inventory(50),
            })

        levels = resp.json()["levels"]
        # 50/100 = 0.50 → Mid
        assert all(v == "Mid" for v in levels.values())

    def test_all_out_when_zero_inventory(self, client):
        pantry = _make_pantry(1)
        warehouse = _make_run("wh-1", _full_inventory(100))
        db = _mock_db_with_pantry(pantry)

        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("routers.volunteer_inventory.load_latest_inventory_run", return_value=warehouse),
            patch("routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("routers.volunteer_inventory.persist_inventory_run", return_value="r"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": _full_inventory(0),
            })

        levels = resp.json()["levels"]
        assert all(v == "Out" for v in levels.values())

    def test_pantry_not_found_returns_error(self, client):
        db = _mock_db_with_pantry(None)
        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=None),
            patch("routers.volunteer_inventory.Base.metadata.create_all"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "999",
                "inventory": _full_inventory(10),
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False
        assert "Pantry not found" in resp.json()["error"]

    def test_no_warehouse_run_returns_error(self, client):
        pantry = _make_pantry(1)
        db = _mock_db_with_pantry(pantry)

        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("routers.volunteer_inventory.load_latest_inventory_run", return_value=None),
            patch("routers.volunteer_inventory.Base.metadata.create_all"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": _full_inventory(10),
            })
        assert resp.json()["ok"] is False
        assert "Warehouse" in resp.json()["error"]

    def test_director_pantry_id_is_rejected(self, client):
        resp = client.post("/volunteer/inventory/submit", json={
            "pantryId": "director",
            "inventory": _full_inventory(10),
        })
        assert resp.status_code == 200
        assert resp.json()["ok"] is False

    def test_negative_inventory_value_is_rejected(self, client):
        inv = _full_inventory(10)
        inv["Beverages"] = -1
        resp = client.post("/volunteer/inventory/submit", json={
            "pantryId": "1",
            "inventory": inv,
        })
        assert resp.json()["ok"] is False


# ── POST /warehouse/inventory/snapshot ───────────────────────────────────────

class TestWarehouseSnapshot:

    def test_successful_snapshot(self, client):
        pantry = _make_pantry(1)
        db = _mock_db_with_pantry(pantry)

        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("routers.volunteer_inventory.persist_inventory_run", return_value="snap-id"),
        ):
            resp = client.post("/warehouse/inventory/snapshot", json={
                "pantryId": "1",
                "inventory": _full_inventory(100),
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["runId"] == "snap-id"
        assert data["pantryId"] == "1"

    def test_director_pantry_id_rejected(self, client):
        resp = client.post("/warehouse/inventory/snapshot", json={
            "pantryId": "director",
            "inventory": _full_inventory(100),
        })
        assert resp.json()["ok"] is False

    def test_invalid_inventory_rejected(self, client):
        inv = _full_inventory(10)
        inv["Beverages"] = -5
        resp = client.post("/warehouse/inventory/snapshot", json={
            "pantryId": "1",
            "inventory": inv,
        })
        assert resp.json()["ok"] is False

    def test_pantry_not_found_gives_error(self, client):
        db = _mock_db_with_pantry(None)
        with (
            patch("routers.volunteer_inventory.SessionLocal", return_value=db),
            patch("routers.volunteer_inventory.resolve_pantry", return_value=None),
        ):
            resp = client.post("/warehouse/inventory/snapshot", json={
                "pantryId": "99",
                "inventory": _full_inventory(100),
            })
        assert resp.json()["ok"] is False
