import logging
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile

from routers.review import save_inventory_draft
from schemas import INVENTORY_CATEGORIES
from services.gemini import call_gemini_inventory

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
    
    results = []
    
    inventory: dict[str,int] | None = None
    for file_obj in files:
        content_type = file_obj.content_type or ""
        if not content_type.startswith("image/"):
            results.append({"filename": file_obj.filename, "ok": False, "error": "Not an image"})
            continue
        body = await file_obj.read()
        log.info("Received: %s (%s bytes)", file_obj.filename, len(body))
        if inventory is None:
            inventory = call_gemini_inventory(body, content_type)
        results.append({
            "filename": file_obj.filename,
            "content_type": content_type,
            "size_bytes": len(body),
            "ok": True,
        })
    log.info("Upload done: %s file(s) received", len(results))
    out: dict[str, Any] = {"ok": True, "count": len(results), "files": results}
    if inventory is not None:
        out["inventory"] = inventory
    
        if pantry_id is not None and inventory is not None:
            save_inventory_draft(pantry_id, inventory)
    return out
