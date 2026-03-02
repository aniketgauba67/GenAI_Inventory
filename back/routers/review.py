from typing import Any

from fastapi import APIRouter

router = APIRouter(tags=["review"])

# Lightweight backend draft store for volunteer review flow.
# Keyed by pantry ID so review page can fetch latest detection from backend.
LATEST_DRAFTS: dict[str, dict[str, Any]] = {}


def save_inventory_draft(
    pantry_id: str,
    inventory: dict[str, int],
    files: list[dict[str, Any]],
) -> None:
    """Persist latest detection draft in memory for a pantry."""
    LATEST_DRAFTS[pantry_id] = {
        "pantryId": pantry_id,
        "inventory": inventory,
        "files": [entry for entry in files if entry.get("ok")],
    }


@router.get("/inventory/draft/{pantry_id}")
def get_latest_inventory_draft(pantry_id: str):
    draft = LATEST_DRAFTS.get(pantry_id)
    if draft is None:
        return {
            "ok": False,
            "error": "No draft inventory found for this pantry. Upload photos first.",
        }
    return {"ok": True, "draft": draft}
