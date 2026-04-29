"""******************************* __init__.py ***************************************
 *
 *  Module: Database Package Marker
 *
 *  This module supports database access for the GenAI Inventory backend.
 *
 *  The module provides:
 *
 *  - SQLAlchemy models, session helpers, or seed utilities.
 *  - database-facing helpers used by backend routes.
 *
 *  Key Structures Used:
 *
 *  - SQLAlchemy engines, sessions, models, and pantry records.
 *
 *  This module ensures:
 *
 *  - database code stays separate from route handlers.
 *  - backend persistence uses a consistent schema.
 *
 *  Editors: Aniket, Dipankar, Liam, Jin, and Philip.
 *
 ****************************************************************************
"""

from db.database import engine, SessionLocal, init_db, Base
from db.models import Pantry, InventoryItem, InventoryRun, LoginCredentials

__all__ = [
	"engine",
	"SessionLocal",
	"init_db",
	"Base",
	"Pantry",
	"InventoryItem",
	"InventoryRun",
]
