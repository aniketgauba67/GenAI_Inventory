"""******************************* test_inventory_domain_extended.py ***************************************
 *
 *  Module: Backend Unit Test Inventory Domain Extended Test
 *
 *  This module defines automated backend checks for backend unit test inventory domain extended test.
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

import unittest

import pytest

from back.inventory_domain import (
    INVENTORY_CATEGORIES,
    accumulate_inventory_totals,
    compute_level_from_quantities,
    compute_ratios_and_levels,
    normalize_inventory,
    summarize_levels,
    validate_inventory,
)


class TestInventoryCategories(unittest.TestCase):

    def test_inventory_categories_are_fixed_to_expected_order(self):
        self.assertEqual(
            INVENTORY_CATEGORIES,
            [
                "Beverages",
                "Juices",
                "Cereal",
                "Breakfast",
                "Meat",
                "Fish",
                "Poultry",
                "Frozen",
                "Vegetables",
                "Fruits",
                "Nuts",
                "Soup",
                "Grains",
                "Pasta",
                "Snacks",
                "Spices",
                "Sauces",
                "Condiments",
                "Misc Products",
            ],
        )


# ── normalize_inventory ──────────────────────────────────────────────────────

class TestNormalizeInventory(unittest.TestCase):

    def test_none_input_returns_all_zeros(self):
        result = normalize_inventory(None)
        self.assertEqual(list(result.keys()), INVENTORY_CATEGORIES)
        self.assertTrue(all(v == 0 for v in result.values()))

    def test_empty_dict_returns_all_zeros(self):
        result = normalize_inventory({})
        self.assertEqual(sum(result.values()), 0)

    def test_string_numeric_values_are_coerced(self):
        result = normalize_inventory({"Beverages": "42", "Soup": "0"})
        self.assertEqual(result["Beverages"], 42)
        self.assertEqual(result["Soup"], 0)

    def test_float_that_is_whole_number_coerces_to_int(self):
        result = normalize_inventory({"Beverages": 5.0})
        self.assertEqual(result["Beverages"], 5)
        self.assertIsInstance(result["Beverages"], int)

    def test_none_value_for_known_category_defaults_to_zero(self):
        result = normalize_inventory({"Beverages": None})
        self.assertEqual(result["Beverages"], 0)

    def test_unknown_categories_are_excluded(self):
        result = normalize_inventory({"UnknownCat": 99, "Beverages": 5})
        self.assertNotIn("UnknownCat", result)
        self.assertEqual(result["Beverages"], 5)

    def test_output_always_has_exactly_19_keys(self):
        for input_size in [0, 1, 5, 19, 25]:
            inventory = {cat: i for i, cat in enumerate(INVENTORY_CATEGORIES[:input_size])}
            result = normalize_inventory(inventory)
            self.assertEqual(len(result), 19)

    def test_key_order_matches_category_order(self):
        result = normalize_inventory({"Soup": 1, "Beverages": 2})
        self.assertEqual(list(result.keys()), INVENTORY_CATEGORIES)

    def test_large_values_are_preserved(self):
        result = normalize_inventory({"Meat": 999_999})
        self.assertEqual(result["Meat"], 999_999)


# ── accumulate_inventory_totals ──────────────────────────────────────────────

class TestAccumulateInventoryTotals(unittest.TestCase):

    def test_accumulate_adds_values(self):
        totals = {cat: 0 for cat in INVENTORY_CATEGORIES}
        totals = accumulate_inventory_totals(totals, {"Beverages": 10, "Soup": 5})
        totals = accumulate_inventory_totals(totals, {"Beverages": 3, "Meat": 7})
        self.assertEqual(totals["Beverages"], 13)
        self.assertEqual(totals["Soup"], 5)
        self.assertEqual(totals["Meat"], 7)

    def test_accumulate_with_none_page_adds_zeros(self):
        totals = {cat: 10 for cat in INVENTORY_CATEGORIES}
        result = accumulate_inventory_totals(totals, None)
        self.assertTrue(all(v == 10 for v in result.values()))

    def test_accumulate_with_empty_page(self):
        totals = {cat: 5 for cat in INVENTORY_CATEGORIES}
        result = accumulate_inventory_totals(totals, {})
        self.assertTrue(all(v == 5 for v in result.values()))


# ── validate_inventory ───────────────────────────────────────────────────────

class TestValidateInventory(unittest.TestCase):

    def test_valid_all_zeros_passes(self):
        ok, err = validate_inventory({cat: 0 for cat in INVENTORY_CATEGORIES})
        self.assertTrue(ok)
        self.assertIsNone(err)

    def test_valid_large_positive_passes(self):
        ok, err = validate_inventory({"Beverages": 10_000})
        self.assertTrue(ok)

    def test_string_zero_is_valid(self):
        ok, err = validate_inventory({"Beverages": "0"})
        self.assertTrue(ok)

    def test_none_inventory_passes(self):
        ok, err = validate_inventory(None)
        self.assertTrue(ok)

    def test_empty_inventory_passes(self):
        ok, err = validate_inventory({})
        self.assertTrue(ok)

    def test_negative_value_fails(self):
        ok, err = validate_inventory({"Beverages": -1})
        self.assertFalse(ok)
        self.assertIn("Negative", err)

    def test_float_decimal_fails(self):
        ok, err = validate_inventory({"Beverages": 3.7})
        self.assertFalse(ok)
        self.assertIn("Non-integer", err)

    def test_string_non_numeric_fails(self):
        ok, err = validate_inventory({"Beverages": "abc"})
        self.assertFalse(ok)
        self.assertIn("Invalid", err)

    def test_unknown_categories_are_ignored(self):
        ok, err = validate_inventory({"NotACategory": -999})
        self.assertTrue(ok)

    def test_first_failing_category_stops_validation(self):
        ok, err = validate_inventory({"Beverages": -1, "Soup": -2})
        self.assertFalse(ok)
        # Only reports the first bad category
        self.assertIn("Beverages", err)


# ── compute_level_from_quantities ─────────────────────────────────────────────

class TestComputeLevelFromQuantities(unittest.TestCase):

    def test_zero_current_is_out(self):
        self.assertEqual(compute_level_from_quantities(0, 100), "Out")

    def test_negative_current_is_out(self):
        # Should not normally happen but defensiveness is good
        self.assertEqual(compute_level_from_quantities(-5, 100), "Out")

    def test_zero_baseline_with_stock_is_high(self):
        self.assertEqual(compute_level_from_quantities(5, 0), "High")

    def test_zero_baseline_zero_current_is_out(self):
        self.assertEqual(compute_level_from_quantities(0, 0), "Out")

    def test_71_pct_is_high(self):
        self.assertEqual(compute_level_from_quantities(71, 100), "High")

    def test_exactly_70_pct_is_mid(self):
        # ratio = 0.70 — NOT > 0.70 → Mid
        self.assertEqual(compute_level_from_quantities(70, 100), "Mid")

    def test_31_pct_is_mid(self):
        self.assertEqual(compute_level_from_quantities(31, 100), "Mid")

    def test_exactly_30_pct_is_low(self):
        # ratio = 0.30 — NOT > 0.30 → Low
        self.assertEqual(compute_level_from_quantities(30, 100), "Low")

    def test_1_pct_is_low(self):
        self.assertEqual(compute_level_from_quantities(1, 100), "Low")

    def test_equal_quantities_is_high(self):
        self.assertEqual(compute_level_from_quantities(50, 50), "High")

    def test_current_exceeds_baseline_is_high(self):
        self.assertEqual(compute_level_from_quantities(150, 100), "High")


# ── compute_ratios_and_levels ────────────────────────────────────────────────

class TestComputeRatiosAndLevels(unittest.TestCase):

    def test_all_zeros_gives_all_out(self):
        ratios, levels = compute_ratios_and_levels({}, {})
        self.assertTrue(all(v == "Out" for v in levels.values()))
        self.assertTrue(all(v == 0.0 for v in ratios.values()))

    def test_ratios_are_rounded_to_4_dp(self):
        ratios, _ = compute_ratios_and_levels({"Beverages": 1}, {"Beverages": 3})
        self.assertEqual(ratios["Beverages"], 0.3333)

    def test_all_categories_always_present_in_output(self):
        ratios, levels = compute_ratios_and_levels(
            {"Beverages": 5},
            {"Beverages": 10},
        )
        self.assertEqual(set(ratios.keys()), set(INVENTORY_CATEGORIES))
        self.assertEqual(set(levels.keys()), set(INVENTORY_CATEGORIES))

    def test_first_non_zero_reading_with_zero_baseline_gives_ratio_1(self):
        ratios, levels = compute_ratios_and_levels(
            {"Soup": 8}, {"Soup": 0}
        )
        self.assertEqual(ratios["Soup"], 1.0)
        self.assertEqual(levels["Soup"], "High")

    def test_current_zero_baseline_zero_gives_ratio_0(self):
        ratios, levels = compute_ratios_and_levels(
            {"Soup": 0}, {"Soup": 0}
        )
        self.assertEqual(ratios["Soup"], 0.0)
        self.assertEqual(levels["Soup"], "Out")

    def test_level_boundaries_exact(self):
        """Confirm exact 0.30 and 0.70 boundaries."""
        _, levels = compute_ratios_and_levels(
            {"Beverages": 30, "Juices": 70, "Cereal": 29, "Breakfast": 71},
            {"Beverages": 100, "Juices": 100, "Cereal": 100, "Breakfast": 100},
        )
        self.assertEqual(levels["Beverages"], "Low")   # 0.30 not > 0.30
        self.assertEqual(levels["Juices"], "Mid")      # 0.70 not > 0.70
        self.assertEqual(levels["Cereal"], "Low")      # 0.29 < 0.30
        self.assertEqual(levels["Breakfast"], "High")  # 0.71 > 0.70


# ── summarize_levels ──────────────────────────────────────────────────────────

class TestSummarizeLevels(unittest.TestCase):

    def test_all_high(self):
        levels = {cat: "High" for cat in INVENTORY_CATEGORIES}
        summary = summarize_levels(levels)
        self.assertEqual(summary["High"], 19)
        self.assertEqual(summary["Mid"] + summary["Low"] + summary["Out"], 0)

    def test_all_out(self):
        levels = {cat: "Out" for cat in INVENTORY_CATEGORIES}
        summary = summarize_levels(levels)
        self.assertEqual(summary["Out"], 19)

    def test_empty_levels(self):
        summary = summarize_levels({})
        self.assertEqual(summary, {"High": 0, "Mid": 0, "Low": 0, "Out": 0})

    def test_unknown_level_strings_are_ignored(self):
        summary = summarize_levels({"Beverages": "Unknown", "Soup": "High"})
        self.assertEqual(summary["High"], 1)

    def test_mixed_levels(self):
        levels = {
            "Beverages": "High",
            "Juices": "High",
            "Cereal": "Mid",
            "Breakfast": "Low",
            "Meat": "Out",
        }
        summary = summarize_levels(levels)
        self.assertEqual(summary["High"], 2)
        self.assertEqual(summary["Mid"], 1)
        self.assertEqual(summary["Low"], 1)
        self.assertEqual(summary["Out"], 1)


if __name__ == "__main__":
    unittest.main()
