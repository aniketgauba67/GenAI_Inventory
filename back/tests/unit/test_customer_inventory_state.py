"""Unit tests for back/customer_inventory_state.py — inventory state resolution."""

from __future__ import annotations

import unittest
from datetime import datetime
from types import SimpleNamespace

from back.customer_inventory_state import (
    baseline_to_reset_levels,
    normalize_customer_level,
    resolve_customer_inventory_state,
)
from back.inventory_domain import INVENTORY_CATEGORIES


def _make_run(
    run_id: str = "r1",
    pantry_id: int = 1,
    source: str = "volunteer-submit",
    inventory: dict | None = None,
    comparison: dict | None = None,
    created_at: datetime | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        run_id=run_id,
        pantry_id=pantry_id,
        source=source,
        inventory=inventory or {},
        comparison=comparison or {},
        created_at=created_at or datetime(2024, 6, 1, 12, 0, 0),
    )


_EARLY = datetime(2024, 1, 1)
_LATE  = datetime(2024, 6, 1)


class TestNormalizeCustomerLevel(unittest.TestCase):

    def test_valid_levels_pass_through(self):
        for level in ("High", "Mid", "Low", "Out"):
            with self.subTest(level=level):
                self.assertEqual(normalize_customer_level(level), level)

    def test_lowercase_is_title_cased(self):
        self.assertEqual(normalize_customer_level("high"), "High")
        self.assertEqual(normalize_customer_level("mid"), "Mid")
        self.assertEqual(normalize_customer_level("low"), "Low")
        self.assertEqual(normalize_customer_level("out"), "Out")

    def test_unknown_level_maps_to_low(self):
        self.assertEqual(normalize_customer_level("Unknown"), "Low")
        self.assertEqual(normalize_customer_level(""), "Low")
        self.assertEqual(normalize_customer_level(None), "Low")

    def test_whitespace_around_level_is_stripped(self):
        self.assertEqual(normalize_customer_level("  High  "), "High")


class TestBaselineToResetLevels(unittest.TestCase):

    def test_nonzero_category_becomes_high(self):
        levels = baseline_to_reset_levels({"Beverages": 10, "Soup": 5})
        self.assertEqual(levels["Beverages"], "High")
        self.assertEqual(levels["Soup"], "High")

    def test_zero_category_becomes_out(self):
        levels = baseline_to_reset_levels({"Beverages": 0, "Soup": 1})
        self.assertEqual(levels["Beverages"], "Out")
        self.assertEqual(levels["Soup"], "High")

    def test_none_input_all_out(self):
        levels = baseline_to_reset_levels(None)
        self.assertTrue(all(v == "Out" for v in levels.values()))

    def test_empty_dict_all_out(self):
        levels = baseline_to_reset_levels({})
        self.assertTrue(all(v == "Out" for v in levels.values()))

    def test_output_has_all_19_categories(self):
        levels = baseline_to_reset_levels({"Beverages": 5})
        self.assertEqual(set(levels.keys()), set(INVENTORY_CATEGORIES))


