"""Edge-case and boundary tests covering unusual inputs across all layers."""

from __future__ import annotations

import unittest
from datetime import datetime
from types import SimpleNamespace

import pytest

from back.inventory_domain import (
    INVENTORY_CATEGORIES,
    compute_level_from_quantities,
    compute_ratios_and_levels,
    normalize_inventory,
    validate_inventory,
)
from back.operating_hours import normalize_operating_hours
from back.customer_inventory_state import resolve_customer_inventory_state

pytestmark = pytest.mark.edge_cases


# ── Inventory — extreme values ────────────────────────────────────────────────

class TestExtremeInventoryValues(unittest.TestCase):

    def test_max_int_value_normalizes_cleanly(self):
        result = normalize_inventory({"Beverages": 2**31 - 1})
        self.assertEqual(result["Beverages"], 2**31 - 1)

    def test_very_large_quantity_is_high(self):
        level = compute_level_from_quantities(1_000_000, 100)
        self.assertEqual(level, "High")

    def test_validate_zero_for_every_category(self):
        ok, err = validate_inventory({cat: 0 for cat in INVENTORY_CATEGORIES})
        self.assertTrue(ok)

    def test_validate_max_int_passes(self):
        ok, err = validate_inventory({"Beverages": 2**31 - 1})
        self.assertTrue(ok)

    def test_validate_float_zero_passes(self):
        ok, err = validate_inventory({"Beverages": 0.0})
        self.assertTrue(ok)

    def test_validate_negative_large_fails(self):
        ok, err = validate_inventory({"Beverages": -9999})
        self.assertFalse(ok)

    def test_normalize_all_none_values(self):
        inv = {cat: None for cat in INVENTORY_CATEGORIES}
        result = normalize_inventory(inv)
        self.assertTrue(all(v == 0 for v in result.values()))

    def test_normalize_string_numbers(self):
        result = normalize_inventory({"Beverages": "100", "Soup": "0"})
        self.assertEqual(result["Beverages"], 100)
        self.assertEqual(result["Soup"], 0)


# ── Level boundaries ──────────────────────────────────────────────────────────

class TestLevelBoundaries(unittest.TestCase):
    """Verify every boundary of the High/Mid/Low/Out thresholds."""

    CASES = [
        (0, 100, "Out"),
        (1, 100, "Low"),
        (29, 100, "Low"),
        (30, 100, "Low"),    # 0.30 is NOT > 0.30
        (31, 100, "Mid"),
        (69, 100, "Mid"),
        (70, 100, "Mid"),    # 0.70 is NOT > 0.70
        (71, 100, "High"),
        (100, 100, "High"),
        (200, 100, "High"),
        (1, 0, "High"),      # zero baseline → High
    ]

    def test_all_boundaries(self):
        for current, baseline, expected in self.CASES:
            with self.subTest(current=current, baseline=baseline):
                self.assertEqual(
                    compute_level_from_quantities(current, baseline),
                    expected,
                    msg=f"compute_level_from_quantities({current}, {baseline}) should be {expected!r}",
                )


# ── Operating hours — edge cases ─────────────────────────────────────────────

