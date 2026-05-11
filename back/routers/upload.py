"""******************************* upload.py ***************************************
 *
 *  Module: Image Upload Router
 *
 *  This module accepts shelf images, sends them to Gemini, and stores
 *  detected inventory.
 *
 *  The module provides:
 *
 *  - upload health and category endpoints.
 *  - image MIME validation and upload metadata.
 *  - Gemini inventory extraction and draft persistence for review.
 *
 *  Key Structures Used:
 *
 *  - FastAPI file uploads, Gemini image payloads, pantry inventory database
 *  records.
 *
 *  This module ensures:
 *
 *  - non-image uploads are rejected before AI processing.
 *  - volunteer uploads are tied to a real pantry before review.
 *
 *  Editors: Aniket, Dipanker, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

import logging

from fastapi import APIRouter, File, Form, UploadFile

from back.inventory_domain import INVENTORY_CATEGORIES, resolve_pantry
from back.routers.review import save_inventory_draft
from back.services.gemini import call_gemini_inventory_images
from db.database import SessionLocal
from db.models import InventoryItem, Pantry

log = logging.getLogger(__name__)

router = APIRouter(tags=["upload"])


def _combine_inventory_results(
    inventories: list[dict],
    max_quantities: dict[str, int] | None = None,
) -> dict[str, int]:
    """Sum one-image Gemini results into the same fixed category schema."""
    totals = {category: 0 for category in INVENTORY_CATEGORIES}
    for inventory in inventories:
        for category in INVENTORY_CATEGORIES:
            try:
                totals[category] += max(0, int(inventory.get(category, 0)))
            except (TypeError, ValueError):
                continue

    if max_quantities:
        for category, max_quantity in max_quantities.items():
            if category in totals and max_quantity > 0:
                totals[category] = min(totals[category], max_quantity)
    return totals


def _detect_inventory_with_retry(
    image_parts: list[tuple[bytes, str]],
    max_quantities: dict[str, int] | None = None,
) -> dict | None:
    """Detect inventory, retrying per-image when a multi-image AI call fails."""
    inventory = call_gemini_inventory_images(image_parts, max_quantities=max_quantities)
    if inventory is not None or len(image_parts) <= 1:
        return inventory

    log.warning("Multi-image Gemini detection failed; retrying images individually")
    individual_results: list[dict] = []
    for index, image_part in enumerate(image_parts, start=1):
        result = call_gemini_inventory_images([image_part], max_quantities=max_quantities)
        if result is None:
            log.warning("Individual Gemini retry failed for image %s", index)
            continue
        individual_results.append(result)

    if not individual_results:
        return None
    return _combine_inventory_results(individual_results, max_quantities=max_quantities)


@router.get("/")
def root():
    """Return a small health response for the upload router.

    Parameters:
        None.

    Returns:
        A JSON object confirming the upload router is reachable.
    """
    return {"status": "ok"}


@router.get("/categories")
def categories():
    """Return the fixed inventory categories used by upload and review screens.

    Parameters:
        None.

    Returns:
        A JSON object containing the shared inventory category list.
    """
    return {"categories": INVENTORY_CATEGORIES}


@router.post("/upload")
async def upload_images(
    files: list[UploadFile] = File(..., description="Image files"),
    pantry_id: str | None = Form(default=None),
):
    """Process uploaded shelf images and persist the detected inventory draft.

    Parameters:
        files: Image files selected by the volunteer upload workflow.
        pantry_id: Pantry identifier used to scope database hints and review
        drafts.

    Returns:
        A JSON response containing upload metadata and detected inventory, or a
        user-facing error when validation or detection fails.
    """
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

    if not image_parts:
        log.warning("Upload contained no valid image files")
        return {
            "ok": False,
            "error": "No valid image files were provided.",
            "count": len(results),
            "files": results,
        }

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
                    log.debug("max_quantities passed to Gemini: %s", max_quantities)
        except Exception:
            log.exception("Could not load max_quantities from DB; proceeding without hint")
        finally:
            db.close()

    inventory: dict[str, int] | None = None
    if image_parts:
        log.info("Calling Gemini with %s image(s) in one request", len(image_parts))
        inventory = _detect_inventory_with_retry(image_parts, max_quantities=max_quantities)
    log.info("Upload done: %s file(s) received", len(results))

    if inventory is None:
        log.warning("Inventory detection returned no result")
        return {
            "ok": False,
            "error": "Could not detect inventory from the uploaded image(s). Try a clearer shelf photo.",
            "count": len(results),
            "files": results,
        }

    out = {"ok": True, "count": len(results), "files": results}
    out["inventory"] = inventory

    if pantry_id is not None:
        save_inventory_draft(pantry_id, inventory, results)
    return out
