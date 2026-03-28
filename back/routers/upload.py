import logging
import sys
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile

ROOT_DIR = Path(__file__).resolve().parents[2]
DB_DIR = ROOT_DIR / "db"
if str(DB_DIR) not in sys.path:
    sys.path.insert(0, str(DB_DIR))

from database import SessionLocal  # noqa: E402
from models import InventoryItem, Pantry  # noqa: E402

try:
    from .review import save_inventory_draft
    from ..inventory_domain import INVENTORY_CATEGORIES, resolve_pantry
    from ..services.gemini import call_gemini_inventory_images
except ImportError:
    from routers.review import save_inventory_draft
    from inventory_domain import INVENTORY_CATEGORIES, resolve_pantry
    from services.gemini import call_gemini_inventory_images

log = logging.getLogger(__name__)

router = APIRouter(tags=["upload"])


@router.get("/")
def root():
    return {"status": "ok"}


@router.get("/categories")
def categories():
    return {"categories": INVENTORY_CATEGORIES}


@router.post("/upload")
async def upload_images(
    files: list[UploadFile] = File(..., description="Image files"),
    pantry_id: str | None = Form(default=None),
):
    if not files:
        log.warning("Upload called with no files")
        return {"ok": False, "error": "No files provided"}
    if pantry_id is not None and str(pantry_id).strip().lower() == "director":
        return {"ok": False, "error": "Director must choose a real pantry ID before upload."}
    
    results = []
    image_parts: list[tuple[bytes, str]] = []

    for file_obj in files:
        content_type = file_obj.content_type or ""
        if not content_type.startswith("image/"):
            results.append({"filename": file_obj.filename, "ok": False, "error": "Not an image"})
            continue
        body = await file_obj.read()
        log.info("Received: %s (%s bytes)", file_obj.filename, len(body))
        image_parts.append((body, content_type))
        results.append({
            "filename": file_obj.filename,
            "content_type": content_type,
            "size_bytes": len(body),
            "ok": True,
        })

    max_quantities: dict[str, int] | None = None
    if pantry_id is not None and image_parts:
        db = SessionLocal()
        try:
            pantry = resolve_pantry(db, Pantry, pantry_id)
            if pantry is not None:
                items = (
                    db.query(InventoryItem)
                    .filter(InventoryItem.pantry_id == pantry.id)
                    .all()
                )
                if items:
                    max_quantities = {item.category_name: item.original_quantity for item in items}
                    log.info("Loaded original_quantity for %s categories (pantry %s)", len(items), pantry_id)
                    print(f"[DEBUG] max_quantities passed to Gemini: {max_quantities}")
        except Exception:
            log.exception("Could not load max_quantities from DB; proceeding without hint")
        finally:
            db.close()

    inventory: dict[str, int] | None = None
    if image_parts:
        log.info("Calling Gemini with %s image(s) in one request", len(image_parts))
        inventory = call_gemini_inventory_images(image_parts, max_quantities=max_quantities)
    log.info("Upload done: %s file(s) received", len(results))
    out = {"ok": True, "count": len(results), "files": results}
    if inventory is not None:
        out["inventory"] = inventory

        if pantry_id is not None:
            save_inventory_draft(pantry_id, inventory, results)
    return out