class TestResolveCustomerInventoryState(unittest.TestCase):

    # --- Fallback path ---

    def test_no_runs_uses_fallback_data(self):
        result = resolve_customer_inventory_state(
            None,
            None,
            fallback_levels={"Beverages": "High"},
            fallback_original_quantities={"Beverages": 100},
        )
        self.assertEqual(result["source"], "fallback")
        self.assertIsNone(result["lastUpdated"])
        self.assertEqual(result["levels"]["Beverages"], "High")
        self.assertEqual(result["originalQuantities"]["Beverages"], 100)

    def test_no_runs_no_fallback_returns_all_low(self):
        result = resolve_customer_inventory_state(None, None)
        self.assertEqual(result["source"], "fallback")
        self.assertTrue(all(v == "Low" for v in result["levels"].values()))

    # --- Volunteer-submit preferred ---

    def test_volunteer_run_newer_than_warehouse_is_used(self):
        warehouse = _make_run(
            source="warehouse-snapshot",
            inventory={cat: 100 for cat in INVENTORY_CATEGORIES},
            created_at=_EARLY,
        )
        volunteer = _make_run(
            source="volunteer-submit",
            inventory={cat: 50 for cat in INVENTORY_CATEGORIES},
            comparison={"warehouseInventory": {cat: 100 for cat in INVENTORY_CATEGORIES}},
            created_at=_LATE,
        )
        result = resolve_customer_inventory_state(volunteer, warehouse)
        self.assertEqual(result["source"], "volunteer-submit")
        self.assertEqual(result["lastUpdated"], _LATE.isoformat())
        # 50/100 = 0.50 → Mid for all categories
        self.assertTrue(all(v == "Mid" for v in result["levels"].values()))

    def test_volunteer_run_same_time_as_warehouse_is_used(self):
        same_time = datetime(2024, 6, 1, 12, 0, 0)
        warehouse = _make_run(source="warehouse-snapshot", created_at=same_time,
                              inventory={cat: 100 for cat in INVENTORY_CATEGORIES})
        volunteer = _make_run(source="volunteer-submit", created_at=same_time,
                              inventory={cat: 80 for cat in INVENTORY_CATEGORIES},
                              comparison={"warehouseInventory": {cat: 100 for cat in INVENTORY_CATEGORIES}})
        result = resolve_customer_inventory_state(volunteer, warehouse)
        self.assertEqual(result["source"], "volunteer-submit")

    def test_volunteer_run_with_no_warehouse_is_used(self):
        volunteer = _make_run(
            source="volunteer-submit",
            inventory={cat: 10 for cat in INVENTORY_CATEGORIES},
            comparison={},
            created_at=_LATE,
        )
        result = resolve_customer_inventory_state(volunteer, None)
        self.assertEqual(result["source"], "volunteer-submit")
        # No warehouse baseline: all categories fall back to fallback_original_quantities (0)
        # → compute_level_from_quantities(10, 0) → "High"
        self.assertTrue(all(v == "High" for v in result["levels"].values()))

    # --- Warehouse fallback path ---

    def test_older_volunteer_run_uses_warehouse_snapshot(self):
        warehouse = _make_run(
            source="warehouse-snapshot",
            inventory={cat: 100 for cat in INVENTORY_CATEGORIES},
            created_at=_LATE,
        )
        volunteer = _make_run(
            source="volunteer-submit",
            inventory={cat: 50 for cat in INVENTORY_CATEGORIES},
            created_at=_EARLY,
        )
        result = resolve_customer_inventory_state(volunteer, warehouse)
        self.assertEqual(result["source"], "warehouse-snapshot")
        # All non-zero baseline categories → High
        self.assertTrue(all(v == "High" for v in result["levels"].values()))

    def test_warehouse_only_gives_all_high(self):
        warehouse = _make_run(
            source="warehouse-snapshot",
            inventory={cat: 100 for cat in INVENTORY_CATEGORIES},
            created_at=_LATE,
        )
        result = resolve_customer_inventory_state(None, warehouse)
        self.assertEqual(result["source"], "warehouse-snapshot")
        self.assertTrue(all(v == "High" for v in result["levels"].values()))

    def test_warehouse_with_zero_inventory_gives_all_out(self):
        warehouse = _make_run(
            source="warehouse-snapshot",
            inventory={cat: 0 for cat in INVENTORY_CATEGORIES},
            created_at=_LATE,
        )
        result = resolve_customer_inventory_state(None, warehouse)
        self.assertTrue(all(v == "Out" for v in result["levels"].values()))

    # --- Output shape ---

    def test_result_always_has_required_keys(self):
        result = resolve_customer_inventory_state(None, None)
        for key in ("source", "lastUpdated", "levels", "originalQuantities", "currentInventory"):
            self.assertIn(key, result)

    def test_result_levels_has_all_19_categories(self):
        result = resolve_customer_inventory_state(None, None)
        self.assertEqual(set(result["levels"].keys()), set(INVENTORY_CATEGORIES))

    def test_comparison_warehouse_inventory_used_as_baseline(self):
        """The run's embedded warehouseInventory takes precedence over standalone run."""
        embedded_wh = {cat: 200 for cat in INVENTORY_CATEGORIES}
        standalone_wh = {cat: 100 for cat in INVENTORY_CATEGORIES}

        warehouse = _make_run(
            source="warehouse-snapshot",
            inventory=standalone_wh,
            created_at=_EARLY,
        )
        volunteer = _make_run(
            source="volunteer-submit",
            inventory={cat: 100 for cat in INVENTORY_CATEGORIES},
            comparison={"warehouseInventory": embedded_wh},
            created_at=_LATE,
        )
        result = resolve_customer_inventory_state(volunteer, warehouse)
        # 100 / 200 = 0.50 → Mid (uses embedded warehouse, not standalone)
        self.assertTrue(all(v == "Mid" for v in result["levels"].values()))


if __name__ == "__main__":
    unittest.main()
