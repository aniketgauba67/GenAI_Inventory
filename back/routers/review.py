"""******************************* review.py ***************************************
 *
 *  Module: Review Router
 *
 *  This module returns the latest inventory draft for staff review.
 *
 *  The module provides:
 *
 *  - in-memory draft storage by pantry ID.
 *  - draft retrieval for the volunteer review screen.
 *
 *  Key Structures Used:
 *
 *  - draft dictionaries keyed by pantry identifier.
 *
 *  This module ensures:
 *
 *  - review pages can fetch the latest detection result after upload.
 *  - director sessions cannot submit inventory without selecting a pantry.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

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
    """Return the most recent unsaved inventory draft for one pantry.

    Parameters:
        pantry_id: Pantry identifier whose latest upload draft should be read.

    Returns:
        A JSON response containing the draft inventory, or an error when no
        draft exists for the pantry.
    """
    if str(pantry_id).strip().lower() == "director":
        return {"ok": False, "error": "Director must choose a real pantry ID first."}
    draft = LATEST_DRAFTS.get(pantry_id)
    if draft is None:
        return {
            "ok": False,
            "error": "No draft inventory found for this pantry. Upload photos first.",
        }
    return {"ok": True, "draft": draft}
