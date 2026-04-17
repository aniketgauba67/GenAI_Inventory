from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
import unittest

from back.customer_inventory_state import resolve_customer_inventory_state


@dataclass
class FakeRun:
    created_at: datetime
    inventory: dict
    comparison: dict | None = None


class CustomerInventoryStateTests(unittest.TestCase):
    def test_prefers_latest_volunteer_submit_when_newer_than_warehouse(self) -> None:
        warehouse_run = FakeRun(
            created_at=datetime(2026, 4, 17, 9, 0, 0),
            inventory={"Beverages": 30},
        )
        volunteer_run = FakeRun(
            created_at=warehouse_run.created_at + timedelta(hours=2),
            inventory={"Beverages": 0},
            comparison={"warehouseInventory": {"Beverages": 30}},
        )

        resolved = resolve_customer_inventory_state(
            volunteer_run,
            warehouse_run,
            fallback_original_quantities={"Beverages": 5},
        )

        self.assertEqual(resolved["source"], "volunteer-submit")
        self.assertEqual(resolved["currentInventory"]["Beverages"], 0)
        self.assertEqual(resolved["originalQuantities"]["Beverages"], 30)
        self.assertEqual(resolved["levels"]["Beverages"], "Out")

    def test_falls_back_to_latest_warehouse_when_no_newer_volunteer_submit_exists(self) -> None:
        warehouse_run = FakeRun(
            created_at=datetime(2026, 4, 17, 11, 0, 0),
            inventory={"Beverages": 39},
        )
        volunteer_run = FakeRun(
            created_at=warehouse_run.created_at - timedelta(days=1),
            inventory={"Beverages": 5},
            comparison={"warehouseInventory": {"Beverages": 20}},
        )

        resolved = resolve_customer_inventory_state(
            volunteer_run,
            warehouse_run,
            fallback_original_quantities={"Beverages": 10},
        )

        self.assertEqual(resolved["source"], "warehouse-snapshot")
        self.assertEqual(resolved["currentInventory"]["Beverages"], 39)
        self.assertEqual(resolved["originalQuantities"]["Beverages"], 39)
        self.assertEqual(resolved["levels"]["Beverages"], "High")

    def test_prefers_volunteer_submit_when_timestamps_are_equal(self) -> None:
        shared_time = datetime(2026, 4, 17, 11, 0, 0)
        warehouse_run = FakeRun(
            created_at=shared_time,
            inventory={"Beverages": 12},
        )
        volunteer_run = FakeRun(
            created_at=shared_time,
            inventory={"Beverages": 7},
            comparison={"warehouseInventory": {"Beverages": 12}},
        )

        resolved = resolve_customer_inventory_state(volunteer_run, warehouse_run)

        self.assertEqual(resolved["source"], "volunteer-submit")
        self.assertEqual(resolved["currentInventory"]["Beverages"], 7)
        self.assertEqual(resolved["originalQuantities"]["Beverages"], 12)


if __name__ == "__main__":
    unittest.main()
