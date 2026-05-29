"""Seed mock inventory quantities and recent runs for local testing."""

import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from db.database import SessionLocal
from db.models import InventoryItem, InventoryRun, Pantry

CATEGORIES = [
    "Beverages", "Juices", "Cereal", "Breakfast", "Meat", "Fish",
    "Poultry", "Frozen", "Vegetables", "Fruits", "Nuts", "Soup",
    "Grains", "Pasta", "Snacks", "Spices", "Sauces", "Condiments",
    "Misc Products",
]

PANTRY_PROFILES = {
    # pantry_id: (min_qty, max_qty)  — simulates well-stocked vs. low pantries
    1:  (60, 120),
    2:  (40, 90),
    3:  (10, 50),
    4:  (70, 130),
    5:  (5,  30),
    6:  (50, 100),
    7:  (20, 80),
    8:  (80, 150),
}

def status_from_qty(qty, original):
    if qty <= 0:
        return "Out"
    ratio = qty / original
    if ratio < 0.30:
        return "Low"
    if ratio < 0.70:
        return "Mid"
    return "High"


def seed(session):
    pantries = session.query(Pantry).all()
    print(f"Found {len(pantries)} pantries.")

    for pantry in pantries:
        lo, hi = PANTRY_PROFILES.get(pantry.id, (20, 80))

        # --- Update or create inventory_items ---
        existing = {item.category_name: item for item in pantry.items}
        for cat in CATEGORIES:
            original = random.randint(lo, hi)
            current  = random.randint(0, original)
            st = status_from_qty(current, original)

            if cat in existing:
                item = existing[cat]
                item.original_quantity = original
                item.status = st
                item.updated_at = datetime.utcnow()
            else:
                session.add(InventoryItem(
                    pantry_id=pantry.id,
                    category_name=cat,
                    original_quantity=original,
                    status=st,
                ))

        # --- Add 1–3 recent inventory runs ---
        run_count = random.randint(1, 3)
        for i in range(run_count):
            days_ago = random.randint(1, 14)
            ts = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 8))

            inventory_snapshot = {}
            levels = {}
            for cat in CATEGORIES:
                original = random.randint(lo, hi)
                current  = random.randint(0, original)
                inventory_snapshot[cat] = current
                levels[cat] = status_from_qty(current, original)

            high = sum(1 for l in levels.values() if l == "High")
            mid  = sum(1 for l in levels.values() if l == "Mid")
            low  = sum(1 for l in levels.values() if l == "Low")
            out  = sum(1 for l in levels.values() if l == "Out")

            session.add(InventoryRun(
                run_id=str(uuid4()),
                pantry_id=pantry.id,
                created_at=ts,
                source="volunteer-submit",
                files=[],
                inventory=inventory_snapshot,
                comparison={
                    "pantryId": str(pantry.id),
                    "levels": levels,
                    "summaryCounts": {"High": high, "Mid": mid, "Low": low, "Out": out},
                    "source": "volunteer-submit",
                },
            ))

        print(f"  Pantry {pantry.id}: {pantry.name} — seeded {run_count} run(s)")

    session.commit()
    print("\nDone. Mock data committed.")


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
