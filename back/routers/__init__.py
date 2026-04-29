"""******************************* __init__.py ***************************************
 *
 *  Module: Backend Router
 *
 *  This module defines API endpoints for the GenAI Inventory backend.
 *
 *  The module provides:
 *
 *  - FastAPI route handlers.
 *  - request validation and response shaping.
 *  - service or database calls for one workflow area.
 *
 *  Key Structures Used:
 *
 *  - FastAPI router objects, Pydantic schemas, and SQLAlchemy helpers.
 *
 *  This module ensures:
 *
 *  - frontend API calls have stable backend endpoints.
 *  - route logic remains grouped by workflow.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from back.routers.review import router as review_router
from back.routers.upload import router as upload_router

__all__ = ["upload_router", "review_router"]
