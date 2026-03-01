import os
from dotenv import load_dotenv
from sqlalchemy import text
from database import engine, init_db

load_dotenv()

try:
    print("✓ Initializing database with SQLAlchemy...")
     
    #init_db() # Uncomment to reset database (drops all tables and recreates them), use with caution due to potential monetary costs

    print("✓ Database tables created successfully!")
    
    # Test connection
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version();"))
        print(f"✓ Connected: {result.scalar()}")
        
except Exception as e:
    print(f"✗ Database error: {e}")
    raise
    
