"""******************************* create_db.py ***************************************
 *
 *  Module: Create Db
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

import os
from dotenv import load_dotenv
from sqlalchemy import text
from db.database import engine, init_db
from db.models import DirectorCredentials, InventoryItem, InventoryRun, LoginCredentials, Pantry # noqa: F401

load_dotenv()

try:
    print("✓ Initializing database with SQLAlchemy...")

    init_db() # Uncomment to reset database (drops all tables and recreates them), use with caution due to potential monetary costs

    print("✓ Database tables created successfully!")
    
    # Test connection
    with engine.connect() as connection:
        result = connection.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';"))
        print("✓ Connected to database.")

except Exception as e:
    print(f"✗ Database error: {e}")
    raise
    
