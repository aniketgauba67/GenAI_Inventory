import logging

from fastapi import APIRouter, File, UploadFile

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
):
    if not files:
        log.warning("Upload called with no files")
        return {"ok": False, "error": "No files provided"}
    results = []
    inventory: dict | None = None
    for f in files:
        content_type = f.content_type or ""
        if not content_type.startswith("image/"):
            results.append({"filename": f.filename, "ok": False, "error": "Not an image"})
            continue
        body = await f.read()
        log.info("Received: %s (%s bytes)", f.filename, len(body))
        if inventory is None:
            inventory = call_gemini_inventory(body, content_type)
        results.append({
            "filename": f.filename,
            "content_type": content_type,
            "size_bytes": len(body),
            "ok": True,
        })
    log.info("Upload done: %s file(s) received", len(results))
    out = {"ok": True, "count": len(results), "files": results}
    if inventory is not None:
        out["inventory"] = inventory
    print(out)
    return out
