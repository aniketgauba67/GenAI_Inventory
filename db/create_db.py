import os
from dotenv import load_dotenv
from sqlalchemy import text
from database import engine, init_db
from models import InventoryItem, Pantry, InventoryRun  # noqa: F401

load_dotenv()

try:
    print("✓ Initializing database with SQLAlchemy...")
     
    #init_db() # Uncomment to reset database (drops all tables and recreates them), use with caution due to potential monetary costs

    print("✓ Database tables created successfully!")
    
    # Test connection
    with engine.connect() as connection:
        result = connection.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';"))
        print(f"✓ Connected: {result.fetchall()}")
        print("Column names in all pantries table:")
        result = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'pantries';"))
        print(f"✓ Columns: {result.fetchall()}")
        print("Column names in all inventory_items table:")
        result = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_items';"))
        print(f"✓ Columns: {result.fetchall()}")
        print("Column names in all inventory_runs table:")
        result = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_runs';"))
        print(f"✓ Columns: {result.fetchall()}")

except Exception as e:
    print(f"✗ Database error: {e}")
    raise
    
