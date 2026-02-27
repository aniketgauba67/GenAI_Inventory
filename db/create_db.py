import os
from dotenv import load_dotenv
from sqlalchemy import text
from database import engine, init_db
from models import Pantry, InventoryItem

load_dotenv()

try:
    print("✓ Initializing database with SQLAlchemy...")
    init_db()
    print("✓ Database tables created successfully!")
    
    # Test connection
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        print(f"✓ Connected: {result.scalar()}")
        
except Exception as e:
    print(f"✗ Database error: {e}")
    raise
    
