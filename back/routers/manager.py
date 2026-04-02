import logging
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, UploadFile, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Pantry, InventoryItem, InventoryRun
from inventory_domain import accumulate_inventory_totals, resolve_pantry, normalize_inventory
from schemas import INVENTORY_CATEGORIES

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

try:
    from ..services.gemini import call_gemini_order_form
    from ..aws_persistence import persist_inventory_run
except ImportError:
    from services.gemini import call_gemini_order_form
    from aws_persistence import persist_inventory_run

log = logging.getLogger(__name__)

router = APIRouter(prefix="/manager", tags=["manager"])


def _load_latest_volunteer_run(db: Session, pantry_id: int) -> InventoryRun | None:
    """Return the latest volunteer-submitted current inventory for a pantry."""
    return (
        db.query(InventoryRun)
        .filter(InventoryRun.pantry_id == pantry_id)
        .filter(InventoryRun.source == "volunteer-submit")
        .order_by(InventoryRun.created_at.desc())
        .first()
    )


@router.post("/order-form")
async def upload_order_form(
    files: list[UploadFile] = File(..., description="Order form image(s)"),
):
    if not files:
        log.warning("Order form upload called with no files")
        return {"ok": False, "error": "No files provided"}
    results = []
    # Aggregate totals across all uploaded pages.
    inventory_totals = {category: 0 for category in INVENTORY_CATEGORIES}
    page_inventories: list[dict[str, int]] = []
    for f in files:
        content_type = f.content_type or ""
        if not content_type.startswith("image/"):
            results.append({"filename": f.filename, "ok": False, "error": "Not an image"})
            continue
        body = await f.read()
        log.info("Order form received: %s (%s bytes)", f.filename, len(body))
        page_inventory = call_gemini_order_form(body, content_type)
        if page_inventory is not None:
            normalized_page = normalize_inventory(page_inventory)
            page_inventories.append(normalized_page)
            accumulate_inventory_totals(inventory_totals, normalized_page)
        results.append({
            "filename": f.filename,
            "content_type": content_type,
            "size_bytes": len(body),
            "ok": True,
        })
    out = {"ok": True, "count": len(results), "files": results}
    # Return aggregated totals so manager review starts from the combined baseline.
    out["inventory"] = inventory_totals
    if page_inventories:
        out["pageInventories"] = page_inventories
    return out


@router.post("/inventory/{pantry_id}")
async def update_baseline_inventory(
    pantry_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    """
    Update the 'original_quantity' (baseline) for all categories in a pantry.
    Payload expected: { "inventory": { "Category": quantity, ... } }
    """
    if pantry_id.strip().lower() == "director":
        return {"ok": False, "error": "Director must choose a real pantry ID before baseline update."}

    # 1. Resolve pantry
    pantry = resolve_pantry(db, Pantry, pantry_id)
    if not pantry:
        # If numeric ID not found, return error
        if pantry_id.isdigit():
             return {"ok": False, "error": f"Pantry ID {pantry_id} not found"}
        
        # If string name (e.g. 'MyPantry'), create it
        log.info("Creating new pantry with name: %s", pantry_id)
        pantry = Pantry(name=pantry_id)
        db.add(pantry)
        db.commit()
        db.refresh(pantry)

    # 2. Extract inventory data
    inventory_data = payload.get("inventory")
    if not inventory_data:
        return {"ok": False, "error": "Missing inventory data"}

    normalized_manager_inventory = normalize_inventory(inventory_data)
    latest_volunteer_run = _load_latest_volunteer_run(db, pantry.id)
    previous_current_inventory = (
        normalize_inventory(latest_volunteer_run.inventory)
        if latest_volunteer_run is not None and isinstance(latest_volunteer_run.inventory, dict)
        else {category: 0 for category in INVENTORY_CATEGORIES}
    )
    combined_baseline_inventory = {
        category: previous_current_inventory[category] + normalized_manager_inventory[category]
        for category in INVENTORY_CATEGORIES
    }

    # 3. Upsert items
    for category in INVENTORY_CATEGORIES:
        # If category is not in payload, default to 0 or skip?
        # Let's update only if present, or assume complete update.
        # Given the UI sends all categories, we can update all.
        qty_val = combined_baseline_inventory[category]

        # Find existing item
        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.pantry_id == pantry.id, InventoryItem.category_name == category)
            .first()
        )
        if item:
            item.original_quantity = qty_val
            item.status = "Out" if qty_val <= 0 else "High"
        else:
            item = InventoryItem(
                pantry_id=pantry.id,
                category_name=category,
                original_quantity=qty_val,
                status="Out" if qty_val <= 0 else "High"
            )
            db.add(item)
    
    
    try:
        db.commit()
        log.info("Updated baseline for pantry %s (ID: %s)", pantry.name, pantry.id)
    except Exception as e:
        db.rollback()
        log.error("Error updating inventory_items: %s", e)
        return {"ok": False, "error": str(e)}

    # Also save as warehouse-snapshot in inventory_runs so volunteer submit can find it
    try:
        run_record = {
            "pk": str(uuid4()),
            "pantryId": pantry.id,
            "createdAt": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
            "files": [],
            "inventory": combined_baseline_inventory,
            "comparison": {
                "pantryId": str(pantry.id),
                "note": "Baseline set from manager order form plus latest volunteer-submitted current inventory.",
                "managerInventory": normalized_manager_inventory,
                "previousCurrentInventory": previous_current_inventory,
            },
            "source": "warehouse-snapshot",
        }
        run_id = persist_inventory_run(run_record)
        log.info("Saved warehouse-snapshot run %s for pantry %s", run_id, pantry.id)
    except Exception as e:
        log.error("Error saving warehouse-snapshot run: %s", e)
        return {"ok": False, "error": f"Baseline saved to items table but failed to write run: {e}"}

    return {
        "ok": True,
        "pantry_id": pantry.id,
        "message": "Baseline inventory updated",
        "inventory": combined_baseline_inventory,
    }