class TestOperatingHoursEdgeCases(unittest.TestCase):

    def test_empty_list_is_valid(self):
        normalized, err = normalize_operating_hours([])
        self.assertIsNone(err)
        self.assertEqual(normalized, [])

    def test_consecutive_midnight_hours(self):
        # From 00:00 to 23:59 — almost full day
        slots = [{"day": "sat", "open": "00:00", "close": "23:59"}]
        normalized, err = normalize_operating_hours(slots)
        self.assertIsNone(err)
        self.assertEqual(len(normalized), 1)

    def test_exactly_one_minute_window_is_valid(self):
        slots = [{"day": "mon", "open": "12:00", "close": "12:01"}]
        _, err = normalize_operating_hours(slots)
        self.assertIsNone(err)

    def test_all_7_days_in_reverse_order_sorted_correctly(self):
        slots = [
            {"day": "sun", "open": "09:00", "close": "17:00"},
            {"day": "sat", "open": "09:00", "close": "17:00"},
            {"day": "fri", "open": "09:00", "close": "17:00"},
            {"day": "thu", "open": "09:00", "close": "17:00"},
            {"day": "wed", "open": "09:00", "close": "17:00"},
            {"day": "tue", "open": "09:00", "close": "17:00"},
            {"day": "mon", "open": "09:00", "close": "17:00"},
        ]
        normalized, err = normalize_operating_hours(slots)
        self.assertIsNone(err)
        days = [s["day"] for s in normalized]
        self.assertEqual(days, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"])

    def test_slot_missing_close_key_fails(self):
        slots = [{"day": "mon", "open": "09:00"}]
        _, err = normalize_operating_hours(slots)
        self.assertIsNotNone(err)

    def test_slot_missing_open_key_fails(self):
        slots = [{"day": "mon", "close": "17:00"}]
        _, err = normalize_operating_hours(slots)
        self.assertIsNotNone(err)


# ── Inventory state — edge cases ──────────────────────────────────────────────

class TestInventoryStateEdgeCases(unittest.TestCase):

    def _run(self, inventory, comparison=None, created_at=None, source="volunteer-submit"):
        return SimpleNamespace(
            run_id="r1",
            inventory=inventory or {},
            comparison=comparison or {},
            created_at=created_at or datetime(2024, 1, 1),
            source=source,
        )

    def test_volunteer_run_with_none_inventory_field(self):
        volunteer = self._run(inventory=None)
        result = resolve_customer_inventory_state(volunteer, None)
        # Should not crash; all quantities should default to 0 → all High (0 baseline)
        self.assertIn("levels", result)

    def test_warehouse_run_with_none_inventory_field(self):
        warehouse = self._run(inventory=None, source="warehouse-snapshot")
        result = resolve_customer_inventory_state(None, warehouse)
        self.assertIn("levels", result)

    def test_comparison_with_non_dict_warehouse_inventory_falls_back(self):
        volunteer = self._run(
            inventory={cat: 10 for cat in INVENTORY_CATEGORIES},
            comparison={"warehouseInventory": "not-a-dict"},
        )
        warehouse = self._run(
            inventory={cat: 100 for cat in INVENTORY_CATEGORIES},
            source="warehouse-snapshot",
            created_at=datetime(2023, 1, 1),
        )
        # Should not crash
        result = resolve_customer_inventory_state(volunteer, warehouse)
        self.assertIn("levels", result)

    def test_fallback_with_invalid_level_string(self):
        result = resolve_customer_inventory_state(
            None, None,
            fallback_levels={"Beverages": "INVALID_LEVEL"},
        )
        # normalize_customer_level maps unknown → "Low"
        self.assertEqual(result["levels"]["Beverages"], "Low")

    def test_all_categories_always_present_in_result(self):
        result = resolve_customer_inventory_state(None, None)
        self.assertEqual(set(result["levels"].keys()), set(INVENTORY_CATEGORIES))
        self.assertEqual(set(result["originalQuantities"].keys()), set(INVENTORY_CATEGORIES))
        self.assertEqual(set(result["currentInventory"].keys()), set(INVENTORY_CATEGORIES))


# ── API edge cases (require client fixture from api/conftest) ─────────────────

class TestAPIEdgeCases:

    def test_login_with_whitespace_username_is_rejected(self, client):
        resp = client.post("/auth/login", json={"username": "   ", "password": "pw"})
        assert resp.status_code in (200, 400, 422)
        if resp.status_code == 200:
            assert resp.json()["ok"] is False

    def test_login_extra_fields_are_ignored(self, client):
        from unittest.mock import patch
        with patch("crud.check_director_credentials", return_value=True):
            resp = client.post("/auth/login", json={
                "username": "director",
                "password": "pw",
                "unexpectedField": "should-be-ignored",
            })
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_chat_message_with_only_whitespace_is_rejected(self, client):
        resp = client.post("/chat/message", json={"message": "   "})
        assert resp.status_code in (200, 422)
        if resp.status_code == 200:
            assert resp.json()["ok"] is False

    def test_pantries_by_time_time_with_seconds_is_rejected(self, client):
        resp = client.get("/customer/pantries-by-time?day=mon&time=09:00:00")
        # "09:00:00" has 3 parts after split on ":", fails validation
        data = resp.json()
        assert data["ok"] is False

    def test_volunteer_submit_missing_fields_is_422(self, client):
        resp = client.post("/volunteer/inventory/submit", json={"pantryId": "1"})
        assert resp.status_code == 422

    def test_warehouse_snapshot_missing_fields_is_422(self, client):
        resp = client.post("/warehouse/inventory/snapshot", json={"pantryId": "1"})
        assert resp.status_code == 422
