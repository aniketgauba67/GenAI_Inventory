"""******************************* test_workflows.py ***************************************
 *
 *  Module: Backend Integration Test Workflows Test
 *
 *  This module defines automated backend checks for backend integration test workflows test.
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
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""
from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from back.inventory_domain import INVENTORY_CATEGORIES, compute_ratios_and_levels

pytestmark = pytest.mark.integration


def _full(qty: int = 100) -> dict:
    return {cat: qty for cat in INVENTORY_CATEGORIES}


def _make_pantry(pid=1):
    return SimpleNamespace(id=pid, name=f"Pantry {pid}")


def _make_warehouse_run(inventory: dict):
    return SimpleNamespace(
        run_id="wh-1",
        inventory=inventory,
        source="warehouse-snapshot",
        created_at=datetime(2024, 1, 1),
    )


# ── Volunteer submit workflow (Upload → Review → Submit) ─────────────────────

class TestVolunteerSubmitWorkflow:
    """Simulate the complete 3-step volunteer flow end-to-end via API."""

    def test_upload_then_submit_produces_correct_levels(self, client):
        """Upload images → mock Gemini detection → submit detected inventory → verify levels."""
        import io

        pantry = _make_pantry(1)
        warehouse = _make_warehouse_run(_full(100))
        detected = _full(75)  # 75% → High

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = pantry
        mock_db.query.return_value.filter.return_value.all.return_value = []

        # Step 1: Upload images
        with (
            patch("back.routers.upload.SessionLocal", return_value=mock_db),
            patch("back.routers.upload.resolve_pantry", return_value=pantry),
            patch("back.routers.upload.call_gemini_inventory_images", return_value=detected),
            patch("back.routers.upload.save_inventory_draft"),
        ):
            upload_resp = client.post(
                "/upload",
                files=[("files", ("shelf.jpg", io.BytesIO(b"X" * 100), "image/jpeg"))],
                data={"pantry_id": "1"},
            )

        assert upload_resp.status_code == 200
        assert upload_resp.json()["ok"] is True
        upload_inventory = upload_resp.json()["inventory"]

        # Step 2: Submit detected inventory
        mock_db2 = MagicMock()
        with (
            patch("back.routers.volunteer_inventory.SessionLocal", return_value=mock_db2),
            patch("back.routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("back.routers.volunteer_inventory.load_latest_inventory_run", return_value=warehouse),
            patch("back.routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("back.routers.volunteer_inventory.persist_inventory_run", return_value="vol-run-1"),
        ):
            submit_resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": upload_inventory,
            })

        assert submit_resp.status_code == 200
        data = submit_resp.json()
        assert data["ok"] is True

        # 75/100 = 0.75 → all High
        assert all(v == "High" for v in data["levels"].values())

    def test_submit_after_partial_depletion_shows_mixed_levels(self, client):
        """Warehouse has 100 units; submit 30 → Low for all."""
        pantry = _make_pantry(1)
        warehouse = _make_warehouse_run(_full(100))
        current = _full(30)  # 30/100 = 0.30 → Low (not > 0.30)

        mock_db = MagicMock()
        with (
            patch("back.routers.volunteer_inventory.SessionLocal", return_value=mock_db),
            patch("back.routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("back.routers.volunteer_inventory.load_latest_inventory_run", return_value=warehouse),
            patch("back.routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("back.routers.volunteer_inventory.persist_inventory_run", return_value="r"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": current,
            })

        assert resp.json()["ok"] is True
        # 30/100 = 0.30 → Low
        assert all(v == "Low" for v in resp.json()["levels"].values())


# ── Manager workflow (Upload order form → Save baseline → Volunteer submit) ───

class TestManagerWorkflow:

    def test_ratios_reflect_manager_baseline(self, client):
        """After manager saves baseline of 200 units, volunteer submits 100 → Mid."""
        # The manager workflow stores a warehouse-snapshot run.
        # Then volunteer submit uses that as the denominator.
        baseline_qty = 200
        current_qty = 100  # 100/200 = 0.50 → Mid

        pantry = _make_pantry(1)
        warehouse = _make_warehouse_run(_full(baseline_qty))

        mock_db = MagicMock()
        with (
            patch("back.routers.volunteer_inventory.SessionLocal", return_value=mock_db),
            patch("back.routers.volunteer_inventory.resolve_pantry", return_value=pantry),
            patch("back.routers.volunteer_inventory.load_latest_inventory_run", return_value=warehouse),
            patch("back.routers.volunteer_inventory.upsert_pantry_inventory_items"),
            patch("back.routers.volunteer_inventory.persist_inventory_run", return_value="r"),
        ):
            resp = client.post("/volunteer/inventory/submit", json={
                "pantryId": "1",
                "inventory": _full(current_qty),
            })

        assert resp.json()["ok"] is True
        assert all(v == "Mid" for v in resp.json()["levels"].values())


# ── Domain logic integration — no HTTP ───────────────────────────────────────

class TestDomainLogicIntegration:
    """Pure function composition tests that cross module boundaries."""

    def test_compute_ratios_from_warehouse_and_volunteer(self):
        warehouse = _full(100)
        volunteer = {cat: 71 for cat in INVENTORY_CATEGORIES}

        ratios, levels = compute_ratios_and_levels(volunteer, warehouse)

        assert all(v == "High" for v in levels.values()), \
            f"Expected all High (71/100=0.71), got: {set(levels.values())}"

    def test_zero_volunteer_inventory_all_out(self):
        warehouse = _full(100)
        volunteer = _full(0)
        _, levels = compute_ratios_and_levels(volunteer, warehouse)
        assert all(v == "Out" for v in levels.values())

    def test_inventory_state_resolution_chooses_correct_source(self):
        """When volunteer run is newer, it should override warehouse-snapshot."""
        from back.customer_inventory_state import resolve_customer_inventory_state

        early = datetime(2024, 1, 1)
        late  = datetime(2024, 6, 1)

        wh_run = SimpleNamespace(
            run_id="wh",
            inventory=_full(100),
            comparison={},
            source="warehouse-snapshot",
            created_at=early,
        )
        vol_run = SimpleNamespace(
            run_id="vol",
            inventory=_full(80),
            comparison={"warehouseInventory": _full(100)},
            source="volunteer-submit",
            created_at=late,
        )

        result = resolve_customer_inventory_state(vol_run, wh_run)
        assert result["source"] == "volunteer-submit"
        assert all(v == "High" for v in result["levels"].values())  # 80/100 = 0.80
