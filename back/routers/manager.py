import logging

from fastapi import APIRouter, File, UploadFile, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Pantry, InventoryItem
from inventory_domain import resolve_pantry
from schemas import INVENTORY_CATEGORIES

try:
    from ..services.gemini import call_gemini_order_form
except ImportError:
    from services.gemini import call_gemini_order_form

log = logging.getLogger(__name__)

router = APIRouter(prefix="/manager", tags=["manager"])


@router.post("/order-form")
async def upload_order_form(
    files: list[UploadFile] = File(..., description="Order form image(s)"),
):
    if not files:
        log.warning("Order form upload called with no files")
        return {"ok": False, "error": "No files provided"}
    results = []
    inventory = None
    for f in files:
        content_type = f.content_type or ""
        if not content_type.startswith("image/"):
            results.append({"filename": f.filename, "ok": False, "error": "Not an image"})
            continue
        body = await f.read()
        log.info("Order form received: %s (%s bytes)", f.filename, len(body))
        if inventory is None:
            inventory = call_gemini_order_form(body, content_type)
        results.append({
            "filename": f.filename,
            "content_type": content_type,
            "size_bytes": len(body),
            "ok": True,
        })
    out = {"ok": True, "count": len(results), "files": results}
    if inventory is not None:
        out["inventory"] = inventory
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

    # 3. Upsert items
    for category in INVENTORY_CATEGORIES:
        # If category is not in payload, default to 0 or skip?
        # Let's update only if present, or assume complete update.
        # Given the UI sends all categories, we can update all.
        val = inventory_data.get(category)
        if val is None:
            continue
        
        try:
            qty_val = int(val)
        except (ValueError, TypeError):
            continue
        
        # Find existing item
        item = (
            db.query(InventoryItem)
            .filter(InventoryItem.pantry_id == pantry.id, InventoryItem.category_name == category)
            .first()
        )
        if item:
            item.original_quantity = qty_val
        else:
            item = InventoryItem(
                pantry_id=pantry.id,
                category_name=category,
                original_quantity=qty_val,
                status="normal"
            )
            db.add(item)
    
    try:
        db.commit()
        log.info("Updated baseline for pantry %s (ID: %s)", pantry.name, pantry.id)
        return {"ok": True, "pantry_id": pantry.id, "message": "Baseline inventory updated"}
    except Exception as e:
        db.rollback()
        log.error("Error updating baseline: %s", e)
        return {"ok": False, "error": str(e)}
