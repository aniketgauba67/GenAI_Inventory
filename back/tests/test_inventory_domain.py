"""Tests for shared inventory domain utilities."""

import unittest

from back.inventory_domain import (
    INVENTORY_CATEGORIES,
    compute_level_from_quantities,
    compute_ratios_and_levels,
    normalize_inventory,
    summarize_levels,
    validate_inventory,
)


class TestInventoryDomain(unittest.TestCase):
    def test_inventory_categories_are_fixed_to_19(self) -> None:
        self.assertEqual(len(INVENTORY_CATEGORIES), 19)
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

    def test_normalize_inventory_fills_missing_and_drops_unknown(self) -> None:
        normalized = normalize_inventory(
            {
                "Cereal": 10,
                "Juices": "5",
                "Unknown": 999,
            }
        )

        self.assertEqual(list(normalized.keys()), INVENTORY_CATEGORIES)
        self.assertEqual(normalized["Cereal"], 10)
        self.assertEqual(normalized["Juices"], 5)
        self.assertEqual(normalized["Beverages"], 0)
        self.assertNotIn("Unknown", normalized)

    def test_validate_inventory_rejects_negative_values(self) -> None:
        ok, error = validate_inventory({"Cereal": -1})
        self.assertFalse(ok)
        self.assertEqual(error, "Negative value for Cereal")

    def test_validate_inventory_rejects_non_integer_values(self) -> None:
        ok, error = validate_inventory({"Cereal": 1.5})
        self.assertFalse(ok)
        self.assertEqual(error, "Non-integer value for Cereal")

    def test_validate_inventory_accepts_missing_and_unknown_categories(self) -> None:
        ok, error = validate_inventory({"Unknown": 5, "Cereal": 7})
        self.assertTrue(ok)
        self.assertIsNone(error)

    def test_compute_ratios_and_levels_boundary_thresholds(self) -> None:
        ratios, levels = compute_ratios_and_levels(
            {
                "Cereal": 7,
                "Juices": 3,
                "Beverages": 8,
                "Breakfast": 4,
            },
            {
                "Cereal": 10,
                "Juices": 10,
                "Beverages": 10,
                "Breakfast": 10,
            },
        )

        self.assertEqual(ratios["Cereal"], 0.7)
        self.assertEqual(levels["Cereal"], "Mid")
        self.assertEqual(ratios["Juices"], 0.3)
        self.assertEqual(levels["Juices"], "Low")
        self.assertEqual(ratios["Beverages"], 0.8)
        self.assertEqual(levels["Beverages"], "High")
        self.assertEqual(ratios["Breakfast"], 0.4)
        self.assertEqual(levels["Breakfast"], "Mid")

    def test_compute_ratios_and_levels_handles_zero_previous_inventory(self) -> None:
        ratios, levels = compute_ratios_and_levels(
            {"Cereal": 5, "Juices": 0},
            {"Cereal": 0, "Juices": 0},
        )

        self.assertEqual(ratios["Cereal"], 1.0)
        self.assertEqual(levels["Cereal"], "High")
        self.assertEqual(ratios["Juices"], 0.0)
        self.assertEqual(levels["Juices"], "Out")

    def test_compute_level_from_quantities_matches_thresholds(self) -> None:
        self.assertEqual(compute_level_from_quantities(0, 10), "Out")
        self.assertEqual(compute_level_from_quantities(8, 10), "High")
        self.assertEqual(compute_level_from_quantities(4, 10), "Mid")
        self.assertEqual(compute_level_from_quantities(3, 10), "Low")
        self.assertEqual(compute_level_from_quantities(5, 0), "High")

    def test_summarize_levels_counts_expected_values(self) -> None:
        summary = summarize_levels(
            {
                "Cereal": "High",
                "Juices": "Mid",
                "Beverages": "Low",
                "Breakfast": "Out",
            }
        )

        self.assertEqual(summary, {"High": 1, "Mid": 1, "Low": 1, "Out": 1})


if __name__ == "__main__":
    unittest.main()
